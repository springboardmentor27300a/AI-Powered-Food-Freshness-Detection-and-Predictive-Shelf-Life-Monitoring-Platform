from fastapi import APIRouter, Response
from app.db.mongodb import get_database
import csv
import io
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
