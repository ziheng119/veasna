# Veasna Backend

The server behind the Veasna app. It stores clinic data in PostgreSQL and serves it
to every staff device on the local network, including live queue updates. It needs
no internet connection.

## Database setup (first time)

### 1. Install PostgreSQL

- **Windows:** download the installer from https://www.postgresql.org/download/windows/
  (do this while you still have internet). Keep the default port `5432` and remember
  the password you choose for the `postgres` user.
- **macOS:** `brew install postgresql@16`, then `brew services start postgresql@16`.
- **Ubuntu/Debian:** `sudo apt install postgresql`, then `sudo systemctl start postgresql`.

### 2. Create the database and its user

Open a PostgreSQL shell: on Windows, run **SQL Shell (psql)** from the Start menu.
On macOS or Linux, run `psql postgres`. Then run:

```sql
CREATE DATABASE veasna_screening;
CREATE USER veasna_app WITH PASSWORD 'change_me';
GRANT ALL PRIVILEGES ON DATABASE veasna_screening TO veasna_app;
\q
```

Replace `change_me` with a password of your own.

Prefer a graphical tool? In pgAdmin, create a login role `veasna_app` with a
password, then create a database `veasna_screening` owned by that role.

### 3. Enter your settings

From the project folder, create the settings files from their templates:

```bash
npm run setup:env
```

Open `apps/backend/.env` and change at least these lines:

```env
DB_USER=veasna_app
DB_PASSWORD=change_me            # the password from step 2
JWT_SECRET=a-long-random-phrase  # keeps sign-ins secure; any long random text
```

