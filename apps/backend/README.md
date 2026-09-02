# Veasna Backend

Express + PostgreSQL API for clinic workflows (registration, queue, triage, visits, consultation, referral, physiotherapy, pharmacy).

## Stack

- Node.js + Express
- PostgreSQL (`pg` connection pool)
- JWT (`jsonwebtoken`) and validation (`express-validator`)
- Security middleware: `helmet`, `cors`
- Tests: Jest + Supertest

## Project Structure

- `server.js`: app entrypoint, middleware, `/api` router, `/health`, startup migrations
- `routes/api.js`: mounts the feature routers; also holds the `/api/users` roster endpoints
- `routes/*.js`: feature routes (`session`, `locations`, `patients`/`patient`, `registration`, `queue`, `visits`, `triage`, `pharmacy`)
- `config/db.js`: PostgreSQL pool and password helpers
- `utils/ensureSchema.js`: runs the incremental migrations at boot
- `db_setup.sql`: full schema for fresh installs
- `migrations/`: incremental SQL (also auto-applied at startup)
- `scripts/`: setup, admin seed, and optional demo seed
- `tests/`: Jest + Supertest suite (runs against a throwaway `veasna_test` DB)
- `API_DOCUMENTATION.md`: endpoint reference

For the product-level picture (stations, patient journey, data model) see
[`../../FEATURES.md`](../../FEATURES.md).

## Prerequisites

- Node.js 18+ recommended
- PostgreSQL 12+

## Setup

From repo root:

```bash
npm install
cp apps/backend/.env.example apps/backend/.env
```

This installs workspace dependencies for all apps. Then fill in `apps/backend/.env`:

```env
DB_USER=your_postgres_user
DB_HOST=localhost
DB_NAME=veasna_screening
DB_PASSWORD=your_postgres_password
DB_PORT=5432

PORT=3000
NODE_ENV=development
JWT_SECRET=replace_with_long_random_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin12345
```

