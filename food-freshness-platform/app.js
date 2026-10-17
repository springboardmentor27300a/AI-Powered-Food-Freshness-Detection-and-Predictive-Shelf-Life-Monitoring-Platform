/* FreshAI app — role-based single-page app. Data lives in the browser (see core.js). */
(function () {
  FA.init();
  let user = FA.session();
  if (!user) { location.replace('login.html' + (location.hash ? '?next=' + encodeURIComponent(location.hash) : '')); return; }
  const esc = FA.esc, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const DAY = 864e5, view = $('#view');
  const raw = id => FA.db.items.find(i => i.id === id);
  const catIcon = c => (FA.CATS[c] || {}).icon || '🍽️';
  const R = FA.ROLES;
  let charts = [], route = 'dashboard', known = null;
  const inv = { q: '', cat: '', status: '', sort: 'score', dir: 1 };
  let repType = 'freshness', alertTab = 'open', scanState = null;

  /* ---------- UI helpers ---------- */
  function toast(msg, type) { const t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4500); }
  function openModal(html, wide) { $('#mbox').className = 'mbox' + (wide ? ' wide' : ''); $('#mbox').innerHTML = html; $('#modal').classList.add('show'); }
  function closeModal() { $('#modal').classList.remove('show'); $('#mbox').innerHTML = ''; }
  const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const chipFor = r => `<span class="chip" style="color:${r.color};border-color:${r.color}66;background:${r.color}1f">${r.label}</span>`;
  const scoreB = r => `<span class="score" style="color:${r.color};border-color:${r.color}">${r.score}</span>`;
  const days = d => d >= 14 ? Math.round(d) + ' d' : d < 1 ? (d * 24 < 1 ? '<1 h' : Math.round(d * 24) + ' h') : d.toFixed(1) + ' d';
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const items = () => FA.enrich(user);
  const zones = () => FA.zonesFor(user);
  const wasteLog = () => FA.wasteFor(user);
  function persist() { FA.save(); }
  function log(msg) { FA.audit(user.name, msg); persist(); }

  /* ---------- canvas charts ---------- */
  function cv(c, h) { const d = devicePixelRatio || 1, w = Math.max(160, c.parentElement.clientWidth); c.width = w * d; c.height = h * d; c.style.width = w + 'px'; c.style.height = h + 'px'; const x = c.getContext('2d'); x.scale(d, d); return { x, w, h }; }
  function donut(c, data, center, sub) {
    const { x, w, h } = cv(c, 220), cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 12, tot = sum(data, d => d.v) || 1; let a = -Math.PI / 2;
    x.lineWidth = 26; x.lineCap = 'butt'; data.forEach(d => { if (!d.v) return; const s = d.v / tot * Math.PI * 2; x.beginPath(); x.strokeStyle = d.c; x.arc(cx, cy, r, a + .02, a + s - .02); x.stroke(); a += s; });
    x.fillStyle = '#e8f5ee'; x.textAlign = 'center'; x.font = "700 30px 'Space Grotesk',sans-serif"; x.fillText(center, cx, cy + 8); x.fillStyle = '#8fb0a0'; x.font = '12px Inter,sans-serif'; x.fillText(sub, cx, cy + 28);
  }
  function bars(c, labels, vals, colors, max, suffix) {
    const { x, w, h } = cv(c, 230), pad = { l: 34, r: 8, t: 14, b: 44 }, bw = (w - pad.l - pad.r) / labels.length; max = max || Math.max(1, ...vals) * 1.15;
    x.font = '11px Inter'; x.strokeStyle = 'rgba(255,255,255,.07)'; x.fillStyle = '#8fb0a0'; x.textAlign = 'right';
    for (let i = 0; i <= 4; i++) { const y = pad.t + (h - pad.t - pad.b) * (1 - i / 4); x.beginPath(); x.moveTo(pad.l, y); x.lineTo(w - pad.r, y); x.stroke(); x.fillText(Math.round(max * i / 4), pad.l - 6, y + 4); }
    labels.forEach((l, i) => {
      const bh = (h - pad.t - pad.b) * Math.min(1, vals[i] / max), bx = pad.l + i * bw + bw * .2, by = h - pad.b - bh;
      x.fillStyle = Array.isArray(colors) ? colors[i] : colors; x.beginPath(); x.roundRect ? x.roundRect(bx, by, bw * .6, bh, 5) : x.rect(bx, by, bw * .6, bh); x.fill();
      x.fillStyle = '#e8f5ee'; x.textAlign = 'center'; x.fillText(Math.round(vals[i]) + (suffix || ''), bx + bw * .3, by - 5);
      x.fillStyle = '#8fb0a0'; const t = l.length > 9 ? l.slice(0, 8) + '…' : l; x.fillText(t, bx + bw * .3, h - pad.b + 16);
    });
  }
  function lines(c, labels, series, o) {
    o = o || {}; const { x, w, h } = cv(c, o.h || 230), pad = { l: 36, r: 12, t: 14, b: 28 };
    const all = series.flatMap(s => s.v), mn = o.min ?? Math.min(...all), mx = o.max ?? Math.max(...all), rg = (mx - mn) || 1;
    const px = i => pad.l + (w - pad.l - pad.r) * (labels.length < 2 ? .5 : i / (labels.length - 1)), py = v => pad.t + (h - pad.t - pad.b) * (1 - (v - mn) / rg);
    x.font = '11px Inter'; x.textAlign = 'right'; x.strokeStyle = 'rgba(255,255,255,.07)'; x.fillStyle = '#8fb0a0';
    for (let i = 0; i <= 4; i++) { const v = mn + rg * i / 4, y = py(v); x.beginPath(); x.moveTo(pad.l, y); x.lineTo(w - pad.r, y); x.stroke(); x.fillText(Math.round(v), pad.l - 6, y + 4); }
    x.textAlign = 'center'; const step = Math.ceil(labels.length / 6); labels.forEach((l, i) => { if (i % step === 0 || i === labels.length - 1) x.fillText(l, px(i), h - 8); });
    series.forEach(s => {
      const g = x.createLinearGradient(0, pad.t, 0, h - pad.b); g.addColorStop(0, s.c + '44'); g.addColorStop(1, s.c + '00');
      x.beginPath(); s.v.forEach((v, i) => i ? x.lineTo(px(i), py(v)) : x.moveTo(px(i), py(v))); x.strokeStyle = s.c; x.lineWidth = 2.5; x.lineJoin = 'round'; x.stroke();
      if (o.fill) { x.lineTo(px(s.v.length - 1), h - pad.b); x.lineTo(px(0), h - pad.b); x.closePath(); x.fillStyle = g; x.fill(); }
      const li = s.v.length - 1; x.beginPath(); x.arc(px(li), py(s.v[li]), 4, 0, 7); x.fillStyle = s.c; x.fill();
    });
    if (o.band) { x.fillStyle = 'rgba(52,211,153,.08)'; x.fillRect(pad.l, py(o.band[1]), w - pad.l - pad.r, py(o.band[0]) - py(o.band[1])); }
  }
  function spark(c, z) {
    const { x, w, h } = cv(c, 70), v = z.hist.map(r => r.temp), lo = Math.min(...v, z.target[0]) - .5, hi = Math.max(...v, z.target[1]) + .5, py = t => h - 6 - (h - 12) * (t - lo) / (hi - lo), px = i => w * i / (v.length - 1);
    x.fillStyle = 'rgba(52,211,153,.10)'; x.fillRect(0, py(z.target[1]), w, py(z.target[0]) - py(z.target[1]));
    x.beginPath(); v.forEach((t, i) => i ? x.lineTo(px(i), py(t)) : x.moveTo(px(i), py(t))); x.strokeStyle = FA.zoneOut(z) ? '#f87171' : '#34d399'; x.lineWidth = 2; x.stroke();
  }
  function drawCharts() { charts.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawCharts, 120); });
  const reg = f => charts.push(f);

  /* ---------- derived metrics ---------- */
  function dist(list) { const c = {}; FA.LABELS.forEach(l => c[l[1]] = 0); list.forEach(i => c[i.r.label]++); return c; }
  function distData(list) { const d = dist(list); return FA.LABELS.map(l => ({ l: l[1], v: d[l[1]], c: l[2] })); }
  function trend(list) {
    const lab = [], v = []; for (let d = 13; d >= 0; d--) {
      const sc = list.filter(i => (Date.now() - i.receivedAt) / DAY - d >= 0).map(i => FA.score(raw(i.id), null, d).score);
      if (sc.length) { v.push(Math.round(avg(sc))); lab.push(d === 0 ? 'Now' : '-' + d + 'd'); }
    } return { lab, v };
  }
  function wasteSplit() { const w = wasteLog(), now = Date.now(), cur = w.filter(x => now - x.at < 30 * DAY), prev = w.filter(x => now - x.at >= 30 * DAY && now - x.at < 60 * DAY); const f = a => sum(a.filter(x => x.reason === 'discarded'), x => x.value); return { cur: f(cur), prev: f(prev) }; }
  function weeks() { const w = wasteLog(), out = []; for (let k = 7; k >= 0; k--) { const a = Date.now() - (k + 1) * 7 * DAY, b = Date.now() - k * 7 * DAY, s = w.filter(x => x.at >= a && x.at < b); out.push({ l: k ? '-' + k + 'w' : 'This wk', all: sum(s, x => x.value), dis: sum(s.filter(x => x.reason === 'discarded'), x => x.value) }); } return out; }

  /* ---------- navigation ---------- */
  const NAV = [['dashboard', 'Dashboard', '▦'], ['inventory', 'Inventory', '📦'], ['scan', 'Freshness Scan', '📷'], ['storage', 'Storage Monitor', '🌡️'], ['alerts', 'Alerts', '🔔'], ['analytics', 'Analytics', '📈'], ['reports', 'Reports', '🧾'], ['users', 'Users & Audit', '👥', ['admin']], ['profile', 'My Profile', '⚙️']];
  function buildNav() {
    const n = FA.alerts(user).filter(a => a.state === 'open').length;
    $('#nav').innerHTML = NAV.filter(x => !x[3] || x[3].includes(user.role)).map(x => `<a href="#/${x[0]}" class="${route === x[0] ? 'on' : ''}"><span>${x[2]}</span>${x[1]}${x[0] === 'alerts' && n ? `<span class="n">${n}</span>` : ''}</a>`).join('');
    $('#me').innerHTML = `<div class="av">${esc(initials(user.name))}</div><div><b>${esc(user.name)}</b><small>${R[user.role]}</small></div>`;
    const b = $('#bellN'); b.hidden = !n; b.textContent = n;
    const open = FA.alerts(user).filter(a => a.state === 'open').slice(0, 5);
    $('#bellDrop').innerHTML = `<h4>Notifications</h4>` + (open.length ? open.map(a => `<a href="#/alerts"><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></a>`).join('') : '<div class="empty">You\'re all caught up ✓</div>');
  }
  function go() {
    const h = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
    const ok = NAV.find(x => x[0] === h && (!x[3] || x[3].includes(user.role)));
    route = ok ? h : 'dashboard'; charts = [];
    const v = V[route]; view.innerHTML = v.html(); buildNav(); document.title = 'FreshAI — ' + NAV.find(x => x[0] === route)[1];
    v.after && v.after(); drawCharts(); scrollTo(0, 0); $('#side').classList.remove('open'); $('#scrim').classList.remove('show');
  }
  const render = () => { const y = scrollY; charts = []; const v = V[route]; view.innerHTML = v.html(); buildNav(); v.after && v.after(); drawCharts(); scrollTo(0, y); };
  addEventListener('hashchange', go);

  /* ---------- VIEWS ---------- */
  const V = {};
  const head = (t, p, btns) => `<div class="ph"><div><h1>${t}</h1><p>${p || ''}</p></div><div class="btns">${btns || ''}</div></div>`;

  /* DASHBOARD */
  V.dashboard = {
    html() {
      const list = items(), zs = zones(), al = FA.alerts(user).filter(a => a.state === 'open');
      const atRisk = list.filter(i => i.r.score < 50), exp = list.filter(i => i.r.remaining < 2 && i.r.score >= 30), risk$ = sum(atRisk, i => i.qty * i.price), ws = wasteSplit();
      const fourth = { consumer: ['Home fridge', zs[0] ? zs[0].hist[zs[0].hist.length - 1].temp + '°C' : '—', zs[0] && FA.zoneOut(zs[0]) ? 'Outside target' : 'Within target range', zs[0] && FA.zoneOut(zs[0]) ? 'dn' : 'up'],
        retail: ['Markdown opportunity', FA.money(sum(list.filter(i => i.r.score >= 30 && i.r.score < 65 && i.r.remaining < 3 && !i.markdown), i => i.qty * i.price * .3)), 'Recoverable with 30% markdown', ''],
        warehouse: ['Storage compliance', Math.round(avg(zs.map(FA.compliance))) + '%', zs.filter(FA.zoneOut).length + ' zone(s) out of range', zs.some(FA.zoneOut) ? 'dn' : 'up'],
        inspector: ['Inspection queue', list.filter(i => (i.r.score < 65 || i.r.remaining < 2) && !(i.inspections[0] && Date.now() - i.inspections[0].at < DAY)).length, 'Batches needing a check', ''],
        admin: ['Active users', FA.db.users.filter(u => u.active).length, FA.db.users.length + ' accounts total', '']
      }[user.role];
      const delta = ws.prev ? Math.round((ws.cur - ws.prev) / ws.prev * 100) : 0;
      const hr = new Date().getHours(), gr = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
      const useFirst = list.slice().sort((a, b) => a.r.remaining - b.r.remaining).slice(0, 6);
      return head(`${gr}, ${esc(user.name.replace(/^(dr|mr|ms|mrs|prof)\.?\s+/i, '').split(' ')[0])} 👋`, `${R[user.role]} · ${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`, `<a class="btn pri" href="#/scan">📷 New freshness scan</a>`) + `
      <div class="grid g4">
        <div class="card kpi"><span>Average freshness</span><b>${Math.round(avg(list.map(i => i.r.score)))}</b><small>${list.length} items tracked</small></div>
        <div class="card kpi" style="--k:rgba(248,113,113,.22)"><span>At-risk items</span><b>${atRisk.length}</b><small class="${atRisk.length ? 'dn' : 'up'}">${FA.money(risk$)} value at risk</small></div>
        <div class="card kpi" style="--k:rgba(251,191,36,.22)"><span>Expiring within 48h</span><b>${exp.length}</b><small>${al.length} open alert${al.length === 1 ? '' : 's'}</small></div>
        <div class="card kpi" style="--k:rgba(34,211,238,.22)"><span>${fourth[0]}</span><b>${fourth[1]}</b><small class="${fourth[3]}">${fourth[2]}</small></div>
      </div>
      <div class="grid g21" style="margin-top:18px">
        <div class="card"><h3>Average freshness · last 14 days <small>higher is better</small></h3><canvas id="cTrend"></canvas></div>
        <div class="card"><h3>Freshness mix</h3><canvas id="cDist"></canvas><div class="legend">${FA.LABELS.map(l => `<span><i style="background:${l[2]}"></i>${l[1]}</span>`).join('')}</div></div>
      </div>
      <div class="grid g2" style="margin-top:18px">
        <div class="card"><h3>Use first (FEFO) <small>shortest remaining shelf life</small></h3><div class="list">${useFirst.map(i => `<div class="li" data-act="open" data-id="${i.id}" style="cursor:pointer"><div class="emoji">${catIcon(i.category)}</div><div class="grow"><b>${esc(i.name)}</b><small>${i.qty} ${esc(i.unit)} · ${esc(FA.zone(i.zone).name)}</small></div><div style="text-align:right"><b style="color:${i.r.color}">${days(i.r.remaining)}</b><small>left</small></div></div>`).join('') || '<div class="empty">No items yet</div>'}</div></div>
        <div class="card">${this.role(list, zs, ws, delta)}</div>
      </div>
      <div class="card" style="margin-top:18px"><h3>Active alerts <small><a href="#/alerts">View all →</a></small></h3><div class="list">${al.slice(0, 4).map(a => `<div class="li"><span class="chip sev-${a.sev}">${a.sev}</span><div class="grow"><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></div></div>`).join('') || '<div class="empty">No open alerts ✓</div>'}</div></div>`;
    },
    role(list, zs, ws, delta) {
      if (user.role === 'retail') {
        const s = list.filter(i => i.r.score >= 30 && i.r.score < 65 && i.r.remaining < 3 && !i.markdown).sort((a, b) => a.r.score - b.r.score).slice(0, 5);
        return `<h3>Markdown suggestions <small>sell before spoilage</small></h3><div class="list">${s.map(i => `<div class="li"><div class="emoji">${catIcon(i.category)}</div><div class="grow"><b>${esc(i.name)}</b><small>${i.qty} ${esc(i.unit)} · ${days(i.r.remaining)} left · recover ≈ ${FA.money(i.qty * i.price * .7)}</small></div><button class="btn sm pri" data-act="markdown" data-id="${i.id}">−30%</button></div>`).join('') || '<div class="empty">Nothing to mark down right now ✓</div>'}</div><p class="note" style="margin-top:12px">Waste cost (30 d): ${FA.money(ws.cur)} ${ws.prev ? `<b style="color:${delta <= 0 ? 'var(--g1)' : 'var(--bad)'}">${delta > 0 ? '+' : ''}${delta}% vs prior 30 d</b>` : ''}</p>`;
      }
      if (user.role === 'warehouse') return `<h3>Storage zones <small><a href="#/storage">Open monitor →</a></small></h3><div class="list">${zs.map(z => { const l = z.hist[z.hist.length - 1]; return `<div class="li"><div class="grow"><b>${esc(z.name)}</b><small>Target ${z.target[0]} to ${z.target[1]}°C · ${FA.compliance(z)}% compliant</small></div><b data-zt="${z.id}" style="color:${FA.zoneOut(z) ? 'var(--bad)' : 'var(--g1)'}">${l.temp}°C</b></div>`; }).join('')}</div>`;
      if (user.role === 'inspector') {
        const q = list.filter(i => i.r.score < 65 || i.r.remaining < 2).sort((a, b) => a.r.score - b.r.score).slice(0, 5);
        return `<h3>Inspection queue <small>lowest freshness first</small></h3><div class="list">${q.map(i => `<div class="li"><div class="emoji">${catIcon(i.category)}</div><div class="grow"><b>${esc(i.name)}</b><small>${esc(i.batch || 'No batch')} · score ${i.r.score}${i.inspections[0] ? ' · last: ' + i.inspections[0].result + ' ' + FA.ago(i.inspections[0].at) : ''}</small></div><button class="btn sm pri" data-act="inspect" data-id="${i.id}">Inspect</button></div>`).join('') || '<div class="empty">Queue is empty ✓</div>'}</div>`;
      }
      if (user.role === 'admin') {
        const byRole = Object.keys(R).map(k => `${R[k]}: <b>${FA.db.users.filter(u => u.role === k).length}</b>`).join(' · ');
        return `<h3>System overview <small><a href="#/users">Manage →</a></small></h3><p class="note" style="margin-bottom:12px">${byRole}</p><div class="tl">${FA.db.audit.slice(0, 5).map(a => `<div>${esc(a.what)}<small>${esc(a.who)} · ${FA.ago(a.at)}</small></div>`).join('')}</div>`;
      }
      const t = [], z = zs[0];
      if (z && FA.zoneOut(z)) t.push('Your fridge is outside its 2–5°C range — check the door seal.');
      list.filter(i => i.r.remaining < 2).slice(0, 2).forEach(i => t.push(`Cook or eat ${i.name.toLowerCase()} within ${Math.max(1, Math.round(i.r.remaining * 24))} hours.`));
      t.push('Store raw meat and fish on the bottom shelf, away from ready-to-eat food.', 'Keep bananas and apples apart from other produce to slow ripening.');
      return `<h3>Smart kitchen tips <small>for you</small></h3><div class="list">${t.slice(0, 4).map(x => `<div class="li"><span>💡</span><div class="grow">${esc(x)}</div></div>`).join('')}</div><p class="note" style="margin-top:12px">Food waste this month: <b>${FA.money(ws.cur)}</b></p>`;
    },
    after() {
      const list = items(), t = trend(list), d = distData(list);
      reg(() => lines($('#cTrend'), t.lab, [{ v: t.v, c: '#34d399' }], { min: 0, max: 100, fill: true }));
      reg(() => donut($('#cDist'), d.map(x => ({ v: x.v, c: x.c })), String(list.length), 'items'));
    },
    live() { zones().forEach(z => { const e = $(`[data-zt="${z.id}"]`); if (e) { e.textContent = z.hist[z.hist.length - 1].temp + '°C'; e.style.color = FA.zoneOut(z) ? 'var(--bad)' : 'var(--g1)'; } }); }
  };

  /* INVENTORY */
  function invRows() {
    let l = items().filter(i => (!inv.q || (i.name + i.batch + i.supplier + i.category).toLowerCase().includes(inv.q.toLowerCase())) && (!inv.cat || i.category === inv.cat) && (!inv.status || (inv.status === 'risk' ? i.r.score < 50 : i.r.label === inv.status)));
    const k = { name: i => i.name.toLowerCase(), category: i => i.category, qty: i => i.qty, score: i => i.r.score, remaining: i => i.r.remaining, value: i => i.qty * i.price }[inv.sort];
    return l.sort((a, b) => (k(a) > k(b) ? 1 : -1) * inv.dir);
  }
  function invTable() {
    const l = invRows(); const th = (k, t) => `<th class="s" data-act="sort" data-k="${k}">${t}${inv.sort === k ? (inv.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    return `<div class="tw"><table><thead><tr>${th('name', 'Item')}${th('category', 'Category')}${th('qty', 'Qty')}<th class="hide-sm">Zone</th>${th('score', 'Freshness')}<th>Status</th>${th('remaining', 'Shelf life')}${th('value', 'Value')}</tr></thead><tbody>${l.map(i => `<tr class="click" data-act="open" data-id="${i.id}"><td><div class="name"><div class="emoji">${catIcon(i.category)}</div><div>${esc(i.name)}${i.markdown ? ' <span class="chip sev-medium">−30%</span>' : ''}${i.inspections[0] && i.inspections[0].result === 'Fail' ? ' <span class="chip sev-critical">Hold</span>' : ''}<small>${esc(i.batch || '—')} · ${esc(i.supplier || '')}</small></div></div></td><td>${esc(i.category)}</td><td>${i.qty} ${esc(i.unit)}</td><td class="hide-sm">${esc(FA.zone(i.zone).name)}</td><td>${scoreB(i.r)}</td><td>${chipFor(i.r)}</td><td>${days(i.r.remaining)}</td><td>${FA.money(i.qty * i.price)}</td></tr>`).join('')}</tbody></table></div>${l.length ? '' : '<div class="empty">No items match your filters.</div>'}<p class="note" style="margin-top:10px">${l.length} item${l.length === 1 ? '' : 's'} · total value ${FA.money(sum(l, i => i.qty * i.price))}</p>`;
  }
  V.inventory = {
    html() {
      return head('Inventory', 'Batches, freshness scores and predicted shelf life.', (FA.can(user, 'add') ? `<button class="btn pri" data-act="additem">＋ Add item</button>` : '')) + `
      <div class="card"><div class="tools"><input id="iq" type="search" placeholder="Search name, batch, supplier…" value="${esc(inv.q)}" aria-label="Search inventory" />
        <select id="ic" aria-label="Category"><option value="">All categories</option>${Object.keys(FA.CATS).map(c => `<option ${inv.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <select id="is" aria-label="Status"><option value="">All statuses</option>${FA.LABELS.map(l => `<option ${inv.status === l[1] ? 'selected' : ''}>${l[1]}</option>`).join('')}<option value="risk" ${inv.status === 'risk' ? 'selected' : ''}>At risk (&lt; 50)</option></select></div>
        <div id="itab">${invTable()}</div></div>`;
    },
    after() {
      const up = () => { $('#itab').innerHTML = invTable(); };
      $('#iq').oninput = e => { inv.q = e.target.value; up(); }; $('#ic').onchange = e => { inv.cat = e.target.value; up(); }; $('#is').onchange = e => { inv.status = e.target.value; up(); };
    }
  };

  function itemForm(it) {
    const e = !!it, zs = zones(); it = it || { name: '', category: 'Fruits', qty: 1, unit: 'kg', price: 1, zone: zs[0].id, pack: 'standard', supplier: '', batch: '' };
    openModal(`<div class="mh"><h2>${e ? 'Edit item' : 'Add inventory item'}</h2><button class="x" data-act="close" aria-label="Close">×</button></div>
    <form id="ifrm" class="frm" novalidate>
      <label class="fld full">Item name<input id="f_name" value="${esc(it.name)}" maxlength="60" required /></label>
      <label class="fld">Category<select id="f_cat">${Object.keys(FA.CATS).map(c => `<option ${it.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="fld">Storage zone<select id="f_zone">${zs.map(z => `<option value="${z.id}" ${it.zone === z.id ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select></label>
      <label class="fld">Quantity<input id="f_qty" type="number" min="0.01" step="any" value="${it.qty}" /></label>
      <label class="fld">Unit<select id="f_unit">${['kg', 'units', 'L', 'boxes'].map(u => `<option ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="fld">Unit price ($)<input id="f_price" type="number" min="0" step="0.01" value="${it.price}" /></label>
      <label class="fld">Packaging<select id="f_pack">${Object.keys(FA.PACK).map(p => `<option value="${p}" ${it.pack === p ? 'selected' : ''}>${FA.PACKLABEL[p]}</option>`).join('')}</select></label>
      <label class="fld">Supplier<input id="f_sup" value="${esc(it.supplier)}" maxlength="60" /></label>
      <label class="fld">Batch / lot no.<input id="f_batch" value="${esc(it.batch)}" maxlength="30" /></label>
      ${e ? '' : `<label class="fld">Received (days ago)<input id="f_age" type="number" min="0" max="365" step="0.5" value="0" /></label><label class="fld">Quality at receipt: <b id="f_vv">95</b>%<input id="f_vis" type="range" min="40" max="100" value="95" /></label>`}
      <div class="full err" id="f_err" style="color:var(--bad);font-size:.85rem"></div>
    </form><div class="mf"><button class="btn" data-act="close">Cancel</button><button class="btn pri" data-act="saveitem" data-id="${e ? it.id : ''}">${e ? 'Save changes' : 'Add item'}</button></div>`);
    const v = $('#f_vis'); if (v) v.oninput = () => $('#f_vv').textContent = v.value;
  }
  function saveItem(id) {
    const g = s => $(s).value, name = g('#f_name').trim(), qty = parseFloat(g('#f_qty')), price = parseFloat(g('#f_price')), er = m => $('#f_err').textContent = m;
    if (!name) return er('Please enter an item name.'); if (!(qty > 0)) return er('Quantity must be greater than 0.'); if (!(price >= 0)) return er('Price cannot be negative.');
    const z = FA.zone(g('#f_zone')), f = { name, category: g('#f_cat'), zone: z.id, qty, unit: g('#f_unit'), price, pack: g('#f_pack'), supplier: g('#f_sup').trim(), batch: g('#f_batch').trim() };
    if (id) { Object.assign(raw(id), f); log('Edited item ' + name); toast('Item updated'); }
    else { FA.db.items.push(Object.assign(f, { id: FA.uid('i'), receivedAt: Date.now() - (parseFloat(g('#f_age')) || 0) * DAY, visual0: +g('#f_vis'), inspections: [], status: 'active', scope: z.scope, owner: user.id })); log('Added item ' + name); toast('Item added to inventory'); }
    persist(); closeModal(); render();
  }
  function itemDetail(id) {
    const i = items().find(x => x.id === id); if (!i) return; const r = i.r, z = FA.zone(i.zone), C = 2 * Math.PI * 70, ra = raw(id);
    const parts = [['Visual (40%)', r.parts.visual], ['Storage (25%)', r.parts.storage], ['Shelf-life (20%)', r.parts.life], ['Age (15%)', r.parts.age]];
    openModal(`<div class="mh"><div><h2>${catIcon(i.category)} ${esc(i.name)}</h2><p class="note">${esc(i.category)} · ${esc(i.batch || 'No batch')} · ${esc(i.supplier || '—')} · received ${FA.date(i.receivedAt)}</p></div><button class="x" data-act="close" aria-label="Close">×</button></div>
    <div class="grid g2"><div><div class="gauge"><svg viewBox="0 0 170 170" width="170"><circle class="bg" cx="85" cy="85" r="70"/><circle class="fg" id="dg" cx="85" cy="85" r="70" stroke="${r.color}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><div><b>${r.score}</b><small>Freshness</small></div></div><p style="text-align:center;margin-top:10px">${chipFor(r)}</p>
      <div class="kv"><div><span>Shelf life left</span><b>${days(r.remaining)}</b></div><div><span>Spoilage prob.</span><b>${r.spoil}%</b></div><div><span>Confidence</span><b>${r.conf}%</b></div></div></div>
      <div><div class="parts">${parts.map(p => `<div><span>${p[0]}</span><div class="bar"><i style="width:${Math.round(p[1])}%;background:linear-gradient(90deg,#34d399,#22d3ee)"></i></div><b>${Math.round(p[1])}</b></div>`).join('')}</div>
      <p class="note" style="margin-top:14px">📍 ${esc(z.name)} · now ${z.hist[z.hist.length - 1].temp}°C / ${z.hist[z.hist.length - 1].hum}% RH (target ${z.target[0]} to ${z.target[1]}°C)<br>📦 ${i.qty} ${esc(i.unit)} × ${FA.money(i.price)} = <b>${FA.money(i.qty * i.price)}</b> · ${FA.PACKLABEL[i.pack]}${i.lastScan ? `<br>📷 Last scan ${FA.ago(i.lastScan.at)}` : ''}</p></div></div>
    <div class="reco"><h4>💡 Recommendations</h4><ul>${FA.recs(ra, r, z).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    ${i.inspections.length ? `<h4 style="margin:16px 0 8px">Inspections</h4><div class="tl">${i.inspections.slice(0, 3).map(n => `<div><b>${esc(n.result)}</b> — ${esc(n.note || 'No notes')}<small>${esc(n.by)} · ${FA.dt(n.at)}</small></div>`).join('')}</div>` : ''}
    <div class="mf" style="justify-content:flex-start"><a class="btn" href="#/scan?item=${i.id}" data-act="close">📷 Re-scan</a>
    ${FA.can(user, 'inspect') ? `<button class="btn" data-act="inspect" data-id="${i.id}">🔍 Inspect</button>` : ''}${FA.can(user, 'markdown') && !i.markdown ? `<button class="btn" data-act="markdown" data-id="${i.id}">🏷 Mark down 30%</button>` : ''}
    ${FA.can(user, 'edit') ? `<button class="btn" data-act="edititem" data-id="${i.id}">✏️ Edit</button>` : ''}</div>
    ${FA.can(user, 'del') ? `<div class="mf" style="justify-content:flex-start;margin-top:10px"><button class="btn sm" data-act="dispose" data-id="${i.id}" data-why="consumed">✓ Used / sold</button><button class="btn sm" data-act="dispose" data-id="${i.id}" data-why="donated">🤝 Donate</button><button class="btn sm bad" data-act="dispose" data-id="${i.id}" data-why="discarded">🗑 Discard</button></div>` : ''}`, true);
    requestAnimationFrame(() => setTimeout(() => { const d = $('#dg'); if (d) d.style.strokeDashoffset = C * (1 - r.score / 100); }, 30));
  }
  function dispose(id, why) {
    const i = raw(id); i.status = why; if (why !== 'consumed') FA.db.waste.unshift({ id: FA.uid('w'), at: Date.now(), name: i.name, category: i.category, qty: i.qty, value: +(i.qty * i.price).toFixed(2), reason: why, scope: i.scope, owner: i.owner });
    log(`${{ consumed: 'Used/sold', donated: 'Donated', discarded: 'Discarded' }[why]} ${i.name}`); persist(); closeModal(); toast(why === 'consumed' ? 'Marked as used / sold' : why === 'donated' ? 'Marked as donated — thank you!' : 'Item discarded and logged as waste', why === 'discarded' ? 'warn' : ''); render();
  }
  function inspectForm(id) {
    const i = raw(id); openModal(`<div class="mh"><h2>Record inspection</h2><button class="x" data-act="close" aria-label="Close">×</button></div><p class="note" style="margin-bottom:14px">${esc(i.name)} · ${esc(i.batch || 'no batch')}</p>
    <div class="frm"><label class="fld full">Result<select id="in_r"><option>Pass</option><option>Conditional</option><option>Fail</option></select></label><label class="fld full">Notes<textarea id="in_n" rows="3" maxlength="300" placeholder="Odor, texture, temperature probe reading…"></textarea></label></div>
    <div class="mf"><button class="btn" data-act="close">Cancel</button><button class="btn pri" data-act="saveinspect" data-id="${id}">Save inspection</button></div>`);
  }

  /* SCAN */
  V.scan = {
    html() {
      const zs = zones(), list = items(), pre = (location.hash.split('item=')[1] || '').split('&')[0], p = list.find(i => i.id === pre);
      scanState = { img: null, visual: null, findings: [], preId: p ? p.id : '' };
      return head('Freshness scan', 'Upload a photo and storage details to estimate freshness, shelf life and spoilage risk.') + `
      <div class="grid g2"><div class="card"><h3>1 · Photo &amp; details</h3>
        <div class="drop-zone" id="dz"><div id="dzin"><div style="font-size:2.2rem">📷</div><b>Drop a food photo here, or click to upload</b><p class="note">On a phone this opens the camera. The image never leaves your device.</p></div><div class="sc"></div></div>
        <input type="file" id="sfile" accept="image/*" capture="environment" hidden />
        <div class="frm" style="margin-top:16px">
          <label class="fld full">Re-scan an existing item (optional)<select id="s_item"><option value="">— New item —</option>${list.map(i => `<option value="${i.id}" ${i.id === scanState.preId ? 'selected' : ''}>${esc(i.name)}${i.batch ? ' · ' + esc(i.batch) : ''}</option>`).join('')}</select></label>
          <label class="fld">Item name<input id="s_name" maxlength="60" placeholder="e.g. Red apples" value="${p ? esc(p.name) : ''}" /></label>
          <label class="fld">Category<select id="s_cat">${Object.keys(FA.CATS).map(c => `<option ${p && p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          <label class="fld">Storage zone<select id="s_zone">${zs.map(z => `<option value="${z.id}" ${p && p.zone === z.id ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select></label>
          <label class="fld">Packaging<select id="s_pack">${Object.keys(FA.PACK).map(k => `<option value="${k}" ${p && p.pack === k ? 'selected' : k === 'standard' && !p ? 'selected' : ''}>${FA.PACKLABEL[k]}</option>`).join('')}</select></label>
          <label class="fld">Days since purchase<input id="s_age" type="number" min="0" max="365" step="0.5" value="${p ? (p.r.age).toFixed(1) : 1}" /></label>
          <label class="fld">Visual condition (no photo): <b id="s_vv">85</b>%<input id="s_vis" type="range" min="0" max="100" value="85" /></label>
        </div><div class="mf" style="justify-content:flex-start"><button class="btn pri" id="sGo">Analyze freshness</button></div></div>
      <div class="card" id="sRes"><h3>2 · Result</h3><div class="empty">Your analysis will appear here.<br><span class="note">Scores use Visual 40% · Storage 25% · Shelf-life 20% · Age 15%.</span></div></div></div>`;
    },
    after() {
      const dz = $('#dz'), f = $('#sfile'); dz.onclick = () => f.click();
      dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over'); dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) loadImg(e.dataTransfer.files[0]); };
      f.onchange = () => f.files[0] && loadImg(f.files[0]); $('#s_vis').oninput = e => $('#s_vv').textContent = e.target.value;
      $('#s_item').onchange = e => { const i = raw(e.target.value); if (i) { $('#s_name').value = i.name; $('#s_cat').value = i.category; $('#s_zone').value = i.zone; $('#s_pack').value = i.pack; $('#s_age').value = ((Date.now() - i.receivedAt) / DAY).toFixed(1); } };
      $('#sGo').onclick = analyze;
    }
  };
  function loadImg(file) {
    if (!/^image\//.test(file.type)) return toast('Please choose an image file.', 'bad'); if (file.size > 12e6) return toast('Image is too large (max 12 MB).', 'bad');
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = 72, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'); x.drawImage(img, 0, 0, s, s); const d = x.getImageData(0, 0, s, s).data; let sat = 0, br = 0, dark = 0, brown = 0, con = 0, n = s * s, prev = 0;
      for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); sat += mx ? (mx - mn) / mx : 0; br += mx / 255; if (mx < 55) dark++; if (r > g && g > b && r < 170 && r - b > 40 && mx < 150) brown++; con += Math.abs(mx - prev); prev = mx; }
      sat /= n; br /= n; dark /= n; brown /= n; con = con / n / 255;
      const vib = Math.min(100, sat * 170), spots = dark + brown, vis = Math.max(5, Math.min(98, vib * .6 + br * 40 - Math.min(60, spots * 160) + 18));
      scanState.img = url; scanState.visual = vis; scanState.findings = [`Colour vibrancy: ${Math.round(vib)}%`, `Brightness: ${Math.round(br * 100)}%`, `Dark / brown spot coverage: ${Math.round(spots * 100)}% ${spots > .18 ? '⚠ possible bruising or mold' : '✓'}`, `Surface texture variation: ${Math.round(Math.min(100, con * 600))}%`];
      $('#dzin').innerHTML = `<img src="${url}" alt="Uploaded food" />`; $('#dz').classList.add('scanning'); $('#s_vis').value = Math.round(vis); $('#s_vv').textContent = Math.round(vis); setTimeout(() => { const z = $('#dz'); z && z.classList.remove('scanning'); }, 3100); toast('Image loaded — click Analyze');
    };
    img.onerror = () => toast('Could not read that image.', 'bad'); img.src = url;
  }
  function analyze() {
    const name = $('#s_name').value.trim() || 'Unnamed item', cat = $('#s_cat').value, zone = FA.zone($('#s_zone').value), pack = $('#s_pack').value, age = Math.max(0, parseFloat($('#s_age').value) || 0), visual = scanState.visual != null && scanState.img ? scanState.visual : +$('#s_vis').value;
    const tmp = { name, category: cat, receivedAt: Date.now() - age * DAY, pack, zone: zone.id, visual0: visual }; const r0 = FA.score(tmp, zone); tmp.lastScan = { visual, frac: r0.frac, at: Date.now() }; const r = FA.score(tmp, zone);
    scanState.result = { name, cat, zone: zone.id, pack, age, visual, r, tmp }; $('#sGo').disabled = true; $('#sGo').textContent = 'Analyzing…'; $('#dz').classList.add('scanning');
    setTimeout(() => { if (route !== 'scan' || !$('#sGo')) return; $('#sGo').disabled = false; $('#sGo').textContent = 'Analyze freshness'; $('#dz').classList.remove('scanning'); showResult(); }, 900);
  }
  function showResult() {
    const s = scanState.result, r = s.r, C = 2 * Math.PI * 70, existing = $('#s_item').value, zone = FA.zone(s.zone);
    $('#sRes').innerHTML = `<h3>2 · Result <small>${esc(s.name)}</small></h3><div class="gauge"><svg viewBox="0 0 170 170" width="170"><circle class="bg" cx="85" cy="85" r="70"/><circle class="fg" id="sg" cx="85" cy="85" r="70" stroke="${r.color}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><div><b>${r.score}</b><small>Freshness score</small></div></div>
      <p style="text-align:center;margin-top:10px">${chipFor(r)}</p><div class="kv"><div><span>Shelf life left</span><b>${days(r.remaining)}</b></div><div><span>Spoilage prob.</span><b>${r.spoil}%</b></div><div><span>Confidence</span><b>${scanState.img ? 88 : 72}%</b></div></div>
      <div class="parts">${[['Visual (40%)', r.parts.visual], ['Storage (25%)', r.parts.storage], ['Shelf-life (20%)', r.parts.life], ['Age (15%)', r.parts.age]].map(p => `<div><span>${p[0]}</span><div class="bar"><i style="width:${Math.round(p[1])}%;background:linear-gradient(90deg,#34d399,#22d3ee)"></i></div><b>${Math.round(p[1])}</b></div>`).join('')}</div>
      ${scanState.img ? `<h4 style="margin:16px 0 6px;font-size:.9rem">Image findings</h4><ul class="note" style="padding-left:18px">${scanState.findings.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="note" style="margin-top:12px">No photo supplied — used your manual visual-condition value.</p>'}
      <div class="reco"><h4>💡 Recommendations</h4><ul>${FA.recs(s.tmp, r, zone).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="mf" style="justify-content:flex-start">${existing ? `<button class="btn pri" data-act="scanupdate">Update inventory item</button>` : FA.can(user, 'add') ? `<button class="btn pri" data-act="scansave">Save to inventory</button>` : ''}<button class="btn" data-act="scanlog">Save result only</button></div><p class="note">Heuristic colour/texture analysis for demonstration — not a certified food-safety test. When in doubt, throw it out.</p>`;
    requestAnimationFrame(() => setTimeout(() => { const g = $('#sg'); if (g) g.style.strokeDashoffset = C * (1 - r.score / 100); }, 30));
    FA.db.scans.unshift({ at: Date.now(), by: user.id, name: s.name, category: s.cat, score: r.score, label: r.label }); FA.db.scans.length = Math.min(FA.db.scans.length, 60); persist();
  }
  function scanSave(update) {
    const s = scanState.result, z = FA.zone(s.zone);
    if (update) { const i = raw($('#s_item').value); i.lastScan = { visual: s.visual, frac: FA.score(i).frac, at: Date.now() }; log('Re-scanned ' + i.name + ' (' + s.r.score + ')'); toast('Inventory item updated with new scan'); }
    else { FA.db.items.push({ id: FA.uid('i'), name: s.name, category: s.cat, qty: 1, unit: 'units', price: 0, zone: s.zone, pack: s.pack, supplier: '', batch: '', receivedAt: Date.now() - s.age * DAY, visual0: s.visual, lastScan: { visual: s.visual, frac: s.r.frac, at: Date.now() }, inspections: [], status: 'active', scope: z.scope, owner: user.id }); log('Added ' + s.name + ' from scan'); toast('Saved to inventory — edit quantity and price there'); }
    persist(); location.hash = '#/inventory';
  }

  /* STORAGE */
  V.storage = {
    html() {
      const zs = zones();
      return head('Storage monitor', 'Live temperature and humidity (simulated sensors, updated every 4 seconds).', FA.can(user, 'edit') && user.role !== 'consumer' ? '<button class="btn bad" data-act="fail">⚡ Simulate cooling failure</button>' : '') + `
      <div class="grid g3">${zs.map(z => { const l = z.hist[z.hist.length - 1], out = FA.zoneOut(z); return `<div class="card zone"><h3>${esc(z.name)} <span class="chip ${out ? 'sev-high' : ''}" id="zc_${z.id}" style="${out ? '' : 'color:var(--g1);border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.1)'}">${out ? 'Out of range' : 'In range'}</span></h3>
        <div class="t ${out ? 'no' : 'ok'}" id="zt_${z.id}">${l.temp}°C</div><p class="note" id="zh_${z.id}">${l.hum}% RH · target ${z.target[0]} to ${z.target[1]}°C</p><canvas id="zs_${z.id}"></canvas>
        <p class="note">Compliance <b id="zp_${z.id}">${FA.compliance(z)}%</b> · ${FA.itemsFor(user).filter(i => i.zone === z.id).length} items stored</p></div>`; }).join('')}</div>
      <div class="card" style="margin-top:18px"><h3>Temperature excursions</h3>${this.exc()}</div>`;
    },
    exc() { const ex = (FA.db.excursions || []).filter(e => zones().some(z => z.id === e.zone)); return ex.length ? `<div class="tw"><table><thead><tr><th>Zone</th><th>Started</th><th>Peak</th><th>Status</th></tr></thead><tbody>${ex.slice(0, 8).map(e => `<tr><td>${esc(FA.zone(e.zone).name)}</td><td>${FA.dt(e.start)}</td><td>${e.peak}°C</td><td>${e.open ? '<span class="chip sev-high">Ongoing</span>' : 'Resolved ' + FA.ago(e.end)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No excursions recorded ✓</div>'; },
    after() { zones().forEach(z => reg(() => spark($('#zs_' + z.id), z))); },
    live() { zones().forEach(z => { const l = z.hist[z.hist.length - 1], out = FA.zoneOut(z), t = $('#zt_' + z.id); if (!t) return; t.textContent = l.temp + '°C'; t.className = 't ' + (out ? 'no' : 'ok'); $('#zh_' + z.id).textContent = `${l.hum}% RH · target ${z.target[0]} to ${z.target[1]}°C`; $('#zp_' + z.id).textContent = FA.compliance(z) + '%'; const c = $('#zc_' + z.id); c.textContent = out ? 'Out of range' : 'In range'; c.className = 'chip ' + (out ? 'sev-high' : ''); c.style.cssText = out ? '' : 'color:var(--g1);border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.1)'; }); drawCharts(); }
  };

  /* ALERTS */
  V.alerts = {
    html() {
      const all = FA.alerts(user), shown = all.filter(a => alertTab === 'all' ? true : alertTab === 'open' ? a.state === 'open' : a.state === 'ack');
      const c = k => all.filter(a => k === 'all' || a.state === k).length;
      return head('Alerts', 'Spoilage, shelf-life and storage-condition notifications.') + `<div class="tabs">${[['open', 'Open'], ['ack', 'Acknowledged'], ['all', 'All']].map(t => `<button class="tab ${alertTab === t[0] ? 'on' : ''}" data-act="atab" data-t="${t[0]}">${t[1]} (${c(t[0])})</button>`).join('')}</div>
      <div class="list">${shown.filter(a => a.state !== 'resolved').map(a => `<div class="alert ${a.sev} ${a.state === 'ack' ? 'ack' : ''}"><span class="chip sev-${a.sev}">${a.sev}</span><div class="grow"><b>${esc(a.title)}</b><br><small>${esc(a.type)} · ${esc(a.detail)}</small></div><div class="btns">${a.item ? `<button class="btn sm" data-act="open" data-id="${a.item}">View</button>` : '<a class="btn sm" href="#/storage">Monitor</a>'}${a.state === 'open' ? `<button class="btn sm" data-act="ack" data-id="${a.id}">Acknowledge</button>` : ''}<button class="btn sm" data-act="resolve" data-id="${a.id}">Resolve</button></div></div>`).join('') || '<div class="card empty">Nothing here — all clear ✓</div>'}</div>`;
    }
  };

  /* ANALYTICS */
  V.analytics = {
    html() {
      const list = items(), w = weeks(), zs = zones(), tot = sum(list, i => i.qty * i.price);
      return head('Analytics', 'Freshness, waste and storage insights across your inventory.') + `
      <div class="grid g4"><div class="card kpi"><span>Inventory value</span><b>${FA.money(tot)}</b><small>${list.length} items</small></div>
      <div class="card kpi" style="--k:rgba(248,113,113,.22)"><span>Value at risk</span><b>${FA.money(sum(list.filter(i => i.r.score < 50), i => i.qty * i.price))}</b><small>score below 50</small></div>
      <div class="card kpi" style="--k:rgba(251,191,36,.22)"><span>Waste (8 weeks)</span><b>${FA.money(sum(w, x => x.all))}</b><small>discarded, donated, marked down</small></div>
      <div class="card kpi" style="--k:rgba(34,211,238,.22)"><span>Avg storage compliance</span><b>${Math.round(avg(zs.map(FA.compliance)))}%</b><small>${zs.length} zone(s)</small></div></div>
      <div class="grid g2" style="margin-top:18px"><div class="card"><h3>Waste cost per week <small>total vs discarded</small></h3><canvas id="aW"></canvas><div class="legend"><span><i style="background:#22d3ee"></i>All waste</span><span><i style="background:#f87171"></i>Discarded</span></div></div>
      <div class="card"><h3>Average freshness by category</h3><canvas id="aC"></canvas></div>
      <div class="card"><h3>Freshness mix</h3><canvas id="aD"></canvas><div class="legend">${FA.LABELS.map(l => `<span><i style="background:${l[2]}"></i>${l[1]}</span>`).join('')}</div></div>
      <div class="card"><h3>Storage compliance by zone <small>% readings in range</small></h3><canvas id="aZ"></canvas></div></div>`;
    },
    after() {
      const list = items(), w = weeks(), zs = zones(), cats = Object.keys(FA.CATS).filter(c => list.some(i => i.category === c)), d = distData(list);
      reg(() => lines($('#aW'), w.map(x => x.l), [{ v: w.map(x => x.all), c: '#22d3ee' }, { v: w.map(x => x.dis), c: '#f87171' }], { min: 0, fill: false }));
      reg(() => bars($('#aC'), cats, cats.map(c => avg(list.filter(i => i.category === c).map(i => i.r.score))), '#34d399', 100));
      reg(() => donut($('#aD'), d.map(x => ({ v: x.v, c: x.c })), String(list.length), 'items'));
      reg(() => bars($('#aZ'), zs.map(z => z.name), zs.map(FA.compliance), zs.map(z => FA.compliance(z) >= 95 ? '#34d399' : '#fbbf24'), 100, '%'));
    }
  };

  /* REPORTS */
  const REPORTS = {
    freshness: ['Freshness report', () => [['Item', 'Category', 'Batch', 'Zone', 'Freshness score', 'Status', 'Spoilage probability %', 'Confidence %'], items().sort((a, b) => a.r.score - b.r.score).map(i => [i.name, i.category, i.batch, FA.zone(i.zone).name, i.r.score, i.r.label, i.r.spoil, i.r.conf])]],
    shelf: ['Shelf-life report', () => [['Item', 'Received', 'Age (days)', 'Remaining (days)', 'Predicted expiry', 'Risk'], items().sort((a, b) => a.r.remaining - b.r.remaining).map(i => [i.name, FA.date(i.receivedAt), i.r.age.toFixed(1), i.r.remaining.toFixed(1), FA.date(Date.now() + i.r.remaining * DAY), i.r.remaining < 1 ? 'Critical' : i.r.remaining < 3 ? 'High' : i.r.remaining < 7 ? 'Medium' : 'Low'])]],
    inventory: ['Inventory quality report', () => [['Item', 'Category', 'Quantity', 'Unit', 'Unit price', 'Value', 'Score', 'Status'], items().sort((a, b) => b.qty * b.price - a.qty * a.price).map(i => [i.name, i.category, i.qty, i.unit, i.price.toFixed(2), (i.qty * i.price).toFixed(2), i.r.score, i.r.label])]],
    waste: ['Waste reduction report', () => [['Date', 'Item', 'Category', 'Quantity', 'Value', 'Reason'], wasteLog().filter(w => Date.now() - w.at < 60 * DAY).sort((a, b) => b.at - a.at).map(w => [FA.date(w.at), w.name, w.category, w.qty, w.value.toFixed(2), w.reason])]],
    storage: ['Storage compliance report', () => [['Zone', 'Target temp (°C)', 'Current temp (°C)', 'Humidity %', 'Compliance %', 'Excursions'], zones().map(z => { const l = z.hist[z.hist.length - 1]; return [z.name, z.target[0] + ' to ' + z.target[1], l.temp, l.hum, FA.compliance(z), (FA.db.excursions || []).filter(e => e.zone === z.id).length]; })]]
  };
  V.reports = {
    html() {
      const [title, fn] = REPORTS[repType], [cols, rows] = fn();
      return head('Reports', 'Preview and export. Excel opens the CSV; use Print to save as PDF.', `<button class="btn" data-act="csv">⬇ Export CSV (Excel)</button><button class="btn pri" data-act="print">🖨 Print / PDF</button>`) + `<div class="tabs noprint">${Object.keys(REPORTS).map(k => `<button class="tab ${repType === k ? 'on' : ''}" data-act="rtab" data-t="${k}">${REPORTS[k][0].replace(' report', '')}</button>`).join('')}</div>
      <div class="card"><h3>${title} <small>Generated ${FA.dt(Date.now())} by ${esc(user.name)}</small></h3><div class="tw"><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length ? '' : '<div class="empty">No data for this report.</div>'}<p class="note" style="margin-top:10px">${rows.length} row(s)</p></div>`;
    }
  };

  /* USERS (admin) */
  V.users = {
    html() {
      return head('Users & audit', 'Manage accounts, roles and review activity.', '<button class="btn pri" data-act="adduser">＋ Add user</button>') + `
      <div class="card"><h3>Accounts</h3><div class="tw"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th class="hide-sm">Last sign-in</th><th></th></tr></thead><tbody>${FA.db.users.map(u => `<tr><td><div class="name"><div class="av" style="width:32px;height:32px;font-size:.75rem">${esc(initials(u.name))}</div>${esc(u.name)}${u.id === user.id ? ' <small>(you)</small>' : ''}</div></td><td>${esc(u.email)}</td>
        <td><select data-act="role" data-id="${u.id}" ${u.id === user.id ? 'disabled' : ''} style="background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:6px 8px">${Object.keys(R).map(k => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${R[k]}</option>`).join('')}</select></td>
        <td>${u.active ? '<span class="chip" style="color:var(--g1);border-color:rgba(52,211,153,.4)">Active</span>' : '<span class="chip sev-critical">Disabled</span>'}</td><td class="hide-sm">${u.lastLogin ? FA.ago(u.lastLogin) : 'Never'}</td>
        <td><div class="btns"><button class="btn sm" data-act="resetpw" data-id="${u.id}">Reset password</button>${u.id !== user.id ? `<button class="btn sm ${u.active ? 'bad' : ''}" data-act="toggleuser" data-id="${u.id}">${u.active ? 'Deactivate' : 'Activate'}</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div></div>
      <div class="card" style="margin-top:18px"><h3>Audit log <small>latest 25 events</small></h3><div class="tw"><table><thead><tr><th>When</th><th>User</th><th>Event</th></tr></thead><tbody>${FA.db.audit.slice(0, 25).map(a => `<tr><td>${FA.dt(a.at)}</td><td>${esc(a.who)}</td><td>${esc(a.what)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
  };

  /* PROFILE */
  V.profile = {
    html() {
      return head('My profile', 'Account details, security and preferences.') + `<div class="grid g2">
      <div class="card"><h3>Account</h3><div class="name" style="margin-bottom:16px"><div class="av" style="width:56px;height:56px;font-size:1.2rem">${esc(initials(user.name))}</div><div><b>${esc(user.name)}</b><small>${esc(user.email)} · ${R[user.role]}</small></div></div>
        <label class="fld">Display name<input id="p_name" value="${esc(user.name)}" maxlength="50" /></label><div class="mf" style="justify-content:flex-start"><button class="btn pri" data-act="savename">Save name</button></div>
        <p class="note" style="margin-top:14px">Member since ${FA.date(user.createdAt)}.</p></div>
      <div class="card"><h3>Change password</h3><div class="frm"><label class="fld full">Current password<input id="p_old" type="password" autocomplete="current-password" /></label><label class="fld">New password<input id="p_new" type="password" autocomplete="new-password" /></label><label class="fld">Confirm<input id="p_new2" type="password" autocomplete="new-password" /></label></div><div id="p_err" class="note" style="margin-top:8px;color:var(--bad)"></div><div class="mf" style="justify-content:flex-start"><button class="btn pri" data-act="savepw">Update password</button></div></div>
      <div class="card"><h3>Preferences</h3><div class="li"><div class="grow"><b>Pop-up alerts</b><small>Show a toast for new high-severity alerts</small></div><label class="sw"><input type="checkbox" id="p_notify" ${user.notify ? 'checked' : ''} /><span></span></label></div></div>
      <div class="card"><h3>Demo data</h3><p class="note">All data is stored in this browser only. Demo data refreshes automatically every 5 days so items stay realistic.</p><div class="mf" style="justify-content:flex-start"><button class="btn bad" data-act="resetdemo">Reset demo data</button><button class="btn" data-act="logout">Sign out</button></div></div></div>`;
    },
    after() { $('#p_notify').onchange = e => { user.notify = e.target.checked; persist(); toast('Preference saved'); }; }
  };

  /* ---------- actions (event delegation) ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) { if (!e.target.closest('.bellwrap')) $('#bellDrop').hidden = true; if (e.target.id === 'modal') closeModal(); return; }
    const a = t.dataset.act, id = t.dataset.id;
    if (t.tagName === 'SELECT') return;
    const A = {
      close: closeModal, open: () => itemDetail(id), additem: () => itemForm(), edititem: () => itemForm(raw(id)), saveitem: () => saveItem(id),
      sort: () => { const k = t.dataset.k; inv.dir = inv.sort === k ? -inv.dir : 1; inv.sort = k; $('#itab').innerHTML = invTable(); },
      dispose: () => { if (t.dataset.why === 'discarded' && !confirm('Discard this item and log it as waste?')) return; dispose(id, t.dataset.why); },
      markdown: () => { const i = raw(id); FA.db.waste.unshift({ id: FA.uid('w'), at: Date.now(), name: i.name, category: i.category, qty: i.qty, value: +(i.qty * i.price * .3).toFixed(2), reason: 'discounted', scope: i.scope, owner: i.owner }); i.price = +(i.price * .7).toFixed(2); i.markdown = true; log('Marked down ' + i.name + ' by 30%'); persist(); closeModal(); toast('Marked down 30% — ' + i.name); render(); },
      inspect: () => inspectForm(id),
      saveinspect: () => { const i = raw(id); i.inspections.unshift({ at: Date.now(), by: user.name, result: $('#in_r').value, note: $('#in_n').value.trim() }); log(`Inspection ${$('#in_r').value}: ${i.name}`); persist(); closeModal(); toast('Inspection recorded'); render(); },
      scansave: () => scanSave(false), scanupdate: () => scanSave(true), scanlog: () => toast('Result saved to scan history'),
      fail: () => { const pick = zones().filter(z => z.target[1] > 0 && z.scope === 'org')[0] || z; const l = pick.hist[pick.hist.length - 1]; pick.hist.push({ t: Date.now(), temp: +(pick.target[1] + 3.8).toFixed(1), hum: l.hum }); recalcZ(pick); FA.db.excursions.unshift({ zone: pick.id, start: Date.now(), peak: pick.target[1] + 3.8, open: true }); log('Simulated cooling failure in ' + pick.name); persist(); toast(pick.name + ' temperature rising!', 'bad'); render(); },
      atab: () => { alertTab = t.dataset.t; render(); },
      ack: () => { FA.db.alertState[id] = { s: 'ack', at: Date.now() }; log('Acknowledged alert'); persist(); render(); },
      resolve: () => { FA.db.alertState[id] = { s: 'resolved', at: Date.now() }; log('Resolved alert'); persist(); toast('Alert resolved'); render(); },
      rtab: () => { repType = t.dataset.t; render(); },
      csv: () => { const [title, fn] = REPORTS[repType], [c, r] = fn(), b = new Blob(['﻿' + FA.csv(c, r)], { type: 'text/csv' }), l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = `freshai-${repType}-${new Date().toISOString().slice(0, 10)}.csv`; l.click(); log('Exported ' + title); toast('CSV downloaded'); },
      print: () => { log('Printed ' + REPORTS[repType][0]); print(); },
      adduser: () => openModal(`<div class="mh"><h2>Add user</h2><button class="x" data-act="close" aria-label="Close">×</button></div><div class="frm"><label class="fld full">Full name<input id="u_n" maxlength="50" /></label><label class="fld">Email<input id="u_e" type="email" /></label><label class="fld">Role<select id="u_r">${Object.keys(R).map(k => `<option value="${k}">${R[k]}</option>`).join('')}</select></label><label class="fld full">Temporary password<input id="u_p" value="Fresh@123" /></label><div class="full" id="u_err" style="color:var(--bad);font-size:.85rem"></div></div><div class="mf"><button class="btn" data-act="close">Cancel</button><button class="btn pri" data-act="saveuser">Create user</button></div>`),
      saveuser: () => { const n = $('#u_n').value.trim(), em = $('#u_e').value.trim(), pw = $('#u_p').value, er = m => $('#u_err').textContent = m; if (n.length < 2) return er('Enter a name.'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return er('Enter a valid email.'); const pi = FA.pwIssue(pw); if (pi) return er(pi); const r = FA.register(n, em, pw, $('#u_r').value); if (!r.ok) return er(r.error); log('Created user ' + n); persist(); closeModal(); toast('User created'); render(); },
      resetpw: () => { const u = FA.db.users.find(x => x.id === id); u.salt = Math.random().toString(36).slice(2, 10); u.hash = FA.hashPw('Fresh@123', u.salt); log('Reset password for ' + u.name); persist(); toast(`Password for ${u.name} reset to Fresh@123`); },
      toggleuser: () => { const u = FA.db.users.find(x => x.id === id); u.active = !u.active; log((u.active ? 'Activated ' : 'Deactivated ') + u.name); persist(); render(); },
      savename: () => { const n = $('#p_name').value.trim(); if (n.length < 2) return toast('Enter a valid name', 'bad'); user.name = n; log('Updated profile name'); persist(); buildNav(); toast('Name updated'); },
      savepw: () => { const o = $('#p_old').value, n = $('#p_new').value, er = m => $('#p_err').textContent = m; if (FA.hashPw(o, user.salt) !== user.hash) return er('Current password is incorrect.'); const pi = FA.pwIssue(n); if (pi) return er(pi); if (n !== $('#p_new2').value) return er('Passwords do not match.'); user.salt = Math.random().toString(36).slice(2, 10); user.hash = FA.hashPw(n, user.salt); log('Changed password'); persist(); er(''); ['#p_old', '#p_new', '#p_new2'].forEach(s => $(s).value = ''); toast('Password updated'); },
      resetdemo: () => { if (!confirm('Reset all demo data? Your changes will be lost.')) return; const keep = user.id; FA.resetDemo(); const u = FA.db.users.find(x => x.id === keep) || FA.db.users[0]; toast('Demo data reset'); setTimeout(() => location.reload(), 400); },
      logout: () => { FA.logout(); location.replace('login.html'); }
    };
    if (A[a]) { if (t.tagName === 'A' && a === 'close') closeModal(); else { if (t.tagName === 'A') { A[a](); return; } e.preventDefault(); A[a](); } }
  });
  document.addEventListener('change', e => { const t = e.target.closest('[data-act="role"]'); if (t) { const u = FA.db.users.find(x => x.id === t.dataset.id); u.role = t.value; log(`Changed role of ${u.name} to ${R[u.role]}`); persist(); toast('Role updated'); render(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  function recalcZ(z) { const l = z.hist.slice(-12); z.avgTemp = +(avg(l.map(r => r.temp))).toFixed(1); z.avgHum = Math.round(avg(l.map(r => r.hum))); }
  $('#logout').onclick = () => { FA.logout(); location.replace('login.html'); };
  $('#burger').onclick = () => { $('#side').classList.add('open'); $('#scrim').classList.add('show'); }; $('#scrim').onclick = () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('show'); };
  $('#bell').onclick = e => { e.stopPropagation(); $('#bellDrop').hidden = !$('#bellDrop').hidden; };
  $('#gsearch').onkeydown = e => { if (e.key === 'Enter') { inv.q = e.target.value; inv.cat = ''; inv.status = ''; if (location.hash === '#/inventory') go(); else location.hash = '#/inventory'; } };

  /* ---------- live loop ---------- */
  function checkNew() {
    const al = FA.alerts(user).filter(a => a.state === 'open'), ids = new Set(al.map(a => a.id));
    if (known && user.notify) al.filter(a => !known.has(a.id) && a.sev !== 'medium').slice(0, 2).forEach(a => toast('⚠ ' + a.title, 'warn'));
    known = ids;
  }
  let n = 0;
  setInterval(() => { FA.tick(); if (++n % 3 === 0) persist(); buildNav(); checkNew(); const v = V[route]; v.live && v.live(); }, 4000);
  if (!location.hash) location.hash = '#/dashboard';
  go(); checkNew();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
