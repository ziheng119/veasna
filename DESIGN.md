---
name: Veasna
description: The patient screening system for Project Battambang's offline community health screenings.
colors:
  battambang-blue: "oklch(0.461 0.122 262.8)"
  blue-ink-foreground: "oklch(0.97 0.014 254.604)"
  mist-canvas: "oklch(0.97 0.004 286.2)"
  paper-white: "oklch(1 0 0)"
  slate-ink: "oklch(0.141 0.005 285.823)"
  quiet-wash: "oklch(0.967 0.001 286.375)"
  muted-slate: "oklch(0.53 0.016 285.938)"
  hairline: "oklch(0.92 0.004 286.32)"
  alarm-red: "oklch(0.577 0.245 27.325)"
  tb-red: "#dc2626"
  done-green: "#059669"
  caution-amber: "#fffbeb"
  caution-amber-ink: "#78350f"
typography:
  headline:
    fontFamily: "TeX Gyre Heros, Helvetica, Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  queue-number:
    fontFamily: "TeX Gyre Heros, Helvetica, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\""
  title:
    fontFamily: "TeX Gyre Heros, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1
  body:
    fontFamily: "TeX Gyre Heros, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "TeX Gyre Heros, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sticker: "3px"
  sm: "6.4px"
  md: "8.4px"
  lg: "10.4px"
  xl: "14.4px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.battambang-blue}"
    textColor: "{colors.blue-ink-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-success:
    backgroundColor: "{colors.done-green}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.alarm-red}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input:
    backgroundColor: "{colors.mist-canvas}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.xl}"
    padding: "20px 24px"
  nav-link-active:
    textColor: "{colors.battambang-blue}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-link:
    textColor: "{colors.muted-slate}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  badge-tb:
    backgroundColor: "{colors.tb-red}"
    textColor: "{colors.paper-white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  badge-station:
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  sticker-tag:
    rounded: "{rounded.sticker}"
    size: "18px"
---

# Design System: Veasna

## Overview

**Creative North Star: "The Field Clinic Board"**

Veasna looks like a tidy board of queue cards at a pop-up village clinic. White cards sit
on a cool, near-white canvas. Each station keeps its own colour and icon wherever it appears.
Patient markers (the red TB flag, the family letter, the coloured sticker) stand out from
across a tent, and everything else stays quiet. The mood is calm, clear and friendly: soft
rounded surfaces and gentle motion, never cold and clinical, and never playful enough to pull
a volunteer's attention from the patient in front of them.

The UI is dense where staff scan (queues, tables, forms in small text) and generous around
them (cards with 20–24px padding, a 1600px maximum width). Brand lives in one place: Project
Battambang blue marks what is active and what to press. The other colours all carry meaning,
not decoration: station identity, family grouping, sticker matching, warnings and danger.

The interface is designed for light mode only. A few badges carry `dark:` variants, but the
theme tokens have no dark set, so don't treat dark mode as supported.

**Key Characteristics:**
- One brand accent (Project Battambang blue). All other colour is meaning: stations, families, stickers, status.
- White cards on a mist canvas, softly lifted with a small shadow.
- Pills for status and selection, gently rounded rectangles for actions and fields.
- Frosted-glass pills for secondary round actions.
- Small, tactile motion: a 1px lift on hover, a press-in on click, fades on entry, all off under reduced motion.
- One typeface, TeX Gyre Heros, bundled with the app so it works offline.

## Colors

A quiet, cool-neutral board with one deep denim blue taken from Project Battambang's own
identity, plus a fixed vocabulary of meaning colours.

### Primary
- **Project Battambang Blue** (`battambang-blue`): the hero blue of projectbattambang.com
  (#32559C). Active nav tab, selected segmented tab, primary buttons, focus rings, selection
  and the default badge tint (at 10–14% over white). White text on it reaches 7.2:1.
- **Blue Wash** (`--accent`, oklch 0.965 0.014 262.8, with deep blue ink `--accent-foreground`):
  hover and keyboard highlight on anything pressable (ghost buttons, menu and list items, queue
  cards). Lighter than a selected item, so hover never reads as chosen.

The blue comes in three strengths: solid for the one thing to press now (and the open patient's
number), blue ink for what is chosen or the card's main action (active nav link, chosen sort
order, **Next** on a queue card), and the wash for what you could press.

