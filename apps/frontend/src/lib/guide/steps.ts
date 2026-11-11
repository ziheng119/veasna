// The guided tour (components/guide/GuideTour.tsx): one patient's visit from registration to their
// last station, as a screening-day (non-admin) account sees it. Only what those accounts can do.
// Each `target` is the data-tour attribute of the part of the page to light up; tests/guide.test.js
// checks every one is still in the code.
import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";
import { TB_MIN_RED_FLAGS } from "@/constants/tb";
import type { Side } from "./geometry";

export interface GuideStep {
  // Shown above the title, e.g. the station.
  chapter: string;
  // The page this step is on; none: whatever page is open.
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
    body: "This tour follows one patient from registration to their last station. It only shows you around: nothing is changed or saved. Use Next or the arrow keys, and Esc or ✕ to leave at any time.",
  },
  {
    chapter: "Getting started", path: "/", target: "location", side: "bottom",
    title: "Choose your location",
    body: "Pick the village or clinic you are working at. Every queue and patient list on this device shows that location. It is asked again each morning.",
  },
  {
    chapter: "Getting started", path: "/", target: "nav", side: "bottom",
    title: "Stations in clinic order",
    body: `Each station has its own page. Patients usually go Triage, Dental, then Consult, and on to Physiotherapy, ${PARTNER_NGO_NAME} or Pharmacy if they need them.`,
  },
  {
    chapter: "Getting started", path: "/", target: "connection", side: "bottom",
    title: "Live updates",
    body: "Queues and forms update by themselves when anyone saves. If this bar turns amber, the host laptop can't be reached: keep typing, as it is kept on this device, and save once the bar is back to normal.",
  },
  {
    chapter: "Registration", path: "/", target: "registration", side: "left", tab: "patient-info",
    title: "Register each patient here",
    body: "Registration has three tabs: Patient Info, Vitals and HEF. The patient gets their queue number when you submit.",
  },
  {
    chapter: "Registration", path: "/", target: "reg-name", side: "bottom", tab: "patient-info",
    title: "Returning patients",
    body: "Start typing the English name. Patients registered before appear under the field: choose one so this visit joins their record instead of making a duplicate.",
  },
  {
    chapter: "Registration", path: "/", target: "reg-vitals", side: "left", tab: "vitals",
    title: "Vitals",
    body: "Height and weight work out the BMI. Blood pressure and temperature are needed too before the patient can be added.",
  },
  {
    chapter: "Registration", path: "/", target: "reg-tb", side: "left", tab: "hef",
    title: "Suspected TB",
    body: `On the HEF tab, tick any TB red flags. With ${TB_MIN_RED_FLAGS} or more, the patient goes straight to Consult and is shown in red in every queue. Keep them apart from other villagers.`,
  },
  {
    chapter: "Registration", path: "/", target: "reg-stations", side: "left", tab: "hef",
    title: "Choose their stations",
    body: "Tick the stations this patient needs. They queue at each one in clinic order.",
  },
  {
    chapter: "Registration", path: "/", target: "reg-actions", side: "top", tab: "hef",
    title: "Add them to the queue",
    body: "Submit & Add to Queue registers the patient and shows their queue number for their sticker. If the Wi-Fi drops, what you typed is kept, and submitting again won't queue them twice.",
  },
  {
    chapter: "Registration", path: "/", target: "home-queue", side: "right", tab: "patient-info",
    title: "Today's queue",
    body: "Everyone registered today at this location, with the station each patient is waiting at.",
  },
  {
    chapter: "Triage", path: "/triage", target: "station-queue", side: "right",
    title: "Each station has its own queue",
    body: "Patients waiting here, in queue order. Choose one to open their record. On a card, Next sends them to their next station, and Send to changes where they go.",
  },
  {
    chapter: "Triage", path: "/triage", target: "station-search", side: "bottom",
    title: "Find a patient",
    body: "Search by name or queue number to open a patient who isn't at the top of the queue.",
  },
  {
    chapter: "Triage", path: "/triage", target: "station-work", side: "left",
    title: "Triage",
    body: `The chosen patient opens here: visual acuity, presenting complaint and history, each saved on its own. Flag suspected TB here, and send them to ${PARTNER_NGO_NAME} if a cataract is suspected. Save & next moves them on.`,
  },
  {
    chapter: "Dental", path: "/dental", target: "station-work", side: "left",
    title: "Dental",
    body: "Dental sees the tooth problems found at Triage. Write what was done, and tick that a referral is needed if the doctor should refer them.",
  },
  {
    chapter: "Consult", path: "/doctors-consultation", target: "station-queue", side: "right",
    title: "Consult",
    body: "The doctor's queue. Patients with suspected TB are shown in red: see them first.",
  },
  {
    chapter: "Consult", path: "/doctors-consultation", target: "station-work", side: "top",
    title: "Consultation notes",
    body: "Write notes, tick the conditions addressed and prescribe from the pharmacy, which adds Pharmacy to their stations. Refer to Physiotherapy here, and create and sign a referral letter. Printing it needs the admin account.",
  },
  {
    chapter: "Physiotherapy", path: "/physiotherapy", target: "station-work", side: "left",
    title: "Physiotherapy",
    body: "Patients the doctor referred. Mark where it hurts on the body chart and write what was done.",
  },
  {
    chapter: PARTNER_NGO_NAME, path: "/seva", target: "station-work", side: "left",
    title: PARTNER_NGO_NAME,
    body: "Patients with a suspected cataract, sent from Triage. Record the eye findings and whether they need referring.",
  },
  {
    chapter: "Pharmacy", path: "/pharmacy", target: "pharmacy-prescriptions", side: "left",
    title: "Pharmacy: the last station",
    body: "The patient's prescriptions wait here. Dispensing changes the stock, so the admin account does it. Finish on their card ends the visit once they have their medicine.",
  },
  {
    chapter: "After the visit", path: "/patient-list", target: "patient-search", side: "bottom",
    title: "Patient List",
    body: "Find any of today's patients by name or visit date. Add to family groups relatives, and Past visits on a queue card opens a patient's earlier records.",
  },
  {
    chapter: "Done", path: "/patient-list",
    title: "You're ready",
    body: "That is a patient's whole visit. Open this guide again any time with the ? button at the top.",
  },
];
