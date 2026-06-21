# Veasna Desktop

Electron wrapper for the Veasna frontend in monorepo mode.

## Run

From repository root:

```bash
npm run dev:desktop
```

Default URL opened by Electron:

- `http://localhost:3001`

Override with env var:

```bash
DESKTOP_FRONTEND_URL=http://localhost:3001 npm run dev:desktop
```

## Current Scope

- Loads frontend in an Electron window.
- Does not yet package installers.
- Does not yet auto-start backend process.
