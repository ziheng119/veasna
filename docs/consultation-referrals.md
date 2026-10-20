# Consultation referrals

Consultation actions use shared glass-style buttons with subtle hover/press
feedback and reduced-motion support. Existing referral fields and destinations
remain available.

## Consultation workspace

On wide screens, Patient Snapshot and Triage Summary share the original snapshot
column in two equal-height, independently scrollable cards. Consultation Notes
occupies the remaining two columns. Smaller screens stack the notes below the
bounded summary cards. Compact styling is opt-in for consultation; other stations
retain their existing summary layout. Panel titles use 16px text and body text
and section headings use 14px.

The left-aligned **Save consultation notes** action shares a row with the
right-aligned **Create referral** / **Edit referral** action. Its label follows the
saved referral for the selected patient visit, not a separate toggle. Creating,
editing, or deleting a referral never transfers it to another selected patient.
The one-referral-per-visit database constraint remains in place; this is not an
exclusive clinician editing lock.

The summary column stays mounted when switching patients. Its patient/triage
children and the notes editor have distinct patient-specific React keys, preventing
duplicate panels while resetting drafts and pending loads on a patient switch.

## Signing and printing

1. Open **Create referral** (or **Edit referral** for a saved record), select destinations and complete relevant fields.
   The wider editor groups patient details, destinations, clinical details and
   signing into sections. New referrals default to today's local date; saved dates
   are preserved and remain editable.
2. Draw your eSignature using a mouse, finger, or stylus. **Clear signature**
   allows another attempt. Saved strokes reopen directly in the editable signature
   box. Drawing adds strokes; Clear signature removes them. Save referral persists
   these changes. Editing other referral fields does not clear the signature.
3. **Save referral** saves a draft, with or without a signature.
4. **Save & print referral** requires a saved or newly drawn signature and saves successfully
   before opening the print dialog. Allow pop-ups for the host's LAN URL.
   The print window remains available for preview/reprinting.

The plain monochrome A4 preview and printed referral use Project Battambang branding, patient details, selected
destinations, completed clinical fields, and the saved signer's username and
signature, without decorative blue bands. Empty fields and unselected destinations are omitted. This is a clinical
referral, not a medical leave certificate. It has no invented licence number or
verification QR code. Browser-added print headers/footers can be disabled in the
print dialog.

An unchanged signature retains its original signer and signing time, even if a
second user edits the referral text. Drawing a changed signature attributes the
new strokes to the authenticated saving user. Clearing and saving removes the
signature and signer metadata. `last_updated_by` still records every saving user.
The account username is used because profiles have no separate clinician name.
Signatures are handwritten electronic marks, not cryptographic digital signatures.

## Printing today's referrals

**Print today's referrals** sits at the right of the consultation search row and
works without selecting a patient. Select a clinic location first.

- The button fetches saved referrals afresh for that location and today's local
  calendar date. The referral date determines inclusion; an undated draft falls
  back to its visit date. Unsaved edits are not included.
- Completed visits are included. Deleted referrals, other locations and other
  dates are excluded. Ordering follows visit creation time, then visit ID.
- All saved records are included. Saved signatures and signer names are retained;
  unsigned drafts are explicitly marked **Unsigned draft**, not silently omitted.
  Batch printing does not save, sign, or otherwise change any record.
- One print window uses the same monochrome A4 template as individual printing.
  Each referral starts a new page. Long clinical text may continue onto more pages
  rather than being clipped. The preview remains open for reprinting.
- Empty results and failures show a message and close the temporary window.
  Allow pop-ups for the host LAN URL. Repeated clicks are blocked while loading.

The authenticated, read-only endpoint is
`GET /api/visits/referrals?location_id=<id>&date=YYYY-MM-DD`. It validates both
parameters and returns non-cached data. Restart the backend for this route;
no database migration or internet service is required.

## Deleting a referral

The saved referral editor has a pastel-red **Delete referral** action at the left
of the Save row. A styled confirmation card names the patient and explains what
will be removed. Cancel receives initial focus; confirming disables the controls
until the request finishes. Cancellation changes nothing, and a
failed request keeps the editor and referral available for retry.

Authenticated `DELETE /api/visits/referral/:visit_id` removes that visit's referral
and signature, and clears its consultation flag in one SQL statement. Notes and
prescription are preserved. Consultation audit metadata records the deleting
account and timestamp when a consultation exists. TB holds still prevent deletion.
Repeated deletion is safe. There is no restore action or new schema migration.

After success the editor closes and the page shows **Create referral**. Local
consultation caches are invalidated on referral save/delete; failed consultation
loads disable actions rather than showing a false empty record. Referral saves
set the consultation flag, and note saves derive it from the existing referral,
so an obsolete client toggle cannot restore a deleted referral flag.

## Storage and compatibility

- Restart the backend to apply additive, idempotent migration
  `011_referral_signature.sql`. Existing referrals remain unsigned.
- The referral stores bounded normalized vector strokes in JSONB, plus server-set
  signer ID, username snapshot, and signing time. No external signing service,
  uploaded executable SVG, or internet access is required.
- Signer identity comes from the authenticated user, not client-submitted names.
  Draft/legacy saves without a signature clear earlier signature metadata.
  Existing `last_updated_by`/`last_updated_at` remain populated.
- Referral edits change the consultation response ETag. Referrals saved before
  consultation notes are also returned. Successful saves update the open panel;
  switching patients remounts its notes editor to avoid carrying drafts across visits.
- Printing renders a separate escaped HTML document instead of the editing UI.
  The source document uses local fonts and CSS; no third-party assets are requested.

## Verification

Frontend tests cover print-field selection, text escaping, signature reload/edit/clear,
successful save-before-print, failed-save behavior, repeated patient switches,
Create/Edit transitions, confirmation, and failed/successful deletion.
Backend tests validate signature limits, authenticated signer attribution,
visit-isolated deletion, preserved notes, TB holds, cache refresh and recreation. Run:
Daily batch tests also cover date/location filtering, completed visits, unsigned
drafts, page boundaries, popup blocking, empty results and request failures.

```powershell
npm.cmd test --workspace apps/frontend -- --runInBand
$env:RUN_DB_TESTS='1'
npm.cmd test --workspace apps/backend -- --runInBand tests/referral.database.test.js tests/referralSignature.test.js
```

Database tests use temporary tables on a dedicated PostgreSQL connection, including
migration repeatability, signature round-trip, draft clearing, and ETag refresh.
They do not change clinic records.
