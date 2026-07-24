export type BrandId = "all" | "ugc" | "mk2" | "dulac"

export type Brand = {
  id: BrandId
  label: string
  icon: string
}

export type Session = {
  time: string
  version: string
  diffusion?: string
  is_preview?: boolean
  ticket_url?: string | null
  /** Present when sessions are merged across several days (week view). */
  date?: string
}

export const WEEK_FILTER = "week" as const
export type DayFilter = string

export type TheaterShowtimes = {
  id: string
  name: string
  address: string
  lat?: number | null
  lng?: number | null
  sessions: Session[]
}

export type Movie = {
  id: number | string
  title: string
  original_title?: string
  runtime?: string
  genres: string[]
  poster?: string | null
  synopsis?: string
  url?: string
  theaters: TheaterShowtimes[]
  session_count: number
  theater_count: number
}

export type MoviesResponse = {
  brand: string
  date: string
  movies: Movie[]
  count: number
  theaters_queried: number
  theaters_ok: number
  errors: string[]
}

export type Theater = {
  id: string
  name: string
  area: string
  brand: string
  lat: number
  lng: number
}

export const BRANDS: Brand[] = [
  { id: "all", label: "All", icon: "/assets/all.svg" },
  { id: "ugc", label: "UGC", icon: "/assets/ugc.png" },
  { id: "mk2", label: "mk2", icon: "/assets/mk2.png" },
  { id: "dulac", label: "Dulac Cinémas", icon: "/assets/dulac.png" },
]

export const NEARBY_RADII_KM = [1, 3, 5] as const
export type NearbyRadiusKm = (typeof NEARBY_RADII_KM)[number]

function localDateValue(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function buildDays(count = 7) {
  const weekdays = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."]
  const today = new Date()
  const days = Array.from({ length: count }, (_, offset) => {
    const day = new Date(today)
    day.setDate(today.getDate() + offset)
    // Local calendar date — not toISOString() (UTC), which is "yesterday"
    // in France between midnight and ~2h in summer.
    const value = localDateValue(day)
    let label = `${weekdays[(day.getDay() + 6) % 7]} ${day.getDate()}/${day.getMonth() + 1}`
    if (offset === 0) label = "Aujourd'hui"
    if (offset === 1) label = "Demain"
    return { value, label }
  })
  return [{ value: WEEK_FILTER, label: "Toute la semaine" }, ...days]
}

export function formatSessionDay(dateValue: string) {
  const weekdays = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."]
  const [y, m, d] = dateValue.split("-").map(Number)
  if (!y || !m || !d) return dateValue
  const date = new Date(y, m - 1, d)
  const today = new Date()
  const todayValue = localDateValue(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (dateValue === todayValue) return "Aujourd'hui"
  if (dateValue === localDateValue(tomorrow)) return "Demain"
  return `${weekdays[date.getDay()]} ${d}/${m}`
}

function mergeWeekMovies(payloads: MoviesResponse[]): Movie[] {
  const byId = new Map<string, Movie>()

  for (const payload of payloads) {
    const day = payload.date
    for (const movie of payload.movies) {
      const key = String(movie.id ?? movie.title)
      let entry = byId.get(key)
      if (!entry) {
        entry = {
          ...movie,
          theaters: [],
          session_count: 0,
          theater_count: 0,
        }
        byId.set(key, entry)
      } else if (!entry.poster && movie.poster) {
        entry.poster = movie.poster
      }

      for (const theater of movie.theaters) {
        let theaterEntry = entry.theaters.find((item) => item.id === theater.id)
        if (!theaterEntry) {
          theaterEntry = { ...theater, sessions: [] }
          entry.theaters.push(theaterEntry)
        }
        for (const session of theater.sessions) {
          theaterEntry.sessions.push({ ...session, date: day })
        }
      }
    }
  }

  const movies = [...byId.values()].sort((a, b) =>
    a.title.localeCompare(b.title, "fr"),
  )
  for (const movie of movies) {
    for (const theater of movie.theaters) {
      theater.sessions.sort((a, b) => {
        const dayCmp = (a.date || "").localeCompare(b.date || "")
        return dayCmp || a.time.localeCompare(b.time)
      })
    }
    movie.theaters.sort((a, b) => a.name.localeCompare(b.name, "fr"))
    movie.session_count = movie.theaters.reduce(
      (sum, theater) => sum + theater.sessions.length,
      0,
    )
    movie.theater_count = movie.theaters.length
  }
  return movies
}

/** Haversine distance in kilometers. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export function formatDistanceKm(km: number) {
  if (km < 0.1) return "<0.1km"
  return `${km.toFixed(1)}km`
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? ""

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(
      "L’API a renvoyé du HTML au lieu de JSON. Redeploy avec la fonction /api, ou définis VITE_API_URL.",
    )
  }
}

async function fetchMoviesForDay(
  brand: BrandId,
  day: string,
): Promise<MoviesResponse> {
  const params = new URLSearchParams({ brand, day })
  const response = await fetch(`${API_BASE}/api/movies?${params}`)
  const payload = (await parseJson(response)) as { detail?: string } & MoviesResponse
  if (!response.ok) {
    throw new Error(payload.detail || "Erreur serveur")
  }
  return payload
}

export async function fetchMovies(
  brand: BrandId,
  day: DayFilter,
): Promise<MoviesResponse> {
  if (day !== WEEK_FILTER) {
    return fetchMoviesForDay(brand, day)
  }

  const days = buildDays()
    .map((item) => item.value)
    .filter((value) => value !== WEEK_FILTER)
  const payloads = await Promise.all(
    days.map((value) => fetchMoviesForDay(brand, value)),
  )
  const movies = mergeWeekMovies(payloads)
  return {
    brand,
    date: WEEK_FILTER,
    movies,
    count: movies.length,
    theaters_queried: Math.max(...payloads.map((p) => p.theaters_queried), 0),
    theaters_ok: Math.max(...payloads.map((p) => p.theaters_ok), 0),
    errors: [...new Set(payloads.flatMap((p) => p.errors || []))].slice(0, 8),
  }
}

export async function fetchTheaters(): Promise<Theater[]> {
  const response = await fetch(`${API_BASE}/api/theaters`)
  const payload = (await parseJson(response)) as Theater[] | { detail?: string }
  if (!response.ok) {
    throw new Error(
      (payload as { detail?: string }).detail || "Impossible de charger les cinémas.",
    )
  }
  return payload as Theater[]
}
