#!/usr/bin/env node
// Staff-only: dump the Firestore `waitlist` collection to CSV.
//
//   cd tools && npm install
//   # either: gcloud auth application-default login   (account with access to forwarddesk-aibit)
//   # or:     export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json   (never commit it)
//   node export-waitlist.mjs > waitlist.csv
//   node export-waitlist.mjs --out waitlist.csv --project forwarddesk-aibit
//
// The Admin SDK bypasses security rules, so this works even though the public rules forbid reads.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync } from 'node:fs';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
const projectId = arg('project', process.env.GCLOUD_PROJECT || 'forwarddesk-aibit');
const out = arg('out', null);

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const COLS = ['createdAt', 'email', 'company', 'role', 'country', 'shipments', 'note', 'consent', 'source', 'page', 'lang', 'id'];
const esc = (v) => {
  if (v === undefined || v === null) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // avoid spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const snap = await db.collection('waitlist').orderBy('createdAt', 'asc').get();
const rows = [COLS.join(',')];
for (const doc of snap.docs) {
  const d = doc.data();
  const createdAt = d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : '';
  rows.push(COLS.map((c) => esc(c === 'id' ? doc.id : c === 'createdAt' ? createdAt : d[c])).join(','));
}
const csv = rows.join('\n') + '\n';
if (out) { writeFileSync(out, csv); console.error(`Wrote ${snap.size} entries to ${out}`); }
else process.stdout.write(csv);
