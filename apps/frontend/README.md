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
| Patient List | `/patient-list` | The first tab (needs **See today's patients**). Search patients; **+** adds a new one; **Add to family** (people icon) groups patients who came together, shown side by side. Click a column header to sort (again to reverse; the default is English name A to Z); sorting stays on your screen only. **Current Station** shows where a patient in today's queue is waiting, and clicking their row opens them there. The list scrollbar's room is always kept, so columns don't shift while it loads |
| Registration | `/` | Register patients and see the clinic queue. **Group families** (above the queue search) groups patients already in the queue: drag cards onto each other or onto a family's box (each drop is shown at once, with the card in or out of the box as it will be saved; cards are only dragged, not tapped), then turn it off to save; the family's cards then share a dotted box. Drag a card out of its box onto empty space to take it out (`src/components/home/PatientQueue.tsx`, `src/lib/familyGrouping.ts`). The HEF tab also asks about NSSF Station queues (`src/components/shared/QueuePatientPicker.tsx`) have the same switch and boxes (`src/components/shared/FamilyGrouping.tsx`) and fold to a narrow strip (sort order, count, numbers and names) while a patient is open, the forms beside them resizing with it (**>>** unfolds, **<<** folds; `QUEUE_FOLD` in `src/lib/pageLayout.ts`); queue search marks families with a dotted border. |
| Patient Details | `/patient-details` | A patient's visits; accounts that may edit correct saved records here. A visit's Consult tab > **Referral** has **Add referral** (or **Sign / print** once there is one), opening the Consult referral form for that visit, e.g. after the patient was completed |
| Triage | `/triage` | Visual acuity, presenting complaint, medical history and the TB flag |
| Consultation | `/doctors-consultation` | Doctor's notes, dental notes, sending to Physiotherapy, prescribing from pharmacy stock, and referrals |
| Physiotherapy | `/physiotherapy` | Physiotherapy assessment (patients sent by the doctor) |
| Dental | `/dental` | Triage notes, what the dental students did, and "referral needed" |
| Partner NGO | `/seva` | Partner NGO notes and referrals (name set in `constants/partnerNgo.ts`) |
| Pharmacy | `/pharmacy` | The Pharmacy queue, dispensing prescriptions, stock, and each patient's prescription history |
| Pharmacy Dashboard | `/pharmacy/dashboard` | Add and edit stock (needs **Pharmacy stock**) |
| Analytics | `/analytics` | Clinic numbers, from the account menu (needs **Analytics**) |
| Accounts | `/accounts` | Admin: screening-day accounts and their permissions |

What each account may see and do is in `src/lib/permissions.ts` (`can`, `canAccessPage`,
`canEditSavedData`), matching the server's `apps/backend/utils/permissions.js`; see
[accounts and permissions](../../docs/user-roles.md). Buttons an account can't use are
not rendered. The account menu (`src/components/shared/AccountMenu.tsx`) grows out of its
button (styles under `.account-menu` in `src/app/globals.css`) and shows each option's
description beside the pointer.

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
shadcn/ui, and Zustand for sign-in state.

| Path | Contents |
| --- | --- |
| `src/app/(auth)/login` | Sign-in page |
| `src/app/(main)/` | Signed-in pages |
| `src/app/wrappers/AuthWrapper.tsx` | Redirects to sign-in when needed |
| `src/lib/api/` | Calls to the backend, all through `request.ts` (`apiFetch`: 20-second timeout, readable messages when the host can't be reached, sign-out on 401; `readError`: the host's error message) |
| `src/stores/` | Shared state |
| `src/constants/` | Shared lists and names (see [Customising](#customising)) |

### The guided tour

The **?** button (`src/components/guide/GuideButton.tsx`) starts the tour in
`src/components/guide/GuideTour.tsx`. Its steps are in `src/lib/guide/steps.ts`: each
names the page (`path`), the part of it to light up (`target`), the pop-up's title and
text, a preferred side, and optionally a registration tab to show first (`tab`).

- Mark a part of a page with `data-tour="name"` (or `tour="name"` on a `PageCard`) and
  use that name as the step's `target`. Tabs are marked with `data-tour-tab`.
  `tests/guide.test.js` fails if a step points at a name no longer in the code, so
  renaming or removing a marked part shows up in the tests.
- Keep steps to what screening-day accounts can do; admin-only actions are mentioned
  only as needing the admin account.
- A step whose part isn't on screen (for example, no patient chosen) waits up to 4
  seconds, then shows its pop-up in the middle of the screen.
- Keep each step's text to one or two short sentences (the tests allow 140 characters).
- A part that is cut off by the screen or its scrolling panel is scrolled into view
  first; the spotlight moves once it has stopped moving, and only covers what can be
  seen (a part taller than the screen is shown from its top).
- The spotlight is a dimmed layer with a hole cut by a `clip-path` set on every
  animation frame, so it follows scrolling and resizing. The blur is a second layer that
  fades in once the spotlight has arrived, as redrawing a blur every frame is slow on
  tablets. Styles are under "Guided tour" in `src/app/globals.css`. With reduced motion
  turned on, it moves without animating.
- The tour's pages are prefetched when it starts.
- A sample patient goes through the stations with the tour (`src/lib/guide/sample.ts`).
  While the tour runs, `apiFetch` answers queues, patient lists, pending prescriptions
  and the sample's own records (id `-1`) itself; everything else still goes to the
  host. Station steps open the sample with `?visit=-1` in their `path`. Saving the
  sample is refused, so nothing reaches the database, and pages that showed it are
  opened afresh when the tour ends. To show more of a station, add to its record there.

```bash
npm test --workspace apps/frontend
npm run lint
```

Clinic builds go to `.next-production` and development builds to `.next`, so running
development mode never overwrites the clinic build.

For the desktop window, see [the desktop guide](../desktop/README.md).
