"""Daily AlloCiné → Supabase sync."""

from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Any

from db import purge_before, upsert_snapshot
from scraper import (
    aggregate_brand_payload,
    fetch_all_theater_payloads,
)
from theaters import BRANDS


def sync_days_ahead() -> int:
    return max(1, min(int(os.getenv("SYNC_DAYS", "7")), 14))


async def sync_day(day: date) -> dict[str, Any]:
    """Scrape all theaters once, then store one snapshot per brand."""
    theater_payloads, errors = await fetch_all_theater_payloads(day)
    brands = [b["id"] for b in BRANDS]
    stored: list[str] = []

    for brand in brands:
        payload = aggregate_brand_payload(
            brand,
            day,
            theater_payloads,
            theaters_queried=len(theater_payloads) if brand == "all" else 0,
            errors=errors,
        )
        # Fix theaters_queried for non-all brands inside aggregate already
        upsert_snapshot(brand, day, payload)
        stored.append(brand)

    return {
        "day": day.isoformat(),
        "theaters_ok": len(theater_payloads),
        "errors": errors[:12],
        "brands": stored,
    }


async def run_daily_sync(
    *,
    start: date | None = None,
    days: int | None = None,
) -> dict[str, Any]:
    """Scrape upcoming days into Supabase and purge past days."""
    start = start or date.today()
    days = days if days is not None else sync_days_ahead()
    results = []

    for offset in range(days):
        day = start + timedelta(days=offset)
        results.append(await sync_day(day))

    deleted = purge_before(start)
    return {
        "ok": True,
        "start": start.isoformat(),
        "days": days,
        "purged_before": start.isoformat(),
        "deleted_rows": deleted,
        "results": results,
    }
