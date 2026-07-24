"""Fetch public Letterboxd watchlists and resolve TMDB ids."""

from __future__ import annotations

import asyncio
import re
import time
from typing import Any
from urllib.parse import unquote

import httpx
from bs4 import BeautifulSoup

from db import (
    get_letterboxd_watchlist,
    get_tmdb_map,
    supabase_configured,
    upsert_letterboxd_watchlist,
    upsert_tmdb_map,
)
from tmdb import normalize_title, search_movie, tmdb_configured

BASE = "https://letterboxd.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    "Referer": "https://letterboxd.com/",
}

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{2,30}$")
YEAR_RE = re.compile(r"^(?P<title>.+?)\s*\((?P<year>\d{4})\)\s*$")
MAX_PAGES = 15
WATCHLIST_TTL = 6 * 60 * 60
_MEMORY_WATCHLIST: dict[str, tuple[float, dict[str, Any]]] = {}
_TMDB_CONCURRENCY = 5


class LetterboxdError(Exception):
    def __init__(self, message: str, *, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def validate_username(username: str) -> str:
    cleaned = username.strip().lstrip("@").lower()
    if not USERNAME_RE.match(cleaned):
        raise LetterboxdError(
            "Username Letterboxd invalide.",
            status_code=400,
        )
    return cleaned


def _parse_item_name(name: str) -> tuple[str, int | None]:
    name = (name or "").strip()
    match = YEAR_RE.match(name)
    if match:
        return match.group("title").strip(), int(match.group("year"))
    return name, None


def _film_from_node(node) -> dict[str, Any] | None:
    slug = (
        node.get("data-item-slug")
        or node.get("data-film-slug")
        or ""
    ).strip()
    link = (
        node.get("data-item-link")
        or node.get("data-target-link")
        or node.get("data-film-link")
        or ""
    ).strip()
    if not slug and link:
        match = re.search(r"/film/([^/]+)/?", link)
        if match:
            slug = unquote(match.group(1))
    if not slug and link.startswith("/film/"):
        slug = link.strip("/").split("/")[-1]

    name = (node.get("data-item-name") or node.get("data-film-name") or "").strip()
    if not name:
        img = node.find("img")
        if img and img.get("alt"):
            name = img["alt"].strip()

    if not slug and not name:
        return None

    title, year = _parse_item_name(name) if name else (slug.replace("-", " "), None)
    if not title:
        title = slug.replace("-", " ")

    film_url = f"{BASE}/film/{slug}/" if slug else None
    return {
        "title": title,
        "year": year,
        "slug": slug or None,
        "url": film_url,
        "tmdb_id": None,
    }


def parse_watchlist_page(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    films: list[dict[str, Any]] = []
    seen: set[str] = set()

    nodes = soup.select(
        "[data-item-slug], [data-film-slug], "
        "[data-target-link*='/film/'], [data-item-link*='/film/']"
    )
    for node in nodes:
        film = _film_from_node(node)
        if not film:
            continue
        key = film.get("slug") or normalize_title(film["title"])
        if not key or key in seen:
            continue
        seen.add(key)
        films.append(film)
    return films


async def _fetch_watchlist_pages(
    client: httpx.AsyncClient,
    username: str,
) -> list[dict[str, Any]]:
    films: list[dict[str, Any]] = []
    seen: set[str] = set()

    for page in range(1, MAX_PAGES + 1):
        if page == 1:
            url = f"{BASE}/{username}/watchlist/"
        else:
            url = f"{BASE}/{username}/watchlist/page/{page}/"

        response = await client.get(url, headers=HEADERS, follow_redirects=True)
        if response.status_code == 404:
            if page == 1:
                raise LetterboxdError(
                    f"Utilisateur « {username} » introuvable.",
                    status_code=404,
                )
            break
        if response.status_code in (401, 403):
            raise LetterboxdError(
                "Watchlist inaccessible (privée ou bloquée).",
                status_code=403,
            )
        if response.status_code != 200:
            raise LetterboxdError(
                f"Letterboxd a répondu {response.status_code}.",
                status_code=502,
            )

        final_path = str(response.url.path).lower()
        if page == 1 and "/watchlist" not in final_path:
            raise LetterboxdError(
                "Watchlist inaccessible (privée ou inexistante).",
                status_code=403,
            )

        page_films = parse_watchlist_page(response.text)
        if not page_films:
            break

        added = 0
        for film in page_films:
            key = film.get("slug") or normalize_title(film["title"])
            if key in seen:
                continue
            seen.add(key)
            films.append(film)
            added += 1
        if added == 0:
            break

        # Letterboxd pages usually have ~28 posters; short page => last page
        if len(page_films) < 18:
            break

    return films


_TMDB_RESOLVE_BUDGET_S = 20.0
_MEMORY_TMDB: dict[str, int] = {}


async def _resolve_tmdb_ids(films: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not films or not tmdb_configured():
        return films

    semaphore = asyncio.Semaphore(_TMDB_CONCURRENCY)

    async with httpx.AsyncClient(timeout=12.0) as client:
        async def one(film: dict[str, Any]) -> None:
            slug = film.get("slug")
            if slug and slug in _MEMORY_TMDB:
                film["tmdb_id"] = _MEMORY_TMDB[slug]
                return

            if slug and supabase_configured():
                try:
                    cached = get_tmdb_map("letterboxd", slug)
                    if cached is not None:
                        film["tmdb_id"] = cached
                        _MEMORY_TMDB[slug] = cached
                        return
                except Exception:  # noqa: BLE001
                    pass

            async with semaphore:
                try:
                    tmdb_id = await search_movie(
                        client,
                        title=film["title"],
                        year=film.get("year"),
                    )
                except Exception:  # noqa: BLE001
                    tmdb_id = None

            if tmdb_id is None:
                return

            film["tmdb_id"] = tmdb_id
            if slug:
                _MEMORY_TMDB[slug] = tmdb_id
            if slug and supabase_configured():
                try:
                    upsert_tmdb_map(
                        "letterboxd",
                        slug,
                        tmdb_id,
                        title=film["title"],
                        year=film.get("year"),
                    )
                except Exception:  # noqa: BLE001
                    pass

        try:
            await asyncio.wait_for(
                asyncio.gather(*[one(film) for film in films]),
                timeout=_TMDB_RESOLVE_BUDGET_S,
            )
        except asyncio.TimeoutError:
            # Partial TMDB coverage is fine — title matching still works.
            pass

    return films


async def fetch_watchlist(username: str) -> dict[str, Any]:
    username = validate_username(username)

    if supabase_configured():
        try:
            cached = get_letterboxd_watchlist(username, max_age_seconds=WATCHLIST_TTL)
            if cached:
                return cached
        except Exception:  # noqa: BLE001
            pass
    else:
        mem = _MEMORY_WATCHLIST.get(username)
        if mem and (time.time() - mem[0]) < WATCHLIST_TTL:
            return mem[1]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            films = await _fetch_watchlist_pages(client, username)
    except httpx.HTTPError as exc:
        raise LetterboxdError(
            f"Impossible de joindre Letterboxd: {exc}",
            status_code=502,
        ) from exc

    if not films:
        raise LetterboxdError(
            "Watchlist vide ou inaccessible.",
            status_code=404,
        )

    films = await _resolve_tmdb_ids(films)
    payload = {
        "username": username,
        "count": len(films),
        "films": films,
        "source": "letterboxd",
    }

    if supabase_configured():
        try:
            upsert_letterboxd_watchlist(username, payload)
            payload["source"] = "letterboxd+supabase"
        except Exception:  # noqa: BLE001
            pass
    else:
        _MEMORY_WATCHLIST[username] = (time.time(), payload)

    return payload