### Neutral
- **Mist Canvas** (`mist-canvas`): the page background behind every card.
- **Paper White** (`paper-white`): cards, dialogs, inputs, the top bar (at 95% with blur).
- **Slate Ink** (`slate-ink`): body text and headings.
- **Quiet Wash** (`quiet-wash`): muted fills: tab tracks, secondary buttons, inactive badges, the account button at rest.
- **Muted Slate** (`muted-slate`): help text, inactive nav links, placeholders, counts, and the
  border of unticked checkboxes and radios. 4.8:1 on the canvas, so placeholders pass AA.
- **Hairline** (`hairline`): every border and divider, and input strokes.

### Meaning colours
- **Alarm Red** (`alarm-red`): destructive buttons and invalid fields.
- **TB Red** (`tb-red`): the suspected-TB badge, and the red border and wash on a TB patient's
  card (red-500 border on red-50, darkening to red-600 on red-100 when selected).
- **Done Green** (`done-green`): the success button ("Save & next" once a form is complete) and live/positive dots.
- **Caution Amber** (`caution-amber` with `caution-amber-ink`): the clock warning bar and
  warning badges. The offline bar also uses amber.
- **Station tones** (Tailwind 100 fill with 700/800 text): Triage blue, Consult emerald,
  Dental cyan, Physiotherapy amber, Partner NGO violet, Pharmacy rose. Each station has one
  icon too (heart pulse, stethoscope, smile, activity, eye, pill).
  On its own page a station's mark (its icon on its tone, `StationMark` / `StationTitle`) leads
  the queue title and the station's own form card, and each queue card shows the next station's
  icon in that station's ink beside **Next:**. That is wayfinding, never an action.
- **Family tones** (Tailwind 100 badge, 500 stripe and border): sky, amber, violet, emerald,
  pink, teal, cycled by family letter.
- **Sticker colours**: set by the admin on Station data to match the physical stickers. They
  are data, not tokens.

The website's sky (#C7F0FF) and pale sky (#E2F6FD) belong to the wider Project Battambang
identity but are not used in Veasna yet.

### Named Rules
**The One Blue Rule.** Project Battambang blue is the only colour that means "active" or
"press here". Never use a station, family or status colour for an action.

**The Red Means TB or Danger Rule.** Red is reserved for suspected TB and destructive or
invalid states. Never use it for emphasis or decoration.

**The Station Colour Is Fixed Rule.** A station's tone and icon are the same everywhere it
appears (`components/shared/StationBadge.tsx`). Never recolour a station locally.

## Typography

**Body Font:** TeX Gyre Heros (with Helvetica, Arial, sans-serif), bundled in
`apps/frontend/public/fonts/` with regular, italic, bold and bold italic.

**Character:** A plain neo-grotesque used for everything, so the UI reads like well-made
clinic signage. Hierarchy comes from size and weight, not from a second family.

### Hierarchy
- **Headline** (700, 1.875rem): page titles on admin pages (Pharmacy, Accounts, Station data).
- **Queue number** (700, 1.5rem, tabular figures, leading 1): the patient's number on queue
  cards. It's the largest thing on a station screen.
