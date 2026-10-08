"""
Milestone 4 tests: Five report types, PDF export and Excel export.
"""
from datetime import date, timedelta
from app.services.report_export import (
    is_valid_report_type,
    table_report_data,
    build_pdf,
    build_excel,
    _REPORT_TYPES,
)


def test_valid_report_types():
    expected = {"freshness", "shelf_life", "inventory_quality", "waste_reduction", "storage_compliance"}
    assert set(_REPORT_TYPES) == expected
    for r in expected:
        assert is_valid_report_type(r) is True
    assert is_valid_report_type("non_existent") is False


def test_build_pdf_and_excel_mocked_data():
    sample_data = {
        "title": "Freshness Assessment Report",
        "report_type": "freshness",
        "generated_on": "08 Oct 2026",
        "batch_id": "All Inventory",
        "summary": [
            ("Total Batches", "12"),
            ("Average Freshness Score", "85.4/100"),
            ("Fresh Items", "8"),
            ("Spoiled Items", "1"),
        ],
        "table_header": [
            "Food Item", "Category", "Batch ID", "Freshness Score",
            "Freshness Category", "Spoilage Probability", "Analysis Date", "Confidence", "Status"
        ],
        "table_rows": [
            ["Apple", "Fruits", "APP-20261001-001", "88.5/100", "Fresh", "5.2%", "01 Oct 2026", "92%", "Fresh"],
            ["Banana", "Fruits", "BAN-20261002-001", "72.0/100", "Acceptable", "24.5%", "02 Oct 2026", "86%", "Expiring Soon"],
            ["Chicken", "Meat & Poultry", "CHK-20261003-001", "30.0/100", "Near Spoilage", "68.0%", "03 Oct 2026", "95%", "Expired"],
        ],
    }

    pdf_bytes = build_pdf(sample_data)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF")

    xlsx_bytes = build_excel(sample_data)
    assert isinstance(xlsx_bytes, bytes)
    assert len(xlsx_bytes) > 500
    # ZIP / XLSX magic number PK\x03\x04
    assert xlsx_bytes.startswith(b"PK")


def test_build_all_five_report_types_export():
    report_configs = [
        ("freshness", ["Food Item", "Category", "Batch ID", "Score", "Category", "Spoilage %", "Date", "Confidence", "Status"]),
        ("shelf_life", ["Product", "Batch ID", "Storage Duration", "Remaining Days", "Expected Expiry", "Risk Level", "Confidence"]),
        ("inventory_quality", ["Batch ID", "Food Name", "Category", "Qty", "Unit", "Expiry Date", "Freshness Status", "Quality Score", "Risk"]),
        ("waste_reduction", ["Batch ID", "Product", "Category", "Qty", "Remaining Days", "Freshness Status", "Spoilage Risk", "Action", "Rotation"]),
        ("storage_compliance", ["Product", "Batch ID", "Current Temp", "Rec Temp", "Current Hum", "Rec Hum", "Air", "Light", "Compliance", "Risk", "Rec"]),
    ]

    for rep_type, headers in report_configs:
        data = {
            "title": f"Test {rep_type.replace('_', ' ').title()} Report",
            "report_type": rep_type,
            "generated_on": "08 Oct 2026",
            "batch_id": "All Inventory",
            "summary": [("Metric 1", "Value 1"), ("Metric 2", "Value 2")],
            "table_header": headers,
            "table_rows": [
                [f"Val_{col}_{row}" for col in range(len(headers))]
                for row in range(5)
            ],
        }

        pdf = build_pdf(data)
        assert pdf.startswith(b"%PDF"), f"PDF generation failed for {rep_type}"
        assert len(pdf) > 500

        xlsx = build_excel(data)
        assert xlsx.startswith(b"PK"), f"Excel generation failed for {rep_type}"
        assert len(xlsx) > 500
