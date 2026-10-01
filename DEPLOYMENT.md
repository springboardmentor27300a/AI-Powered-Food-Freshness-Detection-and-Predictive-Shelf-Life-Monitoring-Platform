# Food Freshness Monitoring Platform

## Modules 9 - 12 Implementation Guide

This project is fully containerized and production-ready, fulfilling the requirements for Modules 9 through 12.

### Module 4.9: Dashboard & Analytics
Role-based dashboards are built into the React frontend (`App.jsx`).
- **Admin**: Views total platform users, scan metrics, and a full platform user list table.
- **Retail Manager**: Gets shelf-life alert shortcuts and waste reduction analytics panels.
- **Warehouse Operator**: Views storage compliance instructions and environment log prompts.
- **Consumer**: Standard freshness views and recommendations.

### Module 4.10: Notification & Alert System
- Implemented via a `GET /notifications` polling mechanism that generates real-time smart alerts for:
  - Expiry (Items expired or expiring in < 5 days).
  - Spoilage (AI-classified spoiled or near-spoilage items).
  - Shelf-life critical thresholds.

### Module 4.11: Reports & Export System
- **PDF Report**: Generates a single-page Executive PDF Report for individual scans.
- **Excel Export**: A dedicated backend endpoint (`/export/excel`) streams a styled `.xlsx` file containing a historical scan log for all of the user's inventory.

### Module 4.12: Final Integration, Testing & Deployment
The platform is fully integrated via Docker Compose for one-click deployment.

#### Deployment Instructions

1. Ensure [Docker Desktop](https://www.docker.com/products/docker-desktop/) is installed and running on your system.
2. In the root directory (where `docker-compose.yml` is located), open a terminal.
3. Run the following command to build and launch the platform:
   ```bash
   docker-compose up --build -d
   ```
4. Access the platform:
   - **Frontend UI**: [http://localhost:5173](http://localhost:5173)
   - **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

#### Taking down the containers
To stop the platform:
```bash
docker-compose down
```
