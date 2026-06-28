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
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin12345
```

## Database Setup (PostgreSQL)

Yes, the current backend requires a PostgreSQL database.

1. Install PostgreSQL (if not installed):

2. Create database and user:

```bash
psql postgres
```

Then run:

```sql
CREATE DATABASE veasna_backend;
CREATE USER veasna_app WITH PASSWORD 'change_me';
GRANT ALL PRIVILEGES ON DATABASE veasna_backend TO veasna_app;
\q
```

3. Update `.env` to match your DB credentials:

```env
DB_USER=veasna_app
DB_HOST=localhost
DB_NAME=veasna_backend
DB_PASSWORD=change_me
DB_PORT=5432
```

What each value means:

- `DB_USER`: PostgreSQL role/username used by the backend to connect.
- `DB_HOST`: database server address (`localhost` means your own machine).
- `DB_NAME`: target database name in PostgreSQL.
- `DB_PASSWORD`: password for `DB_USER` (must match the role password in PostgreSQL).
- `DB_PORT`: PostgreSQL port (`5432` is the default).

How the backend uses these values:

- On startup, the backend loads `.env`.
- `config/db.js` creates a PostgreSQL connection pool from these variables.
- All API queries (`db.query(...)`) run through that pool.

If any value is incorrect, database calls will fail with connection/auth/database errors.

4. Initialize schema:

```bash
psql -U veasna_app -d veasna_backend -f db_setup.sql
```

5. Verify backend can connect:

```bash
npm run setup
```

If `npm run setup` succeeds, your DB setup is complete and it will automatically create (or reactivate) the admin user from `ADMIN_USERNAME` (with password from `ADMIN_PASSWORD`).

Manual admin seed (any time):

```bash
npm run seed:admin
```

### Alternative: Setup with pgAdmin

If you prefer GUI setup:

1. Open pgAdmin and connect to your local PostgreSQL server.
2. Create a login role:
   - Go to `Login/Group Roles` -> `Create` -> `Login/Group Role`
   - Name: `veasna_app`
   - Set password to match `DB_PASSWORD` in `.env`
   - Enable login privilege
3. Create database:
   - Go to `Databases` -> `Create` -> `Database`
   - Database name: `veasna_backend`
   - Owner: `veasna_app`
4. Initialize schema:
   - Open Query Tool on `veasna_backend`
   - Open and run `apps/backend/db_setup.sql`
5. Confirm `.env` values in `apps/backend/.env`:

```env
DB_USER=veasna_app
DB_HOST=localhost
DB_NAME=veasna_backend
DB_PASSWORD=change_me
DB_PORT=5432
```

6. Run:

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

- Register endpoint: `POST /api/auth/register` with `{ username, password }`.
- Login endpoint: `POST /api/auth/login` with `{ username, password }`.
- Password must be at least 8 characters.
- JWT expiry is currently `30d`.
- Some existing routes still use permissive/public-first middleware behavior.

## Current Caveats

- The codebase contains both newer visit-centric routes and older legacy patient-centric routes.
- `express-rate-limit` is configured in `server.js` but not currently applied.
- There is no ORM and no migration framework; schema changes are managed via SQL scripts.
