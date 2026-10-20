/**
 * Food Freshness Monitoring Platform - Retailer Hub Controller
 * Pure Vanilla JavaScript (Fetch API, Chart.js, Dynamic DOM Rendering)
 */

class RetailerApp {
  constructor() {
    this.currentTab = "overview";
    this.charts = {};
    this.cachedInventory = [];
    this.selectedScanItemId = null;
    this.selectedScanFile = null;
    this.activeCameraStream = null;
    this.lastScanResult = null;
    this.selectedEditItemId = null;
    this.selectedDetailsItemId = null;
    this.activeAlertId = null;
  }

  async init() {
    if (!api.enforceRoleAccess(["Retailer"])) return;

    const user = api.getUser();
    if (user) {
      const nameEl = document.getElementById("sidebar-user-name");
      const avatarEl = document.getElementById("sidebar-user-avatar");
      const storePill = document.getElementById("retailer-store-pill");

      if (nameEl) nameEl.textContent = user.name || "Retail Store";
      if (avatarEl) avatarEl.textContent = (user.name || "R").charAt(0).toUpperCase();
      if (storePill) storePill.textContent = user.organization || user.name || "Retail Store";
    }

    this.setupNavigation();
    this.setupEventListeners();
    await this.loadInitialData();

    // Check URL hash for initial tab
    const hash = window.location.hash.replace("#", "");
    if (hash && document.getElementById(`panel-${hash}`)) {
      this.switchTab(hash);
    } else {
      this.switchTab("overview");
    }
  }

  setupNavigation() {
    const navItems = document.querySelectorAll(".retail-nav-tabs .nav-item[data-tab]");
    navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Mobile menu toggle
    const mobileBtn = document.querySelector(".mobile-menu-btn");
    const sidebar = document.querySelector(".sidebar");
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener("click", () => {
        sidebar.classList.toggle("open");
      });
    }

