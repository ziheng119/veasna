# Veasna Frontend

The web app clinic staff use in the browser. It talks to the
[backend](../backend/README.md) over the local network and needs no internet.

## Setup

Install from the project folder (not this folder):

```bash
npm install
npm run setup:env
```

The web app has one setting, the backend's address `NEXT_PUBLIC_BACKEND_URL`, with a
file per mode:

| File | Used by | Default |
| --- | --- | --- |
| `.env.development` | `npm run dev` | `http://localhost:3000` |
| `.env.production` | `npm run build`, `npm start` | Unset: browsers use the address they opened the app on, port `3000`. Set it to the host's IP (e.g. `http://192.168.68.50:3000`) only if the backend runs on another laptop or port. |

Don't set it in `.env.local`: Next.js reads that file in both modes and lets it win.
The production value is built into the app. **After changing it, run `npm run build`
again.**

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

## Customising

| To change | Edit |
| --- | --- |
| The partner NGO's name (shown in the menu, queues, forms and referrals) | `PARTNER_NGO_NAME` in `src/constants/partnerNgo.ts` |
| The logo on printed referral letters | Save it as `public/btb-logo.png`. Without the file, letters print with the name only. |
| The organisation name on referral letters | `LETTERHEAD` in `src/constants/letterhead.ts` |
| The TB red flags offered at registration and Triage | `TB_RED_FLAGS` in `src/constants/tb.ts` |
| What can be typed into registration fields (e.g. digits and one decimal place for height and weight) | `INPUT_FORMATS` in `src/lib/inputFormats.ts` |
| Places a doctor can refer to | `REFERRAL_DESTINATIONS` in `src/constants/referral.ts` |

Run `npm run build` again afterwards for clinic use.

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
| `src/constants/` | Shared lists and names (see [Customising](#customising)) |

```bash
npm test --workspace apps/frontend
npm run lint
```

Clinic builds go to `.next-production` and development builds to `.next`, so running
development mode never overwrites the clinic build.

For the desktop window, see [the desktop guide](../desktop/README.md).
