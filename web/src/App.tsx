import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  LETTERBOXD_USERNAME_KEY,
  NEARBY_RADII_KM,
  WEEK_FILTER,
  buildDays,
  defaultDayFilter,
  distanceKm,
  fetchMovies,
  fetchWatchlist,
  filterMoviesByWatchlist,
  formatDistanceKm,
  formatSessionDay,
  getCachedMovies,
  prefetchUpcomingDays,
  thumbPosterUrl,
  type Movie,
  type NearbyRadiusKm,
  type Session,
  type WatchlistFilm,
} from "@/lib/api"
import { THEATER_COORDS } from "@/lib/theaters"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LinkButton } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DAYS = buildDays()
const DEFAULT_DAY = defaultDayFilter()

type NearbyTheater = {
  id: string
  name: string
  distanceKm: number
  movies: { title: string; time: string; sessions: Session[]; movie: Movie }[]
}

function earliestSession(sessions: Session[]) {
  return [...sessions].sort((a, b) => {
    const dayCmp = (a.date || "").localeCompare(b.date || "")
    return dayCmp || a.time.localeCompare(b.time)
  })[0]
}

function formatSessionLabel(session: Session) {
  if (!session.date) return session.time
  return `${formatSessionDay(session.date)} · ${session.time}`
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
}

