/* FreshAI core: scoring engine, local data store, auth, alerts, zone simulation.
   Everything runs in the browser (localStorage) so the app works on static hosting such as GitHub Pages.
   NOTE: client-side auth is a DEMO. A production system needs a real backend (FastAPI + JWT + PostgreSQL). */
(function () {
  const FA = (window.FA = {});
  const DAY = 864e5, HOUR = 36e5;
  const DBKEY = 'freshai.db.v1', SESSKEY = 'freshai.session.v1';

  /* ---------- constants ---------- */
  FA.CATS = {
    'Fruits': { life: 7, icon: '🍎' }, 'Vegetables': { life: 8, icon: '🥦' }, 'Dairy Products': { life: 10, icon: '🥛' },
    'Meat & Poultry': { life: 4, icon: '🍗' }, 'Seafood': { life: 3, icon: '🐟' }, 'Bakery Products': { life: 5, icon: '🍞' },
    'Packaged Foods': { life: 90, icon: '📦' }, 'Beverages': { life: 60, icon: '🥤' }
  };
  FA.PACK = { vacuum: 1, standard: .85, open: .6 };
  FA.PACKLABEL = { vacuum: 'Vacuum / sealed', standard: 'Standard wrap', open: 'Open / none' };
  FA.ROLES = { consumer: 'Consumer', retail: 'Retail Manager', warehouse: 'Warehouse Operator', inspector: 'Food Quality Inspector', admin: 'Administrator' };
  FA.LABELS = [[85, 'Fresh', '#34d399'], [70, 'Good', '#a3e635'], [50, 'Acceptable', '#fbbf24'], [30, 'Near Spoilage', '#fb923c'], [0, 'Spoiled', '#f87171']];
  FA.label = s => FA.LABELS.find(l => s >= l[0]) || FA.LABELS[4];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();

  /* ---------- sha256 (pure JS so it works on file:// and http) ---------- */
  function sha256(ascii) {
    const rr = (v, a) => (v >>> a) | (v << (32 - a));
    const mp = Math.pow, mw = mp(2, 32); let i, j, result = '';
    const words = [], abl = ascii.length * 8;
    const hash0 = (sha256.h = sha256.h || []), k = (sha256.k = sha256.k || []);
    let pc = k.length; const ic = {};
    for (let c = 2; pc < 64; c++) if (!ic[c]) { for (i = 0; i < 313; i += c) ic[i] = c; hash0[pc] = (mp(c, .5) * mw) | 0; k[pc++] = (mp(c, 1 / 3) * mw) | 0; }
    ascii += '\x80'; while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) { j = ascii.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
    words[words.length] = (abl / mw) | 0; words[words.length] = abl;
    let hash = hash0;
    for (j = 0; j < words.length;) {
      const w = words.slice(j, j += 16), old = hash; hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        const t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash); hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { const b = (hash[i] >> (j * 8)) & 255; result += (b < 16 ? 0 : '') + b.toString(16); }
    return result;
  }
  FA._sha256 = sha256;
  const utf8 = s => unescape(encodeURIComponent(s));
  FA.hashPw = (pw, salt) => { let h = sha256(utf8(salt + pw)); for (let i = 0; i < 300; i++) h = sha256(h + salt); return h; };
  FA.uid = p => p + Math.random().toString(36).slice(2, 9);
  FA.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- storage ---------- */
  function read(store, key) { try { return JSON.parse(store.getItem(key)); } catch (e) { return null; } }
  function write(store, key, v) { try { store.setItem(key, JSON.stringify(v)); } catch (e) { } }
  FA.db = null;
  FA.save = () => write(localStorage, DBKEY, FA.db);

  /* ---------- seed data ---------- */
  function seedZones() {
    const defs = [
      ['z1', 'Cold Room A', 'org', [1, 5], [75, 90], 3.0, 82], ['z2', 'Freezer F1', 'org', [-24, -16], [60, 90], -20.5, 75],
      ['z3', 'Produce Chill', 'org', [6, 10], [85, 95], 8.0, 90], ['z4', 'Dairy Cooler', 'org', [1, 4], [70, 90], 3.4, 80],
      ['z5', 'Dry Store', 'org', [15, 22], [35, 60], 18.5, 48], ['z6', 'Home Fridge', 'home', [2, 5], [70, 90], 3.6, 78]
    ];
    return defs.map(([id, name, scope, target, humT, bt, bh]) => {
      const hist = []; const now = Date.now();
      for (let i = 59; i >= 0; i--) hist.push({ t: now - i * 5 * 60e3, temp: +(bt + Math.sin(i / 7) * .5 + (rnd() - .5) * .6).toFixed(1), hum: +(bh + Math.cos(i / 9) * 2 + (rnd() - .5) * 2).toFixed(0) });
      const z = { id, name, scope, target, humTarget: humT, baseTemp: bt, baseHum: bh, hist }; recalc(z); return z;
    });
  }
  function recalc(z) {
    const l = z.hist.slice(-12); z.avgTemp = +(l.reduce((a, r) => a + r.temp, 0) / l.length).toFixed(1); z.avgHum = Math.round(l.reduce((a, r) => a + r.hum, 0) / l.length);
  }
  function seedItems(ownerHome) {
    const T = (name, category, qty, unit, price, zone, age, visual0, pack, supplier, batch) => ({ name, category, qty, unit, price, zone, age, visual0, pack, supplier, batch });
    const org = [
      T('Fuji Apples', 'Fruits', 120, 'kg', 3.2, 'z3', 2, 96, 'standard', 'Orchard Valley Farms', 'FA-2410-01'),
      T('Strawberries', 'Fruits', 60, 'kg', 6.5, 'z3', 4, 90, 'standard', 'Berry Fresh Co', 'SB-2410-07'),
      T('Bananas', 'Fruits', 90, 'kg', 1.4, 'z3', 3, 92, 'open', 'Tropic Imports', 'BN-2410-03'),
      T('Blueberries', 'Fruits', 35, 'kg', 11.0, 'z3', 6, 88, 'standard', 'Berry Fresh Co', 'BB-2410-02'),
      T('Spinach (loose)', 'Vegetables', 40, 'kg', 4.8, 'z3', 5, 91, 'open', 'GreenLeaf Growers', 'SP-2410-09'),
      T('Broccoli', 'Vegetables', 55, 'kg', 3.1, 'z3', 3, 94, 'standard', 'GreenLeaf Growers', 'BR-2410-04'),
      T('Roma Tomatoes', 'Vegetables', 80, 'kg', 2.7, 'z3', 6, 90, 'standard', 'Sunrise Produce', 'TM-2410-11'),
      T('Carrots', 'Vegetables', 100, 'kg', 1.6, 'z1', 5, 95, 'standard', 'Sunrise Produce', 'CR-2410-02'),
      T('Whole Milk 1L', 'Dairy Products', 240, 'units', 1.1, 'z4', 5, 97, 'vacuum', 'Valley Dairy', 'ML-2410-21'),
      T('Greek Yogurt 500g', 'Dairy Products', 150, 'units', 2.4, 'z4', 9, 93, 'vacuum', 'Valley Dairy', 'YG-2410-15'),
      T('Cheddar Block 400g', 'Dairy Products', 90, 'units', 4.6, 'z4', 8, 96, 'vacuum', 'Valley Dairy', 'CH-2410-08'),
      T('Butter 250g', 'Dairy Products', 110, 'units', 3.2, 'z4', 6, 97, 'vacuum', 'Valley Dairy', 'BT-2410-05'),
      T('Chicken Breast', 'Meat & Poultry', 70, 'kg', 8.9, 'z1', 2, 95, 'vacuum', 'Prime Poultry', 'CK-2410-30'),
      T('Minced Beef', 'Meat & Poultry', 45, 'kg', 10.5, 'z1', 3, 90, 'vacuum', 'Prime Meats', 'BF-2410-12'),
      T('Frozen Chicken Wings', 'Meat & Poultry', 200, 'kg', 5.2, 'z2', 22, 96, 'vacuum', 'Prime Poultry', 'CW-2409-02'),
      T('Atlantic Salmon Fillet', 'Seafood', 30, 'kg', 19.5, 'z1', 2, 95, 'vacuum', 'Nordic Seafood', 'SM-2410-06'),
      T('Prawns (raw)', 'Seafood', 25, 'kg', 16.0, 'z1', 2, 90, 'standard', 'Coastal Catch', 'PR-2410-09'),
      T('Frozen Cod', 'Seafood', 80, 'kg', 12.4, 'z2', 60, 94, 'vacuum', 'Nordic Seafood', 'CD-2408-03'),
      T('Sourdough Loaf', 'Bakery Products', 60, 'units', 3.9, 'z5', 2, 96, 'standard', 'Hearth Bakery', 'SD-2410-44'),
      T('Croissants', 'Bakery Products', 80, 'units', 1.6, 'z5', 3, 90, 'open', 'Hearth Bakery', 'CS-2410-41'),
      T('Pasta Penne 500g', 'Packaged Foods', 400, 'units', 1.3, 'z5', 30, 99, 'vacuum', 'Mediterra Foods', 'PN-2409-77'),
      T('Canned Tomatoes 400g', 'Packaged Foods', 520, 'units', 0.9, 'z5', 60, 99, 'vacuum', 'Mediterra Foods', 'CT-2408-19'),
      T('Orange Juice 1L', 'Beverages', 180, 'units', 2.2, 'z4', 10, 95, 'vacuum', 'SunPress', 'OJ-2410-13'),
      T('Sparkling Water 1.5L', 'Beverages', 360, 'units', 0.8, 'z5', 25, 99, 'vacuum', 'AquaSpring', 'SW-2409-52')
    ].map(x => Object.assign(x, { scope: 'org' }));
    const home = [
      T('Milk 1L', 'Dairy Products', 1, 'units', 1.2, 'z6', 6, 96, 'vacuum', 'Local store', ''),
      T('Spinach bag', 'Vegetables', 1, 'units', 2.5, 'z6', 5, 88, 'standard', 'Local store', ''),
      T('Chicken thighs', 'Meat & Poultry', 0.8, 'kg', 7.0, 'z6', 2, 92, 'standard', 'Butcher', ''),
      T('Strawberries', 'Fruits', 0.5, 'kg', 5.0, 'z6', 4, 84, 'open', 'Farmers market', ''),
      T('Sandwich Bread', 'Bakery Products', 1, 'units', 2.0, 'z6', 4, 90, 'standard', 'Local store', ''),
      T('Greek Yogurt', 'Dairy Products', 2, 'units', 2.4, 'z6', 8, 92, 'vacuum', 'Local store', ''),
      T('Tomatoes', 'Vegetables', 0.6, 'kg', 2.9, 'z6', 7, 86, 'open', 'Farmers market', ''),
      T('Salmon fillet', 'Seafood', 0.3, 'kg', 7.5, 'z6', 2, 94, 'vacuum', 'Fish counter', ''),
      T('Orange Juice', 'Beverages', 1, 'units', 2.6, 'z6', 9, 95, 'vacuum', 'Local store', ''),
      T('Apples', 'Fruits', 1.0, 'kg', 3.5, 'z6', 3, 95, 'standard', 'Local store', '')
    ].map(x => Object.assign(x, { scope: 'home', owner: ownerHome }));
    return org.concat(home).map(x => {
      const o = { id: FA.uid('i'), receivedAt: Date.now() - x.age * DAY - rnd() * 6 * HOUR, inspections: [], status: 'active' }; delete x.age; return Object.assign(o, x);
    });
  }
  function seedWaste(items) {
    const w = [], now = Date.now(); const names = [['Strawberries', 'Fruits', 6.5], ['Spinach (loose)', 'Vegetables', 4.8], ['Whole Milk 1L', 'Dairy Products', 1.1], ['Minced Beef', 'Meat & Poultry', 10.5], ['Croissants', 'Bakery Products', 1.6], ['Bananas', 'Fruits', 1.4], ['Greek Yogurt 500g', 'Dairy Products', 2.4], ['Prawns (raw)', 'Seafood', 16]];
    for (let wk = 8; wk >= 0; wk--) {
      const n = Math.max(2, Math.round(7 - wk * .45 + rnd() * 2));
      for (let k = 0; k < n; k++) {
        const nm = names[Math.floor(rnd() * names.length)], qty = Math.round((2 + rnd() * 14) * 10) / 10, reason = rnd() < .62 ? 'discarded' : rnd() < .5 ? 'donated' : 'discounted';
        w.push({ id: FA.uid('w'), at: now - wk * 7 * DAY - rnd() * 6 * DAY, name: nm[0], category: nm[1], qty, value: +(qty * nm[2]).toFixed(2), reason, scope: 'org' });
      }
    }
    return w;
  }
  FA.seed = function () {
    const users = []; ['Aisha Khan|consumer@freshai.demo|consumer', 'Rohan Mehta|retail@freshai.demo|retail', 'Priya Nair|warehouse@freshai.demo|warehouse', 'Dr. Sameer Rao|inspector@freshai.demo|inspector', 'Admin User|admin@freshai.demo|admin'].forEach(s => {
      const [name, email, role] = s.split('|'), salt = Math.random().toString(36).slice(2, 10);
      users.push({ id: FA.uid('u'), name, email, role, salt, hash: FA.hashPw('Fresh@123', salt), active: true, createdAt: Date.now() - 30 * DAY, lastLogin: null, notify: true });
    });
    const items = seedItems(users[0].id);
    FA.db = { v: 1, seededAt: Date.now(), users, items, zones: seedZones(), waste: seedWaste(items), scans: [], alertState: {}, audit: [], excursions: [] };
    FA.audit('System', 'Demo dataset created'); FA.save();
  };
  FA.init = function () {
    FA.db = read(localStorage, DBKEY);
    if (!FA.db || !FA.db.users || Date.now() - FA.db.seededAt > 5 * DAY) FA.seed();
    return FA.db;
  };
  FA.resetDemo = () => { const sid = (FA.session() || {}).id; localStorage.removeItem(DBKEY); FA.seed(); return sid; };

  /* ---------- audit ---------- */
  FA.audit = (who, what) => { if (!FA.db) return; FA.db.audit.unshift({ at: Date.now(), who, what }); FA.db.audit.length = Math.min(FA.db.audit.length, 120); };

  /* ---------- auth ---------- */
  FA.session = function () {
    const s = read(sessionStorage, SESSKEY) || read(localStorage, SESSKEY);
    if (!s || s.exp < Date.now()) return null;
    FA.init(); const u = FA.db.users.find(x => x.id === s.uid && x.active);
    return u || null;
  };
  FA.login = function (email, pw, remember) {
    FA.init(); email = (email || '').trim().toLowerCase();
    const lock = FA.db.lock = FA.db.lock || {}; const l = lock[email] || { n: 0, until: 0 };
    if (l.until > Date.now()) return { ok: false, error: `Too many attempts. Try again in ${Math.ceil((l.until - Date.now()) / 1000)}s.` };
    const u = FA.db.users.find(x => x.email.toLowerCase() === email);
    if (!u || FA.hashPw(pw, u.salt) !== u.hash) {
      l.n++; if (l.n >= 5) { l.until = Date.now() + 60e3; l.n = 0; } lock[email] = l; FA.audit(email || 'unknown', 'Failed sign-in'); FA.save();
      return { ok: false, error: 'Incorrect email or password.' };
    }
    if (!u.active) return { ok: false, error: 'This account has been deactivated. Contact an administrator.' };
    delete lock[email]; u.lastLogin = Date.now(); FA.audit(u.name, 'Signed in'); FA.save();
    const s = { uid: u.id, exp: Date.now() + (remember ? 7 * DAY : 8 * HOUR), token: FA.uid('t') + FA.uid('') };
    write(remember ? localStorage : sessionStorage, SESSKEY, s); (remember ? sessionStorage : localStorage).removeItem(SESSKEY);
    return { ok: true, user: u };
  };
  FA.register = function (name, email, pw, role) {
    FA.init(); email = email.trim().toLowerCase();
    if (FA.db.users.some(u => u.email.toLowerCase() === email)) return { ok: false, error: 'An account with this email already exists.' };
    role = ['consumer', 'retail', 'warehouse', 'inspector', 'admin'].includes(role) ? role : 'consumer';
    const salt = Math.random().toString(36).slice(2, 10);
    const u = { id: FA.uid('u'), name: name.trim(), email, role, salt, hash: FA.hashPw(pw, salt), active: true, createdAt: Date.now(), lastLogin: null, notify: true };
    FA.db.users.push(u);
    if (role === 'consumer') seedItems(u.id).filter(i => i.scope === 'home').forEach(i => FA.db.items.push(i)); // starter kitchen so the app is not empty
    FA.audit(u.name, 'Account registered (' + role + ')'); FA.save(); return { ok: true, user: u };
  };
  FA.resetPassword = function (email, pw) {
    FA.init(); email = (email || '').trim().toLowerCase(); const u = FA.db.users.find(x => x.email.toLowerCase() === email);
    if (!u) return { ok: false, error: 'No account found with that email.' };
    if (email.endsWith('@freshai.demo')) return { ok: false, error: 'Demo accounts always use the password Fresh@123.' };
    const i = FA.pwIssue(pw); if (i) return { ok: false, error: i };
    u.salt = Math.random().toString(36).slice(2, 10); u.hash = FA.hashPw(pw, u.salt); if (FA.db.lock) delete FA.db.lock[email]; FA.audit(u.name, 'Password reset'); FA.save(); return { ok: true };
  };
  FA.logout = function () { const u = FA.session(); if (u) { FA.audit(u.name, 'Signed out'); FA.save(); } sessionStorage.removeItem(SESSKEY); localStorage.removeItem(SESSKEY); };
  FA.pwIssue = pw => pw.length < 8 ? 'Use at least 8 characters.' : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'Include letters and numbers.' : '';

  /* ---------- data access ---------- */
  FA.zonesFor = u => FA.db.zones.filter(z => u.role === 'consumer' ? z.scope === 'home' : u.role === 'admin' ? true : z.scope === 'org');
  FA.itemsFor = u => FA.db.items.filter(i => i.status === 'active' && (u.role === 'consumer' ? i.scope === 'home' && i.owner === u.id : u.role === 'admin' ? true : i.scope === 'org'));
  FA.zone = id => FA.db.zones.find(z => z.id === id);
  FA.wasteFor = u => FA.db.waste.filter(w => u.role === 'consumer' ? w.owner === u.id : u.role === 'admin' ? true : w.scope === 'org');
  FA.can = (u, act) => ({ add: u.role !== 'inspector', edit: u.role !== 'inspector', del: u.role !== 'inspector', inspect: ['inspector', 'admin'].includes(u.role), markdown: ['retail', 'admin'].includes(u.role) }[act]);

  /* ---------- scoring engine (Visual 40 / Storage 25 / Shelf-life 20 / Age 15) ---------- */
  FA.score = function (it, zone, off) {
    off = off || 0; zone = zone || FA.zone(it.zone);
    const frozen = zone && zone.target[1] < -10;
    const base = FA.CATS[it.category].life * (frozen ? 10 : 1);
    const age = Math.max(0, (Date.now() - it.receivedAt) / DAY - off);
    const temp = zone ? zone.avgTemp : 4, hum = zone ? zone.avgHum : 70, pack = FA.PACK[it.pack] ?? .85;
    const q = Math.pow(2, Math.max(0, temp - (zone ? zone.target[1] : 5)) / 10);
    const eff = Math.max(.5, base * (.5 + .5 * pack) / q), frac = age / eff;
    let visual;
    if (it.lastScan) visual = clamp(it.lastScan.visual * (1 - .5 * Math.max(0, frac - it.lastScan.frac)), 0, 100);
    else visual = clamp(it.visual0 * (1 - .5 * Math.pow(Math.min(frac, 1.8), 1.4)), 0, 100);
    const lo = zone ? zone.target[0] : 1, hi = zone ? zone.target[1] : 5, hl = zone ? zone.humTarget[0] : 60, hh = zone ? zone.humTarget[1] : 90;
    const td = temp < lo ? lo - temp : temp > hi ? temp - hi : 0, hd = hum < hl ? hl - hum : hum > hh ? hum - hh : 0;
    const storage = clamp((100 - td * 6 - hd * .8) * (.55 + .45 * pack), 0, 100);
    const life = clamp(100 * (1 - Math.pow(Math.min(1, frac), 1.5)), 0, 100), ageS = clamp(100 * (1 - Math.pow(Math.min(1, age / base), 1.5)), 0, 100);
    let score = Math.round(visual * .4 + storage * .25 + life * .2 + ageS * .15);
    if (frac > 1.25) score = Math.min(score, 25); else if (frac >= 1) score = Math.min(score, 45);
    const remaining = Math.max(0, eff - age), L = FA.label(score);
    return { score, label: L[1], color: L[2], remaining, age, eff, frac, spoil: clamp(Math.round(100 - score + (temp > hi + 4 ? 8 : 0)), 1, 99), conf: it.lastScan ? 90 : 76, parts: { visual, storage, life, age: ageS }, temp, hum };
  };
  FA.recs = function (it, r, zone) {
    const out = []; zone = zone || FA.zone(it.zone);
    if (r.score < 30) out.push('Spoilage indicators likely — inspect and discard if in doubt. Do not sell or serve.');
    else if (r.score < 50) out.push('Use or process today; prioritise this batch (FEFO) or mark it down for quick sale.');
    else if (r.remaining < 2) out.push(`About ${r.remaining.toFixed(1)} days left — plan to use or sell it within 48 hours.`);
    if (zone && r.temp > zone.target[1]) out.push(`Storage is warm (${r.temp}°C vs ${zone.target[0]}–${zone.target[1]}°C target). Check cooling and door seals.`);
    if (zone && r.hum > zone.humTarget[1]) out.push('Humidity is high — improve air circulation to reduce mold risk.');
    if (zone && r.hum < zone.humTarget[0]) out.push('Humidity is low — consider a crisper drawer or cover to prevent drying.');
    if (it.pack === 'open') out.push('Switch to sealed or vacuum packaging to extend shelf life.');
    if (it.category === 'Fruits' && /banana|apple/i.test(it.name)) out.push('Store away from other produce — ethylene speeds ripening.');
    if (!out.length) out.push('Conditions look good. Keep current storage and re-scan in a few days.');
    return out;
  };
  FA.enrich = u => FA.itemsFor(u).map(it => Object.assign({ r: FA.score(it) }, { it })).map(x => Object.assign({}, x.it, { r: x.r }));

  /* ---------- zone simulation ---------- */
  FA.tick = function () {
    FA.db.excursions = FA.db.excursions || [];
    FA.db.zones.forEach(z => {
      const last = z.hist[z.hist.length - 1], wasOut = last.temp < z.target[0] || last.temp > z.target[1];
      const t = last.temp + (z.baseTemp - last.temp) * .18 + (Math.random() - .5) * (z.target[1] < -10 ? .8 : .9);
      const h = last.hum + (z.baseHum - last.hum) * .2 + (Math.random() - .5) * 2.2;
      const n = { t: Date.now(), temp: +t.toFixed(1), hum: Math.round(clamp(h, 20, 99)) }; z.hist.push(n); if (z.hist.length > 60) z.hist.shift(); recalc(z);
      const out = n.temp < z.target[0] || n.temp > z.target[1];
      if (out && !wasOut) FA.db.excursions.unshift({ zone: z.id, start: n.t, peak: n.temp, open: true });
      const ex = FA.db.excursions.find(e => e.zone === z.id && e.open);
      if (ex) { if (out) ex.peak = Math.abs(n.temp - z.baseTemp) > Math.abs(ex.peak - z.baseTemp) ? n.temp : ex.peak; else { ex.open = false; ex.end = n.t; } }
    });
    FA.db.excursions.length = Math.min(FA.db.excursions.length, 40);
  };
  FA.zoneOut = z => { const l = z.hist[z.hist.length - 1]; return l.temp < z.target[0] || l.temp > z.target[1]; };
  FA.compliance = z => Math.round(z.hist.filter(r => r.temp >= z.target[0] && r.temp <= z.target[1]).length / z.hist.length * 100);

  /* ---------- alerts (computed live; ack/resolve state persisted) ---------- */
  FA.alerts = function (u) {
    const list = [], st = FA.db.alertState;
    FA.enrich(u).forEach(i => {
      const r = i.r;
      if (r.score < 30) list.push({ id: 'sp:' + i.id, sev: 'critical', type: 'Spoilage', title: `${i.name} appears spoiled`, detail: `Freshness ${r.score} · ${i.qty} ${i.unit} · ${FA.zone(i.zone).name}`, item: i.id });
      else if (r.score < 50) list.push({ id: 'ns:' + i.id, sev: 'high', type: 'Spoilage', title: `${i.name} near spoilage`, detail: `Freshness ${r.score} · use today · ${FA.zone(i.zone).name}`, item: i.id });
      else if (r.remaining < 2) list.push({ id: 'ex:' + i.id, sev: 'medium', type: 'Shelf-life', title: `${i.name} expires in ~${Math.max(1, Math.round(r.remaining * 24))}h`, detail: `${r.remaining.toFixed(1)} days left · ${i.qty} ${i.unit}`, item: i.id });
    });
    FA.zonesFor(u).forEach(z => { if (FA.zoneOut(z)) { const l = z.hist[z.hist.length - 1]; list.push({ id: 'zn:' + z.id, sev: 'high', type: 'Storage', title: `${z.name} outside target range`, detail: `${l.temp}°C now · target ${z.target[0]} to ${z.target[1]}°C`, zone: z.id }); } });
    const order = { critical: 0, high: 1, medium: 2 };
    return list.map(a => Object.assign(a, { state: (st[a.id] || {}).s || 'open' })).sort((a, b) => order[a.sev] - order[b.sev]);
  };

  /* ---------- formatting ---------- */
  FA.money = v => '$' + (+v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  FA.date = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  FA.dt = t => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  FA.ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  FA.csv = (cols, rows) => [cols].concat(rows).map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
})();
