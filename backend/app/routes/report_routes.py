from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Query, HTTPException, Response, status

from backend.app.database import (
    get_inventory_collection,
    get_freshness_records_collection,
)
from backend.app.models.user_model import UserRole
from backend.app.models.inventory_model import inventory_helper
from backend.app.ml.report_generator import report_generator
from backend.app.ml.recommendation_engine import recommendation_engine
from backend.app.ml.shelf_life_model import shelf_life_predictor
from backend.app.utils.dependencies import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports & Data Export"])


@router.get(
    "/summary",
    summary="Generate Comprehensive Quality and Inventory Compliance Summary Report"
)
async def get_summary_report(
    category: Optional[str] = Query(None, description="Category filter"),
    storage_type: Optional[str] = Query(None, description="Storage type filter"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns structured data for the dedicated reports interface,
    calculating compliance status, quality averages, and inventory summaries.
    """
    inv_col = get_inventory_collection()
    fresh_col = get_freshness_records_collection()

    if inv_col is None or fresh_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    user_role = current_user.get("role")

    if user_role not in [UserRole.ADMIN.value, UserRole.WAREHOUSE_MANAGER.value, UserRole.SUPPLY_CHAIN_OPERATOR.value]:
        user_oid = ObjectId(current_user["id"]) if ObjectId.is_valid(current_user["id"]) else current_user["id"]
        query["user_id"] = user_oid

    if category and category.lower() != "all":
        query["category"] = category
    if storage_type and storage_type.lower() != "all":
        query["storage_type"] = storage_type

    raw_items = list(inv_col.find(query).sort("expiry_date", 1))
    items = [inventory_helper(i) for i in raw_items]

    raw_analyses = list(fresh_col.find({}).sort("analysis_date", -1).limit(50))
    analyses = [{
        "id": str(a["_id"]),
        "inventory_id": str(a.get("inventory_id")),
        "freshness_score": a.get("freshness_score"),
        "freshness_label": a.get("freshness_label"),
        "analysis_date": a.get("analysis_date").isoformat() if a.get("analysis_date") else None,
    } for a in raw_analyses]

    summary = report_generator.generate_summary_report(
        items=items,
        analysis_records=analyses,
        filters={"category": category or "All", "storage_type": storage_type or "All"}
    )

    return {
        "summary": summary,
        "items": items,
        "recent_analyses": analyses,
    }


@router.get(
    "/export-csv",
    summary="Export Filtered Inventory and Quality Records into CSV Format"
)
async def export_inventory_csv(
    category: Optional[str] = Query(None, description="Category filter"),
    storage_type: Optional[str] = Query(None, description="Storage type filter"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generates a live RFC 4180-compliant CSV download containing all inventory items,
    storage conditions, and freshness ratings scoped by the user's permissions.
    """
    inv_col = get_inventory_collection()
    if inv_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    user_role = current_user.get("role")

    if user_role not in [UserRole.ADMIN.value, UserRole.WAREHOUSE_MANAGER.value, UserRole.SUPPLY_CHAIN_OPERATOR.value]:
        user_oid = ObjectId(current_user["id"]) if ObjectId.is_valid(current_user["id"]) else current_user["id"]
        query["user_id"] = user_oid

    if category and category.lower() != "all":
        query["category"] = category
    if storage_type and storage_type.lower() != "all":
        query["storage_type"] = storage_type

    raw_items = list(inv_col.find(query).sort("expiry_date", 1))
    items = [inventory_helper(i) for i in raw_items]

    csv_data = report_generator.generate_csv_report(items)

    filename = f"food_freshness_report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )


@router.get(
    "/batch/{inventory_id}",
    summary="Generate Individual Food Quality Compliance Certificate"
)
async def get_batch_certificate(
    inventory_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Produces a quality assurance batch certificate including visual inspection metrics,
    kinetic decay projection, and storage compliance verification.
    """
    inv_col = get_inventory_collection()
    fresh_col = get_freshness_records_collection()

    if inv_col is None or fresh_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    try:
        oid = ObjectId(inventory_id)
        item = inv_col.find_one({"_id": oid})
    except Exception:
        item = inv_col.find_one({"_id": inventory_id})

    if not item:
        raise HTTPException(status_code=404, detail="Food item not found.")

    score = float(item.get("freshness_score") or 85.0)

    # Latest vision analysis
    latest_analysis = fresh_col.find_one({"inventory_id": item["_id"]}, sort=[("analysis_date", -1)])

    # Predict shelf life
    pred = shelf_life_predictor.predict_shelf_life(
        category=item.get("category", "Fruits"),
        purchase_date_val=item.get("purchase_date", ""),
        expiry_date_val=item.get("expiry_date", ""),
        storage_temperature=item.get("storage_temperature"),
        storage_humidity=item.get("storage_humidity"),
        current_freshness_score=score,
    )

    # Recommendations
    recs = recommendation_engine.generate_recommendations(
        category=item.get("category", "Fruits"),
        freshness_status=item.get("freshness_status", "Fresh"),
        freshness_score=score,
        days_remaining=pred["predicted_remaining_days"],
        temperature=item.get("storage_temperature"),
        humidity=item.get("storage_humidity"),
        quantity=float(item.get("quantity", 1.0)),
        unit=item.get("unit", "kg"),
    )

    certificate = {
        "certificate_id": f"CERT-{str(item['_id'])[:8].upper()}-{datetime.now(timezone.utc).strftime('%Y%m%d')}",
        "issue_date": datetime.now(timezone.utc).isoformat(),
        "food_item": inventory_helper(item),
        "visual_quality_score": score,
        "freshness_classification": item.get("freshness_status", "Not Analyzed"),
        "predicted_remaining_shelf_life_days": pred["predicted_remaining_days"],
        "confidence_score": pred["confidence_score"],
        "storage_stress_level": pred["storage_stress_level"],
        "recommended_fefo_priority": recs["fefo_priority"],
        "clearance_markdown_discount": f"{recs['recommended_markdown_discount_pct']}%",
        "compliance_summary": "Passed visual and environmental safety thresholds" if score >= 60.0 else "Attention Required: Elevated spoilage indicators",
        "latest_inspection": {
            "analysis_date": latest_analysis.get("analysis_date").isoformat() if latest_analysis and latest_analysis.get("analysis_date") else None,
            "mold_detected": latest_analysis.get("mold_detected", False) if latest_analysis else False,
            "bruising_detected": latest_analysis.get("bruising_detected", False) if latest_analysis else False,
            "detected_defects": latest_analysis.get("detected_defects", []) if latest_analysis else ["Standard inspection"],
        }
    }

    return certificate


@router.get("/freshness", summary="Module 11.1: Generate Freshness Degradation & Category Report")
async def get_freshness_report(
    category: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    inv_col = get_inventory_collection()
    fresh_col = get_freshness_records_collection()
    if inv_col is None or fresh_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    if category and category.lower() != "all":
        query["category"] = category

    items = [inventory_helper(i) for i in inv_col.find(query)]
    raw_analyses = list(fresh_col.find({}).sort("analysis_date", -1).limit(50))
    analyses = [{"id": str(a["_id"]), "freshness_score": a.get("freshness_score")} for a in raw_analyses]

    return report_generator.generate_freshness_report(items, analyses)


@router.get("/shelf-life", summary="Module 11.2: Generate Shelf-Life & Arrhenius Kinetics Report")
async def get_shelf_life_report(
    category: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    inv_col = get_inventory_collection()
    if inv_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    if category and category.lower() != "all":
        query["category"] = category

    items = [inventory_helper(i) for i in inv_col.find(query)]
    return report_generator.generate_shelf_life_report(items)


@router.get("/inventory-quality", summary="Module 11.3: Generate Inventory Quality & Defect Matrix Report")
async def get_inventory_quality_report(
    category: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    inv_col = get_inventory_collection()
    if inv_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    if category and category.lower() != "all":
        query["category"] = category

    items = [inventory_helper(i) for i in inv_col.find(query)]
    return report_generator.generate_inventory_quality_report(items)


@router.get("/waste-reduction", summary="Module 11.4: Generate Waste Reduction & Sustainability Report")
async def get_waste_reduction_report(
    category: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    inv_col = get_inventory_collection()
    if inv_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    if category and category.lower() != "all":
        query["category"] = category

    items = [inventory_helper(i) for i in inv_col.find(query)]
    return report_generator.generate_waste_reduction_report(items)


@router.get("/storage-compliance", summary="Module 11.5: Generate Storage & Cold Chain Compliance Report")
async def get_storage_compliance_report(
    category: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    inv_col = get_inventory_collection()
    if inv_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    if category and category.lower() != "all":
        query["category"] = category

    items = [inventory_helper(i) for i in inv_col.find(query)]
    return report_generator.generate_storage_compliance_report(items)


@router.get("/export-pdf", summary="Module 11.6: Export Filtered Quality Report into High-Res PDF Document")
async def export_pdf_report(
    category: Optional[str] = Query(None),
    storage_type: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    inv_col = get_inventory_collection()
    fresh_col = get_freshness_records_collection()
    if inv_col is None or fresh_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    user_role = current_user.get("role")
    if user_role not in [UserRole.ADMIN.value, UserRole.WAREHOUSE_MANAGER.value, UserRole.SUPPLY_CHAIN_OPERATOR.value]:
        user_oid = ObjectId(current_user["id"]) if ObjectId.is_valid(current_user["id"]) else current_user["id"]
        query["user_id"] = user_oid

    if category and category.lower() != "all":
        query["category"] = category
    if storage_type and storage_type.lower() != "all":
        query["storage_type"] = storage_type

    items = [inventory_helper(i) for i in inv_col.find(query).sort("expiry_date", 1)]
    raw_analyses = list(fresh_col.find({}).sort("analysis_date", -1).limit(50))
    analyses = [{"id": str(a["_id"]), "freshness_score": a.get("freshness_score")} for a in raw_analyses]

    summary = report_generator.generate_summary_report(
        items=items,
        analysis_records=analyses,
        filters={"category": category or "All", "storage_type": storage_type or "All"}
    )

    pdf_bytes = report_generator.generate_pdf_report(summary, items)
    filename = f"food_freshness_report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        }
    )


@router.get("/export-excel", summary="Module 11.7: Export Inventory and Metrics into Multi-Tab Excel Workbook")
async def export_excel_report(
    category: Optional[str] = Query(None),
    storage_type: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    inv_col = get_inventory_collection()
    fresh_col = get_freshness_records_collection()
    if inv_col is None or fresh_col is None:
        raise HTTPException(status_code=503, detail="Database service is unavailable.")

    query: Dict[str, Any] = {}
    user_role = current_user.get("role")
    if user_role not in [UserRole.ADMIN.value, UserRole.WAREHOUSE_MANAGER.value, UserRole.SUPPLY_CHAIN_OPERATOR.value]:
        user_oid = ObjectId(current_user["id"]) if ObjectId.is_valid(current_user["id"]) else current_user["id"]
        query["user_id"] = user_oid

    if category and category.lower() != "all":
        query["category"] = category
    if storage_type and storage_type.lower() != "all":
        query["storage_type"] = storage_type

    items = [inventory_helper(i) for i in inv_col.find(query).sort("expiry_date", 1)]
    raw_analyses = list(fresh_col.find({}).sort("analysis_date", -1).limit(50))
    analyses = [{"id": str(a["_id"]), "freshness_score": a.get("freshness_score")} for a in raw_analyses]

    summary = report_generator.generate_summary_report(
        items=items,
        analysis_records=analyses,
        filters={"category": category or "All", "storage_type": storage_type or "All"}
    )

    excel_bytes = report_generator.generate_excel_report(items, summary)
    filename = f"food_freshness_inventory_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        }
    )

