"""Fetch cinema showtimes from AlloCiné's public JSON endpoints."""

from __future__ import annotations

import asyncio
import re
import time
from datetime import date
from typing import Any

import httpx
from bs4 import BeautifulSoup

from theaters import get_theater, theaters_for_brand

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_TTL = 8 * 60  # seconds
_FETCH_CONCURRENCY = 4

BASE = "https://www.allocine.fr"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Referer": "https://www.allocine.fr/",
}

VERSION_LABELS = {
    "original": "VO",
    "original_st": "VO ST",
    "original_st_sme": "VO ST SME",
    "multiple": "VF",
    "multiple_st": "VF ST",
    "multiple_st_sme": "VF ST SME",
}


class AllocineError(Exception):
    pass


def _local_theater(theater_id: str) -> dict[str, str]:
    known = get_theater(theater_id)
    if known:
        area = known.get("area") or ""
        return {
            "id": theater_id,
            "name": known["name"],
            "address": f"Paris {area}".strip(),
        }
    return {"id": theater_id, "name": theater_id, "address": ""}


async def fetch_theater_info(client: httpx.AsyncClient, theater_id: str) -> dict[str, str]:
    """Parse theater name + address from the AlloCiné theater page."""
    fallback = _local_theater(theater_id)
    url = f"{BASE}/seance/salle_gen_csalle={theater_id}.html"
    try:
        response = await client.get(url, headers=HEADERS, follow_redirects=True)
    except httpx.HTTPError:
        return fallback

    if response.status_code != 200:
        return fallback

    soup = BeautifulSoup(response.text, "html.parser")
    name_el = soup.select_one(".header-theater-title")
    addr_el = soup.select_one(".header-theater-adress")
    h1 = soup.select_one("h1")

    name = (
        name_el.get_text(strip=True)
        if name_el
        else (h1.get_text(strip=True) if h1 else fallback["name"])
    )
    address = addr_el.get_text(" ", strip=True) if addr_el else fallback["address"]
    return {"id": theater_id, "name": name, "address": address}


def _ticket_url(showtime: dict[str, Any]) -> str | None:
    ticketing = (showtime.get("data") or {}).get("ticketing") or []
    for ticket in ticketing:
        urls = ticket.get("urls") or []
        if urls:
            return urls[0]
    return None


def _normalize_movie(item: dict[str, Any]) -> dict[str, Any]:
    movie = item["movie"]
    poster = movie.get("poster") or {}
    genres = [g.get("translate") for g in (movie.get("genres") or []) if g.get("translate")]

    sessions: list[dict[str, Any]] = []
    for group, showtimes in (item.get("showtimes") or {}).items():
        label = VERSION_LABELS.get(group, group.replace("_", " ").upper())
        for show in showtimes or []:
            starts = show.get("startsAt") or ""
            time_match = re.search(r"T(\d{2}:\d{2})", starts)
            if not time_match:
                continue
            sessions.append(
                {
                    "time": time_match.group(1),
                    "version": label,
                    "diffusion": show.get("diffusionVersion"),
                    "is_preview": bool(show.get("isPreview")),
                    "ticket_url": _ticket_url(show),
                }
            )

    sessions.sort(key=lambda s: (s["time"], s["version"]))

    return {
        "id": movie.get("internalId"),
        "title": movie.get("title") or movie.get("originalTitle") or "Sans titre",
        "original_title": movie.get("originalTitle"),
        "runtime": movie.get("runtime"),
        "genres": genres,
        "poster": poster.get("url"),
        "synopsis": (movie.get("synopsis") or "").strip(),
        "url": f"{BASE}/film/fichefilm_gen_cfilm={movie.get('internalId')}.html",
        "sessions": sessions,
    }


async def fetch_showtimes(
    theater_id: str,
    day: date | None = None,
) -> dict[str, Any]:
    theater_id = theater_id.strip().upper()
    day = day or date.today()
    day_str = day.isoformat()

    async with httpx.AsyncClient(timeout=20.0) as client:
        theater = await fetch_theater_info(client, theater_id)

        movies: list[dict[str, Any]] = []
        page = 1
        total_pages = 1

        while page <= total_pages:
            url = f"{BASE}/_/showtimes/theater-{theater_id}/d-{day_str}/"
            response = await client.get(
                url,
                params={"page": page},
                headers={**HEADERS, "Accept": "application/json"},
                follow_redirects=True,
            )
            if response.status_code == 404:
                raise AllocineError(f"Aucune donnée pour {theater_id} le {day_str}")
            if response.status_code == 429:
                raise AllocineError(
                    "AlloCiné limite temporairement les requêtes (429). Réessaie dans une minute."
                )
            if response.status_code != 200:
                raise AllocineError(f"AlloCiné a répondu {response.status_code}")

            try:
                payload = response.json()
            except ValueError as exc:
                raise AllocineError("Réponse AlloCiné invalide (pas de JSON)") from exc

            if payload.get("error"):
                raise AllocineError(payload.get("message") or "Erreur AlloCiné")

            pagination = payload.get("pagination") or {}
            total_pages = int(pagination.get("totalPages") or 1)

            for item in payload.get("results") or []:
                movie = _normalize_movie(item)
                if movie["sessions"]:
                    movies.append(movie)

            page += 1

    movies.sort(key=lambda m: m["title"].lower())
    return {
        "theater": theater,
        "date": day_str,
        "source": f"{BASE}/seance/salle_gen_csalle={theater_id}.html",
        "movies": movies,
        "count": len(movies),
    }


