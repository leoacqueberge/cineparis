const feedEl = document.getElementById("feed");
const statusEl = document.getElementById("status");
const sheet = document.getElementById("sheet");
const sheetBody = document.getElementById("sheet-body");
const brandButtons = [...document.querySelectorAll(".brand-btn")];

let activeBrand = window.__DEFAULT_BRAND__ || "ugc";
let moviesCache = [];

function selectedDay() {
  const checked = document.querySelector('input[name="day"]:checked');
  return checked ? checked.value : null;
}

function setStatus(message, isError = false) {
  statusEl.hidden = !message;
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setActiveBrand(brand) {
  activeBrand = brand;
  brandButtons.forEach((btn) => {
    const on = btn.dataset.brand === brand;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function renderFeed(movies) {
  moviesCache = movies;
  if (!movies.length) {
    feedEl.hidden = true;
    feedEl.innerHTML = "";
    setStatus("Aucun film trouvé pour ce groupe aujourd’hui.");
    return;
  }

  feedEl.hidden = false;
  feedEl.innerHTML = movies
    .map((movie, index) => {
      const delay = Math.min(index, 10) * 40;
      if (movie.poster) {
        return `
          <button
            type="button"
            class="poster-card"
            data-id="${escapeHtml(movie.id)}"
            style="animation-delay:${delay}ms"
            aria-label="${escapeHtml(movie.title)}"
          >
            <img src="${escapeHtml(movie.poster)}" alt="${escapeHtml(movie.title)}" loading="lazy" />
          </button>
        `;
      }
      return `
        <button
          type="button"
          class="poster-card"
          data-id="${escapeHtml(movie.id)}"
          style="animation-delay:${delay}ms"
          aria-label="${escapeHtml(movie.title)}"
        >
          <div class="poster-fallback">${escapeHtml(movie.title)}</div>
        </button>
      `;
    })
    .join("");

  setStatus("");
}

function openMovie(movieId) {
  const movie = moviesCache.find((m) => String(m.id) === String(movieId));
  if (!movie) return;

  const metaBits = [
    movie.runtime,
    ...(movie.genres || []).slice(0, 2),
    `${movie.theater_count} cinéma${movie.theater_count > 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const theatersHtml = (movie.theaters || [])
    .map((theater) => {
      const sessions = (theater.sessions || [])
        .map((session) => {
          const inner = `<time>${escapeHtml(session.time)}</time><span class="ver">${escapeHtml(session.version)}</span>`;
          if (session.ticket_url) {
            return `<a class="session" href="${escapeHtml(session.ticket_url)}" target="_blank" rel="noopener">${inner}</a>`;
          }
          return `<span class="session">${inner}</span>`;
        })
        .join("");
      return `
        <section class="theater-block">
          <h3>${escapeHtml(theater.name)}</h3>
          <div class="sessions">${sessions}</div>
        </section>
      `;
    })
    .join("");

  sheetBody.innerHTML = `
    <h2>${escapeHtml(movie.title)}</h2>
    <p class="sheet-meta">${escapeHtml(metaBits)}</p>
    ${theatersHtml}
  `;
  if (typeof sheet.showModal === "function") {
    sheet.showModal();
  }
}

async function loadMovies() {
  const day = selectedDay();
  setStatus("Chargement des affiches…");
  feedEl.hidden = true;

  try {
    const params = new URLSearchParams({ brand: activeBrand });
    if (day) params.set("day", day);
    const response = await fetch(`/api/movies?${params}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || "Erreur serveur");
    }
    renderFeed(payload.movies || []);
  } catch (error) {
    feedEl.hidden = true;
    setStatus(error.message || "Impossible de charger les films.", true);
  }
}

brandButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    setActiveBrand(btn.dataset.brand);
    loadMovies();
  });
});

document.getElementById("days").addEventListener("change", loadMovies);

feedEl.addEventListener("click", (event) => {
  const card = event.target.closest(".poster-card");
  if (!card) return;
  openMovie(card.dataset.id);
});

setActiveBrand(activeBrand);
loadMovies();
