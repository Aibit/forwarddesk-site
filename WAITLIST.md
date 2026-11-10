# Waitlist

The landing page has a waitlist form in the hero and in the bottom CTA section (`index.html`, `assets/waitlist.js`).

## Current state: not switched on yet

`config.js` sets `window.FORWARDDESK_FIREBASE_CONFIG = null`, so **signups are not stored server-side**.
A visitor who submits sees *"Waitlist opens shortly — please try again soon"*. Their entry stays only in
their own browser (`localStorage["forwarddesk_waitlist_unsent"]`, last 5 entries), and the console logs that it was not sent.
Only a real Firestore write shows *"Thanks, you're on the list"*.

## Switch it on (after the Firebase terms are accepted for `forwarddesk-aibit`)

1. In the Firebase console for `forwarddesk-aibit`, create Firestore (Native mode) if it doesn't exist yet,
   then register a **Web app** under Project settings > Your apps and copy its config.
2. Merge `waitlist.rules.snippet` into the app repo's `firestore.rules` (inside `match /databases/{database}/documents`),
   then deploy rules from the app repo: `firebase deploy --only firestore:rules --project forwarddesk-aibit`.
   Deploying replaces the project's whole ruleset, so the waitlist block must be in the same file as the app's rules.
3. Put the web config in `config.js` (`window.FORWARDDESK_FIREBASE_CONFIG = { apiKey, authDomain, projectId, appId }`),
   then commit and push to `main`. GitHub Pages republishes in about a minute.
4. Optional: add `aibit.github.io` to Firebase Auth authorized domains (not needed for Firestore-only writes),
   and restrict the API key to the `aibit.github.io` referrer in Google Cloud console.

## Rules (summary)

Create-only. Allowed fields: email, company, role, country, shipments, note, consent, source, page, lang, createdAt.
`email` is required (6–254 chars, looks like an email), `consent == true`, and `createdAt` must equal the server time.
Size limits: company 120, role 80, country 80, note 1000. `shipments` must be one of the select values. No public reads, updates or deletes.
These rules were tested on the local Firestore emulator: valid entries are accepted, while bad email, no consent, extra fields, an oversize note, wrong shipments, a client-set time, and list/get/update are all denied.

## Spam protection

A hidden honeypot field (`website`) plus a 2-second minimum before submitting. Bot submissions are dropped and never stored.

## Export to CSV (staff)

```
cd tools && npm install
gcloud auth application-default login     # or GOOGLE_APPLICATION_CREDENTIALS=/path/key.json (never commit it)
node export-waitlist.mjs --out waitlist.csv
```
