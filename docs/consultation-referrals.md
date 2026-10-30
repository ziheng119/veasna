# Consultation referrals

Doctors write referrals from the Consultation page. A referral can be signed on
screen, printed on its own, or printed together with the rest of the day's referrals.

## The Consultation page

On a wide screen, the left column shows the **Patient Snapshot** and **Triage
Summary** (each scrolls separately). **Consultation Notes** fills the rest. On smaller
screens, the notes appear below the summaries.

Below the notes, **Save consultation notes** is on the left and **Create referral** is
on the right. It reads **Edit referral** once the visit has a saved referral. Each
visit has at most one referral. Switching to another patient starts a fresh form, so
a draft never carries over to the wrong patient.

## Writing, signing and printing a referral

1. Press **Create referral** (or **Edit referral**). Choose the destinations and fill
   in the details. New referrals are dated today; you can change the date.
2. Sign in the signature box with a mouse, finger or stylus. **Clear signature** lets
   you start again. Editing other fields doesn't remove the signature.
3. **Save referral** saves it, signed or not, as a draft.
4. **Save & print referral** needs a signature. It saves first, then opens the print
   window. If nothing opens, allow pop-ups for the Veasna address in the browser.

The printout is a plain black-and-white A4 page with Project Battambang branding, the
patient's details, the chosen destinations, the filled-in clinical fields, and the
signer's username and signature. Empty fields are left out. To remove the web
address and date that browsers add to the page edges, turn off "Headers and footers"
in the print dialog.

**Who signed it:** if someone edits the text but leaves the signature alone, the
original signer and signing time stay. Drawing a new signature records the person
saving it. Clearing the signature and saving removes it. The signer's account
username is shown, because accounts have no separate clinician name. This is a
handwritten mark on screen, not a cryptographic digital signature.

## Printing today's referrals

**Print today's referrals**, at the right of the search row, prints every saved
referral for the selected location and today's date. You don't need to select a
patient first.

- It includes discharged patients and unsigned drafts. Drafts are clearly marked
  **Unsigned draft**.
- It uses the referral's date (or the visit date, if the referral has no date).
- Unsaved changes on screen are not included. Printing never changes any record.
- Each referral starts on a new page. Long text continues onto more pages rather
  than being cut off.
- If there is nothing to print, or loading fails, a message explains why.

## Deleting a referral

In a saved referral, press the red **Delete referral** button, then confirm. This
removes the referral and its signature. The consultation notes and prescription stay.
There is no undo. Deleting is not possible while the patient is on TB hold.

## Who can do what

Both Admin and User can create a referral, and view and print saved ones. Only an
admin can change or delete a saved referral or signature. See
[accounts and permissions](user-roles.md).

## Technical details

- `GET /api/visits/referrals?location_id=<id>&date=YYYY-MM-DD` returns the day's
  referrals for batch printing, in visit order, and is never cached.
- `DELETE /api/visits/referral/:visit_id` removes the referral and signature and clears
  the consultation's referral flag in one statement. It records who deleted it and
  when. Deleting twice is harmless.
- Signatures are stored as size-limited pen strokes (JSONB) with the signer's ID,
  username and time, all set by the server from the signed-in account. Saving without
  a signature clears earlier signature details. `last_updated_by`/`last_updated_at`
  record every save.
- The print page is a separate HTML page built with escaped text, using only local
  fonts and styles. No online service is used.
- The signature columns are added automatically at server start-up
  (`011_referral_signature.sql`). Older referrals stay unsigned.
- Saving or deleting a referral refreshes the consultation data on screen. If
  consultation data fails to load, the buttons are disabled rather than showing an
  empty record that could be overwritten.

Tests (database tests use temporary tables only):

```powershell
npm test --workspace apps/frontend
$env:RUN_DB_TESTS='1'
npm test --workspace apps/backend -- --runInBand tests/referral.database.test.js tests/referralSignature.test.js
```
