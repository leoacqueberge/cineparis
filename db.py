"""Supabase persistence for daily AlloCiné snapshots."""

from __future__ import annotations

import os
from datetime import date, datetime, timezone
from typing import Any

from supabase import Client, create_client

TABLE = "movie_snapshots"


class DatabaseError(Exception):
    pass


def supabase_configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


def get_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise DatabaseError(
            "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.",
        )
    return create_client(url, key)


def get_snapshot(brand: str, day: date) -> dict[str, Any] | None:
    client = get_client()
    response = (
        client.table(TABLE)
        .select("payload, scraped_at")
        .eq("brand", brand)
        .eq("day", day.isoformat())
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        return None
    payload = rows[0].get("payload")
    if not isinstance(payload, dict):
        return None
    result = dict(payload)
    result["source"] = "supabase"
    result["scraped_at"] = rows[0].get("scraped_at")
    return result


def upsert_snapshot(brand: str, day: date, payload: dict[str, Any]) -> None:
    client = get_client()
    client.table(TABLE).upsert(
        {
            "brand": brand,
            "day": day.isoformat(),
            "payload": payload,
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="brand,day",
    ).execute()


def purge_before(day: date) -> int:
    """Delete snapshots for days strictly before `day`. Returns deleted count if available."""
    client = get_client()
    response = (
        client.table(TABLE)
        .delete()
        .lt("day", day.isoformat())
        .execute()
    )
    rows = response.data or []
    return len(rows)
