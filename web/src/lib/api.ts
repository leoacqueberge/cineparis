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

export const BRANDS: Brand[] = [
  { id: "all", label: "All", icon: "/assets/all.svg" },
  { id: "ugc", label: "UGC", icon: "/assets/ugc.png" },
  { id: "mk2", label: "mk2", icon: "/assets/mk2.png" },
  { id: "dulac", label: "Dulac Cinémas", icon: "/assets/dulac.png" },
]

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

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? ""

export async function fetchMovies(brand: BrandId, day: string): Promise<MoviesResponse> {
  const params = new URLSearchParams({ brand, day })
  const response = await fetch(`${API_BASE}/api/movies?${params}`)
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.detail || "Erreur serveur")
  }
  return payload as MoviesResponse
}
