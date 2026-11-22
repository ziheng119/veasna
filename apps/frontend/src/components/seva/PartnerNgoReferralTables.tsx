"use client";

import Link from "next/link";
import type { PartnerNgoReferralType } from "@/lib/api/analytics";
import { readableDate } from "@/components/analytics/dates";
import FamilyBadge from "@/components/shared/FamilyBadge";
import TbBadge from "@/components/shared/TbBadge";
import StickerTag, { findSticker, useStickerColours } from "@/components/shared/StickerTag";

interface Props {
  types: PartnerNgoReferralType[];
  // Analytics: names open the patient's record. The station pop-up keeps the nurse on the queue.
  linkNames?: boolean;
}

const HEAD = "px-3 py-2 font-medium";
const plural = (count: number) => `${count} ${count === 1 ? "patient" : "patients"}`;

/**
 * Patients the Partner NGO station marked for referral, one table per referral type (types with no
 * patients are left out). Each row shows the referral type and date, so a printed or copied row
 * still says what it is. Used by the station's Referral list pop-up and by Analytics.
 */
export default function PartnerNgoReferralTables({ types, linkNames = false }: Props) {
  const stickers = useStickerColours();
  const shown = types.filter((type) => type.patients.length > 0);
  return (
    <div className="space-y-6">
      {shown.map((type) => (
        <section key={type.id} className="space-y-2" aria-label={`${type.label}: ${plural(type.patients.length)}`}>
          <h3 className="font-semibold text-foreground">
            {type.label} <span className="font-normal text-muted-foreground">({type.patients.length})</span>
            {!type.listed && <span className="ml-2 text-xs font-normal text-muted-foreground">No longer on the referral list</span>}
          </h3>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className={HEAD}>Referral</th>
                  <th className={HEAD}>Seen</th>
                  <th className={HEAD}>English name</th>
                  <th className={HEAD}>Khmer name</th>
                  <th className={HEAD}>Sex</th>
                  <th className={HEAD}>Date of birth</th>
                  <th className={HEAD}>Phone</th>
                  <th className={HEAD}>Diagnosis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {type.patients.map((row) => (
                  <tr key={row.visitId} className="align-top">
                    <td className="px-3 py-2">
                      <span className="block font-medium text-foreground">{type.label}</span>
                      <span className="block whitespace-nowrap text-xs text-muted-foreground">
                        {row.referralDate ? readableDate(row.referralDate) : "No date set"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{readableDate(row.visitDate)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {linkNames ? (
                          <Link href={`/patient-details?id=${row.patientId}`}
                            className="rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {row.englishName || "Unnamed patient"}
                          </Link>
                        ) : (row.englishName || "-")}
                        {row.tbStatus === "flagged" && <TbBadge />}
                        {row.family && <FamilyBadge family={row.family} />}
                        {row.stickerColour && <StickerTag sticker={findSticker(stickers, row.stickerColour)} />}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.khmerName || "-"}</td>
                    <td className="px-3 py-2">{row.sex || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.dateOfBirth ? readableDate(row.dateOfBirth) : "-"}</td>
                    <td className="px-3 py-2">{row.phone || "-"}</td>
                    <td className="px-3 py-2">{row.diagnosis || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
