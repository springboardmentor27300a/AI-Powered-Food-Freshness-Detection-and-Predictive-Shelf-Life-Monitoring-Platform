from fastapi import APIRouter, Response, HTTPException
from fastapi.responses import HTMLResponse
from app.db.mongodb import get_database
from app.routers.analysis import PRESET_DATASET_PRODUCE
import csv
import io
import hashlib
from datetime import datetime

router = APIRouter(prefix="/reports", tags=["Reports & Export System"])

@router.get("/export/csv")
async def export_inventory_csv():
    """
    Exports food produce inventory audit logs and freshness metrics as a CSV file.
    """
    db = get_database()
    batches = await db.food_batches.find().to_list(1000)

    output = io.StringIO()
    writer = csv.writer(output)

    # Write Header
    writer.writerow([
        "Batch ID", "Product Name", "Category", "Warehouse Name", 
        "Quantity (kg)", "Unit Price ($/kg)", "Freshness Score", 
        "Freshness Status", "Storage Temp (°C)", "Storage Humidity (%)", 
        "Harvest Date", "Expiry Date", "Status", "Registered By"
    ])

    for b in batches:
        writer.writerow([
            b.get("batch_id", ""),
            b.get("product_name", ""),
            b.get("category", ""),
            b.get("warehouse_name", ""),
            b.get("quantity_kg", 0),
            b.get("unit_price_per_kg", 0),
            b.get("freshness_score", 0),
            b.get("freshness_status", ""),
            b.get("storage_temp_celsius", 0),
            b.get("storage_humidity_percent", 0),
            b.get("harvest_date", ""),
            b.get("expiry_date", ""),
            b.get("status", ""),
            b.get("registered_by", "")
        ])

    csv_content = output.getvalue()
    filename = f"FreshSense_Inventory_Audit_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/freshness/{scan_id}")
async def get_freshness_report(scan_id: str):
    """
    Generates a structured laboratory-grade Freshness Inspection Certificate payload
    for a scanned produce item.
    """
    db = get_database()
    scan = await db.consumer_scans.find_one({"$or": [{"scan_id": scan_id}, {"id": scan_id}]})
    
    if not scan and scan_id in PRESET_DATASET_PRODUCE:
        # Fallback to preset if not yet stored
        p = PRESET_DATASET_PRODUCE[scan_id]
        scan = {
            "scan_id": f"FS-PRESET-{scan_id.upper()}",
            "product_name": p["product_name"],
            "category": p["category"],
            "image_url": p["image_url"],
            "visual_score": p["visual_score"],
            "composite_score": p["visual_score"],
            "status": p["status"],
            "spoilage_probability_percent": 100 - p["visual_score"],
            "mold_detected": p["mold_detected"],
            "mold_spot_count": p["mold_spot_count"],
            "bruise_detected": p["bruise_detected"],
            "bruise_percent": p["bruise_percent"],
            "defect_regions": p["defect_regions"],
            "color_analysis": p["color"],
            "texture_analysis": p["texture"],
            "weighted_breakdown": {
                "visual_score": p["visual_score"],
                "storage_score": 90,
                "shelf_life_score": 85,
                "age_score": 90,
                "composite_score": p["visual_score"]
            },
            "remaining_shelf_life_days": 14 if p["status"] == "Fresh" else 2,
            "storage_temp_celsius": p["optimal_temp"],
            "storage_humidity_percent": p["optimal_humidity"],
            "days_since_purchase": p["days_since_purchase"],
            "safety_verdict": p["safety_verdict"],
            "diagnosis": p["diagnosis"],
            "spoilage_indicators": p["spoilage_indicators"],
            "household_storage_tips": p["household_storage_tips"],
            "culinary_recipes": p["culinary_recipes"],
            "confidence_score": 0.98,
            "scanned_at": datetime.utcnow().isoformat()
        }

    if not scan:
        raise HTTPException(status_code=404, detail="Scan record not found for certificate generation.")

    # Generate verification digital signature hash
    raw_hash_data = f"{scan.get('scan_id')}_{scan.get('composite_score')}_{scan.get('scanned_at')}"
    cert_hash = hashlib.sha256(raw_hash_data.encode()).hexdigest()[:24].upper()

    return {
        "certificate_id": f"CERT-{scan.get('scan_id', 'SCAN')}",
        "verification_hash": cert_hash,
        "issued_by": "FreshSense AI Vision Assessment Engine v2.5",
        "iso_standard": "ISO 22000:2018 Food Safety & Quality Management",
        "scan_details": scan,
        "issued_at": datetime.utcnow().isoformat()
    }

