# Veasna Frontend

Next.js desktop/web UI for the Veasna clinical workflow.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (Radix)
- Zustand (persisted user/session and location state)
- Native `fetch` API layer in `src/lib/api`
- Desktop wrapper lives in `apps/desktop`

## Project Structure

- `src/app/(auth)/login`: login route
- `src/app/(main)/*`: authenticated app pages (one per station — see `FEATURES.md`)
- `src/app/wrappers/AuthWrapper.tsx`: client-side route guard (JWT expiry check)
- `src/app/layout.tsx`: mounts the global `<Toaster>` and `<ConfirmDialog>`
- `src/lib/api/*`: backend API calls (native `fetch`, small per-resource caches)
- `src/lib/queueOrder.ts`: shared queue-number comparator
- `src/stores/*`: Zustand stores — `useUserStore` (session, persisted),
  `useLocationStore` (location + list, persisted, expires at 6 AM),
  `useLocationDataStore` (per-location patients/queue/stock),
  `useConfirmStore` (`confirm()` promise API for `<ConfirmDialog>`)
- `apps/desktop/main.js`: Electron entrypoint in this monorepo

For the product-level picture see [`../../FEATURES.md`](../../FEATURES.md).

## Prerequisites

- Node.js 18+ recommended
- A running backend server (`apps/backend`)

## Environment

No env file is required for the default setup. `src/constants/env_variable.ts`
resolves the backend URL at runtime in the browser:

1. `NEXT_PUBLIC_BACKEND_URL` if set — an explicit override, baked in at build time.
2. Otherwise: `<same protocol/host as the page>:<NEXT_PUBLIC_BACKEND_PORT or 3000>`.

Option 2 is what LAN clients need — every device loads the app from the host's
IP and the API runs on that same host, so nothing has to be rebuilt when the
host's IP changes. Only set `NEXT_PUBLIC_BACKEND_URL` (in `.env.local`) if the
backend runs on a different host or a non-derivable URL; set
`NEXT_PUBLIC_BACKEND_PORT` if the backend isn't on `3000`.

## Install and Run

```bash
cd apps/frontend
npm install
```

Development server:

```bash
npm run dev
```

The app runs on `http://localhost:3001`.

From monorepo root, you can run:

```bash
npm run dev:frontend
```

Production build:

```bash
npm run build
npm run start
```

Lint:

```bash
npm run lint
```

## Electron (Current Status)

Run Electron wrapper from monorepo root:

```bash
npm run dev:desktop
```

Important:

- Electron entrypoint is now in `apps/desktop/main.js`.
- Electron currently loads `http://localhost:3001`.
- You must start `npm run dev` (or `npm run start`) first.
- This repo does not yet include Electron packaging/signing config (`electron-builder` or Electron Forge).
- Offline desktop deployment is not complete yet; this is a wrapper around a running Next.js server.

## Offline Desktop Roadmap

Goal: run Veasna on desktops without internet access.

### Phase 1: Stable Desktop Wrapper (current baseline -> installable app)

- Add Electron packaging (`electron-builder` or Electron Forge) to produce installers (`.dmg`, `.exe`).
- Update Electron startup so it can run in production mode reliably (no manual dev server dependency).
- Add one-command desktop run scripts (for development and packaged app smoke tests).

### Phase 2: Local Backend Runtime on the Same Machine

- Bundle and launch `apps/backend` as a child/background process from Electron app startup.
- Standardize local API URL for desktop mode (for example `http://127.0.0.1:<port>`).
- Add health-check and startup-wait logic before opening main UI routes.

### Phase 3: Local Data Store for Offline Use

- Option A: keep PostgreSQL and provide a local installer/service setup.
- Option B: migrate backend storage to embedded SQLite for simpler installation.
- Add first-run database initialization and schema bootstrap during app setup.

### Phase 4: Operations and Reliability

- Add logs and crash diagnostics for frontend, Electron main process, and backend process.
- Add backup/restore workflow for patient data.
- Add upgrade/migration checks so app updates do not break existing local data.

### Phase 5: Multi-Device Strategy (if needed)

- Decide whether each machine is fully standalone or syncs with a central server later.
- If sync is needed, design conflict handling and data ownership rules before implementation.

## Main Pages

- `/`: registration + queue
- `/patient-list`, `/patient-details`
- `/triage`
- `/seva`
- `/physiotherapy`
- `/doctors-consultation`
- `/pharmacy` (medication view + dispense)
- `/pharmacy/dashboard` (edit stock / inventory)