export default function App() {
  const [day, setDay] = useState(DEFAULT_DAY)
  const [movies, setMovies] = useState<Movie[]>([])
  const [status, setStatus] = useState("Chargement…")
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<Movie | null>(null)
  const [query, setQuery] = useState("")
  const [nearbyOpen, setNearbyOpen] = useState(false)
  const [radiusKm, setRadiusKm] = useState<NearbyRadiusKm>(1)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(
    null,
  )
  const [geoStatus, setGeoStatus] = useState("")
  const [watchlistOpen, setWatchlistOpen] = useState(false)
  const [letterboxdUsername, setLetterboxdUsername] = useState(() => {
    try {
      return localStorage.getItem(LETTERBOXD_USERNAME_KEY) || ""
    } catch {
      return ""
    }
  })
  const [watchlistFilms, setWatchlistFilms] = useState<WatchlistFilm[] | null>(
    null,
  )
  const [watchlistUsername, setWatchlistUsername] = useState("")
  const [watchlistStatus, setWatchlistStatus] = useState("")
  const [watchlistError, setWatchlistError] = useState(false)
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [logoSpinKey, setLogoSpinKey] = useState(0)
  const [selectedMovieId, setSelectedMovieId] = useState<string | number | null>(
    null,
  )
  const watchlistRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    const cached = getCachedMovies("all", day)
    setError(false)

    if (cached) {
      setMovies(cached.movies)
      setStatus(
        cached.movies.length
          ? ""
          : day === WEEK_FILTER
            ? "Aucun film trouvé cette semaine."
            : "Aucun film trouvé pour ce jour.",
      )
    } else {
      setStatus("Chargement des affiches…")
      setMovies([])
    }

    fetchMovies("all", day)
      .then((payload) => {
        if (cancelled) return
        setMovies(payload.movies)
        setStatus(
          payload.movies.length
            ? ""
            : day === WEEK_FILTER
              ? "Aucun film trouvé cette semaine."
              : "Aucun film trouvé pour ce jour.",
        )
      })
      .catch((err: Error) => {
        if (cancelled) return
        if (cached) return
        setError(true)
        setStatus(err.message || "Impossible de charger les films.")
      })

    return () => {
      cancelled = true
    }
  }, [day])

  useEffect(() => {
    if (status || error) return
    const schedule =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (cb: () => void) => window.requestIdleCallback(cb, { timeout: 2000 })
        : (cb: () => void) => window.setTimeout(cb, 200)
    const cancel =
      typeof window !== "undefined" && "cancelIdleCallback" in window
        ? (id: number) => window.cancelIdleCallback(id)
        : (id: number) => window.clearTimeout(id)
    const id = schedule(() => prefetchUpcomingDays("all", day)) as number
    return () => cancel(id)
  }, [day, status, error])

  useEffect(() => {
    if (!watchlistOpen) return
    watchlistRef.current?.focus()
  }, [watchlistOpen])

  function resetHome() {
    setDay(DEFAULT_DAY)
    setSelected(null)
    setQuery("")
    setNearbyOpen(false)
    setRadiusKm(1)
    setUserPos(null)
    setGeoStatus("")
    setWatchlistOpen(false)
    setWatchlistFilms(null)
    setWatchlistUsername("")
    setWatchlistStatus("")
    setWatchlistError(false)
    setWatchlistLoading(false)
    setSelectedMovieId(null)
  }

  function handleLogoClick() {
    setLogoSpinKey((key) => key + 1)
    resetHome()
  }

  function clearWatchlistFilter() {
    setWatchlistFilms(null)
    setWatchlistUsername("")
    setWatchlistStatus("")
    setWatchlistError(false)
  }

  async function applyWatchlist(event?: FormEvent) {
    event?.preventDefault()
    const username = letterboxdUsername.trim().replace(/^@/, "")
    if (!username) {
      setWatchlistError(true)
      setWatchlistStatus("Entre un username Letterboxd.")
      return
    }

    setWatchlistLoading(true)
    setWatchlistError(false)
    setWatchlistStatus("Chargement de la watchlist…")
    try {
      localStorage.setItem(LETTERBOXD_USERNAME_KEY, username)
    } catch {
      /* ignore */
    }

    try {
      const payload = await fetchWatchlist(username)
      setWatchlistFilms(payload.films)
      setWatchlistUsername(payload.username)
      setLetterboxdUsername(payload.username)
      setWatchlistStatus("")
      setWatchlistOpen(false)
    } catch (err) {
      setWatchlistFilms(null)
      setWatchlistUsername("")
      setWatchlistError(true)
      setWatchlistStatus(
        err instanceof Error
          ? err.message
          : "Impossible de charger la watchlist.",
      )
    } finally {
      setWatchlistLoading(false)
    }
  }

  function enableNearby() {
    if (!navigator.geolocation) {
      setGeoStatus("La géolocalisation n’est pas dispo sur cet appareil.")
      setNearbyOpen(true)
      return
    }
    setGeoStatus("Localisation…")
    setNearbyOpen(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoStatus("")
      },
      (err) => {
        setUserPos(null)
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus("Autorise la localisation pour voir les cinémas proches.")
        } else {
          setGeoStatus("Impossible d’obtenir ta position.")
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    )
  }

  function toggleNearby() {
    if (nearbyOpen) {
      setNearbyOpen(false)
      setGeoStatus("")
      return
    }
    enableNearby()
  }

  const watchlistActive = Boolean(watchlistFilms?.length)

  const filteredMovies = useMemo(() => {
    const base = watchlistFilms
      ? filterMoviesByWatchlist(movies, watchlistFilms)
      : movies
    const q = normalize(query)
    if (!q) return base
    return base.filter((movie) => {
      const title = normalize(movie.title)
      const original = normalize(movie.original_title || "")
      return title.includes(q) || original.includes(q)
    })
  }, [movies, query, watchlistFilms])

  const nearbyTheaters = useMemo((): NearbyTheater[] => {
    if (!nearbyOpen || !userPos) return []

    const byTheater = new Map<
      string,
      {
        id: string
        name: string
        distanceKm: number
        movies: Map<
          string,
          { title: string; sessions: Session[]; movie: Movie }
        >
      }
    >()

    const pool = watchlistFilms
      ? filterMoviesByWatchlist(movies, watchlistFilms)
      : movies

    for (const movie of pool) {
      for (const theater of movie.theaters) {
        const catalog = THEATER_COORDS[theater.id]
        const lat =
          typeof theater.lat === "number" ? theater.lat : catalog?.lat
        const lng =
          typeof theater.lng === "number" ? theater.lng : catalog?.lng
        if (typeof lat !== "number" || typeof lng !== "number") continue

        const km = distanceKm(userPos, { lat, lng })
        if (km > radiusKm) continue

        let entry = byTheater.get(theater.id)
        if (!entry) {
          entry = {
            id: theater.id,
            name: theater.name || catalog?.name || theater.id,
            distanceKm: km,
            movies: new Map(),
          }
          byTheater.set(theater.id, entry)
        }

        const key = String(movie.id)
        const existing = entry.movies.get(key)
        if (existing) {
          existing.sessions = [...existing.sessions, ...theater.sessions]
        } else {
          entry.movies.set(key, {
            title: movie.title,
            sessions: [...theater.sessions],
            movie,
          })
        }
      }
    }

    const q = normalize(query)
    return [...byTheater.values()]
      .map((theater) => {
        let list = [...theater.movies.values()].map((item) => {
          const next = earliestSession(item.sessions)
          return {
            title: item.title,
            time: next ? formatSessionLabel(next) : "",
            sessions: item.sessions,
            movie: item.movie,
          }
        })
        if (q) {
          list = list.filter(
            (item) =>
              normalize(item.title).includes(q) ||
              normalize(theater.name).includes(q),
          )
        }
        list.sort((a, b) => {
          const aSession = earliestSession(a.sessions)
          const bSession = earliestSession(b.sessions)
          const aKey = `${aSession?.date || ""}${aSession?.time || ""}`
          const bKey = `${bSession?.date || ""}${bSession?.time || ""}`
          return aKey.localeCompare(bKey) || a.title.localeCompare(b.title)
        })
        return {
          id: theater.id,
          name: theater.name,
          distanceKm: theater.distanceKm,
          movies: list,
        }
      })
      .filter((theater) => theater.movies.length > 0)
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [nearbyOpen, userPos, movies, query, radiusKm, watchlistFilms])

  const meta = selected
    ? [
        selected.runtime,
        ...(selected.genres || []).slice(0, 2),
        `${selected.theater_count} cinéma${selected.theater_count > 1 ? "s" : ""}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : ""

  const emptySearch =
    !error &&
    !status &&
    query.trim() &&
    (nearbyOpen ? nearbyTheaters.length === 0 : filteredMovies.length === 0)

  const emptyWatchlist =
    !error &&
    !status &&
    !query.trim() &&
    watchlistActive &&
    !nearbyOpen &&
    filteredMovies.length === 0

  const nearbyEmpty =
    nearbyOpen &&
    !geoStatus &&
    userPos &&
    !status &&
    !error &&
    !query.trim() &&
    nearbyTheaters.length === 0

  return (
    <div className="min-h-dvh w-full bg-[#15181c] text-white">
      <div className="mx-auto flex w-full min-h-dvh max-w-[1200px] min-w-0 flex-col gap-[15px] px-3 py-3 pb-12 sm:px-5 md:px-8">
        <header className="flex h-9 items-center gap-2.5 md:hidden">
          <button
            type="button"
            onClick={handleLogoClick}
            className="cursor-pointer"
            aria-label="CineParis — revenir à l’accueil"
          >
            <img
              key={logoSpinKey}
              src="/assets/logo.png"
              alt=""
              width={36}
              height={36}
              className={cn(
                "size-9 shrink-0 rounded-[18px] bg-black object-cover motion-reduce:animate-none",
                logoSpinKey > 0 &&
                  "animate-[spin_1.4s_cubic-bezier(0.22,1,0.36,1)]",
              )}
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={resetHome}
            className="cursor-pointer text-left"
            aria-label="CineParis — revenir à l’accueil"
          >
            <h1 className="text-2xl font-bold leading-8 tracking-normal">
              CineParis
            </h1>
          </button>
        </header>

        <div className="-mx-3 h-0 w-[calc(100%+1.5rem)] border-t border-white/15 sm:-mx-5 sm:w-[calc(100%+2.5rem)] md:hidden" />

        <div className="flex items-center md:justify-between md:gap-6">
          <header className="hidden items-center gap-2.5 md:flex">
            <button
              type="button"
              onClick={handleLogoClick}
              className="cursor-pointer"
              aria-label="CineParis — revenir à l’accueil"
            >
              <img
                key={logoSpinKey}
                src="/assets/logo.png"
                alt=""
                width={36}
                height={36}
                className={cn(
                  "size-9 shrink-0 rounded-[18px] bg-black object-cover motion-reduce:animate-none",
                  logoSpinKey > 0 &&
                    "animate-[spin_1.4s_cubic-bezier(0.22,1,0.36,1)]",
                )}
                aria-hidden
              />
            </button>
            <button
              type="button"
              onClick={resetHome}
              className="cursor-pointer text-left"
              aria-label="CineParis — revenir à l’accueil"
            >
              <h1 className="text-2xl font-bold tracking-normal">CineParis</h1>
            </button>
          </header>

          <nav
            className="flex h-10 w-full min-w-0 items-center justify-end gap-1.5 sm:gap-2 md:h-10 md:w-auto"
            aria-label="Actions"
          >
            <button
              type="button"
              title="Watchlist Letterboxd"
              aria-label="Watchlist Letterboxd"
              aria-pressed={watchlistOpen || watchlistActive}
              onClick={() => setWatchlistOpen((open) => !open)}
              className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-transparent p-0 leading-none transition-transform active:scale-95"
            >
              <img
                src="/assets/bookmark.svg?v=5"
                alt=""
                width={40}
                height={40}
                className="block size-10"
              />
            </button>

            <button
              type="button"
              title="Cinémas à proximité"
              aria-label="Cinémas à proximité"
              aria-pressed={nearbyOpen}
              onClick={toggleNearby}
              className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-transparent p-0 leading-none transition-transform active:scale-95"
            >
              <img
                src="/assets/location.svg?v=5"
                alt=""
                width={40}
                height={40}
                className="block size-10"
              />
            </button>

            <div className="relative min-w-0 flex-1 md:w-[220px] md:flex-none lg:w-[260px]">
              <label className="sr-only" htmlFor="movie-search">
                Rechercher un film
              </label>
              <input
                id="movie-search"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setWatchlistOpen(false)
                }}
                placeholder={
                  nearbyOpen ? "Film ou cinéma…" : "Rechercher un film…"
                }
                autoComplete="off"
                className="h-10 w-full appearance-none rounded-full border-0 bg-[#2e343f] py-0 pr-12 pl-3.5 text-[13px] font-normal text-white shadow-none outline-none ring-0 placeholder:text-white/40 focus:bg-white focus:text-black focus:placeholder:text-black/40 focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
              />
              <img
                src="/assets/search.svg?v=5"
                alt=""
                width={36}
                height={36}
                className="pointer-events-none absolute top-1/2 right-1 size-9 -translate-y-1/2"
                aria-hidden
              />
            </div>
          </nav>
        </div>

        {watchlistOpen ? (
          <form
            className="flex items-center gap-2"
            onSubmit={applyWatchlist}
          >
            <label className="sr-only" htmlFor="letterboxd-username">
              Username Letterboxd
            </label>
            <input
              id="letterboxd-username"
              ref={watchlistRef}
              type="text"
              value={letterboxdUsername}
              onChange={(event) => setLetterboxdUsername(event.target.value)}
              placeholder="Username Letterboxd"
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="search"
              disabled={watchlistLoading}
              className="h-10 min-w-0 flex-1 appearance-none rounded-full border-0 bg-[#2e343f] px-3.5 text-[13px] font-normal text-white shadow-none outline-none ring-0 placeholder:text-white/40 focus:bg-white focus:text-black focus:placeholder:text-black/40 focus-visible:outline-none disabled:opacity-50"
            />
            <button type="submit" className="sr-only">
              Charger la watchlist
            </button>
            {watchlistActive ? (
              <button
                type="button"
                onClick={clearWatchlistFilter}
                className="h-10 shrink-0 rounded-full bg-[#2e343f] px-4 text-[13px] font-medium text-white"
              >
                Effacer
              </button>
            ) : null}
          </form>
        ) : null}

        <div className="-mx-3 h-0 w-[calc(100%+1.5rem)] border-t border-white/15 sm:-mx-5 sm:w-[calc(100%+2.5rem)] md:mx-0 md:w-full" />

        <div
          className="flex flex-nowrap gap-2 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label={nearbyOpen ? "Rayon" : "Jour"}
        >
          {nearbyOpen
            ? NEARBY_RADII_KM.map((km) => {
                const checked = radiusKm === km
                return (
                  <button
                    key={km}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setRadiusKm(km)}
                    className={cn(
                      "flex h-[39px] min-w-[61px] shrink-0 cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-[10px] p-2.5 text-[13px] font-medium",
                      checked
                        ? "bg-black text-white"
                        : "bg-[#F2F2F2] text-[#9D9D9D]",
                    )}
                  >
                    {km} km
                  </button>
                )
              })
            : DAYS.map((item) => {
                const checked = day === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setDay(item.value)}
                    className={cn(
                      "relative shrink-0 cursor-pointer whitespace-nowrap bg-transparent px-1 py-2 text-[13px] font-medium uppercase tracking-wide text-[#9caaba] transition-colors",
                      checked && "text-white",
                    )}
                  >
                    {item.label}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-1 bottom-0 h-px bg-white transition-opacity",
                        checked ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                )
              })}
        </div>

        {status && !nearbyOpen ? (
          <p
            className={cn(
              "pt-2 text-sm font-medium",
              error ? "text-red-400" : "text-white/55",
            )}
            role="status"
          >
            {status}
          </p>
        ) : null}

        {watchlistStatus ? (
          <p
            className={cn(
              "pt-2 text-sm font-medium",
              watchlistError ? "text-red-400" : "text-white/55",
            )}
            role="status"
          >
            {watchlistStatus}
          </p>
        ) : null}

        {watchlistActive && !watchlistStatus && !status ? (
          <p className="pt-2 text-sm font-medium text-white/55" role="status">
            {filteredMovies.length} film
            {filteredMovies.length === 1 ? "" : "s"} de @{watchlistUsername}
            {day === WEEK_FILTER ? " cette semaine" : ""}
            {" · "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={clearWatchlistFilter}
            >
              tout afficher
            </button>
          </p>
        ) : null}

        {nearbyOpen && (geoStatus || status) ? (
          <p
            className={cn(
              "pt-2 text-sm font-medium",
              error || geoStatus.includes("Autorise") || geoStatus.includes("Impossible")
                ? "text-red-400"
                : "text-white/55",
            )}
            role="status"
          >
            {geoStatus || status}
          </p>
        ) : null}

        {emptySearch ? (
          <p className="pt-2 text-sm font-medium text-white/55" role="status">
            Aucun résultat pour « {query.trim()} ».
          </p>
        ) : null}

        {emptyWatchlist ? (
          <p className="pt-2 text-sm font-medium text-white/55" role="status">
            Aucun film de @{watchlistUsername} à l’affiche
            {day === WEEK_FILTER ? " cette semaine" : " ce jour"}.
          </p>
        ) : null}

        {nearbyEmpty ? (
          <p className="pt-2 text-sm font-medium text-white/55" role="status">
            Aucun cinéma du Pass à moins de {radiusKm} km.
          </p>
        ) : null}

        {nearbyOpen ? (
          <main className="flex w-full flex-col gap-3 py-1 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-3">
            {nearbyTheaters.map((theater) => (
              <section
                key={theater.id}
                className="rounded-2xl bg-[#F2F2F2] px-4 py-3.5 text-black"
              >
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-bold leading-tight">
                    {theater.name}
                  </h2>
                  <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-black">
                    <img
                      src="/assets/location.svg"
                      alt=""
                      width={14}
                      height={14}
                      className="size-3.5"
                    />
                    {formatDistanceKm(theater.distanceKm)}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {theater.movies.map((item) => (
                    <li key={`${theater.id}-${item.movie.id}`}>
                      <button
                        type="button"
                        className="flex w-full items-baseline justify-between gap-3 text-left text-[15px] font-medium"
                        onClick={() => setSelected(item.movie)}
                      >
                        <span className="min-w-0 truncate">{item.title}</span>
                        <time className="shrink-0 tabular-nums">{item.time}</time>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </main>
        ) : (
          <>
            <main className="grid w-full grid-cols-3 gap-2 py-1 md:grid-cols-4 md:gap-3 lg:grid-cols-5 xl:grid-cols-6">
              {filteredMovies.map((movie) => {
                const poster = thumbPosterUrl(movie.poster) ?? movie.poster
                const isSelected = selectedMovieId === movie.id

                return (
                  <article
                    key={String(movie.id)}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-[5px] border transition-colors",
                      isSelected
                        ? "border-white/40"
                        : "border-white/10",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMovieId(isSelected ? null : movie.id)
                      }
                      className="w-full cursor-pointer p-0 transition-transform active:scale-[0.985]"
                    >
                      {poster ? (
                        <img
                          src={poster}
                          alt={movie.title}
                          loading="lazy"
                          className="block aspect-[300/400] w-full bg-[#ececec] object-cover"
                        />
                      ) : (
                        <div className="grid aspect-[300/400] w-full place-items-center bg-[#ececec] px-1.5 text-center text-[11px] font-medium leading-tight text-black">
                          {movie.title}
                        </div>
                      )}
                    </button>
                  </article>
                )
              })}
            </main>

            {selectedMovieId !== null ? (
              <section className="w-full rounded-2xl bg-[#1f2329] p-4 md:p-5">
                {(() => {
                  const movie = filteredMovies.find(
                    (m) => m.id === selectedMovieId,
                  )
                  if (!movie) return null

                  return (
                    <>
                      <div className="mb-4 flex flex-col gap-1">
                        <h2 className="text-lg font-semibold leading-tight md:text-xl">
                          {movie.title}
                        </h2>
                        <p className="text-[13px] text-white/50">
                          {movie.runtime} · {movie.theater_count} cinéma
                          {movie.theater_count > 1 ? "s" : ""}
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {movie.theaters.map((theater) => {
                          const hasDates = theater.sessions.some(
                            (session) => session.date,
                          )
                          const groups = hasDates
                            ? theater.sessions.reduce<
                                { date: string; sessions: Session[] }[]
                              >((acc, session) => {
                                const date = session.date || ""
                                const group = acc.find(
                                  (item) => item.date === date,
                                )
                                if (group) group.sessions.push(session)
                                else acc.push({ date, sessions: [session] })
                                return acc
                              }, [])
                            : [{ date: "", sessions: theater.sessions }]

                          groups.sort((a, b) => a.date.localeCompare(b.date))

                          for (const group of groups) {
                            group.sessions.sort((a, b) =>
                              a.time.localeCompare(b.time),
                            )
                          }

                          return (
                            <div
                              key={theater.id}
                              className="rounded-lg bg-[#2c3138] px-3 py-3"
                            >
                              <h3 className="mb-2 text-[13px] font-semibold leading-tight md:text-sm">
                                {theater.name}
                              </h3>
                              <div className="flex flex-col gap-2">
                                {groups.map((group) => (
                                  <div
                                    key={group.date || "day"}
                                    className="flex flex-col gap-1.5"
                                  >
                                    {group.date ? (
                                      <p className="text-[11px] font-medium text-white/40">
                                        {formatSessionDay(group.date)}
                                      </p>
                                    ) : null}
                                    <div className="flex flex-wrap gap-1.5">
                                      {group.sessions.map((session) => {
                                        const content = (
                                          <>
                                            <time className="text-[11px] font-semibold tabular-nums">
                                              {session.time}
                                            </time>
                                            <span className="text-[10px] font-medium text-white/40">
                                              {session.version}
                                            </span>
                                          </>
                                        )
                                        const className =
                                          "inline-flex items-baseline gap-1 rounded border border-white/10 bg-[#1f2329] px-1.5 py-1"
                                        const key = `${theater.id}-${session.date || ""}-${session.time}-${session.version}`
                                        if (session.ticket_url) {
                                          return (
                                            <a
                                              key={key}
                                              href={session.ticket_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={className}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {content}
                                            </a>
                                          )
                                        }
                                        return (
                                          <span key={key} className={className}>
                                            {content}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </section>
            ) : null}
          </>
        )}
      </div>

      <Dialog
        isOpen={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        className="max-h-[min(80dvh,720px)] w-full max-w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-md md:max-w-[480px]"
      >
        {selected ? (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {selected.title}
              </DialogTitle>
              {meta ? (
                <DialogDescription className="text-[13px] font-medium">
                  {meta}
                </DialogDescription>
              ) : null}
            </DialogHeader>

            <div className="mt-2">
              {selected.theaters.map((theater) => {
                const hasDates = theater.sessions.some((session) => session.date)
                const groups = hasDates
                  ? theater.sessions.reduce<
                      { date: string; sessions: Session[] }[]
                    >((acc, session) => {
                      const date = session.date || ""
                      const group = acc.find((item) => item.date === date)
                      if (group) group.sessions.push(session)
                      else acc.push({ date, sessions: [session] })
                      return acc
                    }, [])
                  : [{ date: "", sessions: theater.sessions }]

                groups.sort((a, b) => a.date.localeCompare(b.date))

                for (const group of groups) {
                  group.sessions.sort((a, b) => a.time.localeCompare(b.time))
                }

                return (
                  <section
                    key={theater.id}
                    className="border-t border-[#dbdbdb] py-3.5"
                  >
                    <h3 className="mb-2 text-[15px] font-semibold">
                      {theater.name}
                    </h3>
                    <div className="flex flex-col gap-2.5">
                      {groups.map((group) => (
                        <div key={group.date || "day"} className="flex flex-col gap-1.5">
                          {group.date ? (
                            <p className="text-[13px] font-medium text-[#6b6b6b]">
                              {formatSessionDay(group.date)}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            {group.sessions.map((session) => {
                              const content = (
                                <>
                                  <time className="font-semibold tabular-nums">
                                    {session.time}
                                  </time>
                                  <span className="text-xs font-medium text-[#6b6b6b]">
                                    {session.version}
                                  </span>
                                </>
                              )
                              const className =
                                "inline-flex items-baseline gap-1.5 rounded-[10px] border border-[#dbdbdb] px-2.5 py-1.5 text-sm"
                              const key = `${theater.id}-${session.date || ""}-${session.time}-${session.version}`
                              if (session.ticket_url) {
                                return (
                                  <a
                                    key={key}
                                    href={session.ticket_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={className}
                                  >
                                    {content}
                                  </a>
                                )
                              }
                              return (
                                <span key={key} className={className}>
                                  {content}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>

            {selected.url ? (
              <div className="pt-2">
                <LinkButton
                  variant="outline"
                  size="sm"
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fiche AlloCiné
                </LinkButton>
              </div>
            ) : null}
          </>
        ) : null}
      </Dialog>
    </div>
  )
}
