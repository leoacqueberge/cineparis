# CineParis

Séances AlloCiné pour le **Pass UGC Illimité** à Paris.

- **API** : FastAPI (`main.py`)
- **Front** : Vite + React + shadcn (base **React Aria**, preset Nova / Geist)
- **Cache** : Supabase (snapshot journalier, lectures sans re-scrape)

## Lancer en local

```bash
# API
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # remplir SUPABASE_* si tu veux la DB
uvicorn main:app --reload --port 8001
```

```bash
# Front
cd web
npm install
npm run dev
```

Ouvre [http://127.0.0.1:5173](http://127.0.0.1:5173)

## Supabase (recommandé)

1. Crée un projet sur [supabase.com](https://supabase.com)
2. SQL Editor → colle / exécute `supabase/schema.sql`
3. Project Settings → API → copie :
   - `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Sur Vercel → Environment Variables :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (mot de passe long aléatoire)
   - `SYNC_DAYS=7` (optionnel)

### Comportement

| Moment | Action |
|--------|--------|
| Cron `0 2 * * *` UTC (~4h Paris en été) | Scrape AlloCiné → upsert Supabase → purge les jours passés |
| Reload du site | `GET /api/movies` lit **Supabase** (rapide) |
| Jour pas encore en base | 1 scrape + écriture DB (puis cache) |

Déclencher le sync à la main (avec le secret) :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://ton-app.vercel.app/api/cron_scrape
```

Vérifier que Supabase est vu par l’API :

```bash
curl https://ton-app.vercel.app/api/health
# → { "supabase": true, "version": "0.4.1", ... }
```

## Vercel

- **Root Directory** : vide (racine du repo)
- `vercel.json` build le front + expose `/api/*` + cron quotidien
- Plan Hobby : le cron peut timeout si `SYNC_DAYS` est trop grand → mets `SYNC_DAYS=2` ou `3`

## API

```http
GET /api/movies?brand=all&day=2026-07-23
GET /api/cron/scrape
Authorization: Bearer <CRON_SECRET>
```

## Notes

- Modale film = `Dialog` shadcn / React Aria
- Assets dans `web/public/assets/`
- Usage personnel / éducatif : respecte les conditions d’AlloCiné
