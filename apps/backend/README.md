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
CREATE USER veasna_app WITH PASSWORD 'change_me' CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE veasna_screening TO veasna_app;
\q
```

Replace `change_me` with a password of your own. `CREATEDB` lets `npm run restore` put a
backup into a new database.

Prefer a graphical tool? In pgAdmin, create a login role `veasna_app` with a
password and the "Create databases" privilege, then create a database `veasna_screening` owned by that role.

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

This checks that the server can reach the database, sets up the admin sign-in
(`admin` / `admin12345`) and disables the old shared `user` sign-in. Everyone else
signs in with a screening-day account made on the Accounts page. It is safe to run
again.

### 6. Load practice data (optional)

```bash
npm run seed:demo
```

This adds sample patients, a queue for today and pharmacy stock. Running it again skips
anything already added.

### Updating an existing database

You do not need to run any update scripts by hand. When the server starts, it adds
any new tables and columns automatically, without touching existing records. The SQL
files in `migrations/` are kept as a record of each change.

**Locations were removed** (`migrations/027_remove_locations.sql`): there is one clinic,
so the `locations` table and every `location_id` column go the first time an updated
server starts. **Take a backup first** (`npm run backup`): which location each patient,
visit and drug belonged to is not kept. The migration also:

- merges a drug kept at more than one location into one row holding the stock of all of
  them; its prescriptions and dispenses point at that row;
- gives a family whose letter was also used at another location the first free letter,
  so families never merge;
- refuses a repeated queue number on the same day from then on. Past days where two
  locations both issued a number keep both (the server logs this once at start-up).

`migrations/028_account_permissions.sql` adds `users.permissions`; existing accounts get
**See today's patients** and **Edit today's queue**, which is what they could do before.

## Running the server

From the project folder:

```bash
npm start              # server and web app together, for clinic use; either restarts if it crashes
npm run dev:backend    # server only, restarting when code changes
```

When the server starts, it prints the addresses other devices should use, for
example `LAN: http://192.168.68.50:3000/health`. If PostgreSQL is not ready yet, it
waits up to 60 seconds. If PostgreSQL still isn't ready, the server starts anyway
and `/health` reports the problem. Restart the server once PostgreSQL is running.
Press Ctrl+C to stop it cleanly.

To check that it is working, open `/health` in a browser:

- `"database": "ok"` means everything is connected.
- `lastBackup` is the latest automatic backup: when (`at`) and where (`file`), plus
  `error` and `failed_at` when the latest attempt failed. `null` until the first.
- `realtimeClients` is the number of devices currently receiving live updates. Every
  device is told about every change (`realtime.js`).
- `server_time`, `server_date` and `utc_offset_minutes` are the host's clock, which
  every device uses for "today".

## Backups

All records live in this laptop's database, so keep copies off it. Backups need no
internet. `npm start` saves one when it starts and every 2 hours while it runs; `/health`
shows the latest as `lastBackup` (with `error` if the latest attempt failed). A failed
backup never stops the server.

**Take a backup now**, for example at the end of a clinic day. From the project folder:

```bash
npm run backup                      # into the backups/ folder
npm run backup -- E:\veasna-backups # or straight onto a USB stick
```

On Windows you can instead double-click `backup.cmd` in the project folder, or drag a
folder (such as the USB stick) onto it to save the backup there.

Backups are named by date and time, for example `veasna-2026-11-11_173000.dump`, and the
newest 30 in each folder are kept. Keep at least one copy off the host laptop after every
clinic day: a USB stick, or another laptop.

**Check that a backup restores.** Do this before each trip; it changes nothing:

```bash
npm run restore -- latest --check
# Backup OK: veasna-2026-11-11_173000.dump restores with 120 patients, 140 visits, 11 accounts.
```

**Restore a backup**, after a lost database or on a replacement laptop:

```bash
npm run restore                                  # lists the backups
npm run restore -- latest                        # restores the newest
npm run restore -- E:\veasna-backups\veasna-2026-11-11_173000.dump  # or a chosen file
```

