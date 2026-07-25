"""Slim API payloads for faster client loads."""

from __future__ import annotations

import re
from typing import Any

# Grid max ~200px CSS × 2x DPR. AlloCiné CDN: /c_W_H/ path segment.
_POSTER_W = 300
_POSTER_H = 400
_ACSTA_POSTER_RE = re.compile(
    r"^(https?://[^/]*acsta\.net/)(?:[cr]_\d+_\d+/)?(.+)$",
    re.IGNORECASE,
)


def thumb_poster_url(url: str | None) -> str | None:
    if not url:
        return url
    match = _ACSTA_POSTER_RE.match(url)
    if not match:
        return url
    return f"{match.group(1)}c_{_POSTER_W}_{_POSTER_H}/{match.group(2)}"


def _slim_session(session: dict[str, Any]) -> dict[str, Any]:
    slim: dict[str, Any] = {
        "time": session.get("time"),
        "version": session.get("version"),
    }
    if session.get("ticket_url"):
        slim["ticket_url"] = session["ticket_url"]
    if session.get("date"):
        slim["date"] = session["date"]
    return slim


def _slim_theater(theater: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": theater.get("id"),
        "name": theater.get("name"),
        "lat": theater.get("lat"),
        "lng": theater.get("lng"),
        "sessions": [_slim_session(s) for s in (theater.get("sessions") or [])],
    }


def _slim_movie(movie: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": movie.get("id"),
        "title": movie.get("title"),
        "original_title": movie.get("original_title"),
        "runtime": movie.get("runtime"),
        "genres": movie.get("genres") or [],
        "poster": thumb_poster_url(movie.get("poster")),
        "url": movie.get("url"),
        "tmdb_id": movie.get("tmdb_id"),
        "year": movie.get("year"),
        "theaters": [_slim_theater(t) for t in (movie.get("theaters") or [])],
        "session_count": movie.get("session_count"),
        "theater_count": movie.get("theater_count"),
    }


def slim_movies_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Drop unused fields (synopsis, address, …) and shrink poster URLs."""
    movies = [_slim_movie(m) for m in (payload.get("movies") or [])]
    return {
        **payload,
        "movies": movies,
        "count": len(movies),
    }
