"""
Report data builders (Milestone 4).

Every report is a plain `Report` object (title, summary, tables, notes)
built ONLY from stored database rows and the platform's existing
calculations:

  * shelf life / risk / health score / recommendations come from
    app.api.analysis.get_item_analysis - the very same function that
    feeds the dashboards, so report numbers always match the screens;
  * freshness numbers are the stored FreshnessAssessment rows;
  * storage numbers are the stored StorageCondition rows.

Nothing is invented. A value that was never recorded is shown as
NOT_RECORDED / NOT_ASSESSED text - never as 0.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.analysis import get_item_analysis
from app.core.access import inventory_scope, record_scope
from app.core.freshness_scoring import determine_trend_direction
from app.models.freshness_assessment import FreshnessAssessment
from app.models.inventory import FoodInventory
from app.models.storage_condition import StorageCondition
from app.models.user import User

NOT_RECORDED = "Not recorded"
NOT_ASSESSED = "Not assessed"
NOT_AVAILABLE = "Not available"
NO_READINGS = "No readings recorded"

REPORT_KINDS = {
    "freshness": "Freshness Assessment Report",
    "shelf-life": "Shelf-Life Prediction Report",
    "inventory-quality": "Inventory Quality Report",
    "waste-reduction": "Waste Reduction Report",
    "storage-compliance": "Storage Compliance Report",
    "platform-summary": "Platform Summary Report",
}


@dataclass
class Table:
    title: str
    columns: List[str]
    rows: List[List[Any]]
    empty_message: str = "No data to show."


@dataclass
class Report:
    kind: str
    title: str
    generated_at: datetime
    generated_by: str
    scope: str
    summary: List[tuple] = field(default_factory=list)
    tables: List[Table] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)


def _label(value) -> str:
    """Enum or string -> readable text ('near_spoilage' -> 'Near Spoilage')."""
    raw = getattr(value, "value", value)
    return str(raw).replace("_", " ").title()


def _dt(value: Optional[datetime]) -> str:
    return value.strftime("%Y-%m-%d %H:%M") if value else NOT_RECORDED


def _yes_no(flag: bool) -> str:
    return "Yes" if flag else "No"


def _scope_text(user: User) -> str:
    from app.core.access import has_shared_inventory_access

    if has_shared_inventory_access(user):
        return "Shared inventory (all Retail Manager, Warehouse Operator and Food Quality Inspector items)"
    return "Your own inventory"


def _new_report(kind: str, user: User, scope: Optional[str] = None) -> Report:
    return Report(
        kind=kind,
        title=REPORT_KINDS[kind],
        generated_at=datetime.now(timezone.utc),
        generated_by=f"{user.full_name} ({_label(user.role)})",
        scope=scope or _scope_text(user),
    )


# --------------------------------------------------------------------------
# Shared loading
# --------------------------------------------------------------------------
@dataclass
class ItemContext:
    item: FoodInventory
    assessments_newest_first: List[FreshnessAssessment]
    latest_storage: Optional[StorageCondition]
    storage_history_newest_first: List[StorageCondition]
    analysis: Any  # ItemAnalysisResponse

    @property
    def latest_assessment(self) -> Optional[FreshnessAssessment]:
        return self.assessments_newest_first[0] if self.assessments_newest_first else None


def load_item_contexts(db: Session, user: User) -> List[ItemContext]:
    items = (
        db.query(FoodInventory)
        .filter(inventory_scope(user))
        .order_by(FoodInventory.expiry_date, FoodInventory.food_name)
        .all()
    )
    contexts: List[ItemContext] = []
    for item in items:
        assessments = (
            db.query(FreshnessAssessment)
            .filter(
                FreshnessAssessment.inventory_item_id == item.id,
                record_scope(FreshnessAssessment.user_id, user),
            )
            .order_by(FreshnessAssessment.created_at.desc())
            .all()
        )
        storage = (
            db.query(StorageCondition)
            .filter(
                StorageCondition.inventory_item_id == item.id,
                record_scope(StorageCondition.user_id, user),
            )
            .order_by(StorageCondition.recorded_at.desc())
            .all()
        )
        analysis = get_item_analysis(inventory_id=item.id, db=db, current_user=user)
        contexts.append(
            ItemContext(item, assessments, storage[0] if storage else None, storage, analysis)
        )
    return contexts


def _days_to_expiry(item: FoodInventory, today: date) -> int:
    return (item.expiry_date - today).days


def _base_cols(c: ItemContext) -> List[Any]:
    return [c.item.food_name, c.item.category, c.item.batch_number, c.item.quantity]


# --------------------------------------------------------------------------
# 1. Freshness
# --------------------------------------------------------------------------
def build_freshness_report(db: Session, user: User) -> Report:
    r = _new_report("freshness", user)
    ctxs = load_item_contexts(db, user)

    latest_rows, history_rows = [], []
    by_cat: Dict[str, int] = {}
    assessed = 0
    for c in ctxs:
        a = c.latest_assessment
        if a is None:
            latest_rows.append(
                _base_cols(c) + [NOT_ASSESSED, NOT_ASSESSED, NOT_ASSESSED, NOT_ASSESSED, NOT_ASSESSED,
                                 NOT_ASSESSED, NOT_ASSESSED, 0, NOT_AVAILABLE, NOT_ASSESSED]
            )
            continue
        assessed += 1
        by_cat[_label(a.freshness_category)] = by_cat.get(_label(a.freshness_category), 0) + 1
        trend = (
            _label(determine_trend_direction([x.freshness_score for x in c.assessments_newest_first]))
            if len(c.assessments_newest_first) >= 2
            else NOT_AVAILABLE
        )
        latest_rows.append(
            _base_cols(c) + [
                _dt(a.created_at), a.freshness_score, _label(a.freshness_category),
                round(a.spoilage_probability * 100, 1), _yes_no(a.mold_detected),
                _yes_no(a.bruising_detected), _yes_no(a.physical_damage_detected),
                len(c.assessments_newest_first), trend, a.quality_assessment,
            ]
        )
        for h in c.assessments_newest_first:
            history_rows.append([
                c.item.food_name, c.item.batch_number, _dt(h.created_at), h.freshness_score,
                _label(h.freshness_category), round(h.spoilage_probability * 100, 1),
                _yes_no(h.mold_detected), _yes_no(h.bruising_detected),
                _yes_no(h.physical_damage_detected),
            ])

    r.summary = [("Inventory items", len(ctxs)), ("Items with an assessment", assessed),
                 ("Items not yet assessed", len(ctxs) - assessed)]
    r.summary += [(f"Latest result: {k}", v) for k, v in sorted(by_cat.items())]
    r.tables = [
        Table("Latest freshness assessment per item",
              ["Product", "Category", "Batch", "Qty", "Assessed at", "Freshness score (0-100)",
               "Freshness category", "Spoilage probability (%)", "Mold flag", "Bruising flag",
               "Damage flag", "Assessments recorded", "Trend", "Quality assessment"],
              latest_rows, "No inventory items found."),
        Table("Assessment history", 
              ["Product", "Batch", "Assessed at", "Score", "Category", "Spoilage prob. (%)",
               "Mold", "Bruising", "Damage"],
              history_rows, "No freshness assessments have been recorded yet."),
    ]
    r.notes = [
        "Freshness scores come from heuristic image analysis (colour, texture and spoilage rules) of uploaded photos. They are not a trained AI model and not a food-safety certification.",
        "'Not assessed' means no photo has been analysed for that item; it does not mean the score is zero.",
    ]
    return r


# --------------------------------------------------------------------------
# 2. Shelf life
# --------------------------------------------------------------------------
def build_shelf_life_report(db: Session, user: User) -> Report:
    r = _new_report("shelf-life", user)
    ctxs = load_item_contexts(db, user)
    rows, risks, expired = [], {}, 0
    for c in ctxs:
        s = c.analysis.shelf_life.current
        risks[s.risk_level] = risks.get(s.risk_level, 0) + 1
        expired += 1 if s.is_expired else 0
        rows.append(
            _base_cols(c) + [
                c.item.purchase_date.isoformat(), s.original_expiry_date.isoformat(),
                s.forecasted_expiry_date.isoformat(), s.remaining_shelf_life_days,
                _yes_no(s.is_expired), s.risk_level,
                "; ".join(s.risk_reasons) if s.risk_reasons else "None",
                s.matched_food_rule or "No specific food rule (recorded dates used)",
                _label(s.storage_method_used) if s.storage_method_used else NOT_RECORDED,
                _label(c.latest_assessment.freshness_category) if c.latest_assessment else NOT_ASSESSED,
                c.latest_storage.temperature_celsius if c.latest_storage else NOT_RECORDED,
            ]
        )
    r.summary = [("Inventory items", len(ctxs)), ("Past recorded expiry", expired)]
    r.summary += [(f"Risk: {k}", v) for k, v in sorted(risks.items())]
    r.tables = [Table(
        "Remaining shelf life and expiry forecast",
        ["Product", "Category", "Batch", "Qty", "Purchased", "Recorded expiry", "Forecast expiry",
         "Remaining days (estimate)", "Expired", "Risk", "Risk reasons", "Prediction basis",
         "Storage method", "Latest freshness", "Latest temp (C)"],
        rows, "No inventory items found.")]
    r.notes = [
        "Forecasts are estimates from recorded dates, food-specific storage rules, the latest freshness result and storage readings. They can only shorten, never extend, the printed expiry date.",
        "Expired items show 0 remaining days and keep their original expiry date.",
        "Where a food or storage method is not recognised, the recorded dates are used and the 'Prediction basis' column says so.",
    ]
    return r


# --------------------------------------------------------------------------
# 3. Inventory quality
# --------------------------------------------------------------------------
def build_inventory_quality_report(db: Session, user: User) -> Report:
    r = _new_report("inventory-quality", user)
    ctxs = load_item_contexts(db, user)
    today = datetime.now(timezone.utc).date()
    rows, scores = [], []
    for c in ctxs:
        a, h, s = c.latest_assessment, c.analysis.health_score, c.analysis.shelf_life.current
        if a:
            scores.append(a.freshness_score)
        defaults = []
        if a is None:
            defaults.append("visual")
        if c.latest_storage is None:
            defaults.append("storage")
        basis = ("All components from recorded data" if not defaults else
                 "Neutral default used for: " + ", ".join(defaults) + " (no data recorded)")
        rows.append(
            _base_cols(c) + [
                c.item.expiry_date.isoformat(), _days_to_expiry(c.item, today),
                a.freshness_score if a else NOT_ASSESSED,
                _label(a.freshness_category) if a else NOT_ASSESSED,
                _label(c.latest_storage.compliance_status) if c.latest_storage else NO_READINGS,
                h.overall_food_health_score, basis, s.risk_level,
            ]
        )
    r.summary = [
        ("Inventory items", len(ctxs)),
        ("Total units", sum(c.item.quantity for c in ctxs)),
        ("Items with an assessment", len(scores)),
        ("Average freshness score (assessed items)",
         round(sum(scores) / len(scores), 1) if scores else NOT_AVAILABLE),
    ]
    cats: Dict[str, int] = {}
    for c in ctxs:
        cats[c.item.category] = cats.get(c.item.category, 0) + 1
    r.summary += [(f"Items in {k}", v) for k, v in sorted(cats.items())]
    r.tables = [Table(
        "Inventory quality by item",
        ["Product", "Category", "Batch", "Qty", "Recorded expiry", "Days to expiry (negative = expired)",
         "Freshness score", "Freshness category", "Storage compliance", "Overall health score",
         "Health score data basis", "Risk"],
        rows, "No inventory items found.")]
    r.notes = [
        "Overall health score = Visual condition 40% + Storage 25% + Shelf life 20% + Product age 15%.",
        "When an item has no freshness assessment or no storage reading, the existing platform formula uses a neutral default of 70 for that component. The 'Health score data basis' column shows when this happened.",
    ]
    return r


# --------------------------------------------------------------------------
# 4. Waste reduction
# --------------------------------------------------------------------------
_ACTION_TYPES = {"consumption", "rotation", "waste_reduction"}


def build_waste_reduction_report(db: Session, user: User) -> Report:
    r = _new_report("waste-reduction", user)
    ctxs = load_item_contexts(db, user)
    today = datetime.now(timezone.utc).date()
    rows, units, expired_units = [], 0, 0
    for c in ctxs:
        s = c.analysis.shelf_life.current
        a = c.latest_assessment
        reasons = []
        if s.is_expired:
            reasons.append("Past recorded expiry")
        if s.risk_level == "High":
            reasons.append("High shelf-life risk")
        elif 0 <= s.remaining_shelf_life_days <= 7 and not s.is_expired:
            reasons.append("Expires within 7 days")
        if a and a.freshness_category.value in ("near_spoilage", "spoiled"):
            reasons.append(f"Freshness: {_label(a.freshness_category)}")
        if not reasons:
            continue
        units += c.item.quantity
        expired_units += c.item.quantity if s.is_expired else 0
        actions = [x.message for x in c.analysis.recommendations if x.type in _ACTION_TYPES]
        rows.append(
            _base_cols(c) + [
                c.item.expiry_date.isoformat(), s.remaining_shelf_life_days, s.risk_level,
                _label(a.freshness_category) if a else NOT_ASSESSED,
                "; ".join(reasons), " | ".join(actions) if actions else "No specific action generated",
            ]
        )
    r.summary = [("Inventory items reviewed", len(ctxs)), ("Items at risk of waste", len(rows)),
                 ("Units at risk", units), ("Units already past expiry", expired_units)]
    r.tables = [Table(
        "Items at risk of waste",
        ["Product", "Category", "Batch", "Qty (units at risk)", "Recorded expiry", "Remaining days (estimate)",
         "Risk", "Latest freshness", "Why flagged", "Recommended actions"],
        rows, "No items are currently at risk of waste.")]
    r.notes = [
        "An item is listed if it is past expiry, has High shelf-life risk, expires within 7 days, or its latest freshness result is Near Spoilage or Spoiled.",
        "Actions are the platform's existing consumption, rotation and waste-reduction recommendations. This report does not estimate cost or the amount of waste avoided, because that data is not recorded.",
    ]
    return r


# --------------------------------------------------------------------------
# 5. Storage compliance
# --------------------------------------------------------------------------
def build_storage_compliance_report(db: Session, user: User) -> Report:
    r = _new_report("storage-compliance", user)
    ctxs = load_item_contexts(db, user)
    latest_rows, history_rows, counts, with_readings = [], [], {}, 0
    for c in ctxs:
        g = c.analysis.storage_guidance
        t_rng = f"{g.temperature_range_c[0]:g} to {g.temperature_range_c[1]:g}" if g and g.temperature_range_c else NOT_AVAILABLE
        h_rng = f"{g.humidity_range_percent[0]:g} to {g.humidity_range_percent[1]:g}" if g and g.humidity_range_percent else NOT_AVAILABLE
        st = c.latest_storage
        if st is None:
            latest_rows.append(_base_cols(c) + [c.item.storage_location or NOT_RECORDED, NO_READINGS,
                               NO_READINGS, NO_READINGS, NO_READINGS, NO_READINGS, NO_READINGS, t_rng, h_rng, NO_READINGS])
            continue
        with_readings += 1
        counts[_label(st.compliance_status)] = counts.get(_label(st.compliance_status), 0) + 1
        latest_rows.append(_base_cols(c) + [
            c.item.storage_location or NOT_RECORDED, _dt(st.recorded_at), st.temperature_celsius,
            st.humidity_percent, st.air_circulation or NOT_RECORDED, st.light_exposure or NOT_RECORDED,
            _label(st.compliance_status), t_rng, h_rng, st.compliance_notes,
        ])
        for x in c.storage_history_newest_first:
            history_rows.append([c.item.food_name, c.item.batch_number, _dt(x.recorded_at),
                                 x.temperature_celsius, x.humidity_percent,
                                 x.air_circulation or NOT_RECORDED, x.light_exposure or NOT_RECORDED,
                                 x.packaging_type or NOT_RECORDED, _label(x.compliance_status)])
    suitable = counts.get("Suitable")
    r.summary = [
        ("Inventory items", len(ctxs)), ("Items with a storage reading", with_readings),
        ("Items with no reading", len(ctxs) - with_readings),
        ("Compliance rate (latest readings, Suitable / items with readings)",
         f"{round(100 * (suitable or 0) / with_readings)}%" if with_readings else NOT_AVAILABLE),
    ]
    r.summary += [(f"Latest status: {k}", v) for k, v in sorted(counts.items())]
    r.tables = [
        Table("Latest storage reading per item",
              ["Product", "Category", "Batch", "Qty", "Storage location", "Recorded at",
               "Temperature (C)", "Humidity (%)", "Air circulation", "Light exposure", "Compliance",
               "Recommended temp range (C)", "Recommended humidity range (%)", "Compliance notes"],
              latest_rows, "No inventory items found."),
        Table("Storage reading history",
              ["Product", "Batch", "Recorded at", "Temperature (C)", "Humidity (%)",
               "Air circulation", "Light exposure", "Packaging", "Compliance"],
              history_rows, "No storage readings have been recorded yet."),
    ]
    r.notes = [
        "All readings are entered manually; the platform has no sensor integration. Items without readings show 'No readings recorded' - this is not a compliant or non-compliant result.",
        "Compliance is judged on temperature and humidity against the platform's rule table. Air circulation, light exposure and packaging are recorded but not scored.",
        "Recommended ranges are the platform's general guidance, not a certified food-safety standard.",
    ]
    return r


# --------------------------------------------------------------------------
# 6. Platform summary (administrator)
# --------------------------------------------------------------------------
def build_platform_summary_report(db: Session, user: User) -> Report:
    r = _new_report("platform-summary", user, scope="Entire platform (aggregate counts only, no personal data)")
    today = datetime.now(timezone.utc).date()
    users_by_role = {
        _label(role): n for role, n in db.query(User.role, func.count(User.id)).group_by(User.role).all()
    }
    total_users = sum(users_by_role.values())
    active_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    items = db.query(func.count(FoodInventory.id)).scalar() or 0
    units = db.query(func.coalesce(func.sum(FoodInventory.quantity), 0)).scalar() or 0
    past = db.query(func.count(FoodInventory.id)).filter(FoodInventory.expiry_date < today).scalar() or 0
    cats = db.query(FoodInventory.category, func.count(FoodInventory.id)).group_by(FoodInventory.category).all()
    assess = db.query(func.count(FreshnessAssessment.id)).scalar() or 0
    by_fresh = db.query(FreshnessAssessment.freshness_category, func.count(FreshnessAssessment.id)).group_by(
        FreshnessAssessment.freshness_category).all()
    readings = db.query(func.count(StorageCondition.id)).scalar() or 0
    by_comp = db.query(StorageCondition.compliance_status, func.count(StorageCondition.id)).group_by(
        StorageCondition.compliance_status).all()

    r.summary = [("Registered users", total_users), ("Active users", active_users),
                 ("Inventory items", items), ("Total units", int(units)),
                 ("Items past recorded expiry", past), ("Freshness assessments", assess),
                 ("Storage readings", readings)]
    r.tables = [
        Table("Users by role", ["Role", "Users"], sorted([[k, v] for k, v in users_by_role.items()]),
              "No users."),
        Table("Inventory items by category", ["Category", "Items"], sorted([[k, v] for k, v in cats]),
              "No inventory items recorded."),
        Table("Freshness assessments by result", ["Result", "Assessments"],
              sorted([[_label(k), v] for k, v in by_fresh]), "No freshness assessments recorded."),
        Table("Storage readings by compliance", ["Compliance", "Readings"],
              sorted([[_label(k), v] for k, v in by_comp]), "No storage readings recorded."),
    ]
    r.notes = [
        "Counts are taken directly from the database at the time of generation.",
        "Weekly activity trends, platform-wide risk counts and error logs are not available from the platform's stored data, so they are not reported.",
    ]
    return r


BUILDERS = {
    "freshness": build_freshness_report,
    "shelf-life": build_shelf_life_report,
    "inventory-quality": build_inventory_quality_report,
    "waste-reduction": build_waste_reduction_report,
    "storage-compliance": build_storage_compliance_report,
    "platform-summary": build_platform_summary_report,
}
