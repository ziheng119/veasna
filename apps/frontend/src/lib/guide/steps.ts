// The guided tour (components/guide/GuideTour.tsx): one patient's visit from registration to their
// last station, as a screening-day (non-admin) account sees it. Only what those accounts can do.
// Each `target` is the data-tour attribute of the part of the page to light up; tests/guide.test.js
// checks every one is still in the code.
import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";
import { TB_MIN_RED_FLAGS } from "@/constants/tb";
import type { Side } from "./geometry";
import { SAMPLE_ID } from "./sampleId";

// A station page with the sample patient open (lib/guide/sample.ts).
const withSample = (path: string) => `${path}?visit=${SAMPLE_ID}`;

export interface GuideStep {
  // Shown above the title, e.g. the station.
  chapter: string;
  // The page this step is on (may carry ?visit= to open the sample patient); none: whatever
  // page is open.
  path?: string;
  // data-tour of the part to light up; none: a card in the middle of the screen.
  target?: string;
  title: string;
  body: string;
  // Where the pop-up goes if there is room (else wherever fits).
  side?: Side;
  // A data-tour-tab to switch to first (a registration tab). Only changes what is shown.
  tab?: string;
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    chapter: "Welcome",
    title: "Welcome to VEASNA",
    body: "Follow a sample patient from registration to their last station. Nothing is saved. Esc or ✕ exits at any time.",
  },
  {
    chapter: "Getting started", path: "/", target: "nav", side: "bottom",
    title: "Stations in clinic order",
    body: `One page per station, in clinic order: Triage, Dental, Consult, then Physiotherapy, ${PARTNER_NGO_NAME} or Pharmacy.`,
  },
  {
    chapter: "Getting started", path: "/", target: "connection", side: "bottom",
    title: "Live updates",
    body: "Changes show up live. If this turns amber, the host can't be reached: keep typing, and save when it's back.",
  },
  {
    chapter: "Registration", path: "/", target: "registration", side: "left", tab: "patient-info",
    title: "Register each patient here",
    body: "New patients start here, in three tabs: Patient Info, Vitals and HEF.",
  },
  {
    chapter: "Registration", path: "/", target: "reg-name", side: "bottom", tab: "patient-info",
    title: "Returning patients",
    body: "Type the name. If they've come before, pick them from the list so their records stay together.",
  },
  {
    chapter: "Registration", path: "/", target: "reg-vitals", side: "left", tab: "vitals",
    title: "Vitals",
    body: "Height, weight, blood pressure and temperature. BMI is worked out for you.",
  },
  {
    chapter: "Registration", path: "/", target: "reg-tb", side: "left", tab: "hef",
    title: "Suspected TB",
    body: `Tick any TB red flags. With ${TB_MIN_RED_FLAGS} or more, they go straight to Consult and show in red. Keep them apart from others.`,
  },
  {
    chapter: "Registration", path: "/", target: "reg-stations", side: "left", tab: "hef",
    title: "Choose their stations",
    body: "Tick the stations they need. They queue at each one in clinic order.",
  },
  {
    chapter: "Registration", path: "/", target: "reg-actions", side: "top", tab: "hef",
    title: "Add them to the queue",
    body: "Submit to queue them and get their number for the sticker. If the Wi-Fi drops, what you typed is kept.",
  },
  {
    chapter: "Registration", path: "/", target: "home-queue", side: "right", tab: "patient-info",
    title: "Today's queue",
    body: "Everyone registered here today, and the station each one is waiting at. The sample patient waits for Triage.",
  },
  {
    chapter: "Triage", path: withSample("/triage"), target: "station-queue", side: "right",
    title: "Each station has its own queue",
    body: "Patients waiting here, in order; for now, just the sample patient. Choose one to open them. Next sends them on.",
  },
  {
    chapter: "Triage", path: withSample("/triage"), target: "station-search", side: "bottom",
    title: "Find a patient",
    body: "Search by name or queue number.",
  },
  {
    chapter: "Triage", path: withSample("/triage"), target: "station-work", side: "left",
    title: "Triage",
    body: `Vision, complaint and history. Flag suspected TB here, or send a suspected cataract to ${PARTNER_NGO_NAME}. Save & next moves them on.`,
  },
  {
    chapter: "Dental", path: withSample("/dental"), target: "station-work", side: "left",
    title: "Dental",
    body: "Note the treatment given, and tick if the doctor should refer them.",
  },
  {
    chapter: "Consult", path: withSample("/doctors-consultation"), target: "station-queue", side: "right",
    title: "Consult",
    body: "The doctor's queue. Patients in red may have TB: see them first.",
  },
  {
    chapter: "Consult", path: withSample("/doctors-consultation"), target: "station-work", side: "top",
    title: "Consultation notes",
    body: "Notes, prescriptions and referrals, including referral letters. Printing needs the admin account.",
  },
  {
    chapter: "Physiotherapy", path: withSample("/physiotherapy"), target: "station-work", side: "left",
    title: "Physiotherapy",
    body: "Mark where it hurts on the body chart, and note the treatment.",
  },
  {
    chapter: PARTNER_NGO_NAME, path: withSample("/seva"), target: "station-work", side: "left",
    title: PARTNER_NGO_NAME,
    body: "Patients with a suspected cataract. Record the eye findings and whether to refer them.",
  },
  {
    chapter: "Pharmacy", path: withSample("/pharmacy"), target: "pharmacy-prescriptions", side: "left",
    title: "Pharmacy: the last station",
    body: "Prescriptions wait here. The admin account dispenses, as that changes stock. Finish ends the visit.",
  },
  {
    chapter: "After the visit", path: "/patient-list", target: "patient-search", side: "bottom",
    title: "Patient List",
    body: "Find any patient by name or visit date, and group relatives into families.",
  },
  {
    chapter: "Done", path: "/patient-list",
    title: "You're ready",
    body: "That's a whole visit. Open this guide again any time with the ? button.",
  },
];

// A step's page without its query: what usePathname() gives once it is open.
export const stepPage = (step: GuideStep) => step.path?.split("?")[0];
