"""Billing & subscription routes.

Enables the full paid-product flow:

- ``GET /billing``          -> the user's current plan, limits and monthly usage
- ``POST /billing/checkout``-> Dodo Payments checkout session for a plan (demo
  mode returns an immediate success URL so the whole flow is testable without keys)
- ``POST /billing/portal``  -> Dodo customer portal (manage / cancel)
- ``POST /billing/webhook`` -> Dodo subscription events -> plan changes
- ``POST /billing/demo/activate`` -> demo-mode plan upgrade/extension

Dodo Payments is the merchant of record: hosted checkout collects the payment
and handles tax, the customer portal manages subscriptions, and webhooks are
verified against the Standard Webhooks signature before they touch any plan.

All Dodo interactions are optional: without credentials the product runs in
``REPOVERIX_BILLING_DEMO_MODE`` so the experience is fully exercisable
locally, and plans degrade gracefully to Free.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.db.models import PlanName, SubscriptionStatus, User
from app.services import billing as billing_service
from app.services import dodo

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("")
async def billing_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's plan, entitlements and current-period usage.

    Operators listed in ``REPOVERIX_ADMIN_EMAILS`` are reported with the
    ``admin`` plan: every feature enabled and no practical quotas, regardless
    of the stored plan.
    """
    await billing_service.rollover_if_needed(db, current_user)

    plan = billing_service.plan_for_user(current_user)
    repositories = await billing_service.repo_count(db, current_user.id)

    return {
        "plan": {
            "name": plan.name,
            "display_name": plan.display_name,
            "price_monthly": plan.price_monthly // 100,  # cents -> dollars
            "max_repositories": plan.max_repositories,
            "scans_per_month": plan.scans_per_month,
            "fixes_per_month": plan.fixes_per_month,
            "verifications_per_month": plan.verifications_per_month,
            "website_audits_per_month": plan.website_audits_per_month,
            "llm_enabled": plan.llm_enabled,
            "sandbox_enabled": plan.sandbox_enabled,
            "collaborators": plan.collaborators,
        },
        "usage": {
            "repositories": repositories,
            "scans_used": current_user.scans_used,
            "fixes_used": current_user.fixes_used,
            "verifications_used": current_user.verifications_used,
            "website_audits_used": current_user.website_audits_used,
            "period_ends_at": billing_service.current_period(current_user).isoformat(),
        },
        "subscription": {
            "status": (current_user.subscription_status.value if current_user.subscription_status else None),
            "customer_id": current_user.dodo_customer_id,
            "subscription_id": current_user.dodo_subscription_id,
            "period_end": current_user.current_period_end.isoformat()
            if current_user.current_period_end
            else None,
        },
        "demo_mode": get_settings().billing_demo_mode,
        "admin": billing_service.is_admin(current_user),
    }


def _plan_from_string(plan: str) -> PlanName:
    try:
        return PlanName(plan)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unknown plan"
        ) from None


def _is_live_plan(plan: PlanName) -> bool:
    return plan in (PlanName.pro, PlanName.team)


def _reset_usage(user: User) -> None:
    """Zero the monthly counters — a new term starts a fresh budget."""
    user.scans_used = 0
    user.fixes_used = 0
    user.verifications_used = 0
    user.website_audits_used = 0


