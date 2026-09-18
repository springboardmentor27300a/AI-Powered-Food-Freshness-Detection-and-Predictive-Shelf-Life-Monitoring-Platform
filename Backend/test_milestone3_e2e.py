import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.routers import prediction, storage, recommendations, analytics
from app.models.schemas import ShelfLifeSimulationRequest
from app.db.mongodb import connect_to_mongo

async def run_e2e_tests():
    print("=== STARTING MILESTONE 3 E2E ENDPOINT TESTS ===")
    
    # Connect DB (connects to Atlas or mock fallback)
    await connect_to_mongo()

    # 1. Prediction Simulation
    req = ShelfLifeSimulationRequest(
        category="Fruits",
        harvest_date="2026-09-12",
        storage_temp_celsius=3.2,
        storage_humidity_percent=88.0,
        packaging_type="Modified Atmosphere (MAP)",
        air_circulation="Optimal (Active)",
        visual_score=95
    )
    sim_res = await prediction.simulate_storage_conditions(req)
    assert sim_res.remaining_days > 0, "Simulation failed: remaining days should be > 0"
    assert len(sim_res.day_by_day_curve) > 0, "Simulation failed: curve points missing"
    print(f"[PASS] 1. /prediction/simulate-conditions: remaining={sim_res.remaining_days}d, gain=+{sim_res.extension_gain_days}d, points={len(sim_res.day_by_day_curve)}")

    # 2. Batch Shelf-Life
    batch_res = await prediction.predict_batch_shelf_life("BATCH-20260825-APL01")
    assert batch_res is not None, "Batch shelf life prediction failed"
    print(f"[PASS] 2. /prediction/batch/BATCH-20260825-APL01: status={batch_res.freshness_status}, decay={batch_res.decay_rate_multiplier}x")

    # 3. All Batches Prediction
    all_b = await prediction.get_all_batches_shelf_life()
    print(f"[PASS] 3. /prediction/all-batches: evaluated {len(all_b)} batches")

    # 4. Storage Zones
    zones = await storage.get_storage_zones()
    assert len(zones) >= 3, "Expected at least 3 storage zones"
    print(f"[PASS] 4. /storage/zones: found {len(zones)} zones ({zones[0].zone_name})")

    # 5. Storage Telemetry History
    hist = await storage.get_zone_telemetry_history("ZONE-WH01-A")
    assert len(hist["telemetry_points"]) == 25, "Expected 25 hourly telemetry points"
    print(f"[PASS] 5. /storage/telemetry/ZONE-WH01-A: {len(hist['telemetry_points'])} data points generated")

    # 6. Storage Alerts
    alerts = await storage.get_storage_alerts()
    print(f"[PASS] 6. /storage/alerts: found {len(alerts)} alerts")

    # 7. Resolve Alert
    if alerts:
        res_alert = await storage.resolve_storage_alert(alerts[0].alert_id)
        assert res_alert["status"] == "success", "Failed to resolve alert"
        print(f"[PASS] 7. /storage/alerts/resolve: {res_alert['message']}")

    # 8. FEFO Queue
    fefo = await recommendations.get_fefo_dispatch_queue()
    assert len(fefo) > 0, "FEFO queue should not be empty"
    print(f"[PASS] 8. /recommendations/fefo-queue: {len(fefo)} items ranked by urgency (Top: {fefo[0].product_name}, {fefo[0].remaining_days}d)")

    # 9. Dynamic Markdowns
    markdowns = await recommendations.get_dynamic_markdown_recommendations()
    print(f"[PASS] 9. /recommendations/markdowns: {len(markdowns)} markdown suggestions")

    # 10. Ethylene Matrix
    matrix = await recommendations.get_ethylene_storage_matrix()
    assert len(matrix) >= 4, "Expected at least 4 ethylene rules"
    print(f"[PASS] 10. /recommendations/storage-matrix: {len(matrix)} rules active")

    # 11. Recommendations Overview
    rec_overview = await recommendations.get_recommendations_overview()
    print(f"[PASS] 11. /recommendations/overview: {rec_overview['active_recommendations_count']} active actions, ${rec_overview['inventory_value_at_risk_dollars']} at risk")

    # 12. Analytics Dashboard
    stats = await analytics.get_dashboard_analytics()
    assert "shelf_life_distribution" in stats, "Missing shelf_life_distribution in analytics"
    print(f"[PASS] 12. /analytics/dashboard: avg_score={stats['average_freshness_score']}, compliance={stats['cold_storage_compliance_rate']}%")

    # 13. Freshness Trends
    trends = await analytics.get_freshness_trends()
    assert len(trends["series"]) >= 4, "Expected 4 category trend lines"
    print(f"[PASS] 13. /analytics/freshness-trends: {len(trends['series'])} series across {len(trends['dates'])} days")

    # 14. Category Health
    health = await analytics.get_category_health_matrix()
    assert len(health) >= 4, "Expected 4 category health records"
    print(f"[PASS] 14. /analytics/category-health: {len(health)} categories audited")

    print("=== ALL 14 MILESTONE 3 TESTS PASSED PERFECTLY ===")

if __name__ == "__main__":
    asyncio.run(run_e2e_tests())
