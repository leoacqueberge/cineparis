"""TMDB search helpers for AlloCiné ↔ Letterboxd matching."""

from __future__ import annotations

import os
import re
import unicodedata
from typing import Any

import httpx

TMDB_BASE = "https://api.themoviedb.org/3"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "CineParis/0.5 (https://github.com/cineparis)",
}


class TmdbError(Exception):
    pass


def tmdb_configured() -> bool:
    return bool(os.getenv("TMDB_API_KEY", "").strip())


def _api_key() -> str:
    key = os.getenv("TMDB_API_KEY", "").strip()
    if not key:
        raise TmdbError("TMDB_API_KEY manquante")
    return key


def normalize_title(value: str | None) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFD", value)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_runtime_minutes(runtime: str | None) -> int | None:
    if not runtime:
        return None
    hours = re.search(r"(\d+)\s*h", runtime, re.I)
    minutes = re.search(r"(\d+)\s*m", runtime, re.I)
    total = 0
    if hours:
        total += int(hours.group(1)) * 60
    if minutes:
        total += int(minutes.group(1))
    if total:
        return total
    bare = re.search(r"(\d+)", runtime)
    return int(bare.group(1)) if bare else None


def _score_result(
    result: dict[str, Any],
    *,
    query_norms: set[str],
    year: int | None,
    runtime_minutes: int | None,
) -> float:
    titles = {
        normalize_title(result.get("title")),
        normalize_title(result.get("original_title")),
    }
    titles.discard("")
    score = float(result.get("popularity") or 0) * 0.01

    if titles & query_norms:
        score += 100
    else:
        for title in titles:
            for query in query_norms:
                if title and query and (title in query or query in title):
                    score += 40
                    break

    release = (result.get("release_date") or "")[:4]
    if year and release.isdigit():
        delta = abs(int(release) - year)
        if delta == 0:
            score += 50
        elif delta == 1:
            score += 20
        else:
            score -= min(delta * 5, 40)

    if runtime_minutes and result.get("runtime"):
        # runtime rarely present on search results; ignore if missing
        pass

    return score


async def search_movie(
    client: httpx.AsyncClient,
    *,
    title: str,
    original_title: str | None = None,
    year: int | None = None,
    runtime: str | None = None,
) -> int | None:
    """Return best TMDB movie id for a title, or None."""
    queries: list[str] = []
    for candidate in (original_title, title):
        if candidate and candidate.strip() and candidate.strip() not in queries:
            queries.append(candidate.strip())
    if not queries:
        return None

    key = _api_key()
    query_norms = {normalize_title(q) for q in queries}
    query_norms.discard("")
    runtime_minutes = parse_runtime_minutes(runtime)
    best: tuple[float, int] | None = None

    for query in queries:
        params: dict[str, Any] = {
            "api_key": key,
            "query": query,
            "include_adult": "false",
            "language": "fr-FR",
        }
        if year:
            params["year"] = year
            params["primary_release_year"] = year

        response = await client.get(
            f"{TMDB_BASE}/search/movie",
            params=params,
            headers=HEADERS,
            timeout=15.0,
        )
        if response.status_code == 401:
            raise TmdbError("Clé TMDB invalide")
        if response.status_code == 429:
            raise TmdbError("TMDB rate limit (429)")
        if response.status_code != 200:
            continue

        results = (response.json() or {}).get("results") or []
        if not results and year:
            # Retry without year constraint
            params.pop("year", None)
            params.pop("primary_release_year", None)
            response = await client.get(
                f"{TMDB_BASE}/search/movie",
                params=params,
                headers=HEADERS,
                timeout=15.0,
            )
            if response.status_code == 200:
                results = (response.json() or {}).get("results") or []

        for result in results[:8]:
            tmdb_id = result.get("id")
            if not isinstance(tmdb_id, int):
                continue
            score = _score_result(
                result,
                query_norms=query_norms,
                year=year,
                runtime_minutes=runtime_minutes,
            )
            if best is None or score > best[0]:
                best = (score, tmdb_id)

        # Strong exact hit — stop early
        if best and best[0] >= 140:
            return best[1]

    if best and best[0] >= 40:
        return best[1]
    return None
