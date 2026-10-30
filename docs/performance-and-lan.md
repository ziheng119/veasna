# Running on a local network

Veasna runs on one **host laptop** (server and database). Every other device
connects to it through the clinic's Wi-Fi. The Wi-Fi does **not** need internet or a
modem.

```text
          Deco mesh Wi-Fi (3 units, no internet needed)
     ┌──────────────────┼───────────────────────┐
 host laptop        frontend laptop         tablets / browsers
 192.168.68.50      192.168.68.51 (optional) open http://192.168.68.50:3001
 server   :3000     web app :3001
 web app  :3001
 database (stays on the host)
```

Most clinics run the server and the web app together on the host. You can also run
extra copies of the web app on other laptops. They all use the same server, so
everyone sees the same queues.

The addresses in this guide (`192.168.68.x`) are what Deco routers hand out. Always
use the address your host laptop actually has (see step 2 below).

## One-time setup

### 1. Set up the Deco routers

The clinic kit is three **TP-Link Deco AX1800** units. They form one Wi-Fi network
on their own. No modem, internet or Ethernet cable is needed.

1. On a phone, install the **Deco** app (App Store or Google Play) and sign in with a
   TP-Link ID. The phone needs mobile data or other internet for this sign-in only.
2. Plug **one** Deco into power. This becomes the main Deco. Leave its Ethernet ports
   empty.
3. In the app, add a new Deco, pick the model on the box, and follow the prompts. When
   the app says there is no internet connection, choose to continue without it.
4. Name the Wi-Fi network and set a password. Write both down for the clinic.
5. Make sure the main Deco runs in **Router** mode, not Access Point mode
   (*More → Advanced → Operation Mode*). In Access Point mode it hands out no
   addresses, so devices can't find each other without a modem.
6. Plug in the other two Decos, about halfway between the main Deco and the far end
   of the clinic, and add each one in the app (*+ → Add Deco*). They link to the main
   Deco wirelessly. Wait until all three lights are solid.
7. Connect staff devices to the **main** Wi-Fi name, not a guest network. Guest
   networks stop devices from reaching each other.

> The app's wording changes between versions. If a menu name differs, look for the
> closest match.

### 2. Set up the host laptop

1. **Connect the host to the Deco Wi-Fi.** Keep it near a Deco. A cable from the host
   to any Deco Ethernet port is more reliable than Wi-Fi, if you have one.

2. **Find the host's IP address.** On Windows, open PowerShell and run `ipconfig`.
   Under *Wireless LAN adapter Wi-Fi* (or *Ethernet adapter* if cabled), read:

   ```text
   IPv4 Address. . . . . . . . . . . : 192.168.68.50    <- the host's address
   Default Gateway . . . . . . . . . : 192.168.68.1     <- the main Deco
   ```

   If the IPv4 address does not start with the same three numbers as the gateway
   (e.g. it shows `169.254.x.x`), the host is not connected to the Decos properly.

3. **Fix that address so it never changes.** In the Deco app, open
   *More → Advanced → Address Reservation*, add the host laptop and reserve its
   current address. Without this, the host can get a new address after a restart and
   every device loses the app.

4. **Make the network Private and open the ports.** In Windows *Settings → Network &
   internet → Wi-Fi → (the Deco network)*, set the profile to **Private**. Then, in
   PowerShell **as administrator**:

   ```powershell
   New-NetFirewallRule -DisplayName "Veasna" -Direction Inbound -Protocol TCP -LocalPort 3000,3001 -Action Allow -Profile Private
   ```

   Use the `PORT` from `apps/backend/.env` if it isn't `3000`. Do the same on any
   extra frontend laptop (it only needs `3001`).

5. **Tell the web app where the server is.** In `apps/frontend/.env.local`, use the
   host's address and the server's `PORT`:

   ```env
   NEXT_PUBLIC_BACKEND_URL=http://192.168.68.50:3000
   ```

