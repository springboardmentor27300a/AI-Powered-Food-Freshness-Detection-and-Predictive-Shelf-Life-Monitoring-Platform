from datetime import datetime, date, timezone
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


def _fetch_and_filter_inventory_records(
    current_user: Dict[str, Any],
    category: Optional[str] = None,
    storage_type: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    date_basis: Optional[str] = "expiry_date",
    expiry_horizon: Optional[str] = None,
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
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

    # Fetch latest freshness inspections map
    raw_analyses = list(fresh_col.find({}).sort("analysis_date", -1).limit(200))
    analyses_by_item: Dict[str, Dict[str, Any]] = {}
    analyses_list = []
    for a in raw_analyses:
        inv_id = str(a.get("inventory_id"))
        a_date = a.get("analysis_date")
        date_iso = a_date.isoformat() if hasattr(a_date, "isoformat") else str(a_date) if a_date else None
        if inv_id and inv_id not in analyses_by_item:
            analyses_by_item[inv_id] = {
                "analysis_date": date_iso,
                "freshness_score": a.get("freshness_score"),
                "freshness_label": a.get("freshness_label"),
                "mold_detected": bool(a.get("mold_detected", False)),
            }
        analyses_list.append({
            "id": str(a["_id"]),
            "inventory_id": inv_id,
            "freshness_score": a.get("freshness_score"),
            "freshness_label": a.get("freshness_label"),
            "analysis_date": date_iso,
        })

    today = date.today()
    filtered_items: List[Dict[str, Any]] = []

    for raw in raw_items:
        it = inventory_helper(raw)
        item_id = it.get("id")
        latest = analyses_by_item.get(item_id)
        if latest:
            it["last_analyzed"] = latest.get("analysis_date")
            if latest.get("mold_detected"):
                it["mold_detected"] = True
            if it.get("freshness_score") is None and latest.get("freshness_score") is not None:
                it["freshness_score"] = latest.get("freshness_score")
        else:
            it["last_analyzed"] = None

        # Text search (food name, batch number, category, ID)
        if search and search.strip():
            s = search.strip().lower()
            name = (it.get("food_name") or "").lower()
            batch = (it.get("batch_number") or "").lower()
            cat = (it.get("category") or "").lower()
            iid = str(it.get("id") or "").lower()
            if s not in name and s not in batch and s not in cat and s not in iid:
                continue

        # Date range filtering based on basis
        basis_key = "expiry_date"
        if date_basis in ["purchase_date", "purchase"]:
            basis_key = "purchase_date"
        elif date_basis in ["created_at", "created"]:
            basis_key = "created_at"

        date_val = str(it.get(basis_key) or "")[:10]
        if start_date and date_val:
            if date_val < start_date[:10]:
                continue
        if end_date and date_val:
            if date_val > end_date[:10]:
                continue

        # Expiry horizon quick filter
        if expiry_horizon and expiry_horizon.lower() != "all":
            exp_str = str(it.get("expiry_date") or "")[:10]
            days = None
            if exp_str:
                try:
                    exp_dt = datetime.strptime(exp_str, "%Y-%m-%d").date()
                    days = (exp_dt - today).days
                except Exception:
                    days = None

            h = expiry_horizon.lower()
            if h == "today" and days != 0:
                continue
            elif h in ["3days", "3_days", "next_3_days"] and not (days is not None and 0 <= days <= 3):
                continue
            elif h in ["7days", "7_days", "next_7_days"] and not (days is not None and 0 <= days <= 7):
                continue
            elif h in ["30days", "30_days", "next_30_days"] and not (days is not None and 0 <= days <= 30):
                continue
            elif h == "expired" and not (days is not None and days < 0):
                continue

        filtered_items.append(it)

    return filtered_items, analyses_list


@router.get(
    "/summary",
    summary="Generate Comprehensive Quality and Inventory Compliance Summary Report"
)
async def get_summary_report(
    category: Optional[str] = Query(None, description="Category filter"),
    storage_type: Optional[str] = Query(None, description="Storage type filter"),
    status: Optional[str] = Query(None, description="Status filter"),
    search: Optional[str] = Query(None, description="Search keyword"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    date_basis: Optional[str] = Query("expiry_date", description="Date basis: expiry_date, purchase_date, created_at"),
    expiry_horizon: Optional[str] = Query(None, description="Expiry horizon: today, 3days, 7days, 30days"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns structured data for the visual reports interface,
    including 7 KPI cards, 6 Chart.js data sets, and fully filtered inventory records.
    """
    items, analyses = _fetch_and_filter_inventory_records(
        current_user=current_user,
        category=category,
        storage_type=storage_type,
        search=search,
        start_date=start_date,
        end_date=end_date,
        date_basis=date_basis,
        expiry_horizon=expiry_horizon,
    )

    visual_report = report_generator.generate_visual_reports_data(
        items=items,
        analysis_records=analyses,
        filters={
            "category": category or "All",
            "storage_type": storage_type or "All",
            "status": status or "All",
            "search": search or "",
            "start_date": start_date or "",
            "end_date": end_date or "",
            "date_basis": date_basis or "expiry_date",
            "expiry_horizon": expiry_horizon or "all"
        }
    )

    # If status filter is passed, filter items in the response table while preserving overall cards & charts
    if status and status.lower() != "all":
        st_lower = status.strip().lower()
        if st_lower in ["nearing expiry", "nearing_expiry", "expiring soon"]:
            visual_report["items"] = [i for i in visual_report["items"] if i.get("is_nearing_expiry")]
        else:
            visual_report["items"] = [
                i for i in visual_report["items"]
                if (i.get("computed_status") or "").lower() == st_lower
            ]

    visual_report["recent_analyses"] = analyses
    return visual_report


@router.get(
    "/export-csv",
    summary="Export Filtered Inventory and Quality Records into CSV Format"
)
async def export_inventory_csv(
    category: Optional[str] = Query(None, description="Category filter"),
    storage_type: Optional[str] = Query(None, description="Storage type filter"),
    status: Optional[str] = Query(None, description="Status filter"),
    search: Optional[str] = Query(None, description="Search keyword"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    date_basis: Optional[str] = Query("expiry_date", description="Date basis: expiry_date, purchase_date, created_at"),
    expiry_horizon: Optional[str] = Query(None, description="Expiry horizon: today, 3days, 7days, 30days"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generates an RFC 4180-compliant CSV download containing all filtered inventory items,
    expiry calculations, and freshness ratings scoped by the user's permissions.
    """
    items, analyses = _fetch_and_filter_inventory_records(
        current_user=current_user,
        category=category,
        storage_type=storage_type,
        search=search,
        start_date=start_date,
        end_date=end_date,
        date_basis=date_basis,
        expiry_horizon=expiry_horizon,
    )

    visual_report = report_generator.generate_visual_reports_data(
        items=items,
        analysis_records=analyses,
    )
    export_items = visual_report["items"]

    if status and status.lower() != "all":
        st_lower = status.strip().lower()
        if st_lower in ["nearing expiry", "nearing_expiry", "expiring soon"]:
            export_items = [i for i in export_items if i.get("is_nearing_expiry")]
        else:
            export_items = [
                i for i in export_items
                if (i.get("computed_status") or "").lower() == st_lower
            ]

    csv_data = report_generator.generate_csv_report(export_items)
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


@router.get("/export-pdf", summary="Export High-Resolution PDF Quality Compliance Report with Graphs & Tables")
async def export_pdf_report(
    category: Optional[str] = Query(None, description="Category filter"),
    storage_type: Optional[str] = Query(None, description="Storage type filter"),
    status: Optional[str] = Query(None, description="Status filter"),
    search: Optional[str] = Query(None, description="Search keyword"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    date_basis: Optional[str] = Query("expiry_date", description="Date basis: expiry_date, purchase_date, created_at"),
    expiry_horizon: Optional[str] = Query(None, description="Expiry horizon: today, 3days, 7days, 30days"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generates an executive, publication-grade PDF report containing:
    1. Executive KPI Summary Table with 7 metrics
    2. Freshness Distribution Pie Chart with color-coded slices & legend
    3. Food Inventory Status Vertical Bar Chart
    4. Category-Wise Quality & Spoilage Breakdown Table
    5. Food Waste & Spoilage Impact Table
    6. Formatted Detailed Inventory Quality Audit Log Table
    """
    items, analyses = _fetch_and_filter_inventory_records(
        current_user=current_user,
        category=category,
        storage_type=storage_type,
        search=search,
        start_date=start_date,
        end_date=end_date,
        date_basis=date_basis,
        expiry_horizon=expiry_horizon,
    )

    visual_report = report_generator.generate_visual_reports_data(
        items=items,
        analysis_records=analyses,
        filters={
            "category": category or "All",
            "storage_type": storage_type or "All",
            "status": status or "All",
            "search": search or "",
            "start_date": start_date or "",
            "end_date": end_date or "",
            "date_basis": date_basis or "expiry_date",
            "expiry_horizon": expiry_horizon or "all"
        }
    )

    if status and status.lower() != "all":
        st_lower = status.strip().lower()
        if st_lower in ["nearing expiry", "nearing_expiry", "expiring soon"]:
            visual_report["items"] = [i for i in visual_report["items"] if i.get("is_nearing_expiry")]
        else:
            visual_report["items"] = [
                i for i in visual_report["items"]
                if (i.get("computed_status") or "").lower() == st_lower
            ]

    pdf_bytes = report_generator.generate_pdf_report(
        visual_report=visual_report,
        title="Food Freshness & Quality Compliance Report"
    )
    filename = f"food_freshness_report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        }
    )


@router.get("/export-excel", summary="Export Filtered Inventory & Metrics into Multi-Tab Excel Workbook")
async def export_excel_report(
    category: Optional[str] = Query(None, description="Category filter"),
    storage_type: Optional[str] = Query(None, description="Storage type filter"),
    status: Optional[str] = Query(None, description="Status filter"),
    search: Optional[str] = Query(None, description="Search keyword"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    date_basis: Optional[str] = Query("expiry_date", description="Date basis: expiry_date, purchase_date, created_at"),
    expiry_horizon: Optional[str] = Query(None, description="Expiry horizon: today, 3days, 7days, 30days"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    items, analyses = _fetch_and_filter_inventory_records(
        current_user=current_user,
        category=category,
        storage_type=storage_type,
        search=search,
        start_date=start_date,
        end_date=end_date,
        date_basis=date_basis,
        expiry_horizon=expiry_horizon,
    )

    visual_report = report_generator.generate_visual_reports_data(
        items=items,
        analysis_records=analyses,
        filters={
            "category": category or "All",
            "storage_type": storage_type or "All",
            "status": status or "All",
            "search": search or "",
            "start_date": start_date or "",
            "end_date": end_date or "",
            "date_basis": date_basis or "expiry_date",
            "expiry_horizon": expiry_horizon or "all"
        }
    )
    export_items = visual_report["items"]

    if status and status.lower() != "all":
        st_lower = status.strip().lower()
        if st_lower in ["nearing expiry", "nearing_expiry", "expiring soon"]:
            export_items = [i for i in export_items if i.get("is_nearing_expiry")]
        else:
            export_items = [
                i for i in export_items
                if (i.get("computed_status") or "").lower() == st_lower
            ]

    excel_bytes = report_generator.generate_excel_report(export_items, visual_report.get("summary", {}))
    filename = f"food_freshness_inventory_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        }
    )


