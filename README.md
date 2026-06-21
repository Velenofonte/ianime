# iAnime

PWA web per tenere traccia degli anime preferiti, consultare il calendario delle uscite e leggere le news.

**Produzione:** [https://ianime.gigalixirapp.com](https://ianime.gigalixirapp.com)

## Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, PWA (vite-plugin-pwa)
- **Backend:** FastAPI monolite (API + frontend buildato)
- **Database:** PostgreSQL (Gigalixir prod) / SQLite (dev locale)
- **API esterne:** AniList, Jikan, AniNewsAPI

## Funzionalità

- Home con anime popolari e filtri avanzati (titolo, genere, stato, stagioni, score, piattaforma)
- Pannello filtri nascosto di default, espandibile con un tap
- Preferiti sincronizzati su account
- Calendario settimanale uscite (preferiti in corso)
- Dettaglio anime con descrizione completa e toggle EN/IT (traduzione on-demand)
- News aggregate da varie fonti
- Account con cambio password
- PWA installabile con icona personalizzata (poster + «i» con calendario stilizzato)

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

La registrazione pubblica è disabilitata; per cambiare password usa la pagina **Account** dopo il login.

## Deploy su Gigalixir

L'app in produzione si chiama **ianime** (`ianime.gigalixirapp.com`).

```bash
pip install gigalixir
gigalixir login
gigalixir create -n ianime
gigalixir pg:create --free -a ianime
gigalixir config:set JWT_SECRET=your-secret-key -a ianime
gigalixir config:set DEFAULT_SEED_USERNAME=davide -a ianime
gigalixir config:set DEFAULT_SEED_EMAIL=davide@local -a ianime
gigalixir config:set DEFAULT_SEED_PASSWORD='your-secure-password' -a ianime
gigalixir config:set SEED_DEFAULT_USER=true -a ianime
gigalixir config:set ALLOW_REGISTRATION=false -a ianime
gigalixir git:remote -a ianime
npm run deploy
```

`npm run deploy` incrementa automaticamente il build in `client/src/version.json`, crea un commit e fa push su Gigalixir.

Per bump manuale di minor/major: `npm run version:minor` / `npm run version:major`.

Push manuale (sconsigliato, non aggiorna la versione):

```bash
git push gigalixir main
```

URL app: `https://ianime.gigalixirapp.com`

### Icona PWA

Le icone sono in `client/public/icons/`:

| File | Uso |
|------|-----|
| `icon.png` | Favicon e logo nell'header |
| `icon-192.png` | Manifest PWA (192×192) |
| `icon-512.png` | Manifest PWA, Apple Touch Icon (512×512) |

Il manifest è generato da `vite-plugin-pwa` in `client/vite.config.ts`. Dopo un aggiornamento icona, reinstallare la PWA sul dispositivo se l'icona home screen non si aggiorna subito.

## Variabili ambiente

| Variabile | Descrizione |
|-----------|-------------|
| `DATABASE_URL` | Auto su Gigalixir; SQLite in dev |
| `JWT_SECRET` | Chiave segreta JWT |
| `DEFAULT_SEED_USERNAME` | Username utente seed (`davide`) |
| `DEFAULT_SEED_PASSWORD` | Password utente seed (solo alla prima creazione) |
| `DEFAULT_SEED_EMAIL` | Email placeholder seed |
| `SEED_DEFAULT_USER` | `true` per creare utente all'avvio |
| `ALLOW_REGISTRATION` | `false` in produzione (registrazione disabilitata) |
| `CLIENT_URL` | URL frontend (CORS dev) |
| `VITE_API_URL` | `/api` in produzione |
| `LIBRETRANSLATE_URL` | Mirror LibreTranslate (default `https://translate.fedilab.app`) |
| `LIBRETRANSLATE_API_KEY` | Opzionale, solo se il mirror lo richiede |

### Traduzione descrizioni (dettaglio anime)

- Default: testo originale AniList (inglese)
- Toggle **IT**: traduzione via LibreTranslate (mirror pubblico, nessuna registrazione)
- Cache client 7 giorni (`localStorage` + React Query)
- Endpoint `/api/descriptions/translate` protetto da JWT; home e dettaglio richiedono login

Mirror alternativi se il default è offline: `https://translate.cutie.dating`, `https://libretranslate.de`

## Limiti Gigalixir free

- 512 MB RAM — sufficiente per monolite con 1 worker Uvicorn
- Postgres: 2 connessioni, 10.000 righe
- No sleep (app sempre attiva)

## Struttura progetto

```
assistente_test/
├── client/          # React PWA
│   └── public/icons/  # favicon + icone PWA
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
- `DEFAULT_SEED_PASSWORD` non aggiorna la password se l'utente seed esiste già: usa la pagina Account

## Licenza / crediti dati

- [AniList](https://anilist.co)
- [Jikan](https://jikan.moe) (MyAnimeList)
- [AniNewsAPI](https://aninews.vercel.app)
