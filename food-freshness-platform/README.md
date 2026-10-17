# FreshAI — Food Freshness Monitoring Platform

## 👉 [**Click here to open the Live Website**](https://aakasssshhhh7777-alt.github.io/food-freshness-platform/)

> Live link: https://aakasssshhhh7777-alt.github.io/food-freshness-platform/
> Tip: open the **Live Demo** section, move the sliders or upload a food photo.

Animated marketing + demo website for an AI-powered food freshness monitoring platform.
Covers every section of the project document: objective, architecture, 12 modules, role dashboards,
8-week roadmap, evaluation criteria, tech stack, performance metrics and quantitative goals.

## Create your own account
Open `login.html` → **Create account**, choose your own email and password, and pick a role to explore (Consumer, Retail, Warehouse or Inspector). Accounts are stored in that visitor's browser only. **Forgot password?** resets it right on the sign-in page (demo).

## Demo accounts (password for all: `Fresh@123`)
| Role | Email | What they see |
|---|---|---|
| Consumer | consumer@freshai.demo | Home fridge, kitchen tips |
| Retail Manager | retail@freshai.demo | Markdown suggestions, waste cost |
| Warehouse Operator | warehouse@freshai.demo | Zone compliance, sensors |
| Quality Inspector | inspector@freshai.demo | Inspection queue, record inspections |
| Administrator | admin@freshai.demo | Users, roles, audit log, all data |

The app (`login.html` → `app.html`) has: dashboard, inventory CRUD, photo freshness scan, live storage monitor,
alerts, analytics, reports (CSV / print-to-PDF), user management and profile. Data is stored in the browser
(localStorage) so it runs on static hosting. **Auth is a front-end demo** — a production build needs the FastAPI + PostgreSQL backend from the architecture.

## Install as an app (PWA)
- **Chrome / Edge (desktop):** open the live link → click **⬇ Install App** in the top bar (or the install icon in the address bar).
- **Android (Chrome):** menu ⋮ → **Install app** / **Add to Home screen**.
- **iPhone (Safari):** Share → **Add to Home Screen**.

It then opens in its own window with an icon, and also works offline after the first visit.

## Features
- Animated hero (orbiting foods, scan line, floating cards), particle background, scroll-reveal, progress bar
- **Live demo**: weighted freshness model (Visual 40% · Storage 25% · Shelf-life 20% · Age 15%),
  animated gauge, shelf-life estimate, spoilage probability, recommendations
- Optional image upload — runs a simulated colour/texture analysis fully in the browser (nothing is uploaded)
- Interactive architecture diagram, expandable module cards, role dashboard tabs, timeline

> The demo uses a heuristic simulation, not a trained model. It is not food-safety advice.

## Run locally (VS Code)
Open the folder in VS Code and use the **Live Server** extension, or:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

index.html styles.css site.js        (marketing site)
login.html app.html app.css app.js core.js   (the app)
manifest.webmanifest   sw.js   icons/      (installable app files)
.github/workflows/deploy.yml
```
