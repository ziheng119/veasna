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
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3001
```

Frontend env (`apps/frontend/.env.local`):

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

Optional desktop env (`apps/desktop/.env`):

```env
DESKTOP_FRONTEND_URL=http://localhost:3001
```

You can bootstrap from examples:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
cp apps/desktop/.env.example apps/desktop/.env
```

## Common Commands

Patient registration is available on Home. The **+ (Add patient)** link on Patient List
opens the same form, using the selected location and the same validation and queue workflow.
Older `/patient-form?mode=new` links redirect to the registration form on Home.

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

- Active visits can revisit or defer stations using **Stations**. See [station routing](docs/station-routing.md) for workflow, migration, and tests.

- Desktop mode currently wraps the running frontend URL and does not yet package a fully offline app.
- Backend and frontend app-specific documentation is in:
  - `apps/backend/README.md`
  - `apps/frontend/README.md`

### Live queue and patient lists

- Queue and patient lists update across users through authenticated Socket.IO connections on the existing backend port. Reconnecting reloads missed changes without replacing open form drafts.
- For LAN access, set `NEXT_PUBLIC_BACKEND_URL` to the host laptop's IP and API port, and list allowed frontend origins in the backend's `NEXT_PUBLIC_FRONTEND_URL` (comma-separated). Restart both services after configuration changes.
- Uses one backend instance with no Internet or extra service required. Direct SQL edits do not trigger updates.

Run isolated tests (no clinic database writes):

```bash
npm run test --workspace apps/backend -- --runInBand tests/realtime.test.js
npm run test --workspace apps/frontend -- --runInBand
```