@router.post("/checkout")
async def create_checkout(
    plan: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a Dodo Payments checkout session for ``plan`` (pro|team)."""
    settings = get_settings()
    target = _plan_from_string(plan)
    if not _is_live_plan(target):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="No checkout for 'free'"
        )

    product_id = billing_service.DODO_PRODUCT_IDS.get(target.value)
    if not settings.billing_demo_mode and (not settings.dodo_api_key or not product_id):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured on this server yet",
        )

    frontend = settings.frontend_url.rstrip("/")

    # ---- demo mode: simulate a successful checkout --------------------
    if settings.billing_demo_mode:
        current_user.plan = target
        current_user.subscription_status = SubscriptionStatus.active
        # extend the period & roll usage for a fresh start
        current_user.current_period_end = datetime.now(UTC) + timedelta(days=settings.billing_period_days)
        _reset_usage(current_user)
        await db.commit()
        return {
            "url": f"{frontend}/billing?checkout=success&plan={target.value}&demo=1",
            "demo": True,
        }

    # ---- live Dodo Payments -------------------------------------------
    try:
        session = await dodo.create_checkout_session(
            product_id=product_id,
            customer_email=current_user.email,
            customer_name=current_user.full_name,
            return_url=f"{frontend}/billing?checkout=success",
            metadata={"user_id": str(current_user.id)},
        )
    except dodo.DodoError as exc:  # pragma: no cover - Dodo network/config errors
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not start checkout"
        ) from exc
    return {"url": session.get("checkout_url"), "demo": False}


@router.post("/portal")
async def customer_portal(
    current_user: User = Depends(get_current_user),
):
    """Open the Dodo Payments customer portal (manage / cancel subscription)."""
    settings = get_settings()
    if settings.billing_demo_mode:
        return {"url": f"{settings.frontend_url.rstrip('/')}/billing"}
    if not settings.dodo_api_key or not current_user.dodo_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Dodo Payments customer linked to this account",
        )
    try:
        link = await dodo.create_customer_portal_session(current_user.dodo_customer_id)
    except dodo.DodoError as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not open portal") from exc
    return {"url": link}


# Dodo subscription statuses -> the product's subscription states.
_DODO_STATUS_MAP: dict[str, SubscriptionStatus] = {
    "active": SubscriptionStatus.active,
    "pending": SubscriptionStatus.incomplete,
    "on_hold": SubscriptionStatus.past_due,
    "paused": SubscriptionStatus.past_due,
    "failed": SubscriptionStatus.incomplete,
    "cancelled": SubscriptionStatus.canceled,
    "expired": SubscriptionStatus.canceled,
}

_SUBSCRIPTION_EVENTS = {
    "subscription.active",
    "subscription.updated",
    "subscription.renewed",
    "subscription.plan_changed",
    "subscription.on_hold",
    "subscription.failed",
    "subscription.cancelled",
    "subscription.expired",
}

# Events that open a new billing term, so usage starts over.
_RESET_EVENTS = {"subscription.active", "subscription.renewed"}


def _parse_event_time(value) -> datetime | None:
    """Parse a Dodo timestamp (ISO-8601 string or epoch seconds) as UTC."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=UTC)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


async def _find_user_for_event(db: AsyncSession, customer: dict, metadata: dict) -> User | None:
    """Resolve which account a webhook belongs to.

    Prefers the Dodo customer id (once linked), then the ``user_id`` metadata
    the checkout carried, then the billing email. Never trusts anything that
    does not match a stored account.
    """
    customer_id = customer.get("customer_id")
    if customer_id:
        result = await db.execute(select(User).where(User.dodo_customer_id == customer_id))
        user = result.scalar_one_or_none()
        if user is not None:
            return user

    raw_user_id = metadata.get("user_id")
    if raw_user_id:
        try:
            user_id = uuid.UUID(str(raw_user_id))
        except ValueError:
            user_id = None
        if user_id is not None:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user is not None:
                return user

    email = customer.get("email")
    if email:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
    return None


@router.post("/webhook")
async def dodo_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Consume Dodo Payments events and update the user's plan.

    Verifies the Standard Webhooks signature, resolves the account, then
    applies the subscription state: plan from the product, status from the
    event, and the next billing date as the period end. Activations and
    renewals start a fresh usage budget; a cancellation scheduled for the end
    of the term keeps the plan until the expiry event arrives.
    """
    settings = get_settings()
    if settings.billing_demo_mode:
        return {"received": True}

    payload = await request.body()
    try:
        event = dodo.verify_webhook(payload, request.headers)
    except dodo.DodoError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature"
        ) from exc

    event_type = str(event.get("type", ""))
    data = event.get("data") or {}
    customer = data.get("customer") or {}
    metadata = data.get("metadata") or {}

    user = await _find_user_for_event(db, customer, metadata)
    if user is None:
        return {"received": True}

    customer_id = customer.get("customer_id")
    if customer_id and user.dodo_customer_id != customer_id:
        user.dodo_customer_id = customer_id

    if event_type in _SUBSCRIPTION_EVENTS:
        plan = billing_service.plan_for_product_id(data.get("product_id"))
        mapped_status = _DODO_STATUS_MAP.get(str(data.get("status", "")))

        if event_type == "subscription.expired":
            user.plan = PlanName.free
            user.subscription_status = SubscriptionStatus.canceled
            user.dodo_subscription_id = None
        elif event_type == "subscription.cancelled":
            user.subscription_status = SubscriptionStatus.canceled
            if not data.get("cancel_at_next_billing_date"):
                # Immediate cancellation: access ends now. A scheduled one
                # keeps the plan until the term ends (expiry event follows).
                user.plan = PlanName.free
                user.dodo_subscription_id = None
        else:
            plan_changed = plan is not None and plan != user.plan
            if plan is not None:
                user.plan = plan
            if mapped_status is not None:
                user.subscription_status = mapped_status
            subscription_id = data.get("subscription_id")
            if subscription_id:
                user.dodo_subscription_id = str(subscription_id)
            if event_type in _RESET_EVENTS or plan_changed:
                _reset_usage(user)

        period_end = _parse_event_time(data.get("next_billing_date"))
        if period_end is not None:
            user.current_period_end = period_end

    # ``payment.succeeded`` and any other event only refresh the customer link.
    await db.commit()
    return {"received": True}


@router.post("/demo/activate")
async def demo_activate(
    plan: str,
    current_user: User = Depends(get_current_user),
):
    """Demo-mode: activate a paid plan without Dodo (local evaluation only)."""
    settings = get_settings()
    if not settings.billing_demo_mode:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Demo mode is disabled")
    target = _plan_from_string(plan)
    return {
        "url": f"{settings.frontend_url.rstrip('/')}/billing?checkout=success&plan={target.value}&demo=1",
        "demo": True,
    }