The other settings are explained in [settings](#settings) below.

### 4. Create the tables

From `apps/backend`:

```bash
psql -U veasna_app -d veasna_screening -f db_setup.sql
```

Enter the password from step 2 if asked. In pgAdmin, open the Query Tool on
`veasna_screening` and run `db_setup.sql` instead.

Run this **only on a new, empty database**. Never run it again on a database that
already has patient data.

### 5. Check the connection and create the accounts

```bash
npm run setup:backend
```

This checks that the server can reach the database and sets up the two sign-in
accounts (`admin` / `admin12345` and `user` / `user`). It is safe to run again.

### 6. Load practice data (optional)

```bash
npm run seed:demo
```

This adds sample locations (Poipet, Mongkol Borey, Sisophon), patients, a queue for
today and pharmacy stock. Running it again skips anything already added.

### Updating an existing database

You do not need to run any update scripts by hand. When the server starts, it adds
any new tables and columns automatically, without touching existing records. The SQL
files in `migrations/` are kept as a record of each change.

## Running the server

From the project folder:

```bash
npm start              # server and web app together, for clinic use
npm run dev:backend    # server only, restarting when code changes
```

When the server starts, it prints the addresses other devices should use, for
example `LAN: http://192.168.68.50:3000/health`. If PostgreSQL is not ready yet, it
waits up to 60 seconds. If PostgreSQL still isn't ready, the server starts anyway
and `/health` reports the problem. Restart the server once PostgreSQL is running.
Press Ctrl+C to stop it cleanly.

To check that it is working, open `/health` in a browser:

- `"database": "ok"` means everything is connected.
- `realtimeClients` is the number of devices currently receiving live updates.

## Settings

Settings shared by both modes live in `apps/backend/.env`. Settings for one mode go in
`apps/backend/.env.development` (`npm run dev`) or `apps/backend/.env.production`
(`npm start`), and win over `.env` (`config/env.js`). The templates put
`NEXT_PUBLIC_FRONTEND_URL`, `ALLOW_LAN_ORIGINS` and `MDNS_NAME` in the mode files. Mode
comes from the command, so `NODE_ENV` lines in the files are ignored. See
[development and clinic settings](../../docs/performance-and-lan.md#development-and-clinic-settings).

| Setting | What it does |
| --- | --- |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT` | How to reach PostgreSQL. Keep `DB_HOST=localhost`, so the database is never exposed to the network. |
| `PORT` | The server's port (default `3000`). |
| `JWT_SECRET` | Any long random text. Changing it signs everyone out. |
| `NEXT_PUBLIC_FRONTEND_URL` | The web app address(es) allowed to connect, separated by commas, e.g. `http://192.168.68.50:3001`. |
| `ALLOW_LAN_ORIGINS` | Set to `true` to allow a web app on any local network address or `.local` name. Useful when device IPs change. |
| `MDNS_NAME` | A name devices can use instead of the IP, e.g. `veasna` for `http://veasna.local:3001`. Works offline. Leave empty to turn off. See [using a name instead of the IP](../../docs/performance-and-lan.md#using-a-name-instead-of-the-ip). |
| `API_RATE_LIMIT_MAX` | Requests allowed per device every 15 minutes (default `5000`). Raise it if devices see "too many requests" errors. |

See [running on a local network](../../docs/performance-and-lan.md) for a full
router setup with several devices.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL isn't running. On Windows, start the **postgresql** service from the Services app. |
| `password authentication failed` | The password in `.env` doesn't match. Fix `.env`, or reset the password with `ALTER USER veasna_app WITH PASSWORD 'new_password';` in psql. |
| `database "veasna_screening" does not exist` | Go back to step 2. |
| `relation "..." does not exist` | The tables are missing. Go back to step 4. |
| `/health` shows HTTP 503 | The server is running but can't reach PostgreSQL. Start PostgreSQL, then restart the server. |
| Other devices can't connect | See [checking each device](../../docs/performance-and-lan.md#check-each-device). |

## How the server behaves

These rules are enforced by the server, so they apply on every device:

- **Sign-in:** every request except sign-in needs a signed-in account. A sign-in lasts
  7 days. Account changes (such as a role change) apply at the next sign-in.
- **Permissions:** users can enter new records; only admins can change or delete
  saved ones. See [accounts and permissions](../../docs/user-roles.md).
- **Clinic day:** "today" is the host laptop's date, so set its clock and time zone
  correctly.
- **Stations:** each visit goes through only the stations it needs, in clinic order
  (`STATIONS` in `utils/stations.js`): Triage, Dental, Consultation, Physiotherapy, Partner
  NGO (`seva`), Pharmacy. Dental is before Consultation so the doctor sees what dental found. It waits in one queue at a time. Registration offers
  `REGISTRATION_STATIONS`; Physiotherapy is added by the doctor and Pharmacy by prescribing
  (`setStationNeeded` in `utils/stationRoute.js`). Migration `018_dental_pharmacy_stations.sql`
  adds the two stations and the `dental` table.
- **TB flag:** suspected TB is a flag on the visit, set at registration or at Triage when
  3 or more red flags are ticked (`TB_MIN_RED_FLAGS` in `utils/tb.js`, mirrored in
  `apps/frontend/src/constants/tb.ts`). The patient goes only to Consultation (`TB_ROUTE`):
  their other unfinished stations are removed, and `PUT /api/queue/:visitId/stations` is
  refused for any visit with a TB record. They are shown in red with a "TB" label in every
  queue. Anyone can clear the flag, but only while the visit is waiting at Consultation
  (`409` otherwise); clearing also removes any other stations left on its route
  (`sendToConsultation`). Finishing Consultation ends their stations, and
  their prescriptions wait at Pharmacy. Only an admin can change an existing flag's red
  flags or notes.
- **Queue numbers** are text, always issued automatically: 1, 2, 3... per location and
  day, under the location's queue lock. Families have their own letter (`patients.family`),
  set with `POST /api/family` (`routes/family.js`, `utils/family.js`), and move between
  stations together (`utils/familyMoves.js`). Queue numbers are unique per location and day,
  kept so by the app (there is no database constraint). Admin corrections can't run
  ahead of the next number (`queueNoJumpError` in `utils/queueNumber.js`).
- **Partner NGO** (formerly Seva): patients are added from the Triage visual acuity form
  when a cataract is suspected. The station is still `seva` in the database and API; its
  display name is `PARTNER_NGO_NAME` in `apps/frontend/src/constants/partnerNgo.ts`.
- **Prescriptions** are chosen from the location's pharmacy. Prescribing reserves stock
  at once; the pharmacy dispenses (stock goes down) or cancels (stock is released).
- **Visual acuity** is recorded as a Snellen fraction such as `20/20` or `20/40`.
- **Unique ID** is made automatically from the first 3 letters of the English and
  Khmer names plus the date of birth (e.g. `SOKសុខ07031990`). It updates when those
  details change and can't be typed in. Two patients can share one Unique ID.
- **Partial saves:** station forms can be saved half-filled. Registration still needs
  name, sex, vitals and HEF answers.
- **Admin corrections:** on Patient Details, admins can correct a patient's details
  and every part of a past visit. Each section saves separately, so it doesn't
  overwrite someone else working on another section.
- **Pharmacy stock:** each medicine has stock on the shelf, stock reserved by
  prescriptions waiting at the pharmacy, and the available rest. Only available stock
  can be prescribed or dispensed without a prescription. Stock-takes cannot go below
  the reserved amount, and a medicine with waiting prescriptions cannot be deleted.
  Every stock change locks the medicine first, so two devices acting at once both
  count correctly.
- **Dates** are stored and returned as plain `YYYY-MM-DD`, so they don't shift a day
  between devices.

## For developers

| Path | Contents |
| --- | --- |
| `server.js` | Starts the server: security, rate limits, live updates, `/health` and error handling |
| `routes/` | One file per feature (`visits`, `queue`, `triage`, `pharmacy`, ...); `api.js` connects them |
| `utils/ensureSchema.js` | Applies `migrations/` automatically at start-up |
| `utils/validation.js` | Shared input checks |
| `db_setup.sql` | Full schema for a new database |
| `scripts/` | Setup, account and demo data scripts, and `check:lan` |
| `API_DOCUMENTATION.md` | Endpoint reference |

Built with Node.js, Express, PostgreSQL (`pg`, no ORM), Socket.IO, JWT sign-in, Jest
and Supertest.

```bash
npm test                                   # from apps/backend
npm run format                             # Prettier
```

Files named `*.database.test.js` use temporary tables only and are skipped unless you
set `RUN_DB_TESTS=1` (PowerShell: `$env:RUN_DB_TESTS='1'`). Three older test files
(`users`, `locations`, `registration_and_components`) write to the real database, so
don't run the full suite against a clinic database. See the
[main README](../../README.md#for-developers).
