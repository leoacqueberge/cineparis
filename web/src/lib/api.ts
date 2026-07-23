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
}

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

export const NEARBY_RADIUS_KM = 1

export function buildDays(count = 7) {
  const weekdays = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."]
  const today = new Date()
  return Array.from({ length: count }, (_, offset) => {
    const day = new Date(today)
    day.setDate(today.getDate() + offset)
    const value = day.toISOString().slice(0, 10)
    let label = `${weekdays[(day.getDay() + 6) % 7]} ${day.getDate()}/${day.getMonth() + 1}`
    if (offset === 0) label = "Aujourd'hui"
    if (offset === 1) label = "Demain"
    return { value, label }
  })
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

export async function fetchMovies(brand: BrandId, day: string): Promise<MoviesResponse> {
  const params = new URLSearchParams({ brand, day })
  const response = await fetch(`${API_BASE}/api/movies?${params}`)
  const payload = (await parseJson(response)) as { detail?: string } & MoviesResponse
  if (!response.ok) {
    throw new Error(payload.detail || "Erreur serveur")
  }
  return payload
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
