# Running on a local network

Veasna runs on one **host laptop** (server and database). Every other device
connects to it through a router. The router does **not** need internet.

```text
                router (no internet needed)
     ┌──────────────────┼──────────────────────┐
 host laptop        frontend laptop        tablets / browsers
 192.168.1.10       192.168.1.20 (optional) open http://192.168.1.10:3001
 server   :3000     web app :3001
 web app  :3001
 database (stays on the host)
```

Most clinics run the server and the web app together on the host. You can also run
extra copies of the web app on other laptops. They all use the same server, so
everyone sees the same queues.

## One-time setup

1. **Give the host a fixed IP.** In the router's settings, reserve an address for the
   host laptop (often called "DHCP reservation"), for example `192.168.1.10`. A cable
   connection to the router is more reliable than Wi-Fi.

2. **Tell the web app where the server is.** In `apps/frontend/.env.local`:

   ```env
   NEXT_PUBLIC_BACKEND_URL=http://192.168.1.10:3000
   ```

3. **Tell the server which web apps may connect.** In `apps/backend/.env`, list each
   web app address, separated by commas:

   ```env
   NEXT_PUBLIC_FRONTEND_URL=http://192.168.1.10:3001,http://192.168.1.20:3001
   ```

   If device addresses change from day to day, use this instead. It allows any device
   on the local network, but never one from the internet:

   ```env
   ALLOW_LAN_ORIGINS=true
   ```

4. **Allow the ports through the firewall** on the host (and any frontend laptop):
   `3000` for the server and `3001` for the web app. On Windows, mark the clinic
   network as **Private** when asked.

5. **Build the app:**

   ```bash
   npm run build
   ```

   Run this again whenever you change an address in step 2, or update the code.

## Each clinic day

1. **Check the host's date, time and time zone** (for Cambodia: `Asia/Phnom_Penh`, UTC+7).
   Without internet the clock is not corrected automatically. Today's queue and the
   date on new visits come from the host's clock. Other devices' clocks don't matter.
2. **Keep the host plugged in** and stop it from sleeping.
3. **Start Veasna** from the project folder:

   ```bash
   npm start
   ```

   It prints the addresses to use, such as `LAN: http://192.168.1.10:3000/health`.
   If PostgreSQL starts slowly, the server waits for it for up to a minute.
4. **Check from one staff device** (see below), then sign in on each device at
   `http://192.168.1.10:3001`.

Use `npm start`, not `npm run dev`, during clinics. Development mode prepares each page
the first time it is opened, which can make pages very slow. Don't rebuild while the
clinic is running. Stop the app first, then rebuild.

## Check each device

The quickest check: open `http://192.168.1.10:3000/health` in the device's browser.

| What you see | Meaning |
| --- | --- |
| `"database": "ok"` | All good. `realtimeClients` shows how many devices get live updates. |
| `"database"` not ok / HTTP 503 | Server is up but PostgreSQL isn't. Start PostgreSQL, then restart Veasna. |
| Page doesn't load | Wrong IP, device on another network, or the firewall is blocking port `3000`. |

For a full check from a laptop with the project installed:

```bash
npm run check:lan -- http://192.168.1.10:3000 http://192.168.1.20:3001 user user
```

It checks, without changing anything: that the server and database are reachable, that
this web app address is allowed, and that live updates connect for a signed-in user.
Anything that fails comes with a suggested fix.

## When something goes wrong

| Problem | What to do |
| --- | --- |
| A device opens the web app but can't sign in or load data | Its web app address is missing from `NEXT_PUBLIC_FRONTEND_URL`. Add it or set `ALLOW_LAN_ORIGINS=true`, then restart. The server log names the address it refused. |
| A device tries to reach `localhost` | The app was built before `NEXT_PUBLIC_BACKEND_URL` was set. Set it and run `npm run build` again. |
| Today's queue is empty or shows yesterday's patients | The host's date or time zone is wrong. Fix the clock and time zone, then restart Veasna. |
| "Too many requests" (HTTP 429) on a busy day | Raise `API_RATE_LIMIT_MAX` in `apps/backend/.env` (default 5000 per device every 15 minutes) and restart. |
| A page shows **Retry page** | The connection to the host dropped, or the app was rebuilt. Check the network, then press Retry. Save any unsaved work you can see first. |
| Lists may be out of date after Wi-Fi drops | They refresh by themselves when the connection returns, or when you come back to the tab. |

**Saves are not queued while offline.** If a device loses the connection, a save
fails rather than waiting. Always check that a save succeeded before moving on. Losing
the internet has no effect, but losing the router or host stops all saving and loading.

## Technical notes

- The server and live updates share port `3000` and use the same allowed-address
  rule. Live updates use WebSockets, and fall back to ordinary HTTP if a network
  blocks WebSockets.
- PostgreSQL stays on `DB_HOST=localhost` and is never exposed to the network.
- `ALLOW_LAN_ORIGINS=true` accepts only loopback and private addresses (`10.x`,
  `172.16–31.x`, `192.168.x`). Every request still needs a signed-in account.
- Each save makes every connected device reload the lists it is showing (about 2–3
  requests each). Unchanged lists answer with a short "not modified" (HTTP 304), so
  this stays light on the network.
- Sign-in attempts are limited to 30 per device every 15 minutes, separately from
  `API_RATE_LIMIT_MAX`.
- Server-side permissions apply on every request, whatever the page shows.
- Clinic builds are kept in `.next-production` and development builds in `.next`.
  The app uses system fonts, so nothing is downloaded from the internet.
- Pages only preload the links shown on screen, so slow networks aren't flooded.

### Finding the cause of slowness

With a clinic build (`npm start`), on a second device:

1. In the browser's Network tools, compare page and script load times with server
   request (`/api/...`) times.
2. Slow scripts point to a weak network or busy host; slow `/api` requests point to the
   server or database.
3. Check status codes: 401/403 are sign-in or permission problems, 429 is the rate limit.
4. Unplug the router's internet while keeping the local network. Sign-in, navigation,
   live queue updates between two devices and saving should all still work.
5. Disconnect one device from the network. It should show that it's disconnected, then
   show fresh queues after reconnecting.