def aggregate_brand_payload(
    brand: str,
    day: date,
    theater_payloads: list[dict[str, Any]],
    *,
    theaters_queried: int,
    errors: list[str] | None = None,
) -> dict[str, Any]:
    """Build the /api/movies payload from per-theater scrape results."""
    brand = brand.strip().lower()
    day_str = day.isoformat()
    allowed_ids = {t["id"] for t in theaters_for_brand(brand)}

    movies_by_id: dict[Any, dict[str, Any]] = {}
    theaters_ok = 0

    for payload in theater_payloads:
        theater = payload["theater"]
        if theater["id"] not in allowed_ids:
            continue
        theaters_ok += 1
        for movie in payload["movies"]:
            movie_id = movie["id"] or movie["title"]
            entry = movies_by_id.get(movie_id)
            if not entry:
                entry = {
                    "id": movie["id"],
                    "title": movie["title"],
                    "original_title": movie.get("original_title"),
                    "runtime": movie.get("runtime"),
                    "genres": movie.get("genres") or [],
                    "poster": movie.get("poster"),
                    "synopsis": movie.get("synopsis") or "",
                    "url": movie.get("url"),
                    "theaters": [],
                }
                movies_by_id[movie_id] = entry
            elif not entry.get("poster") and movie.get("poster"):
                entry["poster"] = movie["poster"]

            entry["theaters"].append(
                {
                    "id": theater["id"],
                    "name": theater["name"],
                    "address": theater.get("address") or "",
                    "sessions": movie["sessions"],
                }
            )

    movies = sorted(movies_by_id.values(), key=lambda m: m["title"].lower())
    for movie in movies:
        movie["theaters"].sort(key=lambda t: t["name"].lower())
        movie["session_count"] = sum(len(t["sessions"]) for t in movie["theaters"])
        movie["theater_count"] = len(movie["theaters"])

    return {
        "brand": brand,
        "date": day_str,
        "movies": movies,
        "count": len(movies),
        "theaters_queried": theaters_queried if brand == "all" else len(allowed_ids),
        "theaters_ok": theaters_ok,
        "errors": (errors or [])[:8],
    }


async def fetch_all_theater_payloads(day: date) -> tuple[list[dict[str, Any]], list[str]]:
    """Scrape every known theater once for a given day."""
    theaters = theaters_for_brand("all")
    semaphore = asyncio.Semaphore(_FETCH_CONCURRENCY)
    errors: list[str] = []

    async def one(theater: dict[str, str]) -> dict[str, Any] | None:
        async with semaphore:
            try:
                return await fetch_showtimes(theater["id"], day)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{theater['name']}: {exc}")
                return None

    results = await asyncio.gather(*[one(t) for t in theaters])
    payloads = [item for item in results if item]
    return payloads, errors


async def fetch_movies_for_brand(
    brand: str,
    day: date | None = None,
) -> dict[str, Any]:
    """Aggregate movies + showtimes across all theaters of a brand."""
    brand = brand.strip().lower()
    day = day or date.today()
    day_str = day.isoformat()
    cache_key = f"{brand}:{day_str}"

    cached = _CACHE.get(cache_key)
    if cached and (time.time() - cached[0]) < _CACHE_TTL:
        return cached[1]

    theaters = theaters_for_brand(brand)
    if not theaters:
        raise AllocineError(f"Aucun cinéma pour le groupe « {brand} »")

    if brand == "all":
        theater_payloads, errors = await fetch_all_theater_payloads(day)
        payload = aggregate_brand_payload(
            brand,
            day,
            theater_payloads,
            theaters_queried=len(theaters_for_brand("all")),
            errors=errors,
        )
    else:
        semaphore = asyncio.Semaphore(_FETCH_CONCURRENCY)
        errors: list[str] = []

        async def one(theater: dict[str, str]) -> dict[str, Any] | None:
            async with semaphore:
                try:
                    return await fetch_showtimes(theater["id"], day)
                except Exception as exc:  # noqa: BLE001
                    errors.append(f"{theater['name']}: {exc}")
                    return None

        results = await asyncio.gather(*[one(t) for t in theaters])
        theater_payloads = [item for item in results if item]
        payload = aggregate_brand_payload(
            brand,
            day,
            theater_payloads,
            theaters_queried=len(theaters),
            errors=errors,
        )

    _CACHE[cache_key] = (time.time(), payload)
    return payload
