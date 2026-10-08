# FreshGuard — Food Freshness Monitoring Platform

Milestone 3 submission build aligned with the supplied project brief.

## Main implemented modules
- JWT authentication and role-based access
- Food item registration and batch management
- Image upload with lightweight visual-condition heuristics
- Freshness scoring using the brief's 40% visual / 25% storage / 20% shelf-life / 15% product-age weighting
- Remaining shelf-life and expiry forecasting
- Storage condition monitoring for temperature and humidity
- Recommendation engine for storage, FIFO/FEFO rotation and quality inspection
- Freshness, shelf-life, spoilage and storage alerts
- Dashboard and analytics
- Detailed one-report-per-assessment report page
- Individual PDF freshness report with food image when supplied
- Individual PDF/XLSX/CSV exports plus combined multi-page PDF and all-reports CSV export

## Dataset honesty
The supplied brief lists external datasets as recommended sources. This build does not claim to have trained on those external datasets. A small synthetic reference CSV is included under `data/` for demo/testing. The live system is a rule-based/heuristic prototype rather than a trained CNN classifier.

## Report exports
- `/api/reports/{id}` — detailed report data
- `/api/reports/{id}/pdf` — one report PDF with the uploaded food image when available
- `/api/reports/{id}/xlsx` — one report Excel file
- `/api/reports/{id}/csv` — one report CSV file
- `/api/reports/all/pdf` — one multi-page PDF containing every report
- `/api/reports/csv` — all reports in one CSV file

## Run
1. Extract the project.
2. Run `START_FRESHGUARD.bat`.
3. The launcher creates/uses `backend/.env`, prepares the MySQL database, installs dependencies and starts FastAPI + Vite.
4. Open the frontend URL printed by Vite.

MySQL database: `foodfreshness`.