@router.get("/freshness/{scan_id}/printable", response_class=HTMLResponse)
async def get_printable_freshness_report(scan_id: str):
    """
    Renders an official, printable / PDF-ready HTML Certificate of Freshness Assessment.
    Users can print or save as PDF directly from the browser.
    """
    report_data = await get_freshness_report(scan_id)
    scan = report_data["scan_details"]
    cert_hash = report_data["verification_hash"]
    cert_id = report_data["certificate_id"]

    score = scan.get("composite_score", 90)
    status_color = "#10B981" if score >= 88 else ("#3B82F6" if score >= 70 else ("#F59E0B" if score >= 50 else ("#F97316" if score >= 30 else "#EF4444")))

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FreshSense AI - Freshness Inspection Certificate - {scan.get('scan_id')}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, sans-serif;
        }}
        body {{
            background: #f8fafc;
            color: #0f172a;
            padding: 40px 20px;
        }}
        .certificate-container {{
            max-width: 850px;
            margin: 0 auto;
            background: #ffffff;
            border: 2px solid #0f172a;
            padding: 45px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.06);
            position: relative;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 25px;
            margin-bottom: 25px;
        }}
        .brand {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .logo {{
            width: 44px;
            height: 44px;
            background: #4f46e5;
            color: white;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
        }}
        .brand-title h1 {{
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
            letter-spacing: -0.02em;
        }}
        .brand-title p {{
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-top: 2px;
        }}
        .cert-badge {{
            text-align: right;
        }}
        .cert-badge .code {{
            font-size: 13px;
            font-family: monospace;
            font-weight: 700;
            color: #4f46e5;
            background: #eef2ff;
            padding: 5px 10px;
            border-radius: 6px;
            display: inline-block;
        }}
        .cert-badge .date {{
            font-size: 11px;
            color: #64748b;
            margin-top: 5px;
        }}
        .headline {{
            text-align: center;
            margin: 20px 0 30px 0;
        }}
        .headline h2 {{
            font-size: 24px;
            font-weight: 800;
            color: #1e1b4b;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }}
        .headline p {{
            font-size: 13px;
            color: #475569;
            margin-top: 5px;
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: 200px 1fr 180px;
            gap: 25px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 30px;
            align-items: center;
        }}
        .produce-img {{
            width: 100%;
            height: 140px;
            object-fit: cover;
            border-radius: 8px;
            border: 1px solid #cbd5e1;
        }}
        .info-col h3 {{
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 6px;
        }}
        .info-col .cat {{
            display: inline-block;
            background: #e2e8f0;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 10px;
        }}
        .info-col .diag {{
            font-size: 12px;
            color: #334155;
            line-height: 1.5;
        }}
        .score-box {{
            text-align: center;
            padding: 15px;
            border-radius: 8px;
            background: #ffffff;
            border: 2px solid {status_color};
        }}
        .score-box .num {{
            font-size: 42px;
            font-weight: 900;
            color: {status_color};
            line-height: 1;
        }}
        .score-box .status {{
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            color: {status_color};
            margin-top: 6px;
            letter-spacing: 0.05em;
        }}
        .score-box .sub {{
            font-size: 10px;
            color: #64748b;
            margin-top: 4px;
        }}
        .section-title {{
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 12px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
        }}
        .metrics-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 25px;
        }}
        .metrics-table th, .metrics-table td {{
            padding: 10px 14px;
            text-align: left;
            border-bottom: 1px solid #f1f5f9;
        }}
        .metrics-table th {{
            background: #f8fafc;
            color: #475569;
            font-weight: 600;
        }}
        .badge-safe {{
            background: #dcfce7;
            color: #15803d;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
        }}
        .badge-hazard {{
            background: #fee2e2;
            color: #b91c1c;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
        }}
        .spoilage-list {{
            list-style: none;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 25px;
        }}
        .spoilage-list li {{
            font-size: 11px;
            color: #334155;
            background: #f8fafc;
            padding: 8px 12px;
            border-radius: 6px;
            border-left: 3px solid #6366f1;
        }}
        .footer {{
            margin-top: 35px;
            border-top: 2px dashed #cbd5e1;
            padding-top: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .hash-seal {{
            font-size: 10px;
            color: #64748b;
            font-family: monospace;
            line-height: 1.5;
        }}
        .stamp {{
            width: 100px;
            height: 100px;
            border: 3px double #4f46e5;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: #4f46e5;
            font-weight: 800;
            font-size: 9px;
            transform: rotate(-12deg);
            opacity: 0.9;
        }}
        .btn-print {{
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #4f46e5;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            border: none;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
        }}
        @media print {{
            body {{
                background: white;
                padding: 0;
            }}
            .certificate-container {{
                border: 1px solid #000;
                box-shadow: none;
                padding: 25px;
                max-width: 100%;
            }}
            .btn-print {{
                display: none;
            }}
        }}
    </style>
</head>
<body>
    <div class="certificate-container">
        
        <div class="header">
            <div class="brand">
                <div class="logo">🥬</div>
                <div class="brand-title">
                    <h1>FreshSense AI Platform</h1>
                    <p>Automated Computer Vision Food Quality Assurance</p>
                </div>
            </div>
            <div class="cert-badge">
                <div class="code">{cert_id}</div>
                <div class="date">Issued: {scan.get('scanned_at', datetime.utcnow().isoformat())[:10]}</div>
            </div>
        </div>

        <div class="headline">
            <h2>Certificate of Freshness & Food Quality</h2>
            <p>Conducted pursuant to ISO 22000 Computer Vision Freshness Assessment Model</p>
        </div>

        <div class="summary-grid">
            <img src="{scan.get('image_url', '')}" alt="Produce" class="produce-img" />
            <div class="info-col">
                <span class="cat">{scan.get('category', 'Produce')}</span>
                <h3>{scan.get('product_name', 'Item')}</h3>
                <p class="diag">"{scan.get('diagnosis', 'Inspection completed.')}"</p>
                <div style="margin-top: 10px;">
                    <span class="{ 'badge-safe' if score >= 50 else 'badge-hazard' }">
                        {scan.get('safety_verdict', 'Safety Evaluated')}
                    </span>
                </div>
            </div>
            <div class="score-box">
                <div class="num">{score}</div>
                <div class="status">{scan.get('status', 'Fresh')}</div>
                <div class="sub">Weighted Health Score</div>
            </div>
        </div>

        <div class="section-title">PRD 4-Pillar Quality Scoring Matrix</div>
        <table class="metrics-table">
            <thead>
                <tr>
                    <th>Quality Dimension</th>
                    <th>PRD Weight</th>
                    <th>Dimension Score</th>
                    <th>Target Compliance</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Visual Condition Analysis</strong></td>
                    <td>40%</td>
                    <td>{scan.get('weighted_breakdown', {}).get('visual_score', scan.get('visual_score', score))}/100</td>
                    <td>Surface integrity, color vibrancy, zero mold</td>
                </tr>
                <tr>
                    <td><strong>Storage Conditions Impact</strong></td>
                    <td>25%</td>
                    <td>{scan.get('weighted_breakdown', {}).get('storage_score', 90)}/100</td>
                    <td>{scan.get('storage_temp_celsius', 3.5)}°C | {scan.get('storage_humidity_percent', 88.0)}% RH</td>
                </tr>
                <tr>
                    <td><strong>Remaining Shelf-Life Estimation</strong></td>
                    <td>20%</td>
                    <td>{scan.get('weighted_breakdown', {}).get('shelf_life_score', 85)}/100</td>
                    <td>Estimated {scan.get('remaining_shelf_life_days', 10)} safe days remaining</td>
                </tr>
                <tr>
                    <td><strong>Product Age / Senescence</strong></td>
                    <td>15%</td>
                    <td>{scan.get('weighted_breakdown', {}).get('age_score', 90)}/100</td>
                    <td>{scan.get('days_since_purchase', 2)} days in consumer possession</td>
                </tr>
            </tbody>
        </table>

        <div class="section-title">Computer Vision Spoilage & Defect Analysis</div>
        <ul class="spoilage-list">
            <li><strong>Fungal Mold Detection:</strong> { 'POSITIVE (' + str(scan.get('mold_spot_count', 0)) + ' colonies)' if scan.get('mold_detected') else 'NEGATIVE (Zero spores)' }</li>
            <li><strong>Surface Bruise / Necrosis:</strong> { str(scan.get('bruise_percent', 0)) + '%' if scan.get('bruise_detected') else 'None Detected' }</li>
            <li><strong>Pigment Vitality Index:</strong> {scan.get('color_analysis', {}).get('chlorophyll_vitality_percent', 95.0)}% ({scan.get('color_analysis', {}).get('color_status', 'Optimal')})</li>
            <li><strong>Skin & Texture Firmness:</strong> {scan.get('texture_analysis', {}).get('surface_firmness_percent', 95.0)}% ({scan.get('texture_analysis', {}).get('texture_status', 'Crisp')})</li>
        </ul>

        <div class="footer">
            <div class="hash-seal">
                <strong>DIGITAL VERIFICATION SIGNATURE:</strong><br>
                SHA-256: {cert_hash}<br>
                VERIFIED BY: FreshSense AI Vision Engine (Confidence: {scan.get('confidence_score', 0.98)*100:.1f}%)
            </div>
            <div class="stamp">
                <span>FRESHSENSE</span>
                <span style="font-size: 13px; margin: 3px 0;">VERIFIED</span>
                <span>AI QUALITY</span>
            </div>
        </div>

    </div>

    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
</body>
</html>"""

    return HTMLResponse(content=html_content)