For LAN/offline deployment options (`CORS_ALLOWED_ORIGINS`, `OFFLINE_MODE`,
rate-limit ceilings, `ALLOW_OPEN_REGISTRATION`) see
[LAN / Offline Configuration](#lan--offline-configuration) and `.env.example`.

## Database Setup (First-Time)

The backend requires PostgreSQL. Follow these steps to get it running from scratch.

### 1. Install PostgreSQL

**macOS (Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**

Download and run the installer from https://www.postgresql.org/download/windows/. Use the default port (5432) and remember the password you set for the `postgres` superuser.

### 2. Create the database and user

Open a PostgreSQL shell:

```bash
# macOS / Linux
psql postgres

# Windows (from the SQL Shell that ships with the installer)
psql -U postgres
```

Run the following SQL:

```sql
CREATE DATABASE veasna_screening;
CREATE USER veasna_app WITH PASSWORD 'change_me';
GRANT ALL PRIVILEGES ON DATABASE veasna_screening TO veasna_app;
\q
```

Replace `'change_me'` with a password of your choice.

### 3. Configure environment variables

From `apps/backend`, copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` so the DB values match what you just created:

```env
DB_USER=veasna_app
DB_HOST=localhost
DB_NAME=veasna_screening
DB_PASSWORD=change_me
DB_PORT=5432
```

### 4. Initialize the schema

This creates all required tables and indexes:

```bash
psql -U veasna_app -d veasna_screening -f db_setup.sql
```

If prompted for a password, enter the one you set in step 2.

Fresh installs can skip the next step — `db_setup.sql` already includes the current schema.

### 5. Incremental migrations

The server applies every file in `migrations/` at startup (idempotent), so a
**fresh `db_setup.sql` install needs nothing here**. Migration `003` is the
exception to "best effort": if a pre-existing database already has two active
visits sharing a queue number it logs the offending rows and the server exits —
fix the data and restart.

If you are upgrading a database that predates these migrations and want to apply
them by hand, run them in order (do not re-run `db_setup.sql` on a database with
data):

```bash
for f in migrations/*.sql; do psql -U veasna_app -d veasna_screening -f "$f"; done
```

### 6. Run the setup script

```bash
npm run setup
```

This verifies the database connection and creates the initial admin user using `ADMIN_USERNAME` and `ADMIN_PASSWORD` from your `.env`.

You can re-run this at any time. To seed just the admin user:

```bash
npm run seed:admin
```

### 7. Load demo data (optional)

After the admin user exists, you can load sample locations, patients, today's queue, and pharmacy stock:

```bash
npm run seed:demo
```

Equivalent SQL:

```bash
psql -U veasna_app -d veasna_screening -f scripts/seed_demo.sql
```

Safe to re-run: existing rows are skipped. Demo locations are Poipet, Mongkol Borey, and Sisophon. Today's queue is seeded for the current date.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL isn't running. Start it with `brew services start postgresql@16` or `sudo systemctl start postgresql`. |
| `password authentication failed` | The password in `.env` doesn't match the PostgreSQL role. Reset it with `ALTER USER veasna_app WITH PASSWORD 'new_password';` in `psql postgres`. |
| `database "veasna_screening" does not exist` | You haven't created the database yet — go back to step 2. |
| `relation "..." does not exist` | Schema not loaded — run step 4 again. |

### Alternative: Setup with pgAdmin (GUI)

1. Open pgAdmin and connect to your local PostgreSQL server.
2. Create a login role:
   - `Login/Group Roles` → `Create` → `Login/Group Role`
   - Name: `veasna_app`, set a password, enable login privilege
3. Create database:
   - `Databases` → `Create` → `Database`
   - Name: `veasna_screening`, Owner: `veasna_app`
4. Initialize schema:
   - Open Query Tool on `veasna_screening`
   - Open and execute `apps/backend/db_setup.sql`
5. Confirm your `.env` matches, then run `npm run setup`. Optionally load demo data with `npm run seed:demo`. For an existing (not freshly initialized) database, also run the SQL files in `migrations/` in order.

## Run

```bash
# Development
npm run dev

# Production
npm start
```

Server defaults to `http://localhost:3000`.

From repo root, equivalent commands are:

```bash
# Run backend + frontend together
npm run dev

# Run the backend only
npm run dev:backend

# Backend setup/test
npm run setup:backend
npm run test        # needs a veasna_test database — see "Testing and Formatting"

# Optional: load demo clinic data (locations, patients, today's queue, pharmacy)
npm run seed:demo
```

## Testing and Formatting

The test suite runs against a throwaway PostgreSQL database (never your dev DB —
the harness refuses any database whose name does not contain `test`). Create it
once:

```bash
createdb veasna_test
psql -d veasna_test -f db_setup.sql
```

Then:

```bash
npm test        # rebuilds the veasna_test schema, then runs jest
npm run format
```

Override the test DB connection with `TEST_DB_NAME`, `TEST_DB_USER`,
`TEST_DB_PASSWORD`, `TEST_DB_HOST`, `TEST_DB_PORT` if needed. The suite sets
`OFFLINE_MODE=true` and a high `AUTH_RATE_LIMIT_MAX` so rate limiting never
interferes.

## API Overview

All routes are mounted under `/api`.

Main route groups:

- `/api/auth` — register / login (`routes/session.js`)
- `/api/users` — user roster (`routes/api.js`)
- `/api/locations`
- `/api/patients`, `/api/patient` — patient reads + demographic update
- `/api/registration` — patient deletion only (creation/updates are `POST /api/visits`)
- `/api/queue`
- `/api/visits` — visit creation + per-visit clinical records
- `/api/triage`
- `/api/pharmacy` — stock, dispensing, `dispense_log`

For full endpoint docs and payloads, see `API_DOCUMENTATION.md`.

## Authentication Notes

- Register: `POST /api/auth/register` with `{ username, password }` (password ≥ 8 chars). Public unless `ALLOW_OPEN_REGISTRATION=false`.
- Login: `POST /api/auth/login` with `{ username, password }`.
- JWT expiry is `7d`.
- Every `/api` route except `/api/auth/*` requires the `authenticateToken` middleware. There is no role system — `requireRole(['any'])` (the only variant used) just means "any authenticated user".

## LAN / Offline Configuration

- `CORS_ALLOWED_ORIGINS` — comma-separated allowlist of browser origins. If unset,
  the server reflects the request origin, which is what LAN clients need (they
  reach the app via the host's IP, not `localhost`). Set an explicit list to
  lock it down.
- `OFFLINE_MODE=true` — skips the general `/api/` rate limiter (abuse is not the
  threat model on a trusted private network). The `/api/auth/` limiter still
  applies.
- `API_RATE_LIMIT_MAX` (default 1000) / `AUTH_RATE_LIMIT_MAX` (default 100) —
  per-IP request ceilings per 15-minute window.
- `ALLOW_OPEN_REGISTRATION` — set to `false` to require a valid token for
  `POST /api/auth/register` (any signed-in user can then create accounts).
  Defaults to open.

## Current Caveats

- `express-rate-limit` is keyed by client IP: `/api/` (`API_RATE_LIMIT_MAX`, default 1000 req/15 min, skipped when `OFFLINE_MODE=true`) and `/api/auth/` (`AUTH_RATE_LIMIT_MAX`, default 100 req/15 min, always on).
- There is no ORM and no migration framework; schema changes are managed via SQL scripts.
- Migrations in `migrations/` are applied at server startup (idempotent SQL): `password_hash`, pharmacy `stock_count`, visits `completed_at`, the queue-number unique index (003), and `dispense_log` (004). The 003 index is not best-effort — if active visits already share a queue number the server logs the offending rows and exits; resolve them and restart.
