/* eslint-disable @next/next/no-head-element -- Standalone print document, not a Next route. */
import { renderToStaticMarkup } from "react-dom/server";
import { Referral } from "@/lib/types/consultation";
import { PatientInfo } from "@/lib/types/patient";
import { SignatureImage } from "./SignaturePad";

/** Separate printable document: React escapes all patient/user-entered text. */
export function referralDocumentHtml(referral: Referral, patient: PatientInfo, visitId: number) {
  const field = (label: string, value?: string | null) => value?.trim() ? <div className="field"><strong>{label}</strong><span>{value}</span></div> : null;
  return "<!doctype html>" + renderToStaticMarkup(<html lang="en"><head>
    <meta charSet="utf-8" /><title>Project Battambang — Referral</title>
    <style>{`
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #222; font: 12pt Georgia, serif; }
      article { max-width: 180mm; margin: auto; }
      header { text-align: center; padding: 8mm 0; border-bottom: 1px solid #aaa; }
      h1 { font-size: 23pt; margin: 0 0 3mm; } h2 { text-align: center; font-size: 21pt; margin: 10mm 0 3mm; }
      .reference { text-align: center; margin-bottom: 10mm; font-size: 10pt; }
      .field { display: flex; gap: 5mm; margin: 3mm 0; white-space: pre-wrap; overflow-wrap: anywhere; }
      .field strong { flex: 0 0 40mm; } .field span { min-width: 0; }
      section { margin-top: 7mm; } section h3 { font-size: 12pt; margin-bottom: 2mm; }
      p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5; }
      .signature { width: 65mm; margin: 12mm 0 8mm auto; text-align: center; break-inside: avoid; }
      .signature svg { width: 60mm; height: 20mm; color: #222; }
      .signer { border-top: 1px solid #aaa; padding-top: 3mm; font-weight: bold; }
      footer { border-top: 1px solid #aaa; padding: 4mm 0; font-size: 9pt; color: #555; }
    `}</style>
  </head><body><article>
    <header><h1>Project Battambang</h1><div>Clinical referral</div></header>
    <h2>REFERRAL LETTER</h2>
    <div className="reference">Visit reference: {visitId}{referral.referralDate && <> · Date: {referral.referralDate}</>}</div>
    {field("Patient name", patient.english_name)}
    {field("Khmer name", patient.khmer_name)}
    {field("Date of birth", patient.date_of_birth?.slice(0, 10))}
    {field("Sex", patient.sex)}
    {field("Address", patient.address)}
    {field("Referred to", referral.referralType.filter(type => type.trim()).join(", "))}
    <section>
      {field("Condition", referral.illness)}
      {field("Duration", referral.duration)}
      {referral.reason.trim() && <><h3>Reason for referral</h3><p>{referral.reason}</p></>}
    </section>
    <p>Thank you for assessing this patient.</p>
    {referral.signature && <div className="signature">
      <SignatureImage value={referral.signature} />
      <div className="signer">{referral.signerName}</div>
      <p>Project Battambang</p>
      {referral.signedAt && <small>Signed: {referral.signedAt.slice(0, 10)}</small>}
    </div>}
    <footer>Project Battambang · Referral for continuing care</footer>
  </article></body></html>);
}
