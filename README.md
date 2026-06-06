# Anime Tracker

Applicazione web PWA per tenere traccia degli anime preferiti, consultare il calendario delle uscite e leggere le news.

## Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, PWA (vite-plugin-pwa)
- **Backend:** FastAPI monolite (API + frontend buildato)
- **Database:** PostgreSQL (Gigalixir prod) / SQLite (dev locale)
- **API esterne:** AniList, Jikan, AniNewsAPI

## Funzionalità

- Home con anime popolari, filtri (titolo, genere, stato, stagioni, piattaforma)
- Preferiti sincronizzati su account
- Calendario settimanale uscite (preferiti in corso)
- News aggregate da varie fonti
- PWA installabile

## Prerequisiti

- Node.js 20+
- Python 3.12+
- Account [Gigalixir](https://gigalixir.com) (deploy produzione)

## Sviluppo locale

### 1. Backend

```bash
cd server
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy ..\.env.example .env     # imposta DEFAULT_SEED_PASSWORD
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

Apri http://localhost:5173 — il proxy inoltra `/api` a `:8000`.

### Login

Utente seed: **davide** (password impostata in `DEFAULT_SEED_PASSWORD` nel file `.env`).

## Deploy su Gigalixir

```bash
pip install gigalixir
gigalixir login
gigalixir create -n anime-tracker
gigalixir pg:create --free
gigalixir config:set JWT_SECRET=your-secret-key
gigalixir config:set DEFAULT_SEED_USERNAME=davide
gigalixir config:set DEFAULT_SEED_EMAIL=davide@local
gigalixir config:set DEFAULT_SEED_PASSWORD='2Kb!$fmhBxxmS%Yq'
gigalixir git:remote -a anime-tracker
git push gigalixir main
```

URL app: `https://anime-tracker.gigalixirapp.com`

## Variabili ambiente

| Variabile | Descrizione |
|-----------|-------------|
| `DATABASE_URL` | Auto su Gigalixir; SQLite in dev |
| `JWT_SECRET` | Chiave segreta JWT |
| `DEFAULT_SEED_USERNAME` | Username utente seed (`davide`) |
| `DEFAULT_SEED_PASSWORD` | Password utente seed |
| `DEFAULT_SEED_EMAIL` | Email placeholder seed |
| `SEED_DEFAULT_USER` | `true` per creare utente all'avvio |
| `CLIENT_URL` | URL frontend (CORS dev) |
| `VITE_API_URL` | `/api` in produzione |

## Limiti Gigalixir free

- 512 MB RAM — sufficiente per monolite con 1 worker Uvicorn
- Postgres: 2 connessioni, 10.000 righe
- No sleep (app sempre attiva)

## Struttura progetto

```
assistente_test/
├── client/          # React PWA
├── server/          # FastAPI + Alembic
├── scripts/         # build.sh
├── Procfile         # deploy Gigalixir
├── requirements.txt # Python deps (root)
└── package.json     # Node build (heroku-postbuild)
```

## Note

- Doppiaggio/sottotitoli IT: euristica da link AniList, non dati ufficiali geo-IT
- Le piattaforme streaming sono indicative (AniList non filtra per Italia)
- Non committare `.env` con password reali

## Licenza / crediti dati

- [AniList](https://anilist.co)
- [Jikan](https://jikan.moe) (MyAnimeList)
- [AniNewsAPI](https://aninews.vercel.app)
