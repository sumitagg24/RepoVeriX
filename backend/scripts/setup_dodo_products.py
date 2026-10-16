#!/usr/bin/env python
"""Create (or list) the RepoVeriX subscription products in Dodo Payments.

One-time setup helper for the live billing flow. It creates the recurring
products the checkout endpoint sells — Pro at the price in the PLANS table
and Team likewise — and prints the product IDs to paste into the environment:

    REPOVERIX_DODO_PRODUCT_ID_PRO=pdt_…
    REPOVERIX_DODO_PRODUCT_ID_TEAM=pdt_…

Requires REPOVERIX_DODO_API_KEY and honours REPOVERIX_DODO_ENVIRONMENT
(test_mode talks to test.dodopayments.com, live_mode to the live API).

Usage, from the backend directory:

    .venv\\Scripts\\python scripts\\setup_dodo_products.py           # create
    .venv\\Scripts\\python scripts\\setup_dodo_products.py --list    # show existing
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.services import billing as billing_service
from app.services.dodo import DodoError, _request

_PRODUCTS: list[tuple[str, str]] = [
    ("pro", "RepoVeriX Pro"),
    ("team", "RepoVeriX Team"),
]


def _product_body(plan_key: str, name: str) -> dict:
    """Recurring monthly product priced from the single PLANS source."""
    limits = billing_service.get_plan(plan_key)
    return {
        "name": name,
        "description": f"RepoVeriX {limits.display_name} — monthly subscription",
        "tax_category": "saas",
        "price": {
            "type": "recurring_price",
            "price": limits.price_monthly,  # cents
            "currency": "USD",
            "discount": 0,
            "purchasing_power_parity": False,
            "payment_frequency_count": 1,
            "payment_frequency_interval": "Month",
            "subscription_period_count": 1,
            "subscription_period_interval": "Month",
        },
    }


async def _list_products() -> int:
    data = await _request("GET", "/products")
    items = data.get("items") if isinstance(data, dict) else data
    if not items:
        print("No products found.")
        return 0
    for item in items:
        print(f"{item.get('product_id', '?'):28} {item.get('name', '')}")
    return 0


async def main() -> int:
    settings = get_settings()
    if not settings.dodo_api_key:
        print("REPOVERIX_DODO_API_KEY is not set - configure it first.")
        print("See docs/MANUAL-SETUP.md, billing section, for the full setup.")
        return 1

    try:
        if "--list" in sys.argv:
            return await _list_products()

        print(f"Creating subscription products on {settings.dodo_environment} ...\n")
        env_lines = []
        for plan_key, name in _PRODUCTS:
            product = await _request("POST", "/products", _product_body(plan_key, name))
            product_id = product.get("product_id") or product.get("id") or "?"
            env_lines.append(f"REPOVERIX_DODO_PRODUCT_ID_{plan_key.upper()}={product_id}")
            print(f"  {name}: {product_id}")
    except DodoError as exc:
        print(f"Dodo Payments call failed: {exc}")
        return 1

    print("\nAdd these to the environment (and restart the backend):\n")
    for line in env_lines:
        print(f"  {line}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
