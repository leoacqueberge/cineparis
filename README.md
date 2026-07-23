# CineParis

Séances AlloCiné pour le **Pass UGC Illimité** à Paris.

- **API** : FastAPI (`main.py`)
- **Front** : Vite + React + shadcn (base **React Aria**, preset Nova / Geist)

## Lancer

Deux terminaux :

```bash
# API
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

```bash
# Front
cd web
npm install
npm run dev
```

Ouvre [http://127.0.0.1:5173](http://127.0.0.1:5173)  
(Vite proxy `/api` → `http://127.0.0.1:8001`)

## API

```http
GET /api/movies?brand=all&day=2026-07-23
GET /api/movies?brand=ugc
GET /api/movies?brand=mk2
GET /api/movies?brand=dulac
GET /api/showtimes?theater=C0159&day=2026-07-23
```

`brand` = `all` | `ugc` | `mk2` | `dulac`. Cache ~8 min côté serveur.

## Notes

- Modale film = `Dialog` shadcn sur **React Aria Components**
- Assets dans `web/public/assets/`
- Usage personnel / éducatif : respecte les conditions d’AlloCiné
