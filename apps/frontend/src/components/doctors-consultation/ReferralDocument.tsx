/* eslint-disable @next/next/no-head-element, @next/next/no-img-element -- Standalone print document, not a Next route. */
import { renderToStaticMarkup } from "react-dom/server";
import { Referral } from "@/lib/types/consultation";
import { PatientInfo } from "@/lib/types/patient";
import { LETTERHEAD } from "@/constants/letterhead";
import { SignatureImage } from "./SignaturePad";

export interface PrintOptions {
  // Absolute URL of the letterhead logo; omitted, the letterhead shows the name only.
  logoUrl?: string;
}

/** Separate printable document: React escapes all patient/user-entered text. */
export function referralDocumentHtml(referral: Referral, patient: PatientInfo, visitId: number, options: PrintOptions = {}) {
  return referralBatchDocumentHtml([{ referral, patient, visitId }], options);
}

export interface PrintableReferral {
  referral: Referral;
  patient: PatientInfo;
  visitId: number;
}

const BLANK = " "; // keeps an empty signature-block row its height, for writing by hand

function ReferralPage({ referral, patient, visitId, logoUrl }: PrintableReferral & PrintOptions) {
  const field = (label: string, value?: string | null) => value?.trim() ? <div className="field"><strong>{label}</strong><span>{value}</span></div> : null;
  const destinations = referral.referralType.filter(type => type.trim()).join(", ");
  const signedDate = referral.signedAt?.slice(0, 10);
  const letterDate = referral.referralDate || signedDate;
  return (<article>
    <header className="letterhead">
      {logoUrl && <img className="logo" src={logoUrl} alt={`${LETTERHEAD.organisation} logo`} />}
      <div className="organisation">
        <h1>{LETTERHEAD.organisation}</h1>
        <div>{LETTERHEAD.subtitle} · Clinical referral</div>
      </div>
      <div className="meta">
        {letterDate && <div>Date: {letterDate}</div>}
        <div>Ref: {visitId}</div>
      </div>
    </header>

    <h2>REFERRAL LETTER</h2>
    {field("Referred to", destinations)}

    <section className="patient">
      {field("Patient name", patient.english_name)}
      {field("Khmer name", patient.khmer_name)}
      {field("Date of birth", patient.date_of_birth?.slice(0, 10))}
      {field("Sex", patient.sex)}
      {field("Address", patient.address)}
    </section>

    <p>Dear Doctor,</p>
    <p>
      Thank you for seeing the patient named above, who was assessed at our screening clinic
      {letterDate ? ` on ${letterDate}` : ""}. I would be grateful for your assessment and further management.
    </p>
    <section>
      {field("Condition", referral.illness)}
      {field("Duration", referral.duration)}
      {referral.reason.trim() && <><h3>Reason for referral</h3><p>{referral.reason}</p></>}
    </section>
    <p>Yours sincerely,</p>

    <div className="signature">
      <div className="sign-space">{referral.signature && <SignatureImage value={referral.signature} />}</div>
      <div className="sign-line">Doctor&apos;s signature</div>
      <div className="sign-row"><strong>Name</strong><span>{referral.signerName || BLANK}</span></div>
      <div className="sign-row"><strong>Date</strong><span>{signedDate || BLANK}</span></div>
      <div className="sign-row"><strong>Organisation</strong><span>{LETTERHEAD.organisation}</span></div>
      {!referral.signature && <p className="unsigned">Unsigned draft: sign above by hand.</p>}
    </div>

    <footer>{LETTERHEAD.organisation} · Referral for continuing care · Please send any findings back with the patient.</footer>
  </article>);
}

/** One print job, sharing the individual template; every referral starts a fresh page. */
export function referralBatchDocumentHtml(referrals: PrintableReferral[], { logoUrl }: PrintOptions = {}) {
  return "<!doctype html>" + renderToStaticMarkup(<html lang="en"><head>
    <meta charSet="utf-8" /><title>{`${LETTERHEAD.organisation} — Referral`}</title>
    <style>{`
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #222; font: 11.5pt Georgia, serif; }
      article { max-width: 180mm; margin: auto; }
      article + article { break-before: page; page-break-before: always; }
      .letterhead { display: flex; align-items: center; gap: 6mm; padding-bottom: 5mm; border-bottom: 2px solid #333; }
      .logo { height: 22mm; width: auto; object-fit: contain; }
      .organisation { flex: 1; }
      .organisation div, .meta { font-size: 9.5pt; color: #444; }
      .meta { text-align: right; line-height: 1.6; }
      h1 { font-size: 20pt; margin: 0 0 1mm; }
      h2 { text-align: center; font-size: 17pt; letter-spacing: 0.08em; margin: 8mm 0 6mm; }
      .field { display: flex; gap: 5mm; margin: 2mm 0; white-space: pre-wrap; overflow-wrap: anywhere; }
      .field strong { flex: 0 0 38mm; } .field span { min-width: 0; }
      .patient { margin: 4mm 0 6mm; padding: 3mm 4mm; border: 1px solid #bbb; border-radius: 2mm; }
      section { margin-top: 5mm; } section h3 { font-size: 11.5pt; margin-bottom: 2mm; }
      p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5; }
      .signature { width: 75mm; margin: 6mm 0 8mm auto; break-inside: avoid; }
      .sign-space { height: 22mm; color: #222; }
      .sign-space svg { width: 70mm; height: 21mm; }
      .sign-line { border-top: 1px solid #333; padding-top: 1.5mm; font-size: 9pt; color: #555; margin-bottom: 3mm; }
      .sign-row { display: flex; gap: 3mm; margin: 2mm 0; }
      .sign-row strong { flex: 0 0 30mm; }
      .sign-row span { flex: 1; border-bottom: 1px dotted #999; min-height: 5mm; }
      .unsigned { font-weight: bold; margin-top: 3mm; font-size: 10pt; }
      footer { border-top: 1px solid #aaa; padding: 3mm 0; font-size: 8.5pt; color: #555; }
    `}</style>
  </head><body>{referrals.map(item => <ReferralPage key={item.visitId} {...item} logoUrl={logoUrl} />)}</body></html>);
}
