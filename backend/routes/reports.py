"""Reports module (Milestone 4).

- Per-scan freshness reports (Milestone 2 flow, unchanged) live here.
- New: five aggregate report types generated from real MongoDB records,
  with filters (date range / category / item / batch / status), persisted
  metadata, and PDF + Excel export built from the persisted document.
"""
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from database import report_collection, analysis_collection, prediction_collection, food_item_collection
from dependencies import get_current_user, require_roles, serialize_doc, to_object_id
from ml.report_builders import REPORT_TYPES, build_report_data
from ml.report_export import export_excel, export_pdf

router = APIRouter()


class ReportCreate(BaseModel):
    analysis_id: Optional[str] = None
    prediction_id: Optional[str] = None
    item_id: Optional[str] = None
    batch_id: Optional[str] = None


class ReportGenerateRequest(BaseModel):
    report_type: str
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    category: Optional[str] = None
    item_id: Optional[str] = None
    batch_number: Optional[str] = None
    status: Optional[str] = None


@router.get("/types")
async def list_report_types(user: dict = Depends(get_current_user)):
    """The five aggregate report types the platform supports."""
    return [{"id": k, "name": v} for k, v in REPORT_TYPES.items()]


@router.post("/generate")
async def generate_report(payload: ReportGenerateRequest, user: dict = Depends(get_current_user)):
    """Generate an aggregate report from real database records and persist it."""
    if payload.report_type not in REPORT_TYPES:
        raise HTTPException(status_code=400, detail=f"report_type must be one of: {', '.join(REPORT_TYPES)}")

    filters = {k: getattr(payload, k) for k in
               ("date_from", "date_to", "category", "item_id", "batch_number", "status")}
    filters = {k: v for k, v in filters.items() if v}

    data = await build_report_data(payload.report_type, filters, user)

    doc = {
        "report_type": payload.report_type,
        "title": data["title"],
        "description": data["description"],
        "created_by": str(user["_id"]),
        "created_by_username": user["username"],
        "created_by_role": user["role"],
        "created_at": datetime.now(timezone.utc),
        "filters": filters,
        "summary": data["summary"],
        "tables": data["tables"],
    }
    result = await report_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


