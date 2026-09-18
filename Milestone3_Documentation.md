# FreshSense AI: Milestone 3 Documentation
## Shelf-Life Prediction, Cold Storage Telemetry, Recommendation Engine & Freshness Analytics

---

## 1. Milestone 3 Overview & PRD Alignment

As defined in **Milestone 3 (Week 5–6)** of the **Food Freshness Monitoring Platform PRD**:

> **Tasks:** Implement shelf-life prediction models; build storage monitoring workflows; develop recommendation engine; generate inventory insights; create freshness analytics dashboards.  
> **Outcomes:** Shelf-life prediction engine operational; recommendation workflows functional; analytics dashboards completed.  
> **Evaluation Criteria:** Shelf-life prediction operational; recommendation engine functional; analytics and monitoring workflows completed.

Milestone 3 seamlessly builds upon Milestone 1 (Auth, RBAC, Inventory Management) and Milestone 2 (Computer Vision Freshness Scoring & Defect Detection), delivering an industrial-grade predictive analytics and automated cold-chain decision support platform.

---

## 2. Mathematical & Bio-Kinetic Shelf-Life Prediction Model

### 2.1 The Arrhenius & $Q_{10}$ Temperature Kinetic Model
Food deterioration kinetics are fundamentally driven by temperature-dependent enzymatic reactions, respiration rate, and microbial proliferation. FreshSense AI implements a modified **$Q_{10}$ Arrhenius Temperature Coefficient Model**:

$$K_{T} = Q_{10}^{\frac{T_{\text{storage}} - T_{\text{optimal}}}{10}}$$

Where:
- $T_{\text{storage}}$ is the ambient cold room temperature (°C).
- $T_{\text{optimal}}$ is the commodity-specific preservation temperature setpoint (°C).
- $Q_{10}$ represents the fold-increase in biochemical respiration rate per 10°C rise ($2.0 \le Q_{10} \le 2.8$ across commodity classes).

| Category | Optimal Temp ($T_{\text{opt}}$) | Optimal RH ($RH_{\text{opt}}$) | Base Lifespan ($L_0$) | $Q_{10}$ Factor | Optimal Packaging |
|---|---|---|---|---|---|
| **Fruits** | 3.0°C | 88% RH | 25 Days | 2.2 | Modified Atmosphere (MAP) |
| **Vegetables** | 4.0°C | 90% RH | 18 Days | 2.3 | Perforated Polyethylene |
| **Dairy Products** | 2.0°C | 75% RH | 14 Days | 2.5 | Vacuum Sealed |
| **Meat & Poultry** | 1.0°C | 70% RH | 7 Days | 2.6 | Vacuum Sealed |
| **Seafood** | 0.5°C | 70% RH | 5 Days | 2.8 | Modified Atmosphere (MAP) |
| **Bakery Products** | 18.0°C | 60% RH | 6 Days | 1.8 | Modified Atmosphere (MAP) |

### 2.2 Environmental & Packaging Stress Factors
1. **Relative Humidity Factor ($K_H$):**
   - Transpirational Dehydration ($RH < RH_{\text{opt}} - 10$): $K_H = 1.0 + |RH - RH_{\text{opt}}| \times 0.018$
   - Condensation / Mold Risk ($RH > 94\%$): $K_H = 1.0 + |RH - 94| \times 0.022$
2. **Packaging Barrier Multiplier ($K_P$):**
   - *Modified Atmosphere Packaging (MAP)*: $0.55\times$ (respiration suppression via enriched $CO_2$ / low $O_2$)
   - *Vacuum Sealed*: $0.65\times$
   - *Perforated Polyethylene*: $0.90\times$
   - *Open Container / Bulk Ambient*: $1.35\times$ (accelerated oxidation and moisture loss)
3. **Airflow Multiplier ($K_A$):**
   - *Optimal (Active)*: $0.92\times$ (constant positive-pressure ethylene exhaust)
   - *Moderate*: $1.00\times$
   - *Stagnant*: $1.25\times$ (trapped ripening hormones and heat pockets)