    // Logout
    const logoutBtns = document.querySelectorAll(".btn-logout");
    logoutBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        api.logout();
      });
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    window.location.hash = tabName;

    // Update active nav link
    document.querySelectorAll(".retail-nav-tabs .nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.tab === tabName);
    });

    // Update active panel
    document.querySelectorAll(".retail-section").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panel-${tabName}`);
    });

    // Update Top Title
    const titleEl = document.getElementById("retail-page-title");
    const subtitleEl = document.getElementById("retail-page-subtitle");
    const titles = {
      overview: { title: "Retailer Operations Hub", sub: "Store-level inventory, freshness diagnostics, and waste mitigation" },
      inventory: { title: "Store Inventory & Stock", sub: "Manage products, adjust quantities, archive and monitor freshness" },
      "add-product": { title: "Product Intake Form", sub: "Enroll food items into store inventory with storage parameters" },
      "ai-freshness": { title: "AI Freshness Diagnostic", sub: "Computer Vision degradation inspection and Arrhenius shelf life" },
      "expiry-tracking": { title: "Expiry Tracking Audit", sub: "Track approaching expiry windows and prevent stock write-offs" },
      "shelf-life": { title: "Kinetic Shelf-Life Decay", sub: "Dynamic remaining days predicted by biochemical Q10 kinetics" },
      alerts: { title: "Spoilage & Storage Alerts", sub: "Real-time flags for microbial risk, temperature violations, and stockout" },
      storage: { title: "Storage Condition Compliance", sub: "Audit display cases and chillers against category food science standards" },
      quality: { title: "Product Quality Tracking", sub: "Quality scores, defect indicators, and organoleptic tracking" },
      "waste-reduction": { title: "Waste Reduction & FEFO", sub: "Automated retail markdowns and priority rotation recommendations" },
      analytics: { title: "Retail Business Intelligence", sub: "Store analytics, turnover metrics, and category distributions" },
      reports: { title: "Compliance Reports & Export", sub: "Filterable audit summaries and spreadsheet CSV streaming" },
      notifications: { title: "Store Notifications & Logs", sub: "Chronological operational event feed" },
    };

    if (titles[tabName]) {
      if (titleEl) titleEl.textContent = titles[tabName].title;
      if (subtitleEl) subtitleEl.textContent = titles[tabName].sub;
    }

    // Lazy load tab data
    this.loadTabData(tabName);
  }

  async loadInitialData() {
    await Promise.all([
      this.loadOverview(),
      this.loadInventory(),
      this.loadAlertsBadge(),
      this.loadNotificationsBadge(),
    ]);
  }

  async loadTabData(tabName) {
    switch (tabName) {
      case "overview":
        await this.loadOverview();
        break;
      case "inventory":
        await this.loadInventory();
        break;
      case "ai-freshness":
        this.populateScanItemDropdown();
        break;
      case "expiry-tracking":
        await this.loadExpiryTracking();
        break;
      case "shelf-life":
        await this.loadShelfLifeMonitoring();
        break;
      case "alerts":
        await this.loadAlerts();
        break;
      case "storage":
        await this.loadStorageMonitoring();
        break;
      case "quality":
        await this.loadQualityTracking();
        break;
      case "waste-reduction":
        await this.loadWasteReduction();
        break;
      case "analytics":
        await this.loadAnalytics();
        break;
      case "reports":
        await this.loadReports();
        break;
      case "notifications":
        await this.loadNotifications();
        break;
    }
  }

  // ============================================================================
  // 1. OVERVIEW
  // ============================================================================
  async loadOverview() {
    try {
      const data = await api.getRetailerDashboard();
      if (!data) return;

      const kpis = data.kpis || {};
      const totalProds = kpis.total_products !== undefined ? kpis.total_products : (kpis.total_inventory_items || 0);
      const freshProds = kpis.fresh_products !== undefined ? kpis.fresh_products : (kpis.fresh_count || 0);
      const atRiskProds = kpis.at_risk_products !== undefined ? kpis.at_risk_products : (kpis.at_risk_count || kpis.moderate_count || 0);
      const spoiledProds = kpis.spoiled_products !== undefined ? kpis.spoiled_products : (kpis.spoiled_count || 0);
      const nearingExpiry = kpis.products_nearing_expiry !== undefined ? kpis.products_nearing_expiry : (kpis.approaching_expiry_count || 0);
      const foodWaste = kpis.total_food_waste !== undefined ? kpis.total_food_waste : 0.0;
      const foodWasteItems = kpis.total_food_waste_items !== undefined ? kpis.total_food_waste_items : 0;

      const updateCard = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      updateCard("kpi-total-products", totalProds);
      updateCard("kpi-total-items", totalProds);
      updateCard("kpi-total-qty", `${kpis.total_stock_quantity || 0} units in stock`);
      updateCard("kpi-fresh-products", freshProds);
      updateCard("kpi-at-risk-products", atRiskProds);
      updateCard("kpi-spoiled-products", spoiledProds);
      updateCard("kpi-nearing-expiry", nearingExpiry);
      updateCard("kpi-expiring-soon", nearingExpiry);
      updateCard("kpi-food-waste", `${foodWaste} units`);
      updateCard("kpi-food-waste-sub", `${foodWasteItems} items spoiled / expired`);

      // Priority Action Items Table
      this.renderPriorityTable(data.priority_items || []);

      // Recent Inventory Activity Table
      this.renderRecentInventoryTable(data.recent_inventory || []);

      // Recent Freshness Scans Table
      this.renderRecentScans(data.recent_scans || []);

      // Recent Alerts Table
      this.renderRecentAlerts(data.active_alerts || []);

      // Charts Preview
      this.renderOverviewCharts(data.charts || {});
    } catch (err) {
      showToast("Error loading retailer dashboard overview: " + err.message, "error");
    }
  }

  renderRecentScans(scans) {
    const tbody = document.getElementById("overview-recent-scans-body");
    if (!tbody) return;

    if (!scans || scans.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">No recent scans recorded yet. Click 'Scan Food Sample' to run an inspection.</td></tr>`;
      return;
    }

    tbody.innerHTML = scans.slice(0, 5).map(s => {
      const score = s.freshness_score !== null && s.freshness_score !== undefined ? `${Math.round(s.freshness_score)}%` : "--";
      const label = s.freshness_label || "Fresh";
      let badgeClass = "badge-safe";
      if (label === "Spoiled") badgeClass = "badge-urgent";
      else if (label.includes("Moderate") || label.includes("Risk")) badgeClass = "badge-clearance";

      const conf = s.confidence ? `${Math.round(s.confidence * 100)}%` : "95%";
      const imgHtml = s.image_url ? `<img src="${escapeHtml(s.image_url)}" class="scan-thumb" alt="Specimen">` : `<span style="font-size:24px;">🍏</span>`;

      return `
        <tr>
          <td>${imgHtml}</td>
          <td><strong>${escapeHtml(s.food_name)}</strong><br><small style="color:var(--text-muted);">${escapeHtml(s.category)}</small></td>
          <td><span class="badge ${badgeClass}">${escapeHtml(label)}</span></td>
          <td><strong>${score}</strong></td>
          <td>${conf}</td>
          <td><small style="color:var(--text-muted);">${escapeHtml(s.analysis_date || '--')}</small></td>
        </tr>
      `;
    }).join("");
  }

  renderRecentAlerts(alerts) {
    const tbody = document.getElementById("overview-recent-alerts-body");
    if (!tbody) return;

    if (!alerts || alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">✅ No active alerts. Storage and shelf-life conditions optimal.</td></tr>`;
      return;
    }

    tbody.innerHTML = alerts.slice(0, 5).map(a => {
      let sevBadge = "badge-safe";
      if (a.severity === "Critical") sevBadge = "badge-urgent";
      else if (a.severity === "Warning") sevBadge = "badge-clearance";

      return `
        <tr>
          <td><span class="badge ${sevBadge}">${escapeHtml(a.severity || 'Info')}</span></td>
          <td><strong>${escapeHtml(a.product_name)}</strong></td>
          <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(a.reason)}</td>
          <td style="font-size:12px;color:#0369a1;font-weight:600;">${escapeHtml(a.action || 'Inspect')}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="retailerApp.openAlertModal('${a.id}', '${escapeHtml(a.product_name)}')">Review</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  renderPriorityTable(items) {
    const tbody = document.getElementById("overview-priority-table-body");
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">✅ All inventory items are in optimal condition. No urgent actions needed.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map((item) => {
      const days = item.days_to_expiry;
      let badgeClass = "badge-safe";
      if (days !== null && days <= 0) badgeClass = "badge-urgent";
      else if (days !== null && days <= 3) badgeClass = "badge-clearance";

      return `
        <tr>
          <td><strong>${escapeHtml(item.food_name)}</strong></td>
          <td><span class="badge" style="background:#f1f5f9;color:#475569;">${escapeHtml(item.category)}</span></td>
          <td>${item.quantity} ${escapeHtml(item.unit)}</td>
          <td>${escapeHtml(item.expiry_date)}</td>
          <td><span class="badge ${badgeClass}">${days !== null ? (days < 0 ? `${Math.abs(days)}d Overdue` : `${days}d left`) : '--'}</span></td>
          <td><span class="badge ${item.priority === 'Immediate Removal' ? 'badge-urgent' : 'badge-clearance'}">${escapeHtml(item.priority || 'Action Required')}</span></td>
          <td style="font-size:12px;color:#0369a1;font-weight:600;">${escapeHtml(item.markdown || item.action_desc || 'Inspect stock')}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="retailerApp.openStockModal('${item.id}', '${escapeHtml(item.food_name)}', ${item.quantity})">Adjust Stock</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  renderRecentInventoryTable(items) {
    const tbody = document.getElementById("overview-recent-table-body");
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">No products registered yet. Click 'Add Product' to start.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.slice(0, 6).map((item) => {
      const freshness = item.freshness_status || "Not Analyzed";
      let fBadge = "badge-safe";
      if (freshness === "Spoiled") fBadge = "badge-urgent";
      else if (freshness.includes("Moderate")) fBadge = "badge-clearance";

      return `
        <tr>
          <td><strong>${escapeHtml(item.food_name)}</strong></td>
          <td>${escapeHtml(item.category)}</td>
          <td>${item.quantity} ${escapeHtml(item.unit)}</td>
          <td>${escapeHtml(item.expiry_date)}</td>
          <td><span class="badge ${fBadge}">${escapeHtml(freshness)}</span></td>
          <td><strong>${item.freshness_score !== null ? item.freshness_score + '%' : '--'}</strong></td>
          <td>${item.shelf_life_days !== null ? item.shelf_life_days + 'd' : '--'}</td>
          <td>${escapeHtml(item.location || 'Main Display')}</td>
          <td>
            <div class="action-btn-group">
              <button class="btn btn-secondary btn-sm" title="View Details" onclick="retailerApp.openDetailsModal('${item.id}')">👁️</button>
              <button class="btn btn-secondary btn-sm" title="AI Inspection" onclick="retailerApp.openScanForItem('${item.id}')">🔬</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  renderOverviewCharts(charts) {
    // 1. Freshness Chart
    const fCtx = document.getElementById("overviewFreshnessChart");
    if (fCtx && charts.freshness_distribution) {
      if (this.charts.overviewFreshness) this.charts.overviewFreshness.destroy();
      this.charts.overviewFreshness = new Chart(fCtx, {
        type: "doughnut",
        data: {
          labels: charts.freshness_distribution.labels || ["Fresh", "Moderate", "Spoiled", "Pending"],
          datasets: [{
            data: charts.freshness_distribution.data || [0, 0, 0, 0],
            backgroundColor: ["#10b981", "#f59e0b", "#ef4444", "#94a3b8"],
            borderWidth: 2,
            borderColor: "#ffffff",
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "right" } }
        }
      });
    }

    // 2. Category Chart
    const cCtx = document.getElementById("overviewCategoryChart");
    if (cCtx && charts.category_breakdown) {
      if (this.charts.overviewCategory) this.charts.overviewCategory.destroy();
      this.charts.overviewCategory = new Chart(cCtx, {
        type: "bar",
        data: {
          labels: charts.category_breakdown.categories || [],
          datasets: [{
            label: "Product Quantity",
            data: charts.category_breakdown.quantities || [],
            backgroundColor: "#0ea5e9",
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }
  }

  // ============================================================================
  // 2. INVENTORY & STOCK
  // ============================================================================
  async loadInventory() {
    try {
      const search = document.getElementById("inv-filter-search")?.value || "";
      const category = document.getElementById("inv-filter-category")?.value || "all";
      const freshness = document.getElementById("inv-filter-freshness")?.value || "all";
      const expiry = document.getElementById("inv-filter-expiry")?.value || "all";
      const lowStock = document.getElementById("inv-filter-lowstock")?.checked || false;
      const isArchived = document.getElementById("inv-filter-archived")?.checked || false;
      const sortBy = document.getElementById("inv-sort-by")?.value || "expiry_date";
      const sortOrder = document.getElementById("inv-sort-order")?.value || "asc";

      const tbody = document.getElementById("inventory-full-table-body");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:28px;color:var(--text-muted);"><span class="spinner" style="display:inline-block;width:16px;height:16px;border:2px solid #0284c7;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:8px;vertical-align:middle;"></span> Loading inventory records...</td></tr>`;
      }

      const params = {
        search,
        category,
        freshness_status: freshness,
        expiry_status: expiry,
        low_stock_only: lowStock,
        is_archived: isArchived,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      const items = await api.getRetailerInventory(params);
      this.cachedInventory = items || [];
      this.renderFullInventoryTable(this.cachedInventory);
    } catch (err) {
      showToast("Error loading retailer inventory: " + err.message, "error");
    }
  }

  renderFullInventoryTable(items) {
    const tbody = document.getElementById("inventory-full-table-body");
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center;padding:48px 20px;color:var(--text-muted);">
            <div style="font-size:36px;margin-bottom:8px;">📦</div>
            <div style="font-size:16px;font-weight:700;color:var(--text-main);margin-bottom:6px;">No inventory products match criteria</div>
            <div style="font-size:13px;margin-bottom:16px;">Try adjusting your filters, search term, or enroll new food items.</div>
            <button class="btn btn-primary btn-sm" onclick="retailerApp.switchTab('add-product')">➕ Add New Food Product</button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map((item) => {
      const days = item.days_to_expiry;
      let expBadge = "badge-safe";
      if (days !== null && days < 0) expBadge = "badge-urgent";
      else if (days !== null && days <= 3) expBadge = "badge-clearance";

      const freshness = item.freshness_status || "Not Analyzed";
      let fBadge = "badge-safe";
      if (freshness === "Spoiled") fBadge = "badge-urgent";
      else if (freshness.includes("Moderate") || freshness.includes("Risk")) fBadge = "badge-clearance";

      const thumbHtml = item.image_url 
        ? `<img src="${escapeHtml(item.image_url)}" class="product-thumb-sm" alt="Product" onerror="this.onerror=null;this.parentElement.innerHTML='🍎';">` 
        : `<span style="font-size:22px;display:inline-block;width:38px;text-align:center;">🍎</span>`;

      return `
        <tr style="${item.is_archived ? 'opacity:0.65;background:#f8fafc;' : ''}">
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              ${thumbHtml}
              <div>
                <strong>${escapeHtml(item.food_name)}</strong>
                ${item.is_low_stock ? `<span class="badge badge-urgent" style="font-size:10px;margin-left:4px;">Low Stock</span>` : ''}
                ${item.is_archived ? `<span class="badge" style="background:#cbd5e1;font-size:10px;margin-left:4px;">Archived</span>` : ''}
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">ID: <code>${escapeHtml(item.id.slice(-6))}</code></div>
              </div>
            </div>
          </td>
          <td><span class="badge" style="background:#f1f5f9;color:#475569;">${escapeHtml(item.category)}</span></td>
          <td><strong>${item.quantity}</strong> ${escapeHtml(item.unit)}</td>
          <td>${escapeHtml(item.expiry_date)}</td>
          <td><span class="badge ${expBadge}">${days !== null ? (days < 0 ? `${Math.abs(days)}d Overdue` : `${days}d left`) : '--'}</span></td>
          <td><span class="badge ${fBadge}">${escapeHtml(freshness)}</span></td>
          <td><strong>${item.freshness_score !== null && item.freshness_score !== undefined ? Math.round(item.freshness_score) + '%' : '--'}</strong></td>
          <td>${item.shelf_life_days !== null && item.shelf_life_days !== undefined ? item.shelf_life_days + 'd' : '--'}</td>
          <td><small>${escapeHtml(item.location || 'Display')}</small></td>
          <td>
            <div class="action-btn-group">
              <button class="btn btn-secondary btn-sm" title="View Full Details" onclick="retailerApp.openDetailsModal('${item.id}')">👁️ View</button>
              <button class="btn btn-secondary btn-sm" title="Edit Product" onclick="retailerApp.openEditModal('${item.id}')">✏️ Edit</button>
              <button class="btn btn-secondary btn-sm" title="Adjust Stock" onclick="retailerApp.openStockModal('${item.id}', '${escapeHtml(item.food_name)}', ${item.quantity})">⚖️ Stock</button>
              <button class="btn btn-secondary btn-sm" title="AI Inspection" onclick="retailerApp.openScanForItem('${item.id}')">🔬 Scan</button>
              <button class="btn btn-secondary btn-sm" title="${item.is_archived ? 'Restore' : 'Archive'}" onclick="retailerApp.toggleArchive('${item.id}', ${item.is_archived})">
                ${item.is_archived ? '🔄 Unarchive' : '📦 Archive'}
              </button>
              <button class="btn btn-danger btn-sm" title="Delete" onclick="retailerApp.confirmDelete('${item.id}', '${escapeHtml(item.food_name)}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  // View Product Details Modal
  async openDetailsModal(itemId) {
    this.selectedDetailsItemId = itemId;
    let item = this.cachedInventory.find(i => i.id === itemId);
    
    try {
      const fetched = await api.getRetailerProduct(itemId);
      if (fetched) item = fetched;
    } catch (e) {
      // Use cached if fetch fails
    }

    if (!item) {
      showToast("Could not find product details.", "error");
      return;
    }

    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setText("details-modal-title", item.food_name || "Food Product");
    setText("details-modal-category", item.category || "General");
    setText("details-modal-id-badge", `ID: ${item.id}`);

    const imgEl = document.getElementById("details-modal-image");
    if (imgEl) {
      if (item.image_url) {
        imgEl.src = item.image_url;
        imgEl.style.display = "block";
      } else {
        imgEl.style.display = "none";
      }
    }

    setText("details-modal-qty", `${item.quantity} ${item.unit || 'units'}`);
    const scoreText = item.freshness_score !== null && item.freshness_score !== undefined ? `${Math.round(item.freshness_score)}%` : "--";
    setText("details-modal-freshness", `${scoreText} (${item.freshness_status || 'Not Analyzed'})`);

    const days = item.days_to_expiry;
    const expSub = days !== null && days !== undefined ? (days < 0 ? ` (${Math.abs(days)}d Overdue)` : ` (${days}d left)`) : "";
    setText("details-modal-expiry", `${item.expiry_date || '--'}${expSub}`);
    setText("details-modal-shelflife", item.shelf_life_days !== null && item.shelf_life_days !== undefined ? `${item.shelf_life_days} days` : "--");

    setText("details-modal-location", item.location || "Store Display");
    const tempStr = item.storage_temperature !== null && item.storage_temperature !== undefined ? `${item.storage_temperature}°C` : "N/A";
    const humStr = item.storage_humidity !== null && item.storage_humidity !== undefined ? `${item.storage_humidity}% RH` : "N/A";
    setText("details-modal-storage", `${item.storage_type || 'Standard'} (Temp: ${tempStr}, Humidity: ${humStr})`);
    setText("details-modal-batch", item.batch_number || "None / Untracked");
    setText("details-modal-purchase", item.purchase_date || "--");
    setText("details-modal-created", item.created_at ? new Date(item.created_at).toLocaleString() : "--");
    setText("details-modal-updated", item.updated_at ? new Date(item.updated_at).toLocaleString() : "--");

    // Stock Audit History
    const historyTbody = document.getElementById("details-modal-history-body");
    if (historyTbody) {
      const history = item.stock_history || [];
      if (history.length === 0) {
        historyTbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:12px;color:var(--text-muted);">No stock adjustments recorded.</td></tr>`;
      } else {
        historyTbody.innerHTML = history.slice().reverse().map(h => `
          <tr>
            <td>${h.timestamp ? new Date(h.timestamp).toLocaleString() : '--'}</td>
            <td><span class="badge" style="background:#e0f2fe;color:#0369a1;">${escapeHtml(h.adjustment_type || 'set')}</span></td>
            <td>${h.old_quantity ?? '--'}</td>
            <td><strong>${h.new_quantity ?? '--'}</strong></td>
            <td>${escapeHtml(h.reason || 'Inventory recount')}</td>
            <td><small>${escapeHtml(h.adjusted_by || 'Store Manager')}</small></td>
          </tr>
        `).join("");
      }
    }

    // Modal Action Buttons
    const editBtn = document.getElementById("btn-details-to-edit");
    if (editBtn) {
      editBtn.onclick = () => {
        this.closeModals();
        this.openEditModal(item.id);
      };
    }

    const stockBtn = document.getElementById("btn-details-to-stock");
    if (stockBtn) {
      stockBtn.onclick = () => {
        this.closeModals();
        this.openStockModal(item.id, item.food_name, item.quantity);
      };
    }

    const scanBtn = document.getElementById("btn-details-to-scan");
    if (scanBtn) {
      scanBtn.onclick = () => {
        this.closeModals();
        this.openScanForItem(item.id);
      };
    }

    document.getElementById("details-modal")?.classList.add("active");
  }

  // Edit Product Modal
  async openEditModal(itemId) {
    this.selectedEditItemId = itemId;
    let item = this.cachedInventory.find(i => i.id === itemId);

    try {
      const fetched = await api.getRetailerProduct(itemId);
      if (fetched) item = fetched;
    } catch (e) {}

    if (!item) {
      showToast("Could not load product for editing.", "error");
      return;
    }

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : "";
    };

    setVal("edit-item-id", item.id);
    setVal("edit-food-name", item.food_name);
    setVal("edit-category", item.category || "Fruits");
    setVal("edit-quantity", item.quantity);
    setVal("edit-unit", item.unit || "kg");
    setVal("edit-threshold", item.low_stock_threshold || 5);
    setVal("edit-purchase-date", item.purchase_date);
    setVal("edit-expiry-date", item.expiry_date);
    setVal("edit-storage-type", item.storage_type || "Refrigerated");
    setVal("edit-storage-temp", item.storage_temperature);
    setVal("edit-storage-humidity", item.storage_humidity);
    setVal("edit-location", item.location);
    setVal("edit-batch", item.batch_number);
    setVal("edit-image-url", item.image_url);

    document.getElementById("edit-modal")?.classList.add("active");
  }

  async handleEditSubmit(e) {
    e.preventDefault();
    const itemId = document.getElementById("edit-item-id")?.value || this.selectedEditItemId;
    if (!itemId) {
      showToast("Missing product identifier.", "error");
      return;
    }

    const submitBtn = document.getElementById("btn-submit-edit-product");
    setButtonLoading(submitBtn, true, "Save Changes");

    const foodName = document.getElementById("edit-food-name").value.trim();
    const category = document.getElementById("edit-category").value;
    const quantity = parseFloat(document.getElementById("edit-quantity").value);
    const unit = document.getElementById("edit-unit").value.trim();
    const threshold = parseFloat(document.getElementById("edit-threshold").value) || 5.0;
    const purchaseDate = document.getElementById("edit-purchase-date").value;
    const expiryDate = document.getElementById("edit-expiry-date").value;
    const storageType = document.getElementById("edit-storage-type").value;
    const tempVal = document.getElementById("edit-storage-temp").value;
    const storageTemp = tempVal !== "" ? parseFloat(tempVal) : null;
    const humVal = document.getElementById("edit-storage-humidity").value;
    const storageHumidity = humVal !== "" ? parseFloat(humVal) : null;
    const location = document.getElementById("edit-location").value.trim();
    const batchNumber = document.getElementById("edit-batch").value.trim();
    const imageUrl = document.getElementById("edit-image-url").value.trim() || null;

    if (!foodName) {
      showToast("Product name is required.", "error");
      setButtonLoading(submitBtn, false, "Save Changes");
      return;
    }

    if (isNaN(quantity) || quantity < 0) {
      showToast("Stock quantity must be a non-negative number.", "error");
      setButtonLoading(submitBtn, false, "Save Changes");
      return;
    }

    if (purchaseDate && expiryDate && expiryDate < purchaseDate) {
      showToast("Expiry date cannot be earlier than purchase date.", "error");
      setButtonLoading(submitBtn, false, "Save Changes");
      return;
    }

    try {
      await api.updateRetailerProduct(itemId, {
        food_name: foodName,
        category,
        quantity,
        unit,
        low_stock_threshold: threshold,
        purchase_date: purchaseDate,
        expiry_date: expiryDate,
        storage_type: storageType,
        storage_temperature: storageTemp,
        storage_humidity: storageHumidity,
        location,
        batch_number: batchNumber,
        image_url: imageUrl,
      });

      showToast(`Product '${foodName}' updated successfully!`, "success");
      this.closeModals();
      await this.loadInventory();
      await this.loadOverview();
    } catch (err) {
      showToast(err.message || "Failed to update product.", "error");
    } finally {
      setButtonLoading(submitBtn, false, "Save Changes");
    }
  }

  // Stock update modal
  openStockModal(itemId, foodName, currentQty) {
    this.selectedStockItemId = itemId;
    document.getElementById("stock-item-id").value = itemId;
    document.getElementById("stock-modal-subtitle").textContent = `Product: ${foodName} (Current: ${currentQty})`;
    document.getElementById("stock-adjust-amount").value = currentQty;
    document.getElementById("stock-adjust-type").value = "set";
    document.getElementById("stock-adjust-reason").value = "";
    document.getElementById("stock-modal").classList.add("active");
  }

  async handleStockSubmit(e) {
    e.preventDefault();
    const itemId = document.getElementById("stock-item-id").value;
    const type = document.getElementById("stock-adjust-type").value;
    const amount = parseFloat(document.getElementById("stock-adjust-amount").value);
    const reason = document.getElementById("stock-adjust-reason").value.trim();

    if (isNaN(amount) || amount < 0) {
      showToast("Please provide a valid non-negative quantity amount.", "error");
      return;
    }

    try {
      await api.updateRetailerStock(itemId, {
        quantity: amount,
        adjustment_type: type,
        reason: reason || "Retail store inventory recount"
      });
      showToast("Stock quantity updated successfully!", "success");
      this.closeModals();
      await this.loadInventory();
      await this.loadOverview();
    } catch (err) {
      showToast(err.message || "Failed to update stock.", "error");
    }
  }

  async toggleArchive(itemId, currentlyArchived) {
    const action = currentlyArchived ? "unarchive" : "archive";
    if (!confirm(`Are you sure you want to ${action} this product?`)) return;

    try {
      await api.archiveRetailerProduct(itemId, !currentlyArchived, `User toggled ${action}`);
      showToast(`Product successfully ${currentlyArchived ? 'restored' : 'archived'}!`, "success");
      await this.loadInventory();
      await this.loadOverview();
    } catch (err) {
      showToast("Archive error: " + err.message, "error");
    }
  }

  async confirmDelete(itemId, foodName) {
    if (!confirm(`Are you sure you want to permanently delete '${foodName}'? This action cannot be undone.`)) return;

    try {
      await api.deleteRetailerProduct(itemId);
      showToast(`Product '${foodName}' deleted permanently.`, "info");
      await this.loadInventory();
      await this.loadOverview();
    } catch (err) {
      showToast("Delete error: " + err.message, "error");
    }
  }

  // ============================================================================
  // 3. ADD PRODUCT
  // ============================================================================
  async handleAddProduct(e) {
    e.preventDefault();
    const submitBtn = document.getElementById("btn-submit-add-product");
    setButtonLoading(submitBtn, true, "Save Product");

    const foodName = document.getElementById("add-food-name").value.trim();
    const category = document.getElementById("add-category").value;
    const quantity = parseFloat(document.getElementById("add-quantity").value);
    const unit = document.getElementById("add-unit").value.trim();
    const threshold = parseFloat(document.getElementById("add-threshold").value) || 5.0;
    const purchaseDate = document.getElementById("add-purchase-date").value;
    const expiryDate = document.getElementById("add-expiry-date").value;
    const storageType = document.getElementById("add-storage-type").value;
    const tempVal = document.getElementById("add-storage-temp").value;
    const storageTemp = tempVal !== "" ? parseFloat(tempVal) : null;
    const humVal = document.getElementById("add-storage-humidity").value;
    const storageHumidity = humVal !== "" ? parseFloat(humVal) : null;
    const location = document.getElementById("add-location").value.trim();
    const batchNumber = document.getElementById("add-batch").value.trim();
    const imageUrl = document.getElementById("add-image-url").value || null;

    try {
      await api.createRetailerProduct({
        food_name: foodName,
        category,
        quantity,
        unit,
        purchase_date: purchaseDate,
        expiry_date: expiryDate,
        storage_type: storageType,
        storage_temperature: storageTemp,
        storage_humidity: storageHumidity,
        location,
        batch_number: batchNumber,
        image_url: imageUrl,
        low_stock_threshold: threshold
      });

      showToast(`Product '${foodName}' created successfully!`, "success");
      document.getElementById("retailer-add-form").reset();
      document.getElementById("add-image-preview-text").textContent = "";
      this.switchTab("inventory");
    } catch (err) {
      showToast(err.message || "Failed to create product.", "error");
    } finally {
      setButtonLoading(submitBtn, false, "Save Product");
    }
  }

  // ============================================================================
  // 4. AI FRESHNESS SCAN
  // ============================================================================
  populateScanItemDropdown() {
    const select = document.getElementById("scan-item-select");
    if (!select) return;

    select.innerHTML = `<option value="">-- Standalone Scan (New Food Item) --</option>` +
      this.cachedInventory.map(item => `
        <option value="${item.id}" ${this.selectedScanItemId === item.id ? 'selected' : ''}>
          ${escapeHtml(item.food_name)} (${escapeHtml(item.category)}) - Exp: ${item.expiry_date}
        </option>
      `).join("");

    this.handleScanItemSelectChange();
  }

  handleScanItemSelectChange() {
    const select = document.getElementById("scan-item-select");
    const standaloneFields = document.getElementById("standalone-scan-fields");
    if (select && standaloneFields) {
      if (select.value) {
        standaloneFields.style.display = "none";
      } else {
        standaloneFields.style.display = "grid";
      }
    }
  }

  openScanForItem(itemId) {
    this.selectedScanItemId = itemId;
    this.switchTab("ai-freshness");
    const select = document.getElementById("scan-item-select");
    if (select) {
      select.value = itemId;
      this.handleScanItemSelectChange();
    }
  }

  setScanInputMode(mode) {
    const btnUpload = document.getElementById("btn-upload-mode");
    const btnCamera = document.getElementById("btn-camera-mode");
    const uploadArea = document.getElementById("scan-upload-area");
    const cameraBox = document.getElementById("scanner-camera-box");

    if (mode === "camera") {
      if (btnUpload) btnUpload.className = "btn btn-secondary btn-sm";
      if (btnCamera) btnCamera.className = "btn btn-primary btn-sm";
      if (uploadArea) uploadArea.style.display = "none";
      if (cameraBox) cameraBox.style.display = "block";
      this.startCamera();
    } else {
      if (btnUpload) btnUpload.className = "btn btn-primary btn-sm";
      if (btnCamera) btnCamera.className = "btn btn-secondary btn-sm";
      if (cameraBox) cameraBox.style.display = "none";
      const previewContainer = document.getElementById("scan-image-preview-container");
      if (uploadArea && (!previewContainer || previewContainer.style.display === "none")) {
        uploadArea.style.display = "block";
      }
      this.stopCamera();
    }
  }

  async startCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        this.activeCameraStream = stream;
        const video = document.getElementById("scanner-video");
        if (video) {
          video.srcObject = stream;
          video.play();
        }
      } catch (err) {
        showToast("Webcam access denied or unavailable: " + err.message, "error");
        this.setScanInputMode("upload");
      }
    } else {
      showToast("Camera capture is not supported by your browser.", "error");
      this.setScanInputMode("upload");
    }
  }

  stopCamera() {
    if (this.activeCameraStream) {
      this.activeCameraStream.getTracks().forEach(track => track.stop());
      this.activeCameraStream = null;
    }
    const video = document.getElementById("scanner-video");
    if (video) video.srcObject = null;
    const box = document.getElementById("scanner-camera-box");
    if (box) box.style.display = "none";
  }

  captureCameraPhoto() {
    const video = document.getElementById("scanner-video");
    const canvas = document.getElementById("scanner-canvas");
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `scan_capture_${Date.now()}.jpg`, { type: "image/jpeg" });
      this.selectedScanFile = file;
      this.displayScanImagePreview(URL.createObjectURL(blob));
      this.stopCamera();
      const btnUpload = document.getElementById("btn-upload-mode");
      const btnCamera = document.getElementById("btn-camera-mode");
      if (btnUpload) btnUpload.className = "btn btn-primary btn-sm";
      if (btnCamera) btnCamera.className = "btn btn-secondary btn-sm";
      showToast("Camera frame captured successfully!", "success");
    }, "image/jpeg", 0.92);
  }

  displayScanImagePreview(src) {
    const container = document.getElementById("scan-image-preview-container");
    const img = document.getElementById("scan-preview-img");
    const uploadArea = document.getElementById("scan-upload-area");
    if (container && img) {
      img.src = src;
      container.style.display = "block";
    }
    if (uploadArea) {
      uploadArea.style.display = "none";
    }
  }

  triggerReplaceScanImage() {
    this.removeScanImage();
    const fileInput = document.getElementById("scan-image-file");
    if (fileInput) fileInput.click();
  }

  removeScanImage() {
    this.selectedScanFile = null;
    const fileInput = document.getElementById("scan-image-file");
    if (fileInput) fileInput.value = "";
    const container = document.getElementById("scan-image-preview-container");
    if (container) container.style.display = "none";
    const uploadArea = document.getElementById("scan-upload-area");
    if (uploadArea) uploadArea.style.display = "block";
  }

  async handleRunAiScan() {
    const select = document.getElementById("scan-item-select");
    const itemId = select?.value;

    const btn = document.getElementById("btn-run-ai-scan");
    setButtonLoading(btn, true, "⚡ Analyzing Image & Degradation...");

    try {
      let scanResult = null;

      if (itemId) {
        // Associated scan on existing product
        let uploadedUrl = null;
        if (this.selectedScanFile) {
          const formData = new FormData();
          formData.append("file", this.selectedScanFile);
          const uploadRes = await api.request("/inventory/upload-image", {
            method: "POST",
            body: formData,
          });
          uploadedUrl = uploadRes.image_url;
        }

        const res = await api.analyzeRetailerProduct(itemId, uploadedUrl);
        scanResult = {
          ...res,
          food_name: res.product?.food_name || "Food Product",
          category: res.product?.category || "General",
          image_url: uploadedUrl || res.product?.image_url,
        };
      } else {
        // Standalone food scan
        const foodName = document.getElementById("scan-food-name")?.value.trim() || "Food Specimen";
        const category = document.getElementById("scan-category")?.value || "Fruits";

        if (!this.selectedScanFile) {
          showToast("Please attach or capture an inspection photo to run AI diagnostic.", "error");
          setButtonLoading(btn, false, "⚡ Run AI Freshness Analysis");
          return;
        }

        const formData = new FormData();
        formData.append("file", this.selectedScanFile);
        formData.append("food_name", foodName);
        formData.append("category", category);

        const res = await api.quickScanFood(formData);
        scanResult = {
          ...res,
          food_name: foodName,
          category: category,
          image_url: res.image_url || res.image_reference,
        };
      }

      this.lastScanResult = scanResult;
      this.renderScanResults(scanResult);
      showToast("AI Freshness Inspection completed successfully!", "success");

      // Refresh overview and inventory counts in the background
      await this.loadInventory();
      await this.loadOverview();
    } catch (err) {
      showToast("AI Inspection Error: " + err.message, "error");
    } finally {
      setButtonLoading(btn, false, "⚡ Run AI Freshness Analysis");
    }
  }

  renderScanResults(data) {
    const card = document.getElementById("ai-scan-results-card");
    if (!card) return;

    card.style.display = "block";
    const analysis = data.analysis || {};
    const shelfLife = data.shelf_life_prediction || {};
    const recs = data.prescriptive_recommendations || {};

    const score = data.freshness_score !== undefined ? data.freshness_score : (analysis.visual_score !== undefined ? analysis.visual_score : 85.0);
    const label = data.freshness_label || analysis.freshness_label || "Fresh";
    const confVal = data.confidence_score !== undefined ? data.confidence_score : (data.confidence !== undefined ? data.confidence : (analysis.confidence_score !== undefined ? analysis.confidence_score : 0.95));
    const browning = data.browning_index !== undefined ? data.browning_index : (analysis.browning_index !== undefined ? analysis.browning_index : 5.0);
    const texture = data.roughness_index !== undefined ? data.roughness_index : (analysis.roughness_index !== undefined ? analysis.roughness_index : 20.0);
    const isMold = data.mold_detected || analysis.mold_detected;
    const mold = isMold ? "Detected (Rot Alert)" : "None";
    const rsl = data.estimated_shelf_life_days !== undefined ? `${data.estimated_shelf_life_days} days` : (shelfLife.predicted_remaining_days !== undefined ? `${shelfLife.predicted_remaining_days} days` : "7.0 days");

    // Timestamp
    const tsEl = document.getElementById("scan-res-timestamp");
    if (tsEl) tsEl.textContent = new Date().toLocaleTimeString();

    // Score & Badge
    const scoreEl = document.getElementById("scan-res-score");
    if (scoreEl) {
      scoreEl.textContent = `${Math.round(score)}%`;
      scoreEl.style.color = score >= 75 ? "#166534" : (score >= 50 ? "#b45309" : "#991b1b");
    }

    const badge = document.getElementById("scan-res-badge");
    if (badge) {
      badge.textContent = label;
      badge.className = `badge ${label === 'Spoiled' ? 'badge-urgent' : (label.includes('Moderate') || label.includes('Risk') ? 'badge-clearance' : 'badge-safe')}`;
    }

    // Confidence
    const confEl = document.getElementById("scan-res-confidence");
    if (confEl) {
      confEl.textContent = `Confidence: ${Math.round(confVal * 100)}%`;
    }

    // Specimen image
    const imgEl = document.getElementById("scan-res-image");
    const specimenImg = data.image_url || data.image_reference || data.product?.image_url;
    if (imgEl) {
      if (specimenImg) {
        imgEl.src = specimenImg;
        imgEl.style.display = "block";
      } else {
        imgEl.style.display = "none";
      }
    }

    // Degradation indicators
    const brownEl = document.getElementById("scan-res-browning");
    if (brownEl) brownEl.textContent = `${browning}`;

    const textEl = document.getElementById("scan-res-texture");
    if (textEl) textEl.textContent = `${texture}`;

    const moldEl = document.getElementById("scan-res-mold");
    if (moldEl) {
      moldEl.textContent = mold;
      moldEl.style.color = isMold ? "#dc2626" : "var(--text-main)";
    }

    const slEl = document.getElementById("scan-res-shelflife");
    if (slEl) slEl.textContent = rsl;

    // Prescriptive Recommendations list
    const recList = document.getElementById("scan-res-recommendations");
    if (recList) {
      const allRecs = [
        ...(recs.rotation_recommendations || []),
        ...(recs.storage_recommendations || []),
        ...(recs.waste_reduction_recommendations || [])
      ];

      if (allRecs.length > 0) {
        recList.innerHTML = allRecs.map(r => `<li>${escapeHtml(r)}</li>`).join("");
      } else if (label === "Spoiled" || isMold) {
        recList.innerHTML = `
          <li style="color:#dc2626;font-weight:700;">Immediate stock write-off: Remove item from customer-facing shelves.</li>
          <li>Sanitize shelf area to eliminate microbial contamination risks.</li>
          <li>Log item in store waste registry under spoilage losses.</li>
        `;
      } else if (label.includes("Moderate") || label.includes("Risk") || score < 70) {
        recList.innerHTML = `
          <li style="color:#d97706;font-weight:700;">Initiate dynamic 30%–50% FEFO discount markdown today.</li>
          <li>Relocate to high-visibility front endcap for rapid retail throughput.</li>
          <li>Maintain display chiller between 2°C and 4°C to decelerate kinetic breakdown.</li>
        `;
      } else {
        recList.innerHTML = `
          <li>Optimal retail freshness condition verified.</li>
          <li>Adhere to First-Expired, First-Out (FEFO) store merchandising rotation.</li>
          <li>Maintain category-standard temperature and humidity controls.</li>
        `;
      }
    }

    // Scroll smoothly to results card
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  prefillIntakeFromScan() {
    if (!this.lastScanResult) {
      showToast("No active scan findings available.", "info");
      return;
    }

    const res = this.lastScanResult;
    this.switchTab("add-product");

    const nameInput = document.getElementById("add-food-name");
    if (nameInput && res.food_name) nameInput.value = res.food_name;

    const catSelect = document.getElementById("add-category");
    if (catSelect && res.category) catSelect.value = res.category;

    const imgUrl = res.image_url || res.image_reference;
    if (imgUrl) {
      const urlInput = document.getElementById("add-image-url");
      if (urlInput) urlInput.value = imgUrl;
      const previewTxt = document.getElementById("add-image-preview-text");
      if (previewTxt) previewTxt.textContent = "✓ Scanned inspection photo attached";
    }

    showToast("Scanned specimen details prefilled into product intake form.", "success");
  }

  resetScanner() {
    this.removeScanImage();
    this.stopCamera();
    this.lastScanResult = null;
    const nameEl = document.getElementById("scan-food-name");
    if (nameEl) nameEl.value = "";
    const select = document.getElementById("scan-item-select");
    if (select) {
      select.value = "";
      this.handleScanItemSelectChange();
    }
    const card = document.getElementById("ai-scan-results-card");
    if (card) card.style.display = "none";
  }

  // ============================================================================
  // 5. EXPIRY TRACKING
  // ============================================================================
  async loadExpiryTracking() {
    try {
      const data = await api.getRetailerExpiry(7);
      if (!data) return;

      const summary = data.summary || {};
      document.getElementById("exp-count-expired").textContent = summary.expired_count || 0;
      document.getElementById("exp-count-urgent").textContent = (data.approaching_expiry || []).filter(i => i.days_to_expiry <= 3).length;
      document.getElementById("exp-count-approaching").textContent = (data.approaching_expiry || []).filter(i => i.days_to_expiry > 3).length;
      document.getElementById("exp-count-safe").textContent = summary.safe_count || 0;

      const allItems = [...(data.expired || []), ...(data.approaching_expiry || []), ...(data.safe || [])];
      this.renderExpiryTable(allItems);
    } catch (err) {
      showToast("Error loading expiry tracking: " + err.message, "error");
    }
  }

  renderExpiryTable(items) {
    const tbody = document.getElementById("expiry-table-body");
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">No tracked expiry items found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map((item) => {
      const days = item.days_to_expiry;
      let badgeClass = "badge-safe";
      if (days !== null && days < 0) badgeClass = "badge-urgent";
      else if (days !== null && days <= 3) badgeClass = "badge-clearance";

      return `
        <tr>
          <td><strong>${escapeHtml(item.food_name)}</strong></td>
          <td>${escapeHtml(item.category)}</td>
          <td>${item.quantity} ${escapeHtml(item.unit)}</td>
          <td>${escapeHtml(item.recorded_expiry_date || item.expiry_date)}</td>
          <td><span class="badge ${badgeClass}">${days !== null ? (days < 0 ? `${Math.abs(days)}d Overdue` : `${days}d left`) : '--'}</span></td>
          <td>${item.expiry_category || (days < 0 ? 'Expired' : (days <= 3 ? 'Approaching' : 'Safe'))}</td>
          <td><strong>${item.predicted_remaining_shelf_life !== null && item.predicted_remaining_shelf_life !== undefined ? item.predicted_remaining_shelf_life + 'd' : '--'}</strong></td>
          <td><span class="badge ${days <= 3 ? 'badge-urgent' : 'badge-clearance'}">${escapeHtml(item.action_priority || 'Standard')}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="retailerApp.openStockModal('${item.id}', '${escapeHtml(item.food_name)}', ${item.quantity})">Adjust</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ============================================================================
  // 6. SHELF-LIFE MONITORING
  // ============================================================================
  async loadShelfLifeMonitoring() {
    try {
      const records = await api.getRetailerShelfLife();
      const tbody = document.getElementById("shelf-life-table-body");
      if (!tbody) return;

      if (!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">No shelf life records found.</td></tr>`;
        return;
      }

      tbody.innerHTML = records.map((item) => {
        const isCritical = item.warning_status && item.warning_status.includes("Critical");
        return `
          <tr>
            <td><strong>${escapeHtml(item.food_name)}</strong></td>
            <td>${escapeHtml(item.category)}</td>
            <td>${escapeHtml(item.recorded_expiry_date)}</td>
            <td>${item.days_to_expiry !== null ? item.days_to_expiry + 'd' : '--'}</td>
            <td><strong style="color:#0369a1;">${item.predicted_shelf_life_days !== null ? item.predicted_shelf_life_days + 'd' : '--'}</strong></td>
            <td>${item.storage_temperature !== null ? item.storage_temperature + '°C' : 'N/A'}</td>
            <td>${item.recommended_temperature !== null ? item.recommended_temperature + '°C' : 'N/A'}</td>
            <td>${item.freshness_score !== null ? item.freshness_score + '%' : '--'}</td>
            <td><span class="badge ${isCritical ? 'badge-urgent' : 'badge-clearance'}">${escapeHtml(item.warning_status)}</span></td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      showToast("Error loading shelf life records: " + err.message, "error");
    }
  }

  // ============================================================================
  // 7. SPOILAGE ALERTS
  // ============================================================================
  async loadAlerts() {
    try {
      const statusFilter = document.getElementById("alert-filter-status")?.value || "Active";
      const alerts = await api.getRetailerAlerts(statusFilter);
      const tbody = document.getElementById("alerts-table-body");
      if (!tbody) return;

      if (!alerts || alerts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted);">No active spoilage or storage alerts found. Store conditions are safe!</td></tr>`;
        return;
      }

      tbody.innerHTML = alerts.map((a) => {
        const isCrit = a.severity === "Critical";
        return `
          <tr>
            <td><span class="badge ${isCrit ? 'badge-urgent' : 'badge-clearance'}">${escapeHtml(a.severity)}</span></td>
            <td><strong>${escapeHtml(a.type)}</strong></td>
            <td>${escapeHtml(a.product_name)}</td>
            <td style="max-width:260px;font-size:12px;">${escapeHtml(a.reason)}</td>
            <td style="font-size:12px;color:#0369a1;font-weight:600;">${escapeHtml(a.action)}</td>
            <td><small>${new Date(a.timestamp).toLocaleString()}</small></td>
            <td><span class="badge" style="background:${a.status === 'Active' ? '#fecaca' : '#dcfce7'};color:${a.status === 'Active' ? '#991b1b' : '#166534'};">${escapeHtml(a.status)}</span></td>
            <td>
              ${a.status === 'Active' ? `<button class="btn btn-primary btn-sm" onclick="retailerApp.openAlertModal('${a.id}', '${escapeHtml(a.product_name)}')">Acknowledge</button>` : `<small style="color:#64748b;">Reviewed</small>`}
            </td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      showToast("Error loading alerts: " + err.message, "error");
    }
  }

  async loadAlertsBadge() {
    try {
      const alerts = await api.getRetailerAlerts("Active");
      const badge = document.getElementById("nav-alerts-badge");
      if (badge) {
        const count = (alerts || []).length;
        if (count > 0) {
          badge.textContent = count;
          badge.style.display = "inline-flex";
        } else {
          badge.style.display = "none";
        }
      }
    } catch (e) {}
  }

  openAlertModal(alertId, productName) {
    this.activeAlertId = alertId;
    document.getElementById("alert-item-id").value = alertId;
    document.getElementById("alert-modal-subtitle").textContent = `Alert on: ${productName}`;
    document.getElementById("alert-ack-note").value = "";
    document.getElementById("alert-modal").classList.add("active");
  }

  async handleAlertAckSubmit(e) {
    e.preventDefault();
    const alertId = document.getElementById("alert-item-id").value;
    const note = document.getElementById("alert-ack-note").value.trim();

    try {
      await api.acknowledgeRetailerAlert(alertId, note);
      showToast("Alert marked as acknowledged.", "success");
      this.closeModals();
      await this.loadAlerts();
      await this.loadAlertsBadge();
    } catch (err) {
      showToast("Failed to acknowledge alert: " + err.message, "error");
    }
  }

  // ============================================================================
  // 8. STORAGE MONITORING
  // ============================================================================
  async loadStorageMonitoring() {
    try {
      const records = await api.getRetailerStorage();
      const tbody = document.getElementById("storage-table-body");
      if (!tbody) return;

      if (!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">No storage records available.</td></tr>`;
        return;
      }

      tbody.innerHTML = records.map((item) => {
        const isComp = item.compliance_status === "Compliant";
        return `
          <tr>
            <td><strong>${escapeHtml(item.location || 'Main Display')}</strong></td>
            <td>${escapeHtml(item.food_name)}</td>
            <td>${escapeHtml(item.category)}</td>
            <td><strong>${item.current_temperature !== null ? item.current_temperature + '°C' : 'N/A'}</strong></td>
            <td>${escapeHtml(item.permitted_temperature_range)}</td>
            <td>${item.current_humidity !== null ? item.current_humidity + '%' : 'N/A'}</td>
            <td>${escapeHtml(item.recommended_humidity_range)}</td>
            <td><span class="badge ${isComp ? 'badge-safe' : 'badge-urgent'}">${escapeHtml(item.compliance_status)}</span></td>
            <td style="font-size:12px;color:${isComp ? '#166534' : '#b91c1c'};">${(item.violations || []).join("; ") || "Within safe thresholds"}</td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      showToast("Error loading storage monitoring: " + err.message, "error");
    }
  }

  // ============================================================================
  // 9. PRODUCT QUALITY
  // ============================================================================
  async loadQualityTracking() {
    try {
      const items = this.cachedInventory;
      const tbody = document.getElementById("quality-table-body");
      if (!tbody) return;

      if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">No products registered yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = items.map((item) => {
        const score = item.freshness_score;
        const status = item.freshness_status || "Not Analyzed";
        let fBadge = "badge-safe";
        if (status === "Spoiled") fBadge = "badge-urgent";
        else if (status.includes("Moderate")) fBadge = "badge-clearance";

        return `
          <tr>
            <td><strong>${escapeHtml(item.food_name)}</strong></td>
            <td>${escapeHtml(item.category)}</td>
            <td><strong style="color:${score >= 75 ? '#15803d' : (score >= 50 ? '#b45309' : '#b91c1c')};">${score !== null ? score + '%' : '--'}</strong></td>
            <td><span class="badge ${fBadge}">${escapeHtml(status)}</span></td>
            <td>${score !== null ? '94.5%' : '--'}</td>
            <td>${item.shelf_life_days !== null ? item.shelf_life_days + 'd' : '--'}</td>
            <td><small>${item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '--'}</small></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="retailerApp.openScanForItem('${item.id}')">🔬 Scan Again</button>
            </td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      showToast("Error loading quality tracking: " + err.message, "error");
    }
  }

  // ============================================================================
  // 10. WASTE REDUCTION & FEFO
  // ============================================================================
  async loadWasteReduction() {
    try {
      const data = await api.getRetailerWasteReduction();
      if (!data) return;

      const summary = data.summary || {};
      document.getElementById("waste-avoidance-rate").textContent = `${summary.potential_waste_avoidance_rate || 0}%`;
      document.getElementById("waste-at-risk-text").textContent = `${summary.total_quantity_at_risk || 0} units at risk (${summary.urgent_action_count || 0} urgent items)`;

      // Urgent Table
      const urgentTbody = document.getElementById("waste-urgent-table-body");
      if (urgentTbody) {
        const urgents = data.urgent_action || [];
        if (urgents.length === 0) {
          urgentTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">✅ No urgent spoilage risks detected.</td></tr>`;
        } else {
          urgentTbody.innerHTML = urgents.map(i => `
            <tr>
              <td><strong>${escapeHtml(i.food_name)}</strong></td>
              <td>${i.quantity} ${escapeHtml(i.unit)}</td>
              <td>${escapeHtml(i.expiry_date)}</td>
              <td><span class="badge badge-urgent">${i.days_to_expiry !== null ? i.days_to_expiry + 'd' : '--'}</span></td>
              <td><strong style="color:#dc2626;">${escapeHtml(i.markdown)}</strong></td>
              <td style="font-size:12px;">${escapeHtml(i.action_desc)}</td>
              <td><button class="btn btn-secondary btn-sm" onclick="retailerApp.openStockModal('${i.id}', '${escapeHtml(i.food_name)}', ${i.quantity})">Adjust</button></td>
            </tr>
          `).join("");
        }
      }

      // Clearance Table
      const clearTbody = document.getElementById("waste-clearance-table-body");
      if (clearTbody) {
        const clearances = data.critical_clearance || [];
        if (clearances.length === 0) {
          clearTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">No clearance items at this time.</td></tr>`;
        } else {
          clearTbody.innerHTML = clearances.map(i => `
            <tr>
              <td><strong>${escapeHtml(i.food_name)}</strong></td>
              <td>${i.quantity} ${escapeHtml(i.unit)}</td>
              <td>${escapeHtml(i.expiry_date)}</td>
              <td><span class="badge badge-clearance">${i.days_to_expiry !== null ? i.days_to_expiry + 'd' : '--'}</span></td>
              <td><strong style="color:#d97706;">${escapeHtml(i.markdown)}</strong></td>
              <td style="font-size:12px;">${escapeHtml(i.action_desc)}</td>
              <td><button class="btn btn-secondary btn-sm" onclick="retailerApp.openStockModal('${i.id}', '${escapeHtml(i.food_name)}', ${i.quantity})">Adjust</button></td>
            </tr>
          `).join("");
        }
      }
    } catch (err) {
      showToast("Error loading waste reduction: " + err.message, "error");
    }
  }

  // ============================================================================
  // 11. RETAIL ANALYTICS
  // ============================================================================
  async loadAnalytics() {
    try {
      const data = await api.getRetailerAnalytics();
      if (!data) return;

      const charts = data.charts || {};

      // Freshness Doughnut
      const fCtx = document.getElementById("retailFreshnessChart");
      if (fCtx && charts.freshness_distribution) {
        if (this.charts.retailFreshness) this.charts.retailFreshness.destroy();
        this.charts.retailFreshness = new Chart(fCtx, {
          type: "doughnut",
          data: {
            labels: charts.freshness_distribution.labels || [],
            datasets: [{
              data: charts.freshness_distribution.data || [],
              backgroundColor: ["#10b981", "#f59e0b", "#ef4444", "#94a3b8"],
              borderWidth: 2,
              borderColor: "#ffffff"
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

      // Category Bar
      const cCtx = document.getElementById("retailCategoryChart");
      if (cCtx && charts.category_breakdown) {
        if (this.charts.retailCategory) this.charts.retailCategory.destroy();
        this.charts.retailCategory = new Chart(cCtx, {
          type: "bar",
          data: {
            labels: charts.category_breakdown.categories || [],
            datasets: [{
              label: "Inventory Units",
              data: charts.category_breakdown.quantities || [],
              backgroundColor: "#3b82f6",
              borderRadius: 6
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

      // Expiry Horizons Bar
      const eCtx = document.getElementById("retailExpiryChart");
      if (eCtx && charts.expiry_horizons) {
        if (this.charts.retailExpiry) this.charts.retailExpiry.destroy();
        this.charts.retailExpiry = new Chart(eCtx, {
          type: "bar",
          data: {
            labels: charts.expiry_horizons.ranges || [],
            datasets: [{
              label: "Product Count",
              data: charts.expiry_horizons.counts || [],
              backgroundColor: ["#ef4444", "#f97316", "#eab308", "#10b981", "#06b6d4"],
              borderRadius: 6
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

      // Stock Levels
      const sCtx = document.getElementById("retailStockChart");
      if (sCtx && charts.stock_levels) {
        if (this.charts.retailStock) this.charts.retailStock.destroy();
        this.charts.retailStock = new Chart(sCtx, {
          type: "bar",
          data: {
            labels: charts.stock_levels.products || [],
            datasets: [
              {
                label: "Current Quantity",
                data: charts.stock_levels.quantities || [],
                backgroundColor: "#8b5cf6",
                borderRadius: 6
              },
              {
                label: "Low Stock Alert Threshold",
                data: charts.stock_levels.thresholds || [],
                backgroundColor: "#fca5a5",
                borderRadius: 4
              }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    } catch (err) {
      showToast("Error loading analytics: " + err.message, "error");
    }
  }

  // ============================================================================
  // 12. REPORTS & CSV EXPORT
  // ============================================================================
  async loadReports() {
    try {
      const cat = document.getElementById("report-filter-category")?.value || "all";
      const data = await api.getRetailerReports({ category: cat });
      const tbody = document.getElementById("reports-table-body");
      if (!tbody) return;

      const items = data.items || [];
      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">No reports records found.</td></tr>`;
        return;
      }

      tbody.innerHTML = items.map(item => `
        <tr>
          <td><code>${item.id.slice(-6)}</code></td>
          <td><strong>${escapeHtml(item.food_name)}</strong></td>
          <td>${escapeHtml(item.category)}</td>
          <td>${item.quantity} ${escapeHtml(item.unit)}</td>
          <td><small>${escapeHtml(item.batch_number || 'N/A')}</small></td>
          <td>${escapeHtml(item.expiry_date)}</td>
          <td>${item.days_to_expiry !== null ? item.days_to_expiry + 'd' : '--'}</td>
          <td><span class="badge badge-safe">${escapeHtml(item.freshness_status)}</span></td>
          <td>${item.freshness_score !== null ? item.freshness_score + '%' : '--'}</td>
        </tr>
      `).join("");
    } catch (err) {
      showToast("Error loading reports: " + err.message, "error");
    }
  }

  // ============================================================================
  // 13. NOTIFICATIONS
  // ============================================================================
  async loadNotifications() {
    try {
      const notifs = await api.getRetailerNotifications();
      const container = document.getElementById("notifications-list-container");
      if (!container) return;

      if (!notifs || notifs.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);">No notification messages at this time.</div>`;
        return;
      }

      container.innerHTML = notifs.map(n => {
        const isCrit = n.severity === "Critical";
        return `
          <div style="background:${n.is_read ? '#f8fafc' : '#ffffff'};border:1px solid ${n.is_read ? '#e2e8f0' : (isCrit ? '#fecaca' : '#fed7aa')};border-left:4px solid ${isCrit ? '#dc2626' : (n.severity === 'Warning' ? '#f59e0b' : '#3b82f6')};border-radius:var(--radius-md);padding:14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:700;font-size:14px;color:${isCrit ? '#991b1b' : 'var(--text-main)'};">${escapeHtml(n.title)}</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">${escapeHtml(n.message)}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${new Date(n.created_at).toLocaleString()}</div>
            </div>
            <div>
              ${!n.is_read ? `<button class="btn btn-secondary btn-sm" onclick="retailerApp.markNotifRead('${n.id}')">Mark Read</button>` : `<small style="color:#94a3b8;">Read</small>`}
            </div>
          </div>
        `;
      }).join("");
    } catch (err) {
      showToast("Error loading notifications: " + err.message, "error");
    }
  }

  async loadNotificationsBadge() {
    try {
      const notifs = await api.getRetailerNotifications();
      const unreadCount = (notifs || []).filter(n => !n.is_read).length;
      const badge = document.getElementById("nav-notif-badge");
      if (badge) {
        if (unreadCount > 0) {
          badge.textContent = unreadCount;
          badge.style.display = "inline-flex";
        } else {
          badge.style.display = "none";
        }
      }
    } catch (e) {}
  }

  async markNotifRead(notifId) {
    try {
      await api.markRetailerNotificationRead(notifId);
      await this.loadNotifications();
      await this.loadNotificationsBadge();
    } catch (e) {}
  }

  async markAllNotifsRead() {
    try {
      await api.markAllRetailerNotificationsRead();
      showToast("All notifications marked as read.", "info");
      await this.loadNotifications();
      await this.loadNotificationsBadge();
    } catch (e) {}
  }

  // ============================================================================
  // EVENT LISTENERS & MODALS
  // ============================================================================
  setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById("btn-refresh-retailer");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        showToast("Refreshing retailer store data...", "info");
        this.loadTabData(this.currentTab);
      });
    }

    // Quick add button in top header
    const quickAddBtn = document.getElementById("btn-quick-add");
    if (quickAddBtn) {
      quickAddBtn.addEventListener("click", () => {
        this.switchTab("add-product");
      });
    }

    // Add Product Form
    const addForm = document.getElementById("retailer-add-form");
    if (addForm) {
      addForm.addEventListener("submit", (e) => this.handleAddProduct(e));
    }

    // Add Product Image File Upload
    const addImgInput = document.getElementById("add-image-file");
    if (addImgInput) {
      addImgInput.addEventListener("change", async (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          document.getElementById("add-image-preview-text").textContent = `Selected: ${file.name} (Uploading...)`;
          try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await api.request("/inventory/upload-image", {
              method: "POST",
              body: formData,
            });
            document.getElementById("add-image-url").value = res.image_url;
            document.getElementById("add-image-preview-text").textContent = `✓ Uploaded: ${file.name}`;
            showToast("Product image uploaded successfully!", "success");
          } catch (err) {
            document.getElementById("add-image-preview-text").textContent = "Upload failed: " + err.message;
          }
        }
      });
    }

    // Edit Product Form
    const editForm = document.getElementById("retailer-edit-form");
    if (editForm) {
      editForm.addEventListener("submit", (e) => this.handleEditSubmit(e));
    }

    // Stock Adjust Form
    const stockForm = document.getElementById("stock-adjust-form");
    if (stockForm) {
      stockForm.addEventListener("submit", (e) => this.handleStockSubmit(e));
    }

    // Alert Ack Form
    const alertForm = document.getElementById("alert-ack-form");
    if (alertForm) {
      alertForm.addEventListener("submit", (e) => this.handleAlertAckSubmit(e));
    }

    // AI Scan Button
    const runScanBtn = document.getElementById("btn-run-ai-scan");
    if (runScanBtn) {
      runScanBtn.addEventListener("click", () => this.handleRunAiScan());
    }

    // Scan Image File Selection & Preview
    const scanFileInput = document.getElementById("scan-image-file");
    if (scanFileInput) {
      scanFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          this.selectedScanFile = file;
          this.displayScanImagePreview(URL.createObjectURL(file));
        }
      });
    }

    // Scan Area Drag-and-Drop
    const scanDropArea = document.getElementById("scan-upload-area");
    if (scanDropArea) {
      scanDropArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        scanDropArea.style.borderColor = "var(--primary)";
        scanDropArea.style.background = "#eff6ff";
      });
      scanDropArea.addEventListener("dragleave", (e) => {
        e.preventDefault();
        scanDropArea.style.borderColor = "var(--border-color)";
        scanDropArea.style.background = "";
      });
      scanDropArea.addEventListener("drop", (e) => {
        e.preventDefault();
        scanDropArea.style.borderColor = "var(--border-color)";
        scanDropArea.style.background = "";
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          this.selectedScanFile = file;
          this.displayScanImagePreview(URL.createObjectURL(file));
        }
      });
    }

    // Inventory Filters & Sorters
    [
      "inv-filter-search",
      "inv-filter-category",
      "inv-filter-freshness",
      "inv-filter-expiry",
      "inv-sort-by",
      "inv-sort-order",
      "inv-filter-lowstock",
      "inv-filter-archived"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => this.loadInventory());
        if (id === "inv-filter-search") {
          el.addEventListener("keyup", (e) => {
            if (e.key === "Enter" || el.value.length === 0) this.loadInventory();
          });
        }
      }
    });

    // Alert Filter
    const alertFilter = document.getElementById("alert-filter-status");
    if (alertFilter) {
      alertFilter.addEventListener("change", () => this.loadAlerts());
    }

    // Report Filter
    const reportFilter = document.getElementById("report-filter-category");
    if (reportFilter) {
      reportFilter.addEventListener("change", () => this.loadReports());
    }

    // CSV Export Button
    const exportBtn = document.getElementById("btn-export-retailer-csv");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const cat = document.getElementById("report-filter-category")?.value || "all";
        const url = `/api/retailer/reports/export-csv${cat !== 'all' ? '?category=' + cat : ''}`;
        const token = api.getToken();

        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.blob())
          .then(blob => {
            const a = document.createElement("a");
            a.href = window.URL.createObjectURL(blob);
            a.download = `retailer_inventory_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            showToast("CSV export initiated!", "success");
          })
          .catch(err => showToast("Export failed: " + err.message, "error"));
      });
    }

    // Mark All Read Button
    const markAllBtn = document.getElementById("btn-mark-all-read");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", () => this.markAllNotifsRead());
    }

    // Close modals on escape or click overlay
    window.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay")) {
        this.closeModals();
      }
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeModals();
    });
  }

  closeModals() {
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
  }
}

// Global Retailer App Instance
const retailerApp = new RetailerApp();
document.addEventListener("DOMContentLoaded", () => {
  retailerApp.init();
});
