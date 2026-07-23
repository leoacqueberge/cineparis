import { useEffect, useMemo, useRef, useState } from "react"
import { SearchIcon, XIcon } from "lucide-react"
import {
  BRANDS,
  buildDays,
  fetchMovies,
  type BrandId,
  type Movie,
} from "@/lib/api"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LinkButton } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DAYS = buildDays()

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
}

export default function App() {
  const [brand, setBrand] = useState<BrandId>("all")
  const [day, setDay] = useState(DAYS[0].value)
  const [movies, setMovies] = useState<Movie[]>([])
  const [status, setStatus] = useState("Chargement…")
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<Movie | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

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

  const filteredMovies = useMemo(() => {
    const q = normalize(query)
    if (!q) return movies
    return movies.filter((movie) => {
      const title = normalize(movie.title)
      const original = normalize(movie.original_title || "")
      return title.includes(q) || original.includes(q)
    })
  }, [movies, query])

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
    !error && !status && query.trim() && filteredMovies.length === 0

  return (
    <div className="flex min-h-dvh justify-center bg-white text-black">
      <div className="flex w-full min-h-dvh flex-col gap-[15px] py-3 pb-12 md:w-[402px] md:border-x md:border-[#dbdbdb]">
        <header className="flex h-9 items-center gap-2.5 px-5">
          <img
            src="/assets/logo.png"
            alt="CineParis"
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-full bg-black object-cover"
          />
          <span
            aria-hidden
            className="h-[30px] w-0 shrink-0 border-l border-[#dbdbdb] rotate-[15deg]"
          />
          <h1 className="text-2xl font-medium leading-8 tracking-normal">
            Pass UGC
          </h1>
        </header>

        <div className="h-0 w-full border-t border-[#dbdbdb]" />

        <nav
          className="flex h-12 items-center gap-2.5 px-5"
          aria-label="Groupes de cinémas"
        >
          {BRANDS.map((item) => {
            const active = brand === item.id
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-pressed={active}
                onClick={() => setBrand(item.id)}
                className={cn(
                  "rounded-[10px] p-0 transition-[opacity,transform] active:scale-95",
                  active ? "opacity-100" : "opacity-[0.42]",
                )}
              >
                <img
                  src={item.icon}
                  alt={item.label}
                  width={48}
                  height={48}
                  className="size-12 rounded-[10px] bg-white object-cover shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"
                />
              </button>
            )
          })}

          <button
            type="button"
            title="Rechercher un film"
            aria-label="Rechercher un film"
            aria-pressed={searchOpen}
            onClick={() => {
              setSearchOpen((open) => {
                if (open) setQuery("")
                return !open
              })
            }}
            className={cn(
              "ml-auto flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-white transition-[opacity,transform] active:scale-95 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]",
              searchOpen ? "opacity-100" : "opacity-[0.42]",
            )}
          >
            {searchOpen ? (
              <XIcon className="size-5" strokeWidth={2} />
            ) : (
              <SearchIcon className="size-5" strokeWidth={2} />
            )}
          </button>
        </nav>

        {searchOpen ? (
          <div className="px-5">
            <label className="sr-only" htmlFor="movie-search">
              Rechercher un film
            </label>
            <input
              id="movie-search"
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un film…"
              autoComplete="off"
              className="h-11 w-full rounded-[10px] border-0 bg-[#f5f5f5] px-3.5 text-base font-medium outline-none ring-0 placeholder:text-[#6b6b6b] focus-visible:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)]"
            />
          </div>
        ) : null}

        <div className="h-0 w-full border-t border-[#dbdbdb]" />

        <div
          className="flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label="Jour"
        >
          {DAYS.map((item) => {
            const checked = day === item.value
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setDay(item.value)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium",
                  checked
                    ? "border-black bg-black text-white"
                    : "border-[#dbdbdb] text-[#6b6b6b]",
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {status ? (
          <p
            className={cn(
              "px-5 pt-2 text-sm font-medium",
              error ? "text-red-700" : "text-[#6b6b6b]",
            )}
            role="status"
          >
            {status}
          </p>
        ) : null}

        {emptySearch ? (
          <p className="px-5 pt-2 text-sm font-medium text-[#6b6b6b]" role="status">
            Aucun film pour « {query.trim()} ».
          </p>
        ) : null}

        <main className="flex w-full flex-col items-center gap-5 px-0 py-1">
          {filteredMovies.map((movie) => (
            <button
              key={String(movie.id)}
              type="button"
              aria-label={movie.title}
              onClick={() => setSelected(movie)}
              className="w-[calc(100%-40px)] overflow-hidden rounded-[20px] p-0 transition-transform active:scale-[0.985] md:w-[286px]"
            >
              {movie.poster ? (
                <img
                  src={movie.poster}
                  alt={movie.title}
                  loading="lazy"
                  className="aspect-[286/358] w-full rounded-[20px] bg-[#ececec] object-cover"
                />
              ) : (
                <div className="grid aspect-[286/358] w-full place-items-center rounded-[20px] bg-[#ececec] px-6 text-center text-lg font-medium leading-tight">
                  {movie.title}
                </div>
              )}
            </button>
          ))}
        </main>
      </div>

      <Dialog
        isOpen={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        className="max-h-[min(80dvh,720px)] w-full max-w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-md md:max-w-[402px]"
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
              {selected.theaters.map((theater) => (
                <section
                  key={theater.id}
                  className="border-t border-[#dbdbdb] py-3.5"
                >
                  <h3 className="mb-2 text-[15px] font-semibold">
                    {theater.name}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {theater.sessions.map((session) => {
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
                      if (session.ticket_url) {
                        return (
                          <a
                            key={`${theater.id}-${session.time}-${session.version}`}
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
                        <span
                          key={`${theater.id}-${session.time}-${session.version}`}
                          className={className}
                        >
                          {content}
                        </span>
                      )
                    })}
                  </div>
                </section>
              ))}
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
