# Page performance and LAN operation

## Run a prebuilt application for clinic sessions

`npm run dev` is for editing code. Next.js compiles routes on demand and can
discard inactive development pages. A first visit after an idle period can
therefore wait for compilation. This is separate from database latency.

Install dependencies in advance. Configure the host address before building:

- `apps/frontend/.env.local`: `NEXT_PUBLIC_BACKEND_URL=http://<host-LAN-IP>:3000`
- `apps/backend/.env`: `NEXT_PUBLIC_FRONTEND_URL=http://<host-LAN-IP>:3001`
  (comma-separated exact origins if the host also uses localhost).
- Match the backend URL port to the backend's configured `PORT`.

Public frontend environment variables are embedded at build time. Rebuild if the
host address changes. Client devices must use the host IP, not localhost.

From the repository root:

```sh
npm run build
# Stop existing app instances before starting these same ports.
npm start
```

These commands work on Windows and POSIX shells. Both servers bind to all host
interfaces. Allow the configured ports on the host's private-network firewall.
Keep the host awake and give it a stable LAN IP (for example, a router DHCP
reservation). A wired host connection is preferable where available.

Production output uses `.next-production`; development uses `.next`, preventing
development compilation from overwriting production assets. Stop production
before rebuilding its output; do not replace chunks during an active clinic.
Keep dependencies installed on the host. System fonts remove Google font
downloads from builds and font-file transfers from client startup.

## Navigation and recovery

Existing Next.js navigation links retain automatic production prefetching for
visible permitted pages. No extra eager prefetch loop is added, so constrained
links are not flooded with all application routes.

The main routes now have a loading status and an error boundary with an explicit
retry. A failed chunk after a deployment may require a manual browser reload.
Do not reload while there is unsaved work. These boundaries do not catch every
event-handler/API failure; individual forms still handle their own requests.

The tighter 30-attempt/15-minute authentication limit covers credential submission
(`/auth/login` and `/auth/register`), not `/auth/me` on every navigation. All API
requests still have the general 1,000-request/15-minute/IP limit. Shared NAT or
heavy clinic traffic can reach that limit; check for HTTP 429 before changing it.
Server-side page/API permissions remain enforced.

Existing live-update behavior reconnects automatically, marks disconnected lists
as potentially stale, and refreshes lists after reconnect/returning to the tab.
The app does not replay clinical writes automatically. There is no offline-write
queue or guaranteed draft persistence: verify successful saves before navigating
away. Loss of internet alone should not affect the configured local core
workflows; loss of the LAN/host still prevents reads and saves.

## Verify the bottleneck

Use a second device connected to the host, with a production build:

1. In browser Network tools, record first and repeat station navigations.
   Compare document/RSC and JavaScript chunk time with API response time.
2. Large delays beside `Compiling ...` in the host terminal indicate development
   compilation. Production should have no route compilation on navigation.
3. Slow chunks suggest LAN bandwidth/host load; slow APIs suggest backend/database
   work. Check status codes: 401/403 are auth failures, 429 is rate limiting.
4. Disconnect the WAN while retaining the LAN and repeat login, navigation,
   queue updates between two clients, and a test save.
5. Interrupt one client's LAN, confirm disconnected feedback, reconnect and
   verify fresh queues. Test unsaved-form behavior separately; don't assume a
   disconnected browser can safely save patient data.

No device-specific speedup is claimed without measuring on that deployment.
