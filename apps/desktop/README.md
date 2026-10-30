# Veasna Desktop

Opens the Veasna web app in its own window instead of a browser tab.

## Running

Start the web app first (`npm start` or `npm run dev`), then from the project folder:

```bash
npm run dev:desktop
```

The window opens `http://localhost:3001`. To open a web app on another laptop, set
`DESKTOP_FRONTEND_URL` in the same terminal before starting:

```bash
# PowerShell
$env:DESKTOP_FRONTEND_URL='http://192.168.68.50:3001'; npm run dev:desktop
# macOS / Linux
DESKTOP_FRONTEND_URL=http://192.168.68.50:3001 npm run dev:desktop
```

`apps/desktop/.env.example` shows the setting, but the window does not read a `.env`
file, so set it in the terminal as above.

## Current limits

- It is only a window around the web app. The server and web app must already be running.
- There is no installer yet.

## Possible next steps

1. Package installers (`.exe`, `.dmg`) with electron-builder or Electron Forge.
2. Start the server automatically and wait until it is ready before opening the window.
3. Add logs, backup/restore of patient data and safe upgrades.
4. Sync clinic data to a central database later. This needs rules for resolving
   conflicting edits first.
