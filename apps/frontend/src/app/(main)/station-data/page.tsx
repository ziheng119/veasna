"use client";

import Link from "next/link";
import OptionListEditor from "@/components/station-data/OptionListEditor";
import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";
import { TB_MIN_RED_FLAGS } from "@/constants/tb";

const SECTION_TITLE = "scroll-mt-24 text-xl font-semibold text-foreground";

/**
 * Admin only (lib/permissions.ts): the choices offered in station forms. Opened from "Edit station
 * data" on a station page (which jumps to that station with #triage, #consultation or #seva) or from
 * the account menu. Saved lists apply on every device; records saved earlier are not changed.
 */
export default function StationDataPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">Station data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Change the dropdown and checkbox choices in the station forms. Saved changes appear on every device.
        </p>
      </header>

      <h2 id="registration" className={SECTION_TITLE}>Registration</h2>
      <OptionListEditor listKey="sticker_colours" kind="id" title="Sticker colours"
        description="The colour of the sticker given to the patient at registration. It shows as a small tag on their card in every queue."
        placeholder="e.g. Dark green" />

      <h2 id="triage" className={SECTION_TITLE}>Triage</h2>
      <OptionListEditor listKey="snellen" anchor="snellen" kind="value" title="Visual acuity (Snellen) readings"
        description={`The readings for each eye in the Snellen test (without pinhole, with pinhole and with glasses), at Triage and ${PARTNER_NGO_NAME}.`}
        placeholder="e.g. 20/15" />
      <OptionListEditor listKey="tb_red_flags" kind="id" title="TB red flags"
        description={`Ticked at registration and Triage. A patient with ${TB_MIN_RED_FLAGS} or more is flagged for suspected TB.`}
        placeholder="e.g. Chest pain" />

      <h2 id="consultation" className={SECTION_TITLE}>Consult</h2>
      <OptionListEditor listKey="consultation_conditions" kind="id" title="Conditions addressed"
        description="Ticked by the doctor in the consultation notes, and counted on the Analytics page."
        placeholder="e.g. Kidney disease" />
      <OptionListEditor listKey="referral_destinations" kind="value" title="Referral destinations"
        description="Where a doctor can refer a patient. Printed on the referral letter."
        placeholder="e.g. Battambang Provincial Hospital" />

      <h2 id="seva" className={SECTION_TITLE}>{PARTNER_NGO_NAME}</h2>
      <p className="text-sm text-muted-foreground">
        The visual acuity readings are shared with Triage: <Link className="underline" href="#snellen">edit them above</Link>.
      </p>

      <h2 className={SECTION_TITLE}>Elsewhere</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Medicines and stock: <Link className="underline" href="/pharmacy/dashboard">Pharmacy dashboard</Link>.</li>
        <li>Clinic locations: the location menu at the top of every page.</li>
        <li>Patients and their visits: open a patient from <Link className="underline" href="/patient-list">Patient List</Link>.</li>
      </ul>
    </div>
  );
}
