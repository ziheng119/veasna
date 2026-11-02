# Running on a local network

Veasna runs on one **host laptop** (server and database). Every other device
connects to it through the clinic's Wi-Fi. The Wi-Fi does **not** need internet or a
modem.

```text
          Deco mesh Wi-Fi (3 units, no internet needed)
     ┌──────────────────┼───────────────────────┐
 host laptop        frontend laptop         tablets / browsers
 192.168.68.50      192.168.68.51 (optional) open http://veasna.local:3001
 (veasna.local)     web app :3001            or http://192.168.68.50:3001
 server   :3000
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

3. **Fix that address so it never changes.** Reserve it in the Deco app, as described
   in [giving the host a fixed address](#giving-the-host-a-fixed-address). Without
   this, the host can get a new address after a restart and every device loses the app.

4. **Make the network Private and open the ports.** In Windows *Settings → Network &
   internet → Wi-Fi → (the Deco network)*, set the profile to **Private**. Then, in
   PowerShell **as administrator**:

   ```powershell
   New-NetFirewallRule -DisplayName "Veasna" -Direction Inbound -Protocol TCP -LocalPort 3000,3001 -Action Allow -Profile Private
   ```

   Use the `PORT` from `apps/backend/.env` if it isn't `3000`. Do the same on any
   extra frontend laptop (it only needs `3001`). For the `veasna.local` name, also
   allow mDNS on the host:

   ```powershell
   New-NetFirewallRule -DisplayName "Veasna name (mDNS)" -Direction Inbound -Protocol UDP -LocalPort 5353 -Action Allow -Profile Private
   ```

5. **Tell the web app where the server is.** If the web app runs on the host and the
   server uses port `3000`, leave `NEXT_PUBLIC_BACKEND_URL` unset in
   `apps/frontend/.env.local`. Browsers then use the address they opened the app on, so
   it keeps working if the host's address changes. Otherwise, use the host's address and
   the server's `PORT`:

   ```env
   NEXT_PUBLIC_BACKEND_URL=http://192.168.68.50:3000
   ```

6. **Let devices on the clinic network connect to the server.** In `apps/backend/.env`:

   ```env
   ALLOW_LAN_ORIGINS=true
   MDNS_NAME=veasna
   ```

   `MDNS_NAME` lets devices use `http://veasna.local:3001` instead of the IP (see
   [using a name instead of the IP](#using-a-name-instead-of-the-ip)). Leave it empty
   to turn the name off.

   `ALLOW_LAN_ORIGINS` allows any device on the local network, but never one from the internet. To
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
2. Open `http://veasna.local:3001` and bookmark it. If it doesn't load on that device
   (some Android tablets), use `http://192.168.68.50:3001` instead.

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

   It prints the addresses to use, such as `LAN: http://192.168.68.50:3000/health`
   and `Name: http://veasna.local:3000/health`. If PostgreSQL starts slowly, the
   server waits for it for up to a minute.
5. **Check from one staff device** (see below), then sign in on each device at
   `http://veasna.local:3001` (or `http://192.168.68.50:3001`).

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

## Giving the host a fixed address

Every device reaches Veasna through the host laptop's address. The Decos hand out
addresses automatically (DHCP), and without a reservation the host can get a
different one after a restart. Reserve it once:

1. Connect the host to the Decos the way it will be used at clinics (Wi-Fi or cable).
   Wi-Fi and the cable count as two different devices, each with its own address.
2. On the host, turn off random hardware addresses for the Deco network: *Settings →
   Network & internet → Wi-Fi → Manage known networks → (the Deco network) → Random
   hardware addresses: Off*. Also turn off the main *Random hardware addresses*
   switch on the *Wi-Fi* page. Otherwise Windows changes the laptop's hardware (MAC)
   address, and the Decos treat it as a new device and ignore the reservation.
3. Reconnect the Wi-Fi, then run `ipconfig /all`. For the adapter in use, note the
   *IPv4 Address* (e.g. `192.168.68.50`) and the *Physical Address* (e.g.
   `7C-DE-72-C4-B7-CA`).
4. Connect your phone to the **Deco Wi-Fi** and open the Deco app. Without internet,
   the app can only reach the Decos through their own Wi-Fi. If the phone warns that
   the network has no internet, choose to stay connected, and turn off mobile data
   while you use the app.
5. In the app, open *More → Advanced → Address Reservation* and tap **+**. Pick the
   host laptop from the list (match the physical address from step 3), keep the
   address it has now, and save.
6. Make the reservation take effect: in PowerShell run `ipconfig /release`, then
   `ipconfig /renew` (or turn the Wi-Fi off and on). Check that `ipconfig` shows the
   reserved address.
7. Restart the main Deco and the host once, and check that the address stays the same.

If the clinic sometimes uses a cable, reserve the laptop's Ethernet adapter too. It
gets a different address, so either always use the same connection or use the
`veasna.local` name, which follows whichever address the host has.

**Not recommended:** typing a fixed address into Windows (*Edit IP assignment →
Manual*). The Decos don't know about it and can hand the same address to another
device, and then both lose their connection. Use it only if your Deco app has no
Address Reservation. In that case copy the subnet mask, gateway and DNS server (the
main Deco's address) from `ipconfig /all`, and choose an address no other device has.

## Using a name instead of the IP

Devices can open **`http://veasna.local:3001`** instead of typing the host's IP. The
Decos can't give devices names of their own, so the host announces this name on the
local network itself (mDNS, also called Bonjour). No DNS server or internet is
needed, and the name keeps working if the host's address changes. Keep the address
reservation anyway: the IP is the fallback on devices where names don't work.

1. In `apps/backend/.env`, set the name and allow LAN origins:

   ```env
   MDNS_NAME=veasna
   ALLOW_LAN_ORIGINS=true
   ```

   Each host on the same network needs its own name (e.g. `veasna-clinic2`).

2. In `apps/frontend/.env.local`, leave `NEXT_PUBLIC_BACKEND_URL` **unset** (delete
   it or comment it out), then run `npm run build`. The web app then finds the server
   at whatever address the browser used, name or IP, on port `3000`. This needs the
   backend's `PORT` to be `3000`. If you keep `NEXT_PUBLIC_BACKEND_URL` set to the
   IP, the name still opens the web app, but the IP must not change.

3. Allow **UDP port 5353** through the host's firewall (setup step 2.4).

4. Restart Veasna. The startup log shows `Name: http://veasna.local:3000/health`.
   Open that address on a staff device to check it.

| Device | `.local` names |
| --- | --- |
| Windows 10/11, macOS, iPhone, iPad | Work. The first visit can take up to a second; after that it's instant. |
| Android | Depends on the phone and Chrome version. Test each tablet; use the IP if it doesn't load. |
| Linux | Works where Avahi is installed (most desktop versions). |

## Keeping the connection stable

- **Use a cable for the host** if you can, plugged into the main Deco. Otherwise
  keep the host close to a Deco.
- **Stop the host sleeping:** in *Settings → System → Power*, set it never to sleep or
  turn off the screen when plugged in. In *Device Manager → Network adapters →
  (Wi-Fi adapter) → Power Management*, untick *Allow the computer to turn off this
  device to save power*.
- **Avoid restarts during clinics:** set Windows Update *active hours* to cover clinic
  hours, or pause updates over the clinic days.
- **Keep the network Private.** Windows can ask again after the Deco network is reset,
  and a Public network blocks every other device (setup step 2.4).
- **Power on the Decos before the host** and wait for solid lights, so the host gets
  its reserved address straight away.

## Network problems and fixes

| Problem | Cause | Fix |
| --- | --- | --- |
| The host gets a different IP even though it is reserved | Windows is using a random hardware address, so the Decos see a new device | Turn off random hardware addresses ([fixed address](#giving-the-host-a-fixed-address), step 2), then release and renew. |
| The reservation is saved, but `ipconfig` still shows the old IP | The old address is still leased to the host | Run `ipconfig /release`, then `ipconfig /renew`, or reconnect the Wi-Fi. |
| Works on Wi-Fi but not on the cable (or the other way round) | Each adapter has its own address | Reserve both adapters, or use `veasna.local`. |
| The Deco app can't find the Decos at the clinic | The phone is using mobile data because the Wi-Fi has no internet | Connect to the Deco Wi-Fi, stay connected without internet, and turn off mobile data. |
| Two devices keep dropping off | They have the same address, usually because one was typed in manually in Windows | Set both back to automatic (DHCP) and use an Address Reservation instead. |
| `veasna.local` doesn't load, but the IP does | The device doesn't support `.local` names (some Android), UDP 5353 is blocked on the host, or `MDNS_NAME` is empty | Use the IP on that device. On the host, add the mDNS firewall rule and check the startup log shows `Name:`. |
| `veasna.local` opens another clinic's laptop | Two hosts on one network use the same `MDNS_NAME` | Give each host its own name, e.g. `veasna-clinic2`. |
| `veasna.local` opens the web app, but sign-in or data fails | `NEXT_PUBLIC_BACKEND_URL` points at an old IP, or `ALLOW_LAN_ORIGINS` is `false` | Unset `NEXT_PUBLIC_BACKEND_URL` and rebuild, and set `ALLOW_LAN_ORIGINS=true`. |
| The first `veasna.local` visit from Windows takes about 10 seconds | The host has no IPv6 address, and Windows waits for one | Leave IPv6 turned on in the host's Wi-Fi adapter settings, or use the IP. |
| Startup log says `mDNS name veasna.local unavailable` | Another program holds UDP port 5353 and won't share it | Devices can still use the IP. Close other Bonjour/mDNS software and restart Veasna. |
| `npm start` fails with `EAFNOSUPPORT` for the web app | IPv6 is turned off on the host | Turn IPv6 back on, or change `-H ::` to `-H 0.0.0.0` in `apps/frontend/package.json`. |
| Devices drop off when moving between Decos | Some older devices handle the Decos' Fast Roaming badly | Try turning off *More → Advanced → Fast Roaming* in the Deco app. |

## Technical notes

- The server and live updates share port `3000` and use the same allowed-address
  rule. Live updates use WebSockets, and fall back to ordinary HTTP if a network
  blocks WebSockets.
- PostgreSQL stays on `DB_HOST=localhost` and is never exposed to the network.
- The server and web app listen on IPv4 and IPv6. The `.local` name hands out both
  the host's IPv4 and IPv6 address, because Windows waits about 10 seconds when a name
  has no IPv6 address. Only addresses on the asking device's network are given out, so
  virtual adapters (WSL, Hyper-V) are left out (`apps/backend/config/mdns.js`).
- `ALLOW_LAN_ORIGINS=true` also accepts `.local` names, which only resolve on the
  local network.
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
