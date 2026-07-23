from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from scraper import AllocineError, fetch_movies_for_brand, fetch_showtimes
from theaters import BRANDS, THEATERS, get_theater

ROOT = Path(__file__).parent

_DEFAULT_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
_EXTRA_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app = FastAPI(title="CineParis", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[*_DEFAULT_ORIGINS, *_EXTRA_ORIGINS],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)
# Local/dev only — Vercel serverless has no durable static mount.
if os.getenv("VERCEL") != "1":
    app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.get("/")
async def home() -> dict:
    return {
        "app": "CineParis API",
        "docs": "/docs",
        "frontend": "http://127.0.0.1:5173",
        "health": "ok",
    }


@app.get("/api/theaters")
async def list_theaters() -> list[dict]:
    return THEATERS


@app.get("/api/brands")
async def list_brands() -> list[dict]:
    return BRANDS


@app.get("/api/movies")
async def movies(
    brand: str = Query("all", description="all | ugc | mk2 | dulac"),
    day: str | None = Query(None, description="YYYY-MM-DD"),
) -> dict:
    brand_id = brand.strip().lower()
    if brand_id not in {b["id"] for b in BRANDS}:
        raise HTTPException(status_code=400, detail="Groupe invalide (all, ugc, mk2, dulac)")

    try:
        day_value = date.fromisoformat(day) if day else date.today()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Date invalide (YYYY-MM-DD)") from exc

    if day_value < date.today() - timedelta(days=1):
        raise HTTPException(status_code=400, detail="Date trop ancienne")

    try:
        return await fetch_movies_for_brand(brand_id, day_value)
    except AllocineError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Échec du scraping: {exc}") from exc


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


def _day_label(day: date, offset: int) -> str:
    if offset == 0:
        return "Aujourd'hui"
    if offset == 1:
        return "Demain"
    weekdays = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."]
    return f"{weekdays[day.weekday()]} {day.day}/{day.month}"