Restoring:
1. backs up the current database first, if it can still be reached;
2. restores into a new database, named like `veasna_restored_20261111_180000`, and shows
   how many patients, visits and accounts it holds;
3. sets `DB_NAME` in `apps/backend/.env` to that database.

Then restart the server (Ctrl+C, then `npm start`). The old database is never changed: to
go back, set `DB_NAME` to the name the restore printed and restart.

On a replacement laptop, first install PostgreSQL and do steps 2–3 of
[Database setup](#database-setup-first-time) (the database user and `.env`); skip step 4,
since the restore brings the tables. The database user needs permission to create
databases (`ALTER USER veasna_app CREATEDB;` in psql), as in step 2.

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
| `BACKUP_DIR` | Where backups go (default: the project's `backups/` folder). Can be a USB stick, e.g. `E:\veasna-backups`. |
| `BACKUP_INTERVAL_HOURS` | Hours between automatic backups under `npm start` (default `2`; `0` turns them off). |
| `BACKUP_KEEP` | How many backups to keep (default `30`); older ones are deleted. |
| `PG_BIN` | The PostgreSQL `bin` folder, if backups say `pg_dump was not found`. On Windows the newest installed version is found automatically. |
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
| Start-up says queue numbers repeat on some past days | Before locations were removed, two locations could issue the same number on one day. Those days keep both; the database refuses a repeated number only on later days (`migrations/027_remove_locations.sql`). Nothing needs doing. |
| `Backup failed: pg_dump was not found` (or `createdb`, `pg_restore`) | Set `PG_BIN` in `.env` to PostgreSQL's `bin` folder. |
| `Restore failed: permission denied to create database` | In psql, run `ALTER USER veasna_app CREATEDB;`, then try again. |
| `Backup failed: ... server version mismatch` | `pg_dump` is older than the database. Install the matching PostgreSQL version, or point `PG_BIN` at its `bin` folder. |
| Other devices can't connect | See [checking each device](../../docs/performance-and-lan.md#check-each-device). |

## How the server behaves

These rules are enforced by the server, so they apply on every device:

- **Sign-in:** every request except sign-in needs a signed-in account. A sign-in lasts
  7 days and is renewed while the device is in use (when less than 3 days are left, the
  next page change gets a new one), so a device in daily use stays signed in. Account
  changes apply straight away: the account is re-read on every request, and a disabled
  account or an expired sign-in gets `401`, which signs the device out.
- **Permissions:** every account can enter and correct records. A screening-day
  account only reaches its day's patients, and their earlier visits are read-only to it.
  After its day (the host's date is past its screening date) it can't sign in, and every
  request with it gets `401`, so devices still signed in with it sign out. The account and
  its records are kept.
  Deleting records, pharmacy stock changes, Analytics, downloads and settings are
  admin-only. See [accounts and permissions](../../docs/user-roles.md).
- **Clinic day:** "today" is the host laptop's date, so set its clock and time zone
  correctly. Devices use the host's date too (see `utils/hostClock.js`), whatever their
  own clock says.
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
- **Queue numbers** are text, always issued automatically: 1, 2, 3... per day, under the
  queue lock. Families have their own letter (`patients.family`), set with
  `POST /api/family` and `POST /api/family/group` (`routes/family.js`, `utils/family.js`), and move between stations
  together (`utils/familyMoves.js`). Queue numbers are unique per day, kept so by the app
  and by the `visits_day_queue_no_key` index. Admin corrections can't run
  ahead of the next number (`queueNoJumpError` in `utils/queueNumber.js`).
- **Partner NGO** (formerly Seva): patients are added from the Triage visual acuity form
  when a cataract is suspected. The station is still `seva` in the database and API; its
  display name is `PARTNER_NGO_NAME` in `apps/frontend/src/constants/partnerNgo.ts`.
- **Prescriptions** are chosen from the pharmacy. Prescribing reserves stock
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
set `RUN_DB_TESTS=1` (PowerShell: `$env:RUN_DB_TESTS='1'`); they connect with
`apps/backend/.env` but never change its data. Every other test mocks the database. See
the [main README](../../README.md#for-developers).
