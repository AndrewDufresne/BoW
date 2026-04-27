# Book of Work (BoW) — PoC

Lightweight monthly time-allocation tracker. **React + FastAPI + SQLite**.
UI follows the HSBC-inspired design system in [`Docs/DESIGN.md`](Docs/DESIGN.md).

## Documentation

- [Docs/DESIGN.md](Docs/DESIGN.md) — Design system (single source of truth)
- [Docs/ARCHITECTURE.md](Docs/ARCHITECTURE.md) — System architecture
- [Docs/UI_DESIGN.md](Docs/UI_DESIGN.md) — Page-by-page UI spec

## Project layout

```
backend/    FastAPI app  (Poetry + SQLAlchemy + SQLite)
frontend/   React app    (Vite + TypeScript + Tailwind + TanStack Query)
Docs/       Specifications
```

## Prerequisites

- Python 3.11+ and [Poetry 1.8.2](https://python-poetry.org/) (`pipx install poetry==1.8.2` if you don't have it)
- Node.js 20+ and pnpm (`npm i -g pnpm`)

## Run locally

### 1. Backend

```powershell
cd backend
poetry install
poetry run uvicorn app.main:app --reload --port 8000
```

- API base: `http://localhost:8000/api/v1`
- Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`
- On first run, an SQLite file `bow.db` is created and seeded with demo data
  (2 teams, 5 people, 3 projects, 9 activities). Delete the file to reset.

### 2. Frontend

In a second terminal:

```powershell
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` to `http://localhost:8000`.

## Pages

| Route | Purpose |
|-------|---------|
| `/submit` | Allocate 100% of a person's month across projects/activities |
| `/reports` | Placeholder — reserved for the next iteration |
| `/config/teams` `/persons` `/projects` `/activities` | CRUD (soft-delete = deactivate) |

## Production build

```powershell
cd frontend
pnpm build      # outputs to frontend/dist/
```

Serve the static `dist/` behind any web server, with `/api` reverse-proxied to the FastAPI process.

## Notes (PoC scope)

- No authentication / authorization (see `Docs/ARCHITECTURE.md` §10).
- Single-instance deployment, SQLite database.
- Deletes are **deactivations** to preserve historical submissions.