6. **Let devices on the clinic network connect to the server.** In `apps/backend/.env`:

   ```env
   ALLOW_LAN_ORIGINS=true
   ```

   This allows any device on the local network, but never one from the internet. To
   allow only specific web app addresses instead, leave it `false` and list them:

   ```env
   NEXT_PUBLIC_FRONTEND_URL=http://192.168.68.50:3001,http://192.168.68.51:3001
   ```

   Keep `DB_HOST=localhost`; the database is never shared on the network.

7. **Build the app:**

   ```bash
   npm run build
   ```

   The server address from step 5 is fixed into the build. Build again whenever
   you change it, or update the code.

### 3. Connect staff devices

Tablets and other laptops only need a browser:

1. Join the Deco Wi-Fi (the main network, not guest).
2. Open `http://192.168.68.50:3001` and bookmark it.

Nothing needs installing or configuring on them.

**Optional extra frontend laptop.** To run a copy of the web app on another laptop
with the project installed, set its `apps/frontend/.env.local` to the **host's**
address (`NEXT_PUBLIC_BACKEND_URL=http://192.168.68.50:3000`), open port `3001` in
its firewall (step 2.4), then `npm run build` and `npm run start:frontend` there. Staff
can then also use `http://<that laptop's IP>:3001`. For the desktop window, set
`DESKTOP_FRONTEND_URL` in `apps/desktop/.env` to a web app address such as
`http://192.168.68.50:3001`.

## Each clinic day

1. **Power on all three Decos** and wait until their lights are solid. Connect the host
   and check with `ipconfig` that it still has its reserved address (e.g.
   `192.168.68.50`).
2. **Check the host's date, time and time zone** (for Cambodia: `Asia/Phnom_Penh`, UTC+7).
   Without internet the clock is not corrected automatically. Today's queue and the
   date on new visits come from the host's clock. Other devices' clocks don't matter.
3. **Keep the host plugged in** and stop it from sleeping.
4. **Start Veasna** from the project folder:

   ```bash
   npm start
   ```

   It prints the addresses to use, such as `LAN: http://192.168.68.50:3000/health`.
   If PostgreSQL starts slowly, the server waits for it for up to a minute.
5. **Check from one staff device** (see below), then sign in on each device at
   `http://192.168.68.50:3001`.

Use `npm start`, not `npm run dev`, during clinics. Development mode prepares each page
the first time it is opened, which can make pages very slow. Don't rebuild while the
clinic is running. Stop the app first, then rebuild.

## Check each device

The quickest check: open `http://192.168.68.50:3000/health` in the device's browser.

| What you see | Meaning |
| --- | --- |
| `"database": "ok"` | All good. `realtimeClients` shows how many devices get live updates. |
| `"database"` not ok / HTTP 503 | Server is up but PostgreSQL isn't. Start PostgreSQL, then restart Veasna. |
| Page doesn't load | Wrong IP, device on another network (or the Deco guest network), or the firewall is blocking port `3000`. |

For a full check from a laptop with the project installed:

```bash
npm run check:lan -- http://192.168.68.50:3000 http://192.168.68.51:3001 user user
```

It checks, without changing anything: that the server and database are reachable, that
this web app address is allowed, and that live updates connect for a signed-in user.
Anything that fails comes with a suggested fix.

## When something goes wrong

| Problem | What to do |
| --- | --- |
| A device opens the web app but can't sign in or load data | Its web app address is missing from `NEXT_PUBLIC_FRONTEND_URL`. Add it or set `ALLOW_LAN_ORIGINS=true`, then restart. The server log names the address it refused. |
| Nothing loads on any device, but works on the host | The host's address changed, or its network is set to Public. Check `ipconfig` against `NEXT_PUBLIC_BACKEND_URL` (rebuild if it differs), reserve the address in the Deco app, and set the network to Private (setup step 2). |
| The host's IPv4 address starts with `169.254` | It isn't getting an address from the Decos. Check the main Deco is in Router mode and its light is solid, then reconnect the Wi-Fi. |
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
