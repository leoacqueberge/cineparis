import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { SmoothCorners } from "@lisse/react"
import { XIcon } from "lucide-react"
import {
  BRANDS,
  LETTERBOXD_USERNAME_KEY,
  NEARBY_RADII_KM,
  WEEK_FILTER,
  buildDays,
  distanceKm,
  fetchMovies,
  fetchWatchlist,
  filterMoviesByWatchlist,
  formatDistanceKm,
  formatSessionDay,
  type BrandId,
  type Movie,
  type NearbyRadiusKm,
  type Session,
  type WatchlistFilm,
} from "@/lib/api"
import { THEATER_COORDS } from "@/lib/theaters"
import { corners } from "@/lib/squircle"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LinkButton } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DAYS = buildDays()
const DEFAULT_DAY =
  DAYS.find((item) => item.value !== WEEK_FILTER)?.value ?? DAYS[0].value

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
  const [brand, setBrand] = useState<BrandId>("all")
  const [day, setDay] = useState(DEFAULT_DAY)
  const [movies, setMovies] = useState<Movie[]>([])
  const [status, setStatus] = useState("Chargement…")
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<Movie | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
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
  const searchRef = useRef<HTMLInputElement>(null)
  const watchlistRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    setStatus("Chargement des affiches…")
    setError(false)
    setMovies([])

    fetchMovies(brand, day)
      .then((payload) => {
        if (cancelled) return
        setMovies(payload.movies)
        setStatus(
          payload.movies.length
            ? ""
            : day === WEEK_FILTER
              ? "Aucun film trouvé pour ce groupe cette semaine."
              : "Aucun film trouvé pour ce groupe aujourd’hui.",
        )
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(true)
        setStatus(err.message || "Impossible de charger les films.")
      })

    return () => {
      cancelled = true
    }
  }, [brand, day])

  useEffect(() => {
    if (!searchOpen) return
    searchRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    if (!watchlistOpen) return
    watchlistRef.current?.focus()
  }, [watchlistOpen])

  function resetHome() {
    setBrand("all")
    setDay(DEFAULT_DAY)
    setSelected(null)
    setSearchOpen(false)
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
    setSearchOpen(false)
    setQuery("")
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
    <div className="min-h-dvh w-full bg-white text-black">
      <div className="mx-auto flex w-full min-h-dvh max-w-[1200px] min-w-0 flex-col gap-[15px] px-3 py-3 pb-12 sm:px-5 md:px-8">
        <header className="flex h-9 items-center md:hidden">
          <button
            type="button"
            onClick={resetHome}
            className="flex cursor-pointer items-center gap-2.5 text-left"
            aria-label="CineParis — revenir à l’accueil"
          >
            <SmoothCorners
              as="img"
              corners={corners(18)}
              src="/assets/logo.png"
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 animate-[spin_12s_linear_infinite] bg-black object-cover motion-reduce:animate-none"
              aria-hidden
            />
            <h1 className="text-2xl font-bold leading-8 tracking-normal">
              CineParis
            </h1>
          </button>
        </header>

        <div className="-mx-3 h-0 w-[calc(100%+1.5rem)] border-t border-[#dbdbdb] sm:-mx-5 sm:w-[calc(100%+2.5rem)] md:hidden" />

        <div className="flex items-center md:justify-between md:gap-6">
          <header className="hidden md:block">
            <button
              type="button"
              onClick={resetHome}
              className="flex cursor-pointer items-center gap-2.5 text-left"
              aria-label="CineParis — revenir à l’accueil"
            >
              <SmoothCorners
                as="img"
                corners={corners(18)}
                src="/assets/logo.png"
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 animate-[spin_12s_linear_infinite] bg-black object-cover motion-reduce:animate-none"
                aria-hidden
              />
              <h1 className="text-2xl font-bold tracking-normal">CineParis</h1>
            </button>
          </header>

          <nav
            className="flex h-10 w-full min-w-0 items-center justify-between gap-1.5 sm:gap-2 md:h-10 md:w-auto md:justify-start"
            aria-label="Groupes de cinémas"
          >
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              {BRANDS.map((item) => {
                const active = brand === item.id
                const isGlyph = item.id === "all"
                return (
                  <SmoothCorners
                    key={item.id}
                    as="button"
                    type="button"
                    title={item.label}
                    aria-pressed={active}
                    onClick={() => {
                      setBrand(item.id)
                    }}
                    corners={corners(10)}
                    innerBorder={
                      isGlyph
                        ? undefined
                        : { width: 1, color: "#000000", opacity: 0.1 }
                    }
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center overflow-hidden p-0 leading-none transition-[opacity,transform] active:scale-95",
                      isGlyph ? "bg-black" : "bg-white",
                      active ? "opacity-100" : "opacity-[0.42]",
                    )}
                  >
                    <img
                      src={item.icon}
                      alt={item.label}
                      width={40}
                      height={40}
                      className="block size-10 object-cover"
                    />
                  </SmoothCorners>
                )
              })}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:ml-2">
              <SmoothCorners
                as="button"
                type="button"
                title="Watchlist Letterboxd"
                aria-label="Watchlist Letterboxd"
                aria-pressed={watchlistOpen || watchlistActive}
                onClick={() => {
                  setWatchlistOpen((open) => !open)
                  setSearchOpen(false)
                }}
                corners={corners(10)}
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center overflow-hidden bg-black p-0 leading-none transition-[opacity,transform] active:scale-95",
                  watchlistOpen || watchlistActive
                    ? "opacity-100"
                    : "opacity-[0.42]",
                )}
              >
                <img
                  src="/assets/bookmark.svg"
                  alt=""
                  width={40}
                  height={40}
                  className="block size-10"
                />
              </SmoothCorners>

              <SmoothCorners
                as="button"
                type="button"
                title="Cinémas à proximité"
                aria-label="Cinémas à proximité"
                aria-pressed={nearbyOpen}
                onClick={toggleNearby}
                corners={corners(10)}
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center overflow-hidden bg-black p-0 leading-none transition-[opacity,transform] active:scale-95",
                  nearbyOpen ? "opacity-100" : "opacity-[0.42]",
                )}
              >
                <img
                  src="/assets/location.svg"
                  alt=""
                  width={40}
                  height={40}
                  className="block size-10"
                />
              </SmoothCorners>

              <SmoothCorners
                as="button"
                type="button"
                title="Rechercher un film"
                aria-label="Rechercher un film"
                aria-pressed={searchOpen}
                onClick={() => {
                  setSearchOpen((open) => {
                    if (open) setQuery("")
                    return !open
                  })
                  setWatchlistOpen(false)
                }}
                corners={corners(10)}
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center overflow-hidden bg-black p-0 leading-none transition-[opacity,transform] active:scale-95",
                  searchOpen ? "opacity-100" : "opacity-[0.42]",
                )}
              >
                {searchOpen ? (
                  <XIcon className="size-5 text-white" strokeWidth={2} />
                ) : (
                  <img
                    src="/assets/search.svg"
                    alt=""
                    width={40}
                    height={40}
                    className="block size-10"
                  />
                )}
              </SmoothCorners>
            </div>
          </nav>
        </div>

        {watchlistOpen ? (
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={applyWatchlist}
          >
            <label className="sr-only" htmlFor="letterboxd-username">
              Username Letterboxd
            </label>
            <SmoothCorners
              as="input"
              id="letterboxd-username"
              ref={watchlistRef}
              type="text"
              value={letterboxdUsername}
              onChange={(event) => setLetterboxdUsername(event.target.value)}
              placeholder="Username Letterboxd"
              autoComplete="username"
              spellCheck={false}
              corners={corners(10)}
              className="h-11 w-full border-0 bg-[#f5f5f5] px-3.5 text-base font-medium outline-none ring-0 placeholder:text-[#6b6b6b] focus-visible:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)] sm:flex-1"
            />
            <div className="flex gap-2">
              <SmoothCorners
                as="button"
                type="submit"
                disabled={watchlistLoading}
                corners={corners(10)}
                className="h-11 shrink-0 bg-black px-4 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {watchlistLoading ? "…" : "Voir"}
              </SmoothCorners>
              {watchlistActive ? (
                <SmoothCorners
                  as="button"
                  type="button"
                  onClick={clearWatchlistFilter}
                  corners={corners(10)}
                  className="h-11 shrink-0 bg-[#F2F2F2] px-4 text-[13px] font-medium text-black"
                >
                  Effacer
                </SmoothCorners>
              ) : null}
            </div>
          </form>
        ) : null}

        {searchOpen ? (
          <div>
            <label className="sr-only" htmlFor="movie-search">
              Rechercher un film
            </label>
            <SmoothCorners
              as="input"
              id="movie-search"
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                nearbyOpen
                  ? "Rechercher un film ou un cinéma…"
                  : "Rechercher un film…"
              }
              autoComplete="off"
              corners={corners(10)}
              className="h-11 w-full border-0 bg-[#f5f5f5] px-3.5 text-base font-medium outline-none ring-0 placeholder:text-[#6b6b6b] focus-visible:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]"
            />
          </div>
        ) : null}

        <div className="-mx-3 h-0 w-[calc(100%+1.5rem)] border-t border-[#dbdbdb] sm:-mx-5 sm:w-[calc(100%+2.5rem)] md:mx-0 md:w-full" />

        <div
          className="flex flex-nowrap gap-2 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label={nearbyOpen ? "Rayon" : "Jour"}
        >
          {nearbyOpen
            ? NEARBY_RADII_KM.map((km) => {
                const checked = radiusKm === km
                return (
                  <SmoothCorners
                    key={km}
                    as="button"
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setRadiusKm(km)}
                    corners={corners(10)}
                    className={cn(
                      "flex h-[39px] min-w-[61px] shrink-0 cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-[10px] p-2.5 text-[13px] font-medium",
                      checked
                        ? "bg-black text-white"
                        : "bg-[#F2F2F2] text-[#9D9D9D]",
                    )}
                  >
                    {km} km
                  </SmoothCorners>
                )
              })
            : DAYS.map((item) => {
                const checked = day === item.value
                return (
                  <SmoothCorners
                    key={item.value}
                    as="button"
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setDay(item.value)}
                    corners={corners(10)}
                    className={cn(
                      "flex h-[39px] min-w-[61px] shrink-0 cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-[10px] p-2.5 text-[13px] font-medium",
                      checked
                        ? "bg-black text-white"
                        : "bg-[#F2F2F2] text-[#9D9D9D]",
                    )}
                  >
                    {item.label}
                  </SmoothCorners>
                )
              })}
        </div>

        {status && !nearbyOpen ? (
          <p
            className={cn(
              "pt-2 text-sm font-medium",
              error ? "text-red-700" : "text-[#6b6b6b]",
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
              watchlistError ? "text-red-700" : "text-[#6b6b6b]",
            )}
            role="status"
          >
            {watchlistStatus}
          </p>
        ) : null}

        {watchlistActive && !watchlistStatus && !status ? (
          <p className="pt-2 text-sm font-medium text-[#6b6b6b]" role="status">
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
                ? "text-red-700"
                : "text-[#6b6b6b]",
            )}
            role="status"
          >
            {geoStatus || status}
          </p>
        ) : null}

        {emptySearch ? (
          <p className="pt-2 text-sm font-medium text-[#6b6b6b]" role="status">
            Aucun résultat pour « {query.trim()} ».
          </p>
        ) : null}

        {emptyWatchlist ? (
          <p className="pt-2 text-sm font-medium text-[#6b6b6b]" role="status">
            Aucun film de @{watchlistUsername} à l’affiche
            {day === WEEK_FILTER ? " cette semaine" : " ce jour"}.
          </p>
        ) : null}

        {nearbyEmpty ? (
          <p className="pt-2 text-sm font-medium text-[#6b6b6b]" role="status">
            Aucun cinéma du Pass à moins de {radiusKm} km.
          </p>
        ) : null}

        {nearbyOpen ? (
          <main className="flex w-full flex-col gap-3 py-1 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-3">
            {nearbyTheaters.map((theater) => (
              <SmoothCorners
                key={theater.id}
                as="section"
                corners={corners(16)}
                className="bg-[#F2F2F2] px-4 py-3.5"
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
                      className="size-3.5 invert"
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
              </SmoothCorners>
            ))}
          </main>
        ) : (
          <main className="grid w-full grid-cols-3 gap-2 py-1 md:grid-cols-4 md:gap-3 lg:grid-cols-5 xl:grid-cols-6">
            {filteredMovies.map((movie) => (
              <SmoothCorners
                key={String(movie.id)}
                as="button"
                type="button"
                aria-label={movie.title}
                onClick={() => setSelected(movie)}
                corners={corners(12)}
                className="w-full cursor-pointer overflow-hidden p-0 transition-transform active:scale-[0.985]"
              >
                {movie.poster ? (
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    loading="lazy"
                    className="block w-full bg-[#ececec]"
                  />
                ) : (
                  <div className="grid aspect-[286/358] w-full place-items-center bg-[#ececec] px-1.5 text-center text-[11px] font-medium leading-tight">
                    {movie.title}
                  </div>
                )}
              </SmoothCorners>
            ))}
          </main>
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
                                "inline-flex items-baseline gap-1.5 border border-[#dbdbdb] px-2.5 py-1.5 text-sm"
                              const key = `${theater.id}-${session.date || ""}-${session.time}-${session.version}`
                              if (session.ticket_url) {
                                return (
                                  <SmoothCorners
                                    key={key}
                                    as="a"
                                    href={session.ticket_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    corners={corners(10)}
                                    className={className}
                                  >
                                    {content}
                                  </SmoothCorners>
                                )
                              }
                              return (
                                <SmoothCorners
                                  key={key}
                                  as="span"
                                  corners={corners(10)}
                                  className={className}
                                >
                                  {content}
                                </SmoothCorners>
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
