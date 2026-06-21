# Veasna Backend

Express + PostgreSQL API for clinic workflows (registration, queue, triage, visits, consultation, referral, physiotherapy, pharmacy).

## Stack

- Node.js + Express
- PostgreSQL (`pg` connection pool)
- JWT (`jsonwebtoken`) and validation (`express-validator`)
- Security middleware: `helmet`, `cors`
- Tests: Jest + Supertest

## Project Structure

- `server.js`: app entrypoint, middleware, `/api` router, `/health`
- `routes/api.js`: central router and several legacy inline routes
- `routes/*.js`: feature routes (`visits`, `triage`, `pharmacy`, etc.)
- `config/db.js`: PostgreSQL pool and DB helpers
- `db_setup.sql`: schema bootstrap script
- `API_DOCUMENTATION.md`: endpoint reference

## Prerequisites

- Node.js 16+
- PostgreSQL 12+

## Setup

```bash
cd apps/backend
npm install
```

Create a `.env` file in `apps/backend` (or copy from `.env.example`):

```env
DB_USER=your_postgres_user
DB_HOST=localhost
DB_NAME=veasna_backend
DB_PASSWORD=your_postgres_password
DB_PORT=5432

PORT=3000
NODE_ENV=development
JWT_SECRET=replace_with_long_random_secret
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3001
```

Initialize database schema:

```bash
psql -U your_postgres_user -d veasna_backend -f db_setup.sql
```

Optional setup check:

```bash
npm run setup
```

## Run

```bash
# Development
npm run dev

# Production
npm start
```

Server defaults to `http://localhost:3000`.

From monorepo root, equivalent commands are:

```bash
npm run dev:backend
npm run setup:backend
```

## Testing and Formatting

```bash
npm test
npm run format
```

## API Overview

All routes are mounted under `/api`.

Main route groups:

- `/api/auth` (`routes/session.js`)
- `/api/locations`
- `/api/registration`
- `/api/queue`
- `/api/visits`
- `/api/patients`
- `/api/patient`
- `/api/pharmacy`
- `/api/triage`
- `/api/users` (in `routes/api.js`)

For full endpoint docs and payloads, see `API_DOCUMENTATION.md`.

## Authentication Notes

- Login endpoint is `POST /api/auth/login` (username-based, no password flow).
- JWT expiry is currently `30d`.
- The current middleware behavior is permissive/public-first for many routes.

## Current Caveats

- The codebase contains both newer visit-centric routes and older legacy patient-centric routes.
- `express-rate-limit` is configured in `server.js` but not currently applied.
- There is no ORM and no migration framework; schema changes are managed via SQL scripts.