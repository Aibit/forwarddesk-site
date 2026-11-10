// ForwardDesk waitlist form. Stores signups in Firestore `waitlist` when config.js is filled in;
// otherwise keeps the entry in this browser only and tells the visitor honestly.
const SDK = 'https://www.gstatic.com/firebasejs/13.2.0';
const LOCAL_KEY = 'forwarddesk_waitlist_unsent';
const SHIPMENTS = ['lt10', '10-50', '50-200', '200-1000', 'gt1000'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LIMITS = { company: 120, role: 80, country: 80, note: 1000 };
const loadedAt = Date.now();
const cfg = window.FORWARDDESK_FIREBASE_CONFIG;
const configured = !!(cfg && cfg.apiKey && cfg.projectId);
let dbPromise = null;

if (!configured) {
  console.info('[ForwardDesk waitlist] Firebase config not set (config.js). Signups are NOT stored server-side yet; they are kept only in the visitor\'s localStorage under "' + LOCAL_KEY + '".');
}

function db() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { initializeApp } = await import(`${SDK}/firebase-app.js`);
      const fs = await import(`${SDK}/firebase-firestore-lite.js`);
      const app = initializeApp(cfg);
      const d = fs.getFirestore(app);
      const emu = window.FORWARDDESK_FIREBASE_EMULATOR; // testing only, e.g. 'localhost:8080'
      if (emu) { const [h, port] = emu.split(':'); fs.connectFirestoreEmulator(d, h, Number(port)); }
      return { fs, db: d };
    })();
  }
  return dbPromise;
}

function clean(v, max) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max); }

function collect(form) {
  const f = new FormData(form);
  const entry = { email: clean(f.get('email'), 254).toLowerCase(), consent: f.get('consent') === 'on' };
  for (const k of Object.keys(LIMITS)) {
    const v = k === 'note' ? String(f.get(k) || '').trim().slice(0, LIMITS[k]) : clean(f.get(k), LIMITS[k]);
    if (v) entry[k] = v;
  }
  const s = f.get('shipments');
  if (SHIPMENTS.includes(s)) entry.shipments = s;
  entry.source = form.id === 'wl-cta' ? 'cta' : 'hero';
  entry.page = location.pathname.slice(0, 120);
  entry.lang = (navigator.language || '').slice(0, 16);
  return { entry, honeypot: String(f.get('website') || '') };
}

function showDone(form, ok) {
  form.querySelector('.wl-body').hidden = true;
  const d = form.querySelector('.wl-done');
  d.hidden = false;
  d.querySelector('[data-ok]').hidden = !ok;
  d.querySelector('[data-wait]').hidden = ok;
  d.querySelector('[data-again]').hidden = ok;
  d.querySelector('[data-title]').textContent = ok ? 'Thanks, you’re on the list' : 'Waitlist opens shortly — please try again soon';
  d.querySelector('[data-msg]').textContent = ok
    ? 'We’ll email you when there’s news about ForwardDesk.'
    : 'We couldn’t send your details to our list yet. Nothing has left this browser.';
  d.setAttribute('tabindex', '-1'); d.focus({ preventScroll: true });
}

function reset(form) {
  form.querySelector('.wl-done').hidden = true;
  form.querySelector('.wl-body').hidden = false;
}

function err(form, msg) {
  const e = form.querySelector('.wl-err');
  e.textContent = msg; e.hidden = !msg;
}

async function submit(form) {
  err(form, '');
  const { entry, honeypot } = collect(form);
  if (!EMAIL_RE.test(entry.email)) return err(form, 'Please enter a valid work email.');
  if (!entry.consent) return err(form, 'Please tick the box so we can contact you.');
  if (honeypot || Date.now() - loadedAt < 2000) {
    console.info('[ForwardDesk waitlist] submission ignored (spam check).');
    return showDone(form, false);
  }
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    if (!configured) throw new Error('not-configured');
    const { fs, db: d } = await db();
    await fs.addDoc(fs.collection(d, 'waitlist'), { ...entry, createdAt: fs.serverTimestamp() });
    form.reset();
    showDone(form, true);
  } catch (e) {
    if (e.message !== 'not-configured') console.warn('[ForwardDesk waitlist] could not store signup:', e);
    try {
      const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      list.push({ ...entry, savedAt: new Date().toISOString() });
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(-5)));
      console.info('[ForwardDesk waitlist] entry kept in localStorage only — NOT stored server-side.');
    } catch (_) { /* storage unavailable */ }
    showDone(form, false);
  } finally {
    btn.disabled = false; btn.textContent = 'Join the waitlist';
  }
}

document.querySelectorAll('form[data-wl]').forEach((form) => {
  form.addEventListener('submit', (ev) => { ev.preventDefault(); submit(form); });
  form.querySelector('[data-again]').addEventListener('click', () => reset(form));
});
