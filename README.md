# Veasna

Veasna is the patient screening system for Veasna clinics. It handles registration,
station queues (TB Tent, Triage, Seva, Physiotherapy, Consultation), referrals,
pharmacy stock and analytics.

It is built to run **without internet**. One laptop (the "host") runs the database
and the server. Other laptops and tablets on the same router open the app in a
browser using the host's IP address.

The project has three parts:

| Folder | What it is |
| --- | --- |
| `apps/backend` | The server and database connection (Express + PostgreSQL) |
| `apps/frontend` | The web app staff use in the browser (Next.js) |
| `apps/desktop` | An optional desktop window around the web app (Electron) |

## First-time setup

You need **Node.js 18 or newer** and **PostgreSQL 12 or newer** on the host laptop.

1. Install everything from the project folder:

   ```bash
   npm install
   ```

2. Create the database. Follow [database setup](apps/backend/README.md#database-setup-first-time)
   in the backend guide.

3. Copy the example settings files, then fill in your database password and a long
   random `JWT_SECRET`:

   ```bash
   cp apps/backend/.env.example apps/backend/.env
   cp apps/frontend/.env.example apps/frontend/.env.local
   ```

4. Check the database connection and create the sign-in accounts:

   ```bash
   npm run setup:backend
   ```

5. Optional: load sample locations, patients and pharmacy stock for practice:

   ```bash
   npm run seed:demo
   ```

## Running a clinic day

Use the **built** version during clinics. It is much faster than development mode.

```bash
npm run build   # once, and again after changing settings or updating the code
npm start       # starts the server and the web app together
```

Then, on each staff device, open `http://<host-IP>:3001` in a browser.

Before the clinic opens:

- Give the host laptop a fixed IP on the router and keep it plugged in and awake.
- Check the host's **date, time and time zone**. Without internet it cannot set its
  own clock, and the clinic day (which patients appear in today's queue) comes from
  the host's clock.
- From another device, open `http://<host-IP>:3000/health`. It should show
  `"database": "ok"`.

For connecting several devices through a router, see
[running on a local network](docs/performance-and-lan.md).

## Signing in

There are two fixed accounts. New accounts cannot be created.

| Account | Password | Can do |
| --- | --- | --- |
| `admin` | `admin12345` | Everything, including correcting saved records |
| `user` | `user` | View everything and enter new records |

See [accounts and permissions](docs/user-roles.md) for exactly what each can change.

## Feature guides

- [Accounts and permissions](docs/user-roles.md): what Admin and User can do.
- [Queue ordering](docs/queue-ordering.md): sorting queues by number or arrival time.
- [Returning to and skipping stations](docs/station-routing.md): changing a patient's route.
- [Consultation referrals](docs/consultation-referrals.md): signing, printing and deleting referrals.
- [Analytics](docs/analytics.md): what each number on the Analytics page means.
- [Running on a local network](docs/performance-and-lan.md): setup, checks and troubleshooting.

A few things worth knowing:

- Register patients on **Home**. The **+ (Add patient)** button on Patient List opens
  the same form.
- Queues and patient lists update on every device automatically when someone saves.
- Always check that a save succeeded before leaving a page. Unsaved work is not
  kept if the connection to the host drops.

## For developers

```bash
npm run dev            # server + web app with live reload (not for clinics)
npm run dev:backend    # server only
npm run dev:frontend   # web app only
npm run dev:desktop    # desktop window (start the web app first)
npm test               # backend tests
npm run lint           # web app lint
npm run check:lan -- http://<backend-IP>:3000 http://<frontend-IP>:3001 user user
```

Most tests use fake or temporary data. The exceptions are three older backend test
files (`users`, `locations` and `registration_and_components`), which write to the
database in `apps/backend/.env`. **Do not run the full backend suite against a clinic
database.** To run only the safe tests:

```bash
npm test --workspace apps/frontend
npm test --workspace apps/backend -- --testPathIgnorePatterns "users|locations|registration_and_components"
```

Database changes are applied automatically when the server starts. More detail:

- [Backend guide](apps/backend/README.md): database setup, settings and how the server works.
- [Frontend guide](apps/frontend/README.md): pages and project layout.
- [Desktop guide](apps/desktop/README.md): the desktop window.
- [API reference](apps/backend/API_DOCUMENTATION.md): server endpoints.
