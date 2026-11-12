/* eslint-disable @next/next/no-head-element, @next/next/no-img-element -- Standalone print document, not a Next route. */
import { renderToStaticMarkup } from "react-dom/server";
import { LETTERHEAD } from "@/constants/letterhead";
import type { ReferralList, ReferredPatient } from "@/lib/api/analytics";

export interface ReferralListPrintOptions {
  // e.g. "21 Oct 2026" or "15 Oct – 21 Oct 2026".
  dateRange: string;
  // Absolute URL of the letterhead logo; omitted, the letterhead shows the name only.
  logoUrl?: string;
}

const dash = (value?: string | number | null) => (value === null || value === undefined || String(value).trim() === "" ? "–" : String(value));

/** "34 · F", "F" or "–": what the Age / Sex column shows. */
export function ageSex(patient: Pick<ReferredPatient, "age" | "sex">): string {
  return [patient.age ?? null, patient.sex || null].filter(part => part !== null).join(" · ") || "–";
}

function ListPage({ list, dateRange, logoUrl }: { list: ReferralList } & ReferralListPrintOptions) {
  return <article>
    <header className="letterhead">
      {logoUrl && <img className="logo" src={logoUrl} alt={`${LETTERHEAD.organisation} logo`} />}
      <div className="organisation">
        <h1>{LETTERHEAD.organisation}</h1>
        <div>{LETTERHEAD.subtitle} · Referral list</div>
      </div>
      <div className="meta"><div>{dateRange}</div></div>
    </header>
    <h2>{list.label}</h2>
    <p className="count">{list.patients.length} {list.patients.length === 1 ? "patient" : "patients"}</p>
    <table>
      <thead><tr><th>#</th><th>Patient</th><th>Age / Sex</th><th>Phone</th><th>Address</th><th>Visit</th><th>Reason for referral</th></tr></thead>
      <tbody>{list.patients.map((patient, index) => <tr key={patient.visitId}>
        <td>{index + 1}</td>
        <td><strong>{dash(patient.englishName)}</strong>{patient.khmerName && <div>{patient.khmerName}</div>}</td>
        <td>{ageSex(patient)}</td>
        <td>{dash(patient.phone)}</td>
        <td>{dash(patient.address)}</td>
        <td>{patient.visitDate}<div>Queue {dash(patient.queueNo)}</div></td>
        <td>{[patient.condition, patient.reason].filter(text => text?.trim()).join(": ") || "–"}</td>
      </tr>)}</tbody>
    </table>
  </article>;
}

/**
 * A printable list of the patients referred to each destination, one destination per page, for
 * taking on referral days. Destinations without patients are left out. React escapes every
 * patient-entered value.
 */
export function referralListDocumentHtml(lists: ReferralList[], options: ReferralListPrintOptions): string {
  const pages = lists.filter(list => list.patients.length > 0);
  return "<!doctype html>" + renderToStaticMarkup(<html lang="en"><head>
    <meta charSet="utf-8" /><title>{`${LETTERHEAD.organisation} — Referral lists`}</title>
    <style>{`
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #222; font: 10pt Georgia, serif; }
      article + article { break-before: page; page-break-before: always; }
      .letterhead { display: flex; align-items: center; gap: 5mm; padding-bottom: 4mm; border-bottom: 2px solid #333; }
      .logo { height: 16mm; width: auto; object-fit: contain; }
      .organisation { flex: 1; }
      .organisation div, .meta { font-size: 9pt; color: #444; }
      .meta { text-align: right; line-height: 1.6; }
      h1 { font-size: 16pt; margin: 0 0 1mm; }
      h2 { font-size: 15pt; margin: 6mm 0 1mm; }
      .count { margin: 0 0 4mm; color: #555; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #bbb; padding: 2mm; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      th { background: #f1f1f1; font-size: 9pt; }
      td div { color: #555; font-size: 9pt; }
      td:first-child, th:first-child { width: 8mm; text-align: right; }
      tr { break-inside: avoid; }
      thead { display: table-header-group; }
    `}</style>
  </head><body>{pages.map(list => <ListPage key={list.label} list={list} {...options} />)}</body></html>);
}
