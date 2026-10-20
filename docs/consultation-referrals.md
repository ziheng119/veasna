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
right-aligned **Referral needed** control (wrapping on narrow screens).
Clicking Referral needed switches between No and Yes and animates the referral
actions open/closed within the same connected glass surface. Closed controls cannot receive keyboard focus. Save the
consultation notes to persist this choice; collapsing does not delete a saved
referral or clear notes. Animations respect reduced-motion preferences.

## Signing and printing

1. Open **Create/Edit Referral**, select destinations and complete relevant fields.
   The wider editor groups patient details, destinations, clinical details and
   signing into sections. New referrals default to today's local date; saved dates
   are preserved and remain editable.
2. Draw your eSignature using a mouse, finger, or stylus. **Clear signature**
   allows another attempt. Editing referral fields clears the working signature.
3. **Save referral** saves a draft, with or without a signature.
4. **Save & print referral** requires a fresh signature and saves successfully
   before opening the print dialog. Allow pop-ups for the host's LAN URL.
   The print window remains available for preview/reprinting.

The plain monochrome A4 preview and printed referral use Project Battambang branding, patient details, selected
destinations, completed clinical fields, and the saved signer's username and
signature, without decorative blue bands. Empty fields and unselected destinations are omitted. This is a clinical
referral, not a medical leave certificate. It has no invented licence number or
verification QR code. Browser-added print headers/footers can be disabled in the
print dialog.

Each editor session requires signing again, so another user's saved signature is
never reused to attest new edits. The authenticated account's username is used
because user profiles currently have no separate clinician full-name field.
Signatures are handwritten electronic marks, not cryptographic digital signatures.

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

Frontend tests cover print-field selection, text escaping, signature invalidation,
successful save-before-print, and failed-save behavior. Backend tests validate
signature limits and authenticated signer attribution. Run:

```powershell
npm.cmd test --workspace apps/frontend -- --runInBand
$env:RUN_DB_TESTS='1'
npm.cmd test --workspace apps/backend -- --runInBand tests/referral.database.test.js tests/referralSignature.test.js
```

Database tests use temporary tables on a dedicated PostgreSQL connection, including
migration repeatability, signature round-trip, draft clearing, and ETag refresh.
They do not change clinic records.
