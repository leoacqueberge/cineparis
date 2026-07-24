"""Supabase persistence for daily AlloCiné snapshots and Letterboxd/TMDB caches."""

from __future__ import annotations

import os
from datetime import date, datetime, timezone
from typing import Any

from supabase import Client, create_client

TABLE = "movie_snapshots"
TMDB_MAP_TABLE = "tmdb_id_map"
LETTERBOXD_TABLE = "letterboxd_watchlists"


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
    try:
        client.table(TABLE).upsert(
            {
                "brand": brand,
                "day": day.isoformat(),
                "payload": payload,
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="brand,day",
        ).execute()
    except Exception as exc:  # noqa: BLE001
        raise DatabaseError(f"Écriture Supabase échouée: {exc}") from exc


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


def get_tmdb_map(source: str, source_id: str) -> int | None:
    """Return cached tmdb_id, or None if unknown. Raises DatabaseError on infra failure."""
    client = get_client()
    response = (
        client.table(TMDB_MAP_TABLE)
        .select("tmdb_id")
        .eq("source", source)
        .eq("source_id", str(source_id))
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        return None
    value = rows[0].get("tmdb_id")
    return int(value) if value is not None else None


def upsert_tmdb_map(
    source: str,
    source_id: str,
    tmdb_id: int | None,
    *,
    title: str | None = None,
    year: int | None = None,
) -> None:
    client = get_client()
    try:
        client.table(TMDB_MAP_TABLE).upsert(
            {
                "source": source,
                "source_id": str(source_id),
                "tmdb_id": tmdb_id,
                "title": title,
                "year": year,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="source,source_id",
        ).execute()
    except Exception as exc:  # noqa: BLE001
        raise DatabaseError(f"Écriture tmdb_id_map échouée: {exc}") from exc


def get_letterboxd_watchlist(
    username: str,
    *,
    max_age_seconds: int,
) -> dict[str, Any] | None:
    client = get_client()
    response = (
        client.table(LETTERBOXD_TABLE)
        .select("payload, fetched_at")
        .eq("username", username)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        return None
    fetched_at = rows[0].get("fetched_at")
    if fetched_at:
        try:
            fetched = datetime.fromisoformat(str(fetched_at).replace("Z", "+00:00"))
            age = (datetime.now(timezone.utc) - fetched).total_seconds()
            if age > max_age_seconds:
                return None
        except ValueError:
            return None
    payload = rows[0].get("payload")
    if not isinstance(payload, dict):
        return None
    result = dict(payload)
    result["source"] = "supabase"
    result["fetched_at"] = fetched_at
    return result


def upsert_letterboxd_watchlist(username: str, payload: dict[str, Any]) -> None:
    client = get_client()
    try:
        client.table(LETTERBOXD_TABLE).upsert(
            {
                "username": username,
                "payload": payload,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="username",
        ).execute()
    except Exception as exc:  # noqa: BLE001
        raise DatabaseError(f"Écriture letterboxd_watchlists échouée: {exc}") from exc
