import { useState } from "react";
import {
  FileText,
  Download,
  Eye,
  Leaf,
  Clock,
  Package,
  TrendingDown,
  ShieldCheck,
} from "lucide-react";
import { downloadReport, viewReportPdf } from "../api";

// Role-based report access control
const REPORT_ROLE_ACCESS = {
  freshness: ["consumer", "retail_manager", "warehouse_operator", "administrator", "food_quality_inspector"],
  "shelf-life": ["consumer", "retail_manager", "warehouse_operator", "administrator", "food_quality_inspector"],
  inventory: ["retail_manager", "warehouse_operator", "administrator", "food_quality_inspector"],
  "waste-reduction": ["retail_manager", "warehouse_operator", "administrator"],
  "storage-compliance": ["consumer", "retail_manager", "warehouse_operator", "administrator", "food_quality_inspector"],
};

const ALL_REPORTS = [
  {
    id: "freshness",
    title: "Freshness Report",
    description: "M2 image-based freshness analysis with classification, quality scores, and visual metrics",
    icon: Leaf,
    color: "#22c55e",
    pdf: true,
    excel: true,
    pdfEndpoint: "/reports/freshness/pdf",
    excelEndpoint: "/reports/freshness/excel",
  },
  {
    id: "shelf-life",
    title: "Shelf-Life Report",
    description: "M3 ML predictions with remaining shelf life, risk levels, and recommendations",
    icon: Clock,
    color: "#0369a1",
    pdf: true,
    excel: true,
    pdfEndpoint: "/reports/shelf-life/pdf",
    excelEndpoint: "/reports/shelf-life/excel",
  },
  {
    id: "inventory",
    title: "Inventory Quality",
    description: "Inventory health, expiry status, and quality metrics",
    icon: Package,
    color: "#059669",
    pdf: true,
    excel: true,
    pdfEndpoint: "/reports/inventory/pdf",
    excelEndpoint: "/reports/inventory/excel",
  },
  {
    id: "waste-reduction",
    title: "Waste Reduction",
    description: "Potential waste-risk reduction insights and FEFO rotation priorities",
    icon: TrendingDown,
    color: "#d97706",
    pdf: true,
    excel: true,
    pdfEndpoint: "/reports/waste-reduction/pdf",
    excelEndpoint: "/reports/waste-reduction/excel",
  },
  {
    id: "storage-compliance",
    title: "Storage Compliance",
    description: "Storage condition records and compliance status",
    icon: ShieldCheck,
    color: "#7c3aed",
    pdf: true,
    excel: true,
    pdfEndpoint: "/reports/storage-compliance/pdf",
    excelEndpoint: "/reports/storage-compliance/excel",
  },
];

export default function ReportsView({ session }) {
  const [loading, setLoading] = useState({});
  const [error, setError] = useState("");

  const userRole = session?.role || "consumer";

  // Filter reports based on user role
  const visibleReports = ALL_REPORTS.filter((report) => {
    const allowedRoles = REPORT_ROLE_ACCESS[report.id] || [];
    return allowedRoles.includes(userRole);
  });

  const handleDownload = async (endpoint, filename) => {
    setLoading((prev) => ({ ...prev, [endpoint]: true }));
    setError("");
    try {
      await downloadReport(session.token, endpoint, filename);
    } catch (err) {
      setError(err.message || "Download failed");
    } finally {
      setLoading((prev) => ({ ...prev, [endpoint]: false }));
    }
  };

  const handleViewPdf = async (endpoint) => {
    setLoading((prev) => ({ ...prev, [endpoint]: true }));
    setError("");
    try {
      await viewReportPdf(session.token, endpoint);
    } catch (err) {
      setError(err.message || "Failed to view report");
    } finally {
      setLoading((prev) => ({ ...prev, [endpoint]: false }));
    }
  };

  return (
    <div className="reports-view">
      <div className="role-header">
        <div>
          <p className="eyebrow">REPORTS & EXPORTS</p>
          <h1>Generate Reports</h1>
          <p>Download PDF and Excel reports from your FreshGuard data</p>
        </div>
      </div>

      {error && <div className="notice-box error-box">{error}</div>}

      <div className="reports-grid">
        {visibleReports.map((report) => {
          const Icon = report.icon;
          return (
            <div key={report.id} className="report-card">
              <div className="report-card-header">
                <div className="report-icon" style={{ background: `${report.color}15`, color: report.color }}>
                  <Icon size={20} />
                </div>
                <h3>{report.title}</h3>
              </div>
              <p className="report-description">{report.description}</p>
              <div className="report-actions">
                {report.pdf && (
                  <>
                    <button
                      className="btn-secondary"
                      onClick={() => handleViewPdf(report.pdfEndpoint)}
                      disabled={loading[report.pdfEndpoint]}
                    >
                      <Eye size={14} /> View
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => handleDownload(report.pdfEndpoint, `freshguard_${report.id}_report.pdf`)}
                      disabled={loading[report.pdfEndpoint]}
                    >
                      <Download size={14} /> PDF
                    </button>
                  </>
                )}
                {report.excel && (
                  <button
                    className="btn-primary"
                    onClick={() => handleDownload(report.excelEndpoint, `freshguard_${report.id}_report.xlsx`)}
                    disabled={loading[report.excelEndpoint]}
                  >
                    <Download size={14} /> Excel
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visibleReports.length === 0 && (
        <div className="notice-box">
          <p>No reports are available for your role. Please contact an administrator if you need access.</p>
        </div>
      )}

      <div className="reports-note">
        <FileText size={14} />
        <p>
          <strong>Note:</strong> Reports are generated from your actual FreshGuard data.
          Shelf-life predictions clearly distinguish between Real/Traceable models (Tomato, Paneer, Seafood)
          and Synthetic Dataset (Demonstration) models.
        </p>
      </div>
    </div>
  );
}
