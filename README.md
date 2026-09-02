# Veasna Monorepo

Monorepo for the Veasna clinical system — a screening-clinic record system for
mobile/outreach clinics, run on one host laptop with other devices connecting
over a local network.

- `apps/backend`: Express + PostgreSQL API
- `apps/frontend`: Next.js web app
- `apps/desktop`: Electron desktop wrapper

## Documentation

- [`FEATURES.md`](FEATURES.md) — what the app does, the patient journey, and the data model
- [`apps/backend/API_DOCUMENTATION.md`](apps/backend/API_DOCUMENTATION.md) — endpoint reference
- [`apps/backend/README.md`](apps/backend/README.md) / [`apps/frontend/README.md`](apps/frontend/README.md) — per-app setup
- [`AGENTS.md`](AGENTS.md) — engineering guidance (LAN-first, offline, no RBAC)

## Ports

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:3001`

Other devices on the LAN reach the app at `http://<host-ip>:3001`; the frontend
figures out the API URL from that host automatically.

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

# First-time backend setup (verifies the DB, seeds the admin user)
npm run setup:backend

# Backend tests — needs a throwaway `veasna_test` database, see apps/backend/README.md
npm run test

# Optional: load demo clinic data (locations, patients, today's queue, pharmacy)
npm run seed:demo

# Frontend lint
npm run lint
```

Incremental DB migrations in `apps/backend/migrations/` are applied
automatically at server startup (idempotent). You only need to run them by hand
when upgrading a database that predates them — see the backend README.

## Notes

- Desktop mode currently wraps the running frontend URL and does not yet package a fully offline app.
- See [`FEATURES.md`](FEATURES.md) for the full feature and data-flow overview,
  and the per-app READMEs for setup.