- **Title** (600, 1rem, leading 1): card and dialog titles (Today's Queue, Patient Registration).
- **Body** (400, 0.875rem): the default size: tables, form values, buttons, nav links (600 there).
- **Label** (500, 0.75rem): field help text, badges, counts, the "Live" status line.

Medium (500) renders as regular and semibold (600) as bold, because the font ships in two
weights only.

### Named Rules
**The One Family Rule.** Everything is TeX Gyre Heros. Don't add a display or mono family,
and don't load fonts from the internet.

## Layout

A sticky top bar (nav links on the left, refresh, account menu and the ? guide on the
right) sits above a centred content area with a maximum width of 1600px and 24px side
padding. Pages are stacks of cards with 20px gaps.

Station pages pair a queue card with the open patient's forms. From the `xl` breakpoint
(1280px) they sit side by side as panes that scroll on their own. The queue folds to a
narrow strip while a patient is open (`QUEUE_FOLD` in `src/lib/pageLayout.ts`). Below
`xl`, panes stack.

Every station but Pharmacy goes further, as one surface (`StationSurface`): the queue is a tinted column beside the open patient
from `lg` (1024px, tablets in landscape), and stays open (it folds only with **<<**). Split like this, the surface runs edge to edge with no
border, radius or shadow; the line between the columns is its only edge, and it can be dragged
(`SplitDivider`): on hover it lights brand blue, with a small white grip halfway down. Arrow keys
move it (Shift for bigger steps), Home and End go to the narrowest (256px) and widest queue
(leaving the patient 448px), a double-click resets it to the default (29% of the width), and the width is remembered on
the device for every station. A folded queue is a 10rem strip and hides the divider. Buttons for the station's whole day (Print referrals, Referral list) sit
in a bar at the bottom of the queue column, level with the form's sticky buttons, so both columns
end on one line; folded, they show as icons. Stacked below `lg`, it is a card again. The
patient's column scrolls as one: a sticky patient bar on top, registration's vitals and the
TB line scrolling away, sticky section tabs under the bar, and each section's buttons sticky
at the bottom. Queue-card actions (Next, Send to, Discharge) stack down the card's right edge,
each a 32px row with its icon and 12px label, so a card stays as tall as the patient's details.

Spacing follows Tailwind's 4px steps. Cards use 20px vertical and 24px horizontal padding,
controls sit 8–12px apart, and badges and chips use 4px gaps.

## Elevation & Depth

Veasna is gently lifted. Cards carry a small resting shadow over the mist canvas. Buttons
gain a medium shadow and rise 1px on hover, then press in on click. Glass pills combine a
light inner highlight with a soft drop shadow and a background blur. Dialogs and the
account menu float highest.

### Shadow Vocabulary
- **Resting card** (`shadow-sm`): every card.
- **Hover lift** (`shadow-md`): buttons and clickable cards on hover.
- **Glass pill** (`inset 0 1px 0 0 rgba(255,255,255,0.5), 0 2px 6px 0 rgba(0,0,0,0.12)`): round secondary actions.
- **Sticker** (`0 1px 2px rgba(0,0,0,0.35)`): the sticker tag, so it reads as a physical sticker.
- **Floating menu** (`drop-shadow(0 10px 24px rgb(15 23 42 / 0.16))`): the account menu.

### Named Rules
**The Lift Means Clickable Rule.** Only things you can press lift on hover. Static cards keep
their resting shadow.

## Shapes

Gently rounded throughout. Actions and fields use 8.4px corners, cards and dialogs 14.4px,
and the queue-number block 8.4px. Anything that is a status, a choice in a segmented control,
or a round secondary action is a full pill. The sticker tag is the one sharp exception: a 3px
square, tilted 6–12° like a stuck-on sticker. Family groups are drawn as dotted boxes around
their members' cards.

## Components

### Buttons
Tactile and confident, but small: 36px tall, 14px medium text.
- **Shape:** gently rounded (8.4px). Small 32px and large 40px sizes exist, plus a 36px square icon button.
- **Primary:** Project Battambang blue with near-white text.
- **Success:** Done Green, used when a step is complete ("Save & next" on a finished form), with a one-off pop and glow as it turns green.
- **Destructive:** Alarm Red with white text. Always opens a confirm dialog first.
- **Outline / Secondary / Ghost:** white with a hairline border; quiet wash; or transparent with a wash on hover.
- **Hover / Focus:** rises 1px with a medium shadow; focus shows a 3px ring in the brand blue at 50%. Press scales to 0.97.
- **Glass button:** a round frosted pill for secondary actions (Print referrals, Referral list, consultation actions).

### Chips / Badges
- **Style:** full pills, 12px medium text, 2–4px vertical padding, an optional 14px icon.
- **Status variants:** brand blue tint (default/active), muted (inactive), emerald (success), amber (warning), sky (info), red tint (destructive).
- **TB badge:** solid TB Red, white bold "TB" with a shield icon. The loudest element on any screen.
- **Station badge:** the station's tone and icon; "All done" in muted grey when no station is left.
- **Family badge:** the family's tone with a people icon and the family letter, 11px semibold.

### Cards / Containers
- **Corner Style:** 14.4px.
- **Background:** Paper White on Mist Canvas.
- **Shadow Strategy:** resting card shadow (see Elevation & Depth).
- **Border:** 1px hairline. TB patient cards swap it for a 2px red border and a red wash.
- **Internal Padding:** 20px top and bottom, 24px sides. Card headers with a divider add 24px below.

### Inputs / Fields
- **Style:** filled with Mist Canvas on the white card, 1px hairline stroke, 8.4px corners, 36px tall, 14px text, a tiny inner shadow.
- **Labels:** Slate Ink, 14px medium, above the field. Help text below in Muted Slate at 12px. Never grey labels: the label and the placeholder must not share a colour.
- **Section headings in a form** (TB red flags, Stations for this visit, Health coverage): Slate Ink, 14px bold.
- **Choices** (radio and checkbox labels): Slate Ink, 14px regular. Unticked controls have a Muted Slate border (at least 3:1).
- **Computed values** (queue number, BMI, Category, Age from date of birth, Unique ID): a dashed hairline outline with no fill, so they line up with fields but don't look typeable.
- **Focus:** the border turns brand blue with a 3px blue ring at 50%.
- **Error / Disabled:** red border with a faint red ring; disabled at 50% opacity.
- Number fields accept only digits as you type, with one decimal place where it makes sense.

### Navigation
- **Top bar:** white at 95% with a background blur and a hairline bottom border, sticky.
- **Links:** 14px semibold, 8×12px padding, 8.4px corners. Inactive links are Muted Slate and
  get a wash on hover; the active link is brand blue on a 10% blue tint.
- **Account menu:** grows out of its own button and shows each option's description beside the pointer.

### Segmented Tabs
A full-pill track in a translucent wash. The selected option sits on a pill that slides between
options, filled like a Registration queue number (brand blue at 14%) with its label in brand
blue semibold. Used for sort order (Queue number / Arrival time).

### Form Tabs
The registration form's sections (Patient Info / Vitals / HEF, TB & stations) use the plain tab
list: a muted track with the selected section filled brand blue. A tab with fields to fix shows a
small red dot with a white ring.

### Queue Card (signature)
The unit of the board: a white card with the queue number in large tabular bold, a sticker
tag pinned to its corner, the family badge and name, and the station badge. Selected cards
take the brand blue highlight; TB cards stay red, only darker. Family members sit inside one
dotted box in their family's tone.

### Sticker Tag (signature)
An 18px, 3px-cornered square in the patient's sticker colour, tilted, with a dark hairline
ring and a small shadow. It presses on with a short scale-and-settle animation, so staff can
match the card to the sticker on the patient.

## Do's and Don'ts

### Do:
- **Do** use Project Battambang blue (`--primary`) for every active, selected or primary state, and `--ring` for focus.
- **Do** show a patient's TB, family and sticker markers wherever the patient appears.
- **Do** reuse `StationBadge`, `TbBadge`, `FamilyBadge` and `StickerTag` instead of restyling them.
- **Do** keep text at 14px (body) and 12px (labels), and give queue numbers tabular figures.
- **Do** pair every animation with a `motion-reduce` fallback, as `src/lib/motion.ts` does.
- **Do** confirm every destructive action in a dialog that says what will happen.
- **Do** turn the final Submit red (with the shield icon) when the patient is flagged for suspected TB.
- **Do** show failures inline, next to the action, saying what was kept and what to do next. Never use browser `alert()` pop-ups.

### Don't:
- **Don't** use a station, family or status colour for an action or for decoration.
- **Don't** use red for anything other than suspected TB, destructive actions and invalid fields.
- **Don't** use hard-coded Tailwind `blue-*` classes for focus or primary states. Some forms (`components/patient-form/`) and Analytics still do; move them to `primary` and `ring` when touched.
- **Don't** load fonts, icons or images from the internet. Everything is served by the host.
- **Don't** add a second typeface.
