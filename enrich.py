"""Attach TMDB ids to AlloCiné movie payloads."""

from __future__ import annotations

import asyncio
import re
from typing import Any

import httpx

from db import get_tmdb_map, supabase_configured, upsert_tmdb_map
from tmdb import search_movie, tmdb_configured

_TMDB_CONCURRENCY = 5
_MEMORY_MAP: dict[str, int] = {}


def _year_from_movie(movie: dict[str, Any]) -> int | None:
    for key in ("year", "production_year", "release_year"):
        value = movie.get(key)
        if isinstance(value, int) and 1880 <= value <= 2100:
            return value
        if isinstance(value, str) and re.fullmatch(r"\d{4}", value):
            return int(value)
    return None


async def enrich_movies_with_tmdb(movies: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mutate/return movies with tmdb_id when TMDB is configured."""
    if not movies or not tmdb_configured():
        return movies

    semaphore = asyncio.Semaphore(_TMDB_CONCURRENCY)

    async with httpx.AsyncClient(timeout=20.0) as client:
        async def one(movie: dict[str, Any]) -> None:
            if movie.get("tmdb_id"):
                return
            movie_id = movie.get("id")
            if movie_id is None:
                return
            key = str(movie_id)

            cached_mem = _MEMORY_MAP.get(key)
            if cached_mem is not None:
                movie["tmdb_id"] = cached_mem
                return

            if supabase_configured():
                try:
                    cached = get_tmdb_map("allocine", key)
                    if cached is not None:
                        movie["tmdb_id"] = cached
                        _MEMORY_MAP[key] = cached
                        return
                except Exception:  # noqa: BLE001
                    pass

            year = _year_from_movie(movie)
            async with semaphore:
                try:
                    tmdb_id = await search_movie(
                        client,
                        title=movie.get("title") or "",
                        original_title=movie.get("original_title"),
                        year=year,
                        runtime=movie.get("runtime"),
                    )
                except Exception:  # noqa: BLE001
                    tmdb_id = None

            if tmdb_id is None:
                return

            movie["tmdb_id"] = tmdb_id
            _MEMORY_MAP[key] = tmdb_id
            if supabase_configured():
                try:
                    upsert_tmdb_map(
                        "allocine",
                        key,
                        tmdb_id,
                        title=movie.get("title"),
                        year=year,
                    )
                except Exception:  # noqa: BLE001
                    pass

        await asyncio.gather(*[one(movie) for movie in movies])

    return movies


async def enrich_payload_with_tmdb(payload: dict[str, Any]) -> dict[str, Any]:
    movies = payload.get("movies")
    if isinstance(movies, list):
        await enrich_movies_with_tmdb(movies)
    return payload
