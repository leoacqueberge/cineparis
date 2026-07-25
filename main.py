from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

from db import DatabaseError, get_snapshot, supabase_configured, upsert_snapshot
from enrich import enrich_payload_with_tmdb
from letterboxd import LetterboxdError, fetch_watchlist
from payload import slim_movies_payload
from scraper import AllocineError, fetch_movies_for_brand, fetch_showtimes
from sync import run_daily_sync
from theaters import BRANDS, THEATERS, get_theater
from tmdb import tmdb_configured

# Snapshot hits are stable for the day; allow CDN + browser reuse.
_SNAPSHOT_CACHE_HEADERS = {
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
}
_LIVE_CACHE_HEADERS = {
    "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
}

_DEFAULT_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
_EXTRA_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app = FastAPI(title="CineParis", version="0.5.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[*_DEFAULT_ORIGINS, *_EXTRA_ORIGINS],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)
if os.getenv("VERCEL") != "1":
    app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.get("/")
@app.get("/api/health")
async def home() -> dict:
    return {
        "app": "CineParis API",
        "version": "0.5.0",
        "docs": "/docs",
        "health": "ok",
        "supabase": supabase_configured(),
        "tmdb": tmdb_configured(),
    }


@app.get("/api/theaters")
async def list_theaters() -> list[dict]:
    return THEATERS


@app.get("/api/brands")
async def list_brands() -> list[dict]:
    return BRANDS


def _movies_response(payload: dict, *, cacheable: bool) -> JSONResponse:
    body = slim_movies_payload(payload)
    headers = _SNAPSHOT_CACHE_HEADERS if cacheable else _LIVE_CACHE_HEADERS
    return JSONResponse(content=body, headers=headers)


@app.get("/api/movies")
async def movies(
    brand: str = Query("all", description="all | ugc | mk2 | dulac"),
    day: str | None = Query(None, description="YYYY-MM-DD"),
) -> JSONResponse:
    brand_id = brand.strip().lower()
    if brand_id not in {b["id"] for b in BRANDS}:
        raise HTTPException(status_code=400, detail="Groupe invalide (all, ugc, mk2, dulac)")

    try:
        day_value = date.fromisoformat(day) if day else date.today()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Date invalide (YYYY-MM-DD)") from exc

    if day_value < date.today() - timedelta(days=1):
        raise HTTPException(status_code=400, detail="Date trop ancienne")

    # 1) Fast path: Supabase snapshot (TMDB ids come from the daily cron)
    if supabase_configured():
        try:
            snapshot = get_snapshot(brand_id, day_value)
            if snapshot:
                return _movies_response(snapshot, cacheable=True)
        except DatabaseError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        # 2) Cache miss: scrape once, store, return
        try:
            payload = await fetch_movies_for_brand(brand_id, day_value)
            if tmdb_configured():
                await enrich_payload_with_tmdb(payload)
            upsert_snapshot(brand_id, day_value, payload)
            payload = dict(payload)
            payload["source"] = "allocine+supabase"
            return _movies_response(payload, cacheable=True)
        except AllocineError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"Échec du scraping: {exc}") from exc

    # 3) No Supabase: live scrape (local/dev)
    try:
        payload = await fetch_movies_for_brand(brand_id, day_value)
        if tmdb_configured():
            await enrich_payload_with_tmdb(payload)
        payload = dict(payload)
        payload["source"] = "allocine"
        return _movies_response(payload, cacheable=False)
    except AllocineError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Échec du scraping: {exc}") from exc


@app.get("/api/letterboxd/watchlist")
@app.get("/api/letterboxd_watchlist")
async def letterboxd_watchlist(
    username: str = Query(..., min_length=2, max_length=30),
) -> dict:
    try:
        return await fetch_watchlist(username)
    except LetterboxdError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Impossible de charger la watchlist: {exc}",
        ) from exc


@app.get("/api/showtimes")
async def showtimes(
    theater: str = Query(..., min_length=2, max_length=12, description="ID AlloCiné"),
    day: str | None = Query(None, description="YYYY-MM-DD"),
) -> dict:
    theater_id = theater.strip().upper()
    try:
        day_value = date.fromisoformat(day) if day else date.today()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Date invalide (YYYY-MM-DD)") from exc

    if day_value < date.today() - timedelta(days=1):
        raise HTTPException(status_code=400, detail="Date trop ancienne")

    try:
        payload = await fetch_showtimes(theater_id, day_value)
    except AllocineError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Échec du scraping: {exc}") from exc

    known = get_theater(theater_id)
    if known and not payload["theater"].get("name"):
        payload["theater"]["name"] = known["name"]

    return payload


@app.get("/api/cron/scrape")
@app.get("/api/cron_scrape")
async def cron_scrape(
    authorization: str | None = Header(default=None),
) -> dict:
    """Vercel Cron entrypoint — scrape AlloCiné into Supabase, purge old days."""
    secret = os.getenv("CRON_SECRET", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="CRON_SECRET manquant")

    expected = f"Bearer {secret}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not supabase_configured():
        raise HTTPException(status_code=503, detail="Supabase non configuré")

    try:
        return await run_daily_sync()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Sync échouée: {exc}") from exc
