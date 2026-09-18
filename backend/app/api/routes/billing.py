"""Billing & subscription routes.

Enables the full paid-product flow:

- ``GET /billing``         -> the user's current plan, limits and monthly usage
- ``POST /billing/checkout`` -> Stripe Checkout session for a plan (demo mode
  returns an immediate success URL so the whole flow is testable without keys)
- ``POST /billing/portal`` -> Stripe customer portal (manage/cancel)
- ``POST /billing/webhook``-> Stripe subscription events -> plan changes
- ``POST /billing/demo/activate`` -> demo-mode plan upgrade/extension

All Stripe interactions are optional: without credentials the product runs in
``REPOVERIX_BILLING_DEMO_MODE`` so the experience is fully exercisable
locally, and plans degrade gracefully to Free.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.db.models import PlanName, SubscriptionStatus, User
from app.services import billing as billing_service

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("")
async def billing_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's plan, entitlements and current-period usage."""
    await billing_service.rollover_if_needed(db, current_user)

    plan = billing_service.get_plan(current_user.plan)
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
            "stripe_customer_id": current_user.stripe_customer_id,
            "period_end": current_user.current_period_end.isoformat()
            if current_user.current_period_end
            else None,
        },
        "demo_mode": get_settings().billing_demo_mode,
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


@router.post("/checkout")
async def create_checkout(
    plan: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a Stripe Checkout session for ``plan`` (pro|team)."""
    settings = get_settings()
    target = _plan_from_string(plan)
    if not _is_live_plan(target):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="No checkout for 'free'"
        )

    price_id = billing_service.STRIPE_PRICE_IDS.get(target.value)
    if not settings.billing_demo_mode and (not settings.stripe_secret_key or not price_id):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured on this server yet",
        )

    frontend = settings.frontend_url.rstrip("/")

    # ---- demo mode: simulate a successful checkout --------------------
    if settings.billing_demo_mode:
        from datetime import timedelta

        current_user.plan = target
        current_user.subscription_status = SubscriptionStatus.active
        # extend the period & roll usage for a fresh start
        current_user.current_period_end = datetime.now(UTC) + timedelta(days=settings.billing_period_days)
        current_user.scans_used = 0
        current_user.fixes_used = 0
        current_user.verifications_used = 0
        current_user.website_audits_used = 0
        await db.commit()
        return {
            "url": f"{frontend}/billing?checkout=success&plan={target.value}&demo=1",
            "demo": True,
        }

    # ---- live Stripe ------------------------------------------------
    try:
        import stripe

        stripe.api_key = settings.stripe_secret_key
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer_email=current_user.email,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{frontend}/billing?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend}/billing?checkout=cancelled",
            client_reference_id=str(current_user.id),
        )
    except Exception as exc:  # pragma: no cover - Stripe network/config errors
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not start checkout"
        ) from exc
    return {"url": session.url, "demo": False}


@router.post("/portal")
async def customer_portal(
    current_user: User = Depends(get_current_user),
):
    """Open the Stripe billing portal (manage / cancel subscription)."""
    settings = get_settings()
    if settings.billing_demo_mode:
        return {"url": f"{settings.frontend_url.rstrip('/')}/billing"}
    if not settings.stripe_secret_key or not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No Stripe customer linked to this account"
        )
    try:
        import stripe

        stripe.api_key = settings.stripe_secret_key
        session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=f"{settings.frontend_url.rstrip('/')}/billing",
        )
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not open portal") from exc
    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Consume Stripe subscription events and update the user's plan."""
    settings = get_settings()
    if settings.billing_demo_mode:
        return {"received": True}

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        import stripe

        stripe.api_key = settings.stripe_secret_key
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature"
        ) from exc

    if event["type"] not in (
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        return {"received": True}

    session_obj = event.get("data", {}).get("object", {})
    customer_id = session_obj.get("customer")
    subscription_id = session_obj.get("subscription") or session_obj.get("id", "")

    result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
    user = result.scalar_one_or_none()
    if user is None:
        # First-time customer: the client_reference_id carries the user id.
        client_ref = session_obj.get("client_reference_id")
        if client_ref:
            result = await db.execute(select(User).where(User.id == client_ref))
            user = result.scalar_one_or_none()
            if user is not None:
                user.stripe_customer_id = customer_id
    if user is None:
        return {"received": True}

    sub = session_obj
    if event["type"] == "customer.subscription.deleted":
        user.plan = PlanName.free
        user.subscription_status = SubscriptionStatus.canceled
        user.stripe_subscription_id = None
    else:
        from datetime import datetime

        period_end = sub.get("current_period_end")
        # Resolve the active price ID so pro and team subscriptions land on the
        # right plan. ``checkout.session.completed`` nests the subscription
        # under ``subscription``; ``customer.subscription.*`` events carry the
        # items array directly on the object.
        price_id: str | None = None
        items = sub.get("items") or {}
        item_data = items.get("data") or []
        if item_data:
            price_id = (item_data[0].get("price") or {}).get("id")
        if price_id is None:
            # Fallback: checkout.session carries a top-level ``amount_total``
            # line_items but not items; resolve via subscription lookup is
            # impractical here, so use the client_reference metadata if set.
            price_id = sub.get("metadata", {}).get("price_id")
        user.plan = billing_service.plan_from_stripe_price(price_id)
        user.subscription_status = SubscriptionStatus(sub.get("status", "active"))
        user.stripe_subscription_id = subscription_id
        if period_end:
            user.current_period_end = datetime.fromtimestamp(period_end, tz=UTC)
    await db.commit()
    return {"received": True}


@router.post("/demo/activate")
async def demo_activate(
    plan: str,
    current_user: User = Depends(get_current_user),
):
    """Demo-mode: activate a paid plan without Stripe (local evaluation only)."""
    settings = get_settings()
    if not settings.billing_demo_mode:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Demo mode is disabled")
    target = _plan_from_string(plan)
    return {
        "url": f"{settings.frontend_url.rstrip('/')}/billing?checkout=success&plan={target.value}&demo=1",
        "demo": True,
    }
