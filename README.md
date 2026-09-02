# Veasna Monorepo

Monorepo for the Veasna clinical system:

- `apps/backend`: Express + PostgreSQL API
- `apps/frontend`: Next.js web app
- `apps/desktop`: Electron desktop wrapper

## Ports

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:3001`

## Prerequisites

- Node.js 18+ recommended
- PostgreSQL 12+ (for backend)

## Install

From repo root:

```bash
npm install
```

This installs workspace dependencies for all apps.

## Environment Setup

Backend env (`apps/backend/.env`):

```env
DB_USER=your_postgres_user
DB_HOST=localhost
DB_NAME=veasna_screening
DB_PASSWORD=your_postgres_password
DB_PORT=5432

PORT=3000
NODE_ENV=development
JWT_SECRET=replace_with_long_random_secret
```

For LAN/offline deployment, also set `OFFLINE_MODE=true` (and optionally
`CORS_ALLOWED_ORIGINS`) — see `apps/backend/.env.example` and the backend README.

Frontend env (`apps/frontend/.env.local`): none required. The app derives the
backend URL from the page's host at runtime; set `NEXT_PUBLIC_BACKEND_URL` only
for non-standard setups (see `apps/frontend/README.md`).

Optional desktop env (`apps/desktop/.env`):

```env
DESKTOP_FRONTEND_URL=http://localhost:3001
```

You can bootstrap from examples:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/desktop/.env.example apps/desktop/.env
```

## Common Commands

From repo root:

```bash
# Run backend + frontend together
npm run dev

# Run each app individually
npm run dev:backend
npm run dev:frontend
npm run dev:desktop

# Backend setup/test
npm run setup:backend
npm run test

# Apply incremental DB migrations (existing databases only)
psql -U veasna_app -d veasna_screening -f apps/backend/migrations/001_pharmacy_numeric_stock.sql

# Optional: load demo clinic data (locations, patients, today's queue, pharmacy)
npm run seed:demo

# Frontend lint
npm run lint
```

## Notes

- Desktop mode currently wraps the running frontend URL and does not yet package a fully offline app.
- Backend and frontend app-specific documentation is in:
  - `apps/backend/README.md`
  - `apps/frontend/README.md`
