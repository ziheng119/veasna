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
DB_NAME=veasna_screening
DB_PASSWORD=your_postgres_password
DB_PORT=5432

PORT=3000
NODE_ENV=development
JWT_SECRET=replace_with_long_random_secret
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3001
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin12345
```

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

This creates all required tables, indexes, and seed data:

```bash
psql -U veasna_app -d veasna_screening -f db_setup.sql
```

If prompted for a password, enter the one you set in step 2.

### 5. Run the setup script

```bash
npm run setup
```

This verifies the database connection and creates the initial admin user using `ADMIN_USERNAME` and `ADMIN_PASSWORD` from your `.env`.

You can re-run this at any time. To seed just the admin user:

```bash
npm run seed:admin
```

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
5. Confirm your `.env` matches, then run `npm run setup`.

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