**Total Degradation Velocity:**
$$K_{\text{total}} = K_T \times K_H \times K_P \times K_A$$

**Predicted Remaining Shelf-Life:**
$$\text{Remaining Days} = \max\left(0, \left(\frac{L_0 - \text{AgeDays}}{K_{\text{total}}}\right) \times \frac{\text{VisualScore}}{100}\right)$$

### 2.3 PRD 4-Pillar Composite Health Score
In strict adherence to PRD Section 4.7, the platform calculates the composite quality score:

$$\text{Composite Score} = (S_{\text{visual}} \times 0.40) + (S_{\text{storage}} \times 0.25) + (S_{\text{shelflife}} \times 0.20) + (S_{\text{age}} \times 0.15)$$

---

## 3. Cold Storage Condition Monitoring & Telemetry Architecture

### 3.1 Warehouse Microclimate Zones
Monitored storage environments are organized into isolated zones:
- `ZONE-WH01-A`: Cold Room A — Chilled Fresh Produce (Target: 3.0°C, 88% RH)
- `ZONE-WH01-B`: Zone B — Controlled Atmosphere Vault (Target: 2.0°C, 90% RH)
- `ZONE-WH02-A`: Zone Alpha — Coastal High-Humidity Chiller (Target: 2.5°C, 88% RH)
- `ZONE-WH03-A`: Bay 1 — Sunshine Produce Deep Chill (Target: 4.0°C, 85% RH)

### 3.2 Real-Time Compliance Envelope & Excursion Detection
The system continuously evaluates incoming probe readings against cold-chain tolerance envelopes:
- **Compliant:** Temperature within $T_{\text{opt}} \pm 1.5^\circ\text{C}$ and $RH \ge 80\%$.
- **Minor Excursion:** Temperature elevated by $1.5^\circ\text{C} - 3.0^\circ\text{C}$ or $RH$ dropped by $10\%$.
- **Critical Violation:** Temperature elevated by $> 3.0^\circ\text{C}$ for $> 30$ minutes, triggering root-cause alerts.
- **1-Click Operator Resolution:** Operators can acknowledge excursion alerts, execute corrective chiller adjustments, and log remediation events in Cloud MongoDB.

---

## 4. Intelligent Recommendation & FEFO Rotation Engine

### 4.1 First-Expiry-First-Out (FEFO) Dispatch Prioritization
Traditional FIFO (First-In-First-Out) leads to unnecessary waste when produce batches experience differing degradation rates. The FreshSense AI **FEFO Engine** dynamically calculates remaining shelf-life days and assigns batches to an automated dispatch hierarchy:
1. **Critical FEFO Dispatch ($\le 3$ Days Remaining):** Prioritized for instant retail delivery, flash sales, or commercial culinary kitchens.
2. **High Priority (3–7 Days Remaining):** Scheduled for standard retail distribution.
3. **Standard Velocity ($> 7$ Days Remaining):** Maintained in cold buffer storage.

### 4.2 Dynamic Markdown Pricing Engine
To prevent 100% inventory write-offs, the recommendation engine calculates optimal markdown curves:
- **Shelf-Life $4 - 7$ Days ($S < 75$):** $15\%$ promotional velocity markdown.
- **Shelf-Life $2 - 4$ Days ($S < 60$):** $40\%$ clearance markdown.
- **Shelf-Life $< 2$ Days ($S < 40$):** $70\%$ urgent flash sale or donation routing to food banks.
- **Spoiled ($S < 30$):** 100% write-off / diverted to municipal organic composting.

### 4.3 Ethylene Co-Location & Segregation Matrix
Ethylene ($C_2H_4$) is a gaseous plant hormone released during ripening. FreshSense AI prevents premature senescence through co-location rules:
- **High Emitters (Apples, Bananas, Melons, Tomatoes)** must NEVER be stored in the same chamber as **Ethylene-Sensitive Produce (Leafy Greens, Spinach, Broccoli, Carrots)**.
- Minimum 10-meter physical separation with positive-pressure exhaust is enforced.

