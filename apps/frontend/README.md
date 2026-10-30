# Veasna Frontend

The web app clinic staff use in the browser. It talks to the
[backend](../backend/README.md) over the local network and needs no internet.

## Setup

Install from the project folder (not this folder):

```bash
npm install
cp apps/frontend/.env.example apps/frontend/.env.local
```

`.env.local` has one setting, the backend's address:

```env
NEXT_PUBLIC_BACKEND_URL=http://192.168.1.10:3000
```

Use the host laptop's IP, not `localhost`, so that other devices can reach it too.
If you leave it empty, the app assumes the backend is on the same laptop that serves
the web app, port `3000`.

This setting is built into the app. **After changing it, run `npm run build` again.**

## Running

From the project folder:

```bash
npm run build && npm start   # clinic use: fast, with the server too
npm run dev:frontend         # development: reloads as you edit, slower page loads
```

The app runs on port `3001`. Staff devices open `http://<host-IP>:3001`.

## Pages

| Page | Address | Purpose |
| --- | --- | --- |
| Home | `/` | Register patients and see the clinic queue |
| Patient List | `/patient-list` | Search patients; **+** adds a new one |
| Patient Details | `/patient-details` | A patient's visits; admins can correct saved records here |
| Triage | `/triage` | Visual acuity, presenting complaint, medical history and the TB flag |
| Partner NGO | `/seva` | Partner NGO notes and referrals (name set in `constants/partnerNgo.ts`) |
| Physiotherapy | `/physiotherapy` | Physiotherapy assessment |
| Consultation | `/doctors-consultation` | Doctor's notes, prescribing from pharmacy stock, and referrals |
| Pharmacy | `/pharmacy` | Dispense prescriptions, view stock, and each patient's prescription history |
| Pharmacy Dashboard | `/pharmacy/dashboard` | Add and edit stock |
| Analytics | `/analytics` | Clinic numbers, from the user menu |

If a page fails to load, it shows a **Retry page** button. Lists that may be out of date
after a dropped connection refresh themselves when the connection returns.

## For developers

Built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 with
shadcn/ui, and Zustand for sign-in and location state.

| Path | Contents |
| --- | --- |
| `src/app/(auth)/login` | Sign-in page |
| `src/app/(main)/` | Signed-in pages |
| `src/app/wrappers/AuthWrapper.tsx` | Redirects to sign-in when needed |
| `src/lib/api/` | Calls to the backend |
| `src/stores/` | Shared state |
| `src/constants/` | Shared lists, such as TB red flags |

```bash
npm test --workspace apps/frontend
npm run lint
```

Clinic builds go to `.next-production` and development builds to `.next`, so running
development mode never overwrites the clinic build.

For the desktop window, see [the desktop guide](../desktop/README.md).