@router.get("/")
async def list_reports(
    report_type: Optional[str] = Query(None),
    item_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    """Reports visible to the current user: own reports for consumers, all for staff."""
    query: dict = {}
    if user["role"] == "Consumer":
        query["$or"] = [{"created_by": str(user["_id"])}, {"recipient_id": str(user["_id"])}]
    if report_type:
        query["report_type"] = report_type
    if item_id:
        query["item_id"] = item_id
    reports = []
    cursor = report_collection.find(query).sort("created_at", -1).limit(limit)
    async for document in cursor:
        # list view: strip heavy table rows, keep metadata + summary
        document.pop("tables", None)
        reports.append(serialize_doc(document))
    return reports


@router.get("/{report_id}")
async def get_report(report_id: str, user: dict = Depends(get_current_user)):
    doc = await report_collection.find_one({"_id": to_object_id(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if user["role"] == "Consumer" and doc.get("created_by") not in (str(user["_id"]),):
        raise HTTPException(status_code=403, detail="Not your report")
    return serialize_doc(doc)


@router.delete("/{report_id}")
async def delete_report(report_id: str, user: dict = Depends(require_roles("Administrator"))):
    """Administrative report-metadata deletion (Reporting Management)."""
    doc = await report_collection.find_one({"_id": to_object_id(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    await report_collection.delete_one({"_id": doc["_id"]})
    return {"deleted": True, "id": report_id}


@router.get("/{report_id}/export")
async def export_report(
    report_id: str,
    format: str = Query("xlsx", pattern="^(xlsx|pdf|excel)$"),
    user: dict = Depends(get_current_user),
):
    """Download a report as a real .xlsx or .pdf file built from the persisted document."""
    doc = await report_collection.find_one({"_id": to_object_id(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if user["role"] == "Consumer" and doc.get("created_by") not in (str(user["_id"]),):
        raise HTTPException(status_code=403, detail="Not your report")

    if not doc.get("report_type"):
        # Legacy per-scan freshness report: build an exportable view on the fly
        doc = _legacy_scan_report_view(doc)

    safe_title = (doc.get("title") or "report").replace(" ", "_").replace("/", "-")
    stamp = doc.get("created_at")
    stamp = stamp.strftime("%Y%m%d_%H%M") if isinstance(stamp, datetime) else datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    filename = f"{safe_title}_{stamp}"

    if format in ("xlsx", "excel"):
        return Response(
            content=export_excel(doc),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
        )
    return Response(
        content=export_pdf(doc),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )


def _legacy_scan_report_view(doc: dict) -> dict:
    """Convert a Milestone-2 per-scan report into summary/tables form for export."""
    analysis = doc.get("analysis") or {}
    prediction = doc.get("prediction") or {}
    item = doc.get("item") or {}
    summary = [
        {"label": "Product", "value": item.get("name") or analysis.get("food_type") or "N/A"},
        {"label": "Category", "value": item.get("category") or analysis.get("category") or "N/A"},
        {"label": "Batch", "value": item.get("batch_number") or "N/A"},
        {"label": "AI status", "value": analysis.get("ml_status") or "N/A"},
        {"label": "AI confidence", "value": analysis.get("confidence")},
        {"label": "Quality score", "value": analysis.get("quality_score")},
        {"label": "Risk level", "value": prediction.get("risk_level") or "N/A"},
        {"label": "Effective remaining days", "value": prediction.get("effective_remaining_days")},
        {"label": "Predicted expiry", "value": prediction.get("predicted_expiry_date") or "N/A"},
    ]
    breakdown = (analysis.get("quality_assessment") or {}).get("score_breakdown") or {}
    qa_rows = [["ML Freshness (40%)", breakdown.get("ml_freshness_score")],
               ["Color (20%)", breakdown.get("color_score")],
               ["Texture (20%)", breakdown.get("texture_score")],
               ["Surface (20%)", breakdown.get("surface_score")],
               ["Rotten penalty applied", bool(breakdown.get("rotten_penalty_applied"))]]
    recs = doc.get("recommendations") or []
    return {
        "title": "Freshness Report (Scan)",
        "description": "Per-scan freshness report assembled from persisted analysis and prediction records.",
        "created_at": doc.get("created_at"),
        "created_by_username": doc.get("created_by_username"),
        "filters": {},
        "summary": summary,
        "tables": [
            {"name": "Quality Score Breakdown", "columns": ["Component", "Value"], "rows": qa_rows},
            {"name": "Recommendations", "columns": ["Title", "Message"],
             "rows": [[r.get("title"), r.get("message") or r.get("action")] for r in recs]},
        ],
    }

@router.post("/", response_model=dict)
async def create_report(payload: ReportCreate, user: dict = Depends(require_roles(
        "Retail Manager", "Warehouse Operator", "Food Quality Inspector", "Consumer"))):
    """Assemble a report from persisted analysis + prediction (does not fabricate data)."""
    analysis = None
    prediction = None
    if payload.analysis_id:
        analysis = await analysis_collection.find_one({"_id": to_object_id(payload.analysis_id)})
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
    if payload.prediction_id:
        prediction = await prediction_collection.find_one({"_id": to_object_id(payload.prediction_id)})
        if not prediction:
            raise HTTPException(status_code=404, detail="Prediction not found")
    item = None
    if payload.item_id:
        item = await food_item_collection.find_one({"_id": to_object_id(payload.item_id)})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
    if analysis is None and prediction is None:
        raise HTTPException(status_code=400, detail="Provide analysis_id and/or prediction_id")

    doc = {
        "created_by": str(user["_id"]),
        "created_by_username": user["username"],
        "created_at": datetime.now(timezone.utc),
        "analysis": serialize_doc(analysis) if analysis else None,
        "prediction": serialize_doc(prediction) if prediction else None,
        "item": {k: item.get(k) for k in ("name", "category", "batch_number", "quantity")} if item else None,
        "item_id": str(item["_id"]) if item else (analysis or {}).get("item_id"),
        "batch_id": (analysis or {}).get("batch_id"),
    }
    result = await report_collection.insert_one(doc)
    return serialize_doc(doc | {"_id": result.inserted_id})
