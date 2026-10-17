/* ============ Background: floating "freshness particles" ============ */
(function () {
  const c = document.getElementById('bg');
  const ctx = c.getContext('2d');
  let w, h, pts;
  const mouse = { x: -999, y: -999 };
  function resize() {
    w = c.width = innerWidth; h = c.height = innerHeight;
    const n = Math.min(90, Math.floor((w * h) / 18000));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
      r: Math.random() * 2 + .8
    }));
  }
  addEventListener('resize', resize);
  addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  function frame() {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * .8, h * .1, 0, w * .8, h * .1, w * .7);
    g.addColorStop(0, 'rgba(52,211,153,.10)'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 120) { p.x += dx / d * 1.2; p.y += dy / d * 1.2; }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fillStyle = 'rgba(52,211,153,.65)'; ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 120) {
        ctx.strokeStyle = `rgba(34,211,238,${.14 * (1 - d / 120)})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  }
  resize(); frame();
})();

/* ============ Content data (from the project document) ============ */
const MODULES = [
  { t: 'User Authentication & Role-Based Access', items: ['User registration and login', 'JWT authentication', 'OAuth2 login', 'Role-based access control', 'User profile management'], extraTitle: 'Roles', extra: ['Consumer', 'Retail Manager', 'Warehouse Operator', 'Food Quality Inspector', 'Administrator'] },
  { t: 'Food Inventory Management', items: ['Food item registration', 'Batch management', 'Product categorization', 'Inventory tracking', 'Expiry management'], extraTitle: 'Food Categories', extra: ['Fruits', 'Vegetables', 'Dairy Products', 'Meat & Poultry', 'Seafood', 'Bakery Products', 'Packaged Foods', 'Beverages'] },
  { t: 'Food Image Analysis Engine', items: ['Food image upload', 'Visual freshness detection', 'Color analysis', 'Texture analysis', 'Spoilage identification'], extraTitle: 'Image Analysis Features', extra: ['Color Degradation', 'Surface Texture Changes', 'Mold Detection', 'Bruising Detection', 'Physical Damage Detection'] },
  { t: 'Freshness Assessment Engine', items: ['Freshness score calculation', 'Quality assessment', 'Spoilage probability estimation', 'Product quality classification', 'Freshness trend analysis'], extraTitle: 'Freshness Categories', extra: ['Fresh', 'Good', 'Acceptable', 'Near Spoilage', 'Spoiled'] },
  { t: 'Shelf-Life Prediction Module', items: ['Remaining shelf-life estimation', 'Expiry forecasting', 'Storage condition impact analysis', 'Shelf-life trend prediction', 'Risk forecasting'], extraTitle: 'Prediction Inputs', extra: ['Food Images', 'Product Type', 'Storage Temperature', 'Humidity', 'Packaging Type', 'Storage Duration'] },
  { t: 'Storage Condition Monitoring', items: ['Temperature monitoring', 'Humidity monitoring', 'Environmental tracking', 'Storage compliance validation', 'Storage optimization recommendations'], extraTitle: 'Storage Parameters', extra: ['Temperature', 'Humidity', 'Air Circulation', 'Light Exposure', 'Storage Duration'] },
  { t: 'Freshness Scoring Engine', items: ['Food quality scoring', 'Freshness confidence scoring', 'Shelf-life scoring', 'Storage condition scoring', 'Overall food health score'], extraTitle: 'Weighted Scoring Model', extra: ['Visual Condition Analysis 40%', 'Storage Conditions 25%', 'Shelf-Life Prediction 20%', 'Product Age 15%'] },
  { t: 'Recommendation Engine', items: ['Storage recommendations', 'Consumption recommendations', 'Inventory rotation suggestions', 'Waste reduction recommendations', 'Quality improvement suggestions'] },
  { t: 'Dashboard & Analytics', items: ['Consumer dashboard', 'Retail dashboard', 'Warehouse dashboard', 'Admin dashboard'], extraTitle: 'See the Dashboards section', extra: ['Per-role views', 'Freshness analytics', 'Inventory insights'] },
  { t: 'Notification & Alert System', items: ['Freshness alerts', 'Shelf-life warnings', 'Spoilage notifications', 'Storage condition alerts', 'Inventory alerts', 'Platform notifications'] },
  { t: 'Reports & Export System', items: ['Freshness reports', 'Shelf-life reports', 'Inventory quality reports', 'Waste reduction reports', 'Storage compliance reports', 'PDF export', 'Excel export'] },
  { t: 'Final Integration, Testing & Deployment', items: ['Frontend and backend integration', 'API validation and testing', 'End-to-end workflow testing', 'Security testing', 'Performance optimization', 'Docker containerization', 'Production deployment', 'Monitoring and logging setup', 'Documentation and user guides'] },
];

const DASH = {
  Consumer: { items: ['Freshness reports', 'Shelf-life estimates', 'Storage recommendations', 'Food inventory overview'], bars: [70, 85, 55, 92, 64, 78, 88] },
  Retail: { items: ['Product freshness analytics', 'Inventory quality monitoring', 'Shelf-life alerts', 'Waste reduction insights'], bars: [40, 62, 75, 58, 90, 70, 82] },
  Warehouse: { items: ['Storage compliance monitoring', 'Inventory health tracking', 'Batch freshness reports', 'Environmental analytics'], bars: [88, 80, 92, 76, 84, 95, 90] },
  Admin: { items: ['User management', 'Platform analytics', 'System monitoring', 'Reporting management'], bars: [55, 66, 72, 80, 77, 86, 93] },
};

const ROADMAP = [
  { wk: 'Milestone 1 · Weeks 1 & 2', t: 'Project Initialization, Design Process & Core Setup',
    tasks: ['Define project objectives and freshness monitoring workflows', 'Design system architecture and database schema', 'Create UI wireframes and workflow planning', 'Setup frontend and backend environments', 'Implement authentication and role-based access', 'Build food inventory management workflows', 'Collect and organize food freshness image datasets'],
    out: ['Understand freshness monitoring workflows', 'Learn architecture and database design', 'Frontend and backend project initialization', 'Working authentication and inventory system'] },
  { wk: 'Milestone 2 · Weeks 3 & 4', t: 'Image Analysis & Freshness Assessment',
    tasks: ['Implement image analysis engine', 'Build freshness classification workflows', 'Develop food quality scoring', 'Create spoilage detection workflows', 'Generate freshness reports'],
    out: ['Freshness assessment engine operational', 'Food quality scoring functional', 'Spoilage detection workflows completed'] },
  { wk: 'Milestone 3 · Weeks 5 & 6', t: 'Shelf-Life Prediction & Recommendations',
    tasks: ['Implement shelf-life prediction models', 'Build storage monitoring workflows', 'Develop recommendation engine', 'Generate inventory insights', 'Create freshness analytics dashboards'],
    out: ['Shelf-life prediction engine operational', 'Recommendation workflows functional', 'Analytics dashboards completed'] },
  { wk: 'Milestone 4 · Weeks 7 & 8', t: 'Analytics, Testing & Deployment',
    tasks: ['Build executive dashboards', 'Add reports and visualization modules', 'Implement testing and validations', 'Deploy platform using Docker and cloud services', 'Prepare final documentation and presentation'],
    out: ['Fully deployed production-ready platform', 'Food freshness monitoring systems operational', 'End-to-end workflow demonstrable'] },
];

const EVAL = [
  { t: 'Milestone 1', w: 'Week 2', i: ['Project initialization completed', 'Authentication implemented', 'Food inventory management functional', 'Freshness datasets integrated'] },
  { t: 'Milestone 2', w: 'Week 4', i: ['Freshness assessment engine operational', 'Image analysis workflows functional', 'Quality scoring system implemented'] },
  { t: 'Milestone 3', w: 'Week 6', i: ['Shelf-life prediction operational', 'Recommendation engine functional', 'Analytics and monitoring workflows completed'] },
  { t: 'Milestone 4', w: 'Week 8', i: ['Fully deployed frontend and backend', 'Dashboards and reporting systems operational', 'End-to-end food freshness workflow demonstrated'] },
];

const STACK = [
  ['Backend', ['Python', 'FastAPI']],
  ['Frontend', ['JavaScript', 'React.js', 'Next.js', 'Tailwind CSS', 'Chart.js', 'Plotly']],
  ['Primary Database', ['PostgreSQL']],
  ['Secondary Database', ['MongoDB']],
  ['AI & Machine Learning', ['TensorFlow', 'PyTorch', 'Scikit-learn', 'OpenCV', 'Pandas', 'NumPy']],
  ['Computer Vision', ['YOLO', 'CNN Models', 'OpenCV', 'Image Augmentation Libraries']],
  ['IoT & Sensors (Optional)', ['Temperature Sensors', 'Humidity Sensors', 'MQTT']],
  ['Cloud & DevOps', ['Docker', 'AWS / Azure']],
  ['Auth & Libraries', ['JWT Authentication', 'FastAPI', 'React.js']],
  ['Dev & Deployment Tools', ['VS Code', 'Git & GitHub', 'Docker & Docker Compose', 'GitHub Actions', 'Postman']],
];

const METRICS = [
  ['Freshness Assessment', ['Freshness classification accuracy', 'Spoilage detection accuracy', 'Freshness scoring consistency']],
  ['Shelf-Life Prediction', ['Shelf-life prediction MAE', 'Forecast accuracy', 'Prediction confidence score']],
  ['Recommendation', ['Recommendation relevance', 'Waste reduction effectiveness', 'Storage optimization accuracy']],
  ['Analytics', ['Inventory quality monitoring accuracy', 'Freshness trend detection accuracy', 'Alert generation effectiveness']],
  ['System Performance', ['API response time', 'Dashboard loading speed', 'Prediction latency', 'Concurrent user handling capacity']],
];

/* ============ Render sections ============ */
const $ = s => document.querySelector(s);
const li = a => a.map(x => `<li>${x}</li>`).join('');
const tags = a => a.map(x => `<span>${x}</span>`).join('');

$('#moduleGrid').innerHTML = MODULES.map((m, i) => `
  <div class="mod reveal" tabindex="0">
    <span class="num">MODULE ${String(i + 1).padStart(2, '0')}</span>
    <h3>${m.t}</h3>
    <ul>${li(m.items)}</ul>
    ${m.extra ? `<div class="extra"><h5>${m.extraTitle}</h5><div class="tags">${tags(m.extra)}</div></div>` : ''}
  </div>`).join('');
document.querySelectorAll('.mod').forEach(el => {
  const toggle = () => el.classList.toggle('open');
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
});

$('#timeline').innerHTML = ROADMAP.map(m => `
  <div class="ms reveal"><span class="wk">${m.wk}</span><h3>${m.t}</h3>
    <div class="ms-cols"><div><h5>Tasks</h5><ul>${li(m.tasks)}</ul></div><div><h5>Outcomes</h5><ul>${li(m.out)}</ul></div></div>
  </div>`).join('');

$('#evalGrid').innerHTML = EVAL.map(e => `<div class="ev reveal"><h4>${e.t}</h4><span class="w">${e.w}</span><ul>${li(e.i)}</ul></div>`).join('');
$('#stackGrid').innerHTML = STACK.map(s => `<div class="st reveal"><h4>${s[0]}</h4><div class="tags">${tags(s[1])}</div></div>`).join('');
$('#metricGrid').innerHTML = METRICS.map(s => `<div class="st reveal"><h4>${s[0]} Metrics</h4><ul class="check">${li(s[1])}</ul></div>`).join('');

/* dashboards */
const tabsEl = $('#dashTabs'), panel = $('#dashPanel');
function showDash(name) {
  const d = DASH[name];
  tabsEl.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.k === name));
  panel.innerHTML = `<ul>${d.items.map((x, i) => `<li style="animation-delay:${i * .08}s">${x}</li>`).join('')}</ul>
    <div class="mini-chart">${d.bars.map(() => '<i></i>').join('')}</div>`;
  requestAnimationFrame(() => setTimeout(() => panel.querySelectorAll('.mini-chart i').forEach((b, i) => b.style.height = d.bars[i] + '%'), 40));
}
tabsEl.innerHTML = Object.keys(DASH).map(k => `<button class="tab" data-k="${k}">${k} Dashboard</button>`).join('');
tabsEl.addEventListener('click', e => { if (e.target.dataset.k) showDash(e.target.dataset.k); });
showDash('Consumer');

/* ============ Freshness demo ============ */
const ids = n => document.getElementById(n);
let imageBoost = null; // 0-100 visual score derived from uploaded image

const LABELS = [[85, 'Fresh', '#34d399'], [70, 'Good', '#a3e635'], [50, 'Acceptable', '#fbbf24'], [30, 'Near Spoilage', '#fb923c'], [0, 'Spoiled', '#f87171']];

function compute() {
  const sel = ids('category'), baseLife = +sel.selectedOptions[0].dataset.life;
  const visual = imageBoost ?? +ids('visual').value;
  const temp = +ids('temp').value, hum = +ids('hum').value, days = +ids('days').value, pack = +ids('pack').value;

  ids('vVal').textContent = Math.round(visual); ids('tVal').textContent = temp;
  ids('hVal').textContent = hum; ids('dVal').textContent = days;

  // Storage score: ideal chilled 0-5C, humidity 60-85; penalties outside
  const tPen = temp < 0 ? Math.min(40, -temp * 6) : Math.max(0, temp - 5) * 3.2;
  const hPen = hum < 60 ? (60 - hum) * .6 : hum > 85 ? (hum - 85) * 1.2 : 0;
  const storage = Math.max(0, Math.min(100, (100 - tPen - hPen) * (.55 + pack * .45)));

  // Effective life: shelf life shrinks ~ 2x per 10C above 5C (Q10 rule), packaging helps
  const q = Math.pow(2, Math.max(0, temp - 5) / 10);
  const effLife = baseLife * (.5 + .5 * pack) / q * (.4 + .6 * visual / 100);
  const remaining = Math.max(0, effLife - days);
  const lifeScore = Math.max(0, Math.min(100, remaining / effLife * 100 || 0));
  const ageScore = Math.max(0, 100 - days / baseLife * 100);

  const score = Math.round(visual * .40 + storage * .25 + lifeScore * .20 + ageScore * .15);
  const [, label, color] = LABELS.find(l => score >= l[0]);
  const spoil = Math.min(99, Math.max(1, Math.round(100 - score + (temp > 15 ? 8 : 0))));
  const conf = Math.round(imageBoost !== null ? 88 : 72) - (temp > 25 ? 6 : 0);

  ids('score').textContent = score;
  ids('heroScore').textContent = score;
  ids('gfg').style.strokeDashoffset = 540.4 * (1 - score / 100);
  ids('gfg').style.stroke = color;
  const st = ids('status'); st.textContent = label; st.style.color = color; st.style.background = color + '26';
  ids('life').textContent = remaining < 1 ? (score < 30 ? 'Expired' : '< 1 day') : (remaining >= 14 ? Math.round(remaining) + ' days' : remaining.toFixed(1) + ' days');
  ids('spoil').textContent = spoil + '%';
  ids('conf').textContent = conf + '%';
  [visual, storage, lifeScore, ageScore].forEach((v, i) => ids('b' + (i + 1)).style.width = Math.round(v) + '%');

  const r = [];
  if (temp > 8) r.push(`Move to cold storage (0–5 °C) — ${temp} °C accelerates spoilage.`);
  if (temp < 0) r.push('Temperature below freezing may damage texture; raise slightly unless freezing intentionally.');
  if (hum > 90) r.push('Humidity is very high — improve air circulation to prevent mold.');
  if (hum < 55) r.push('Humidity is low — consider a crisper drawer or damp cover to prevent drying.');
  if (pack < .7) r.push('Use sealed or vacuum packaging to extend shelf life.');
  if (score < 50) r.push('Consume or process soon; prioritise this batch in inventory rotation (FIFO).');
  if (score < 30) r.push('Spoilage indicators likely — inspect carefully and discard if in doubt.');
  if (!r.length) r.push('Conditions look good. Keep current storage and re-scan in a few days.');
  ids('reco').innerHTML = li(r);
}
['visual', 'temp', 'hum', 'days', 'pack', 'category'].forEach(id => ids(id).addEventListener('input', () => { if (id === 'visual') imageBoost = null; compute(); }));

/* simulated image analysis: colour saturation / brightness / dark-spot ratio */
ids('pick').addEventListener('click', () => ids('file').click());
ids('file').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const url = URL.createObjectURL(f), img = ids('img');
  img.onload = () => {
    const cv = document.createElement('canvas'), s = 64; cv.width = cv.height = s;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, s, s);
    const d = cx.getImageData(0, 0, s, s).data; let sat = 0, br = 0, dark = 0, brownish = 0, n = s * s;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sat += mx ? (mx - mn) / mx : 0; br += mx / 255;
      if (mx < 55) dark++;
      if (r > g && g > b && r < 170 && r - b > 40 && mx < 150) brownish++;
    }
    sat /= n; br /= n; dark /= n; brownish /= n;
    const colorScore = Math.min(100, sat * 170), spotPen = Math.min(60, (dark + brownish) * 160);
    imageBoost = Math.max(5, Math.min(98, colorScore * .6 + br * 40 - spotPen + 18));
    ids('visual').value = Math.round(imageBoost);
    ids('findings').innerHTML = li([
      `Color vibrancy: ${Math.round(colorScore)}%`,
      `Brightness: ${Math.round(br * 100)}%`,
      `Dark / brown spot coverage: ${Math.round((dark + brownish) * 100)}% ${(dark + brownish) > .18 ? '⚠ possible bruising / mold' : '✓'}`,
    ]);
    ids('preview').hidden = false; compute();
  };
  img.src = url;
});

/* ============ Scroll effects ============ */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
document.querySelectorAll('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });

addEventListener('scroll', () => {
  const h = document.documentElement;
  ids('progress').style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + '%';
  ids('nav').classList.toggle('stuck', scrollY > 30);
}, { passive: true });

/* count-up stats */
document.querySelectorAll('[data-count]').forEach(el => {
  const to = +el.dataset.count; let n = 0;
  const t = setInterval(() => { n++; el.textContent = n; if (n >= to) clearInterval(t); }, 1100 / to);
});

compute();

/* ============ PWA: service worker + install button ============ */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
let deferredPrompt;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; ids('installBtn').hidden = false; });
ids('installBtn').addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; ids('installBtn').hidden = true; });
addEventListener('appinstalled', () => { ids('installBtn').hidden = true; });