---

## 5. Freshness Analytics & Executive Insights

The executive analytics suite aggregates real-time data into key decision metrics:
1. **Total Produce Monitored:** Aggregate active kilograms under cold-chain surveillance.
2. **Economic Value at Risk ($):** Dollar value of inventory approaching expiration window ($\le 3$ days).
3. **Food Waste Diverted ($ and kg):** Quantifiable landfill waste prevented through automated FEFO rotation and dynamic clearance markdowns.
4. **Network Compliance Index (%):** Overall percentage of warehouse sensors operating within strict regulatory temperature/humidity envelopes.
5. **7-Day Degradation Trends:** Time-series tracking comparing degradation velocities across Fruits, Vegetables, Dairy, and Meat.

---

## 6. API Reference: Milestone 3 Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/prediction/shelf-life` | Core Arrhenius shelf-life calculation (compatible with PRD) |
| `POST` | `/api/prediction/simulate-conditions` | Interactive What-If kinetic simulation with 30-day projected curve |
| `GET` | `/api/prediction/batch/{batch_id}` | Real-time shelf-life projection for a specific database batch |
| `GET` | `/api/prediction/all-batches` | Bulk shelf-life forecasts across all active warehouse batches |
| `GET` | `/api/storage/zones` | Real-time telemetry (temp, humidity, airflow, light) for all zones |
| `GET` | `/api/storage/telemetry/{zone_id}` | 24-hour historical telemetry log (hourly readings) for stability graphs |
| `GET` | `/api/storage/alerts` | Active environmental excursion alerts and root causes |
| `POST` | `/api/storage/alerts/{id}/resolve` | 1-click resolution of excursion alert |
| `POST` | `/api/storage/simulate-reading` | Inject simulated IoT telemetry (demonstration trigger) |
| `GET` | `/api/recommendations/fefo-queue` | Ranked First-Expiry-First-Out dispatch schedule |
| `GET` | `/api/recommendations/markdowns` | Dynamic markdown pricing recommendations |
| `GET` | `/api/recommendations/storage-matrix` | Ethylene compatibility and co-location matrix |
| `GET` | `/api/recommendations/overview` | Operational recommendation summary & recoverable revenue |
| `GET` | `/api/analytics/dashboard` | Executive dashboard metrics, value at risk, and waste prevented |
| `GET` | `/api/analytics/freshness-trends` | 7-day category freshness degradation curves |
| `GET` | `/api/analytics/category-health` | Category-by-category quality and turnover health matrix |

---

## 7. Frontend User Interface Architecture

- **`FreshnessAnalyticsHub.jsx`**: A dedicated master interface implementing the Linear modern design system with 4 high-performance tabs:
  1. **⏳ Shelf-Life Prediction Lab & Simulator**: Interactive sliders for Temperature, Humidity, Packaging, Airflow, and Harvest Age; real-time SVG decay curve with dual-trace comparison (Current vs Optimal).
  2. **❄️ Cold Storage Telemetry & Compliance**: Live warehouse zone cards, 24-hour stability sparklines, and active excursion alert board with 1-click resolution.
  3. **💡 Recommendation & FEFO Rotation Engine**: Ranked FEFO dispatch queue with 1-click dispatch action; dynamic markdown pricing cards; biological ethylene matrix.
  4. **📊 Freshness Analytics & Executive Insights**: High-impact executive KPI cards, shelf-life risk distribution bars, category health matrix, and 1-click briefing export.
- **Cross-View Integration**:
  - `Navbar.jsx`: Seamless tab switching to `📈 Freshness & Shelf-Life Analytics` for all authenticated users and administrators.
  - `RetailManagerView.jsx`: Automated `⚡ FEFO PRIORITY` badges on near-expiry lots.
  - `AdminView.jsx`: Value at Risk, Waste Diverted ($), and Network Compliance (%) integrated into top metrics.
