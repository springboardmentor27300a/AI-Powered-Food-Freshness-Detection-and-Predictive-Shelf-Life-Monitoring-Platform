/**
 * Food Freshness Monitoring Platform - Warehouse Operator & Temperature Control Hub
 * Pure Vanilla JavaScript (Fetch API, Chart.js, Reactive DOM Rendering)
 */

class WarehouseApp {
  constructor() {
    this.currentSection = "overview";
    this.zones = [];
    this.selectedZoneId = "ZONE-COLD-B-DAIRY";
    this.selectedZone = null;
    this.historyChart = null;
    this.cachedInventory = [];
    this.alerts = [];
    this.auditLogs = [];
    this.reportsCharts = {
      freshness: null,
      category: null,
      zone: null,
      expiry: null,
    };
    this.reportsPage = 1;
    this.reportsPerPage = 25;
    this.reportsFiltered = [];
  }

  async init() {
    // 1. Enforce RBAC
    if (!api.enforceRoleAccess(["Warehouse Operator", "Warehouse Manager", "Supply Chain Operator"])) {
      return;
    }

    // 2. Setup user display
    const user = api.getUser();
    if (user) {
      const nameEl = document.getElementById("sidebar-user-name");
      const avatarEl = document.getElementById("sidebar-user-avatar");
      const roleBadge = document.getElementById("operator-role-pill");

      if (nameEl) nameEl.textContent = user.name || "Warehouse Operator";
      if (avatarEl) avatarEl.textContent = (user.name || "W").charAt(0).toUpperCase();
      if (roleBadge) roleBadge.textContent = user.role || "Warehouse Operator";
    }

    // 3. Setup event listeners
    this.setupNavigation();
    this.setupListeners();

    // 4. Initial live data load
    await this.refreshAllData();

    // 5. Handle initial hash if provided
    if (window.location.hash) {
      const target = window.location.hash.replace("#", "");
      if (document.getElementById(`panel-${target}`)) {
        this.switchSection(target);
      }
    }
  }

  setupNavigation() {
    // Section tab buttons
    document.querySelectorAll(".warehouse-nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const target = btn.dataset.target;
        this.switchSection(target);
      });
    });

    // Sidebar navigation links
    document.querySelectorAll(".warehouse-nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const target = link.dataset.target;
        this.switchSection(target);
      });
    });
  }

  setupListeners() {
    // Refresh button
    const refreshBtn = document.getElementById("btn-refresh-all");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = "🔄 Refreshing...";
        await this.refreshAllData();
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = "🔄 Refresh Sensors";
        if (typeof showToast === "function") showToast("Sensor telemetry refreshed from live database.", "info");
      });
    }

    // Zone selector in Temperature Control panel
    const zoneSelect = document.getElementById("control-zone-select");
    if (zoneSelect) {
      zoneSelect.addEventListener("change", (e) => {
        this.loadZoneForTemperatureControl(e.target.value);
      });
    }

    // Live validation on temperature input
    const tempInput = document.getElementById("input-target-temperature");
    if (tempInput) {
      tempInput.addEventListener("input", () => {
        this.checkInputBounds();
      });
    }

    // Inventory search & filter
    const invSearch = document.getElementById("inventory-search");
    const invFilter = document.getElementById("inventory-category-filter");
    if (invSearch) invSearch.addEventListener("input", () => this.renderInventoryTable());
    if (invFilter) invFilter.addEventListener("change", () => this.renderInventoryTable());

    // Reports search & filter listeners
    const whSearch = document.getElementById("wh-rep-search");
    if (whSearch) whSearch.addEventListener("input", () => { this.reportsPage = 1; this.renderWarehouseReportsTable(); });

    const whCat = document.getElementById("wh-rep-filter-cat");
    if (whCat) whCat.addEventListener("change", () => { this.reportsPage = 1; this.renderWarehouseReportsTable(); });

    const whZone = document.getElementById("wh-rep-filter-zone");
    if (whZone) whZone.addEventListener("change", () => { this.reportsPage = 1; this.renderWarehouseReportsTable(); });

    const whStatus = document.getElementById("wh-rep-filter-status");
    if (whStatus) whStatus.addEventListener("change", () => { this.reportsPage = 1; this.renderWarehouseReportsTable(); });

    const whUrgency = document.getElementById("wh-rep-filter-urgency");
    if (whUrgency) whUrgency.addEventListener("change", () => { this.reportsPage = 1; this.renderWarehouseReportsTable(); });

    const whSort = document.getElementById("wh-rep-filter-sort");
    if (whSort) whSort.addEventListener("change", () => { this.reportsPage = 1; this.renderWarehouseReportsTable(); });

    const whPerPage = document.getElementById("wh-rep-per-page");
    if (whPerPage) whPerPage.addEventListener("change", (e) => {
      this.reportsPerPage = parseInt(e.target.value) || 25;
      this.reportsPage = 1;
      this.renderWarehouseReportsTable();
    });

    const whPrev = document.getElementById("wh-rep-btn-prev");
    if (whPrev) whPrev.addEventListener("click", () => {
      if (this.reportsPage > 1) {
        this.reportsPage--;
        this.renderWarehouseReportsTable();
      }
    });

    const whNext = document.getElementById("wh-rep-btn-next");
    if (whNext) whNext.addEventListener("click", () => {
      const totalPages = Math.ceil((this.reportsFiltered.length || 1) / this.reportsPerPage);
      if (this.reportsPage < totalPages) {
        this.reportsPage++;
        this.renderWarehouseReportsTable();
      }
    });
  }

  switchSection(sectionId) {
    this.currentSection = sectionId;

    // Update tab buttons
    document.querySelectorAll(".warehouse-nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.target === sectionId);
    });

    // Update sidebar links
    document.querySelectorAll(".warehouse-nav-link").forEach((link) => {
      link.classList.toggle("active", link.dataset.target === sectionId);
    });

    // Toggle panels
    document.querySelectorAll(".warehouse-section-panel").forEach((panel) => {
      panel.classList.remove("active");
    });
    const activePanel = document.getElementById(`panel-${sectionId}`);
    if (activePanel) activePanel.classList.add("active");

    // Update breadcrumb title
    const titleEl = document.getElementById("current-view-title");
    if (titleEl) {
      const titles = {
        overview: "Storage Overview",
        zones: "Storage Zone Management",
        inventory: "Food Inventory",
        "temp-control": "Temperature Control (Dairy & Cold Storage)",
        monitoring: "Temp & Humidity Monitoring",
        history: "Temperature History",
        alerts: "Storage Alerts",
        shelflife: "Shelf-Life Monitoring",
        audit: "Audit Logs",
        reports: "Storage Quality & Cold-Chain Compliance Reports",
      };
      titleEl.textContent = titles[sectionId] || "Warehouse Command";
    }

    // If switching to history, ensure chart is rendered
    if (sectionId === "history") {
      this.loadHistoryChart(this.selectedZoneId);
    } else if (sectionId === "reports") {
      this.loadReportsSection();
    }

    window.location.hash = sectionId;
  }

  async refreshAllData() {
    try {
      // 1. Fetch Overview & Zones
      const overview = await api.getWarehouseDashboard().catch(() => null);
      if (overview) {
        this.updateKpis(overview);
        this.zones = overview.zones || [];
      } else {
        this.zones = await api.getWarehouseZones().catch(() => []);
      }

      // 2. Render Chambers across Overview, Zones, and Monitoring
      this.renderChambersOverview();
      this.renderZonesManagement();
      this.renderMonitoringGrid();
      this.renderShelfLifeGrid();

      // 3. Load active zone into Temperature Control
      await this.loadZoneForTemperatureControl(this.selectedZoneId);

      // 4. Fetch Inventory
      await this.loadInventoryData();

      // 5. Fetch Alerts
      this.alerts = await api.getWarehouseAlerts().catch(() => []);
      this.renderAlerts();

      // 6. Fetch Audit Logs
      this.auditLogs = await api.getWarehouseAuditLogs(30).catch(() => []);
      this.renderAuditLogs();

    } catch (err) {
      console.error("Error refreshing warehouse data:", err);
      if (typeof showToast === "function") {
        showToast("Error connecting to warehouse telemetry: " + err.message, "danger");
      }
    }
  }

  updateKpis(overview) {
    const kpiZones = document.getElementById("kpi-total-zones");
    const kpiOnline = document.getElementById("kpi-controller-online");
    const kpiComp = document.getElementById("kpi-compliant-zones");
    const kpiAlerts = document.getElementById("kpi-active-alerts");
    const kpiProds = document.getElementById("kpi-monitored-prods");

    if (kpiZones) kpiZones.textContent = overview.total_zones || 4;
    if (kpiOnline) kpiOnline.textContent = `${overview.controller_online_count || 3} controllers online`;
    if (kpiComp) kpiComp.textContent = `${overview.compliant_zones || 4} / ${overview.total_zones || 4}`;
    if (kpiAlerts) kpiAlerts.textContent = overview.active_alerts_count || 0;
    if (kpiProds) kpiProds.textContent = overview.total_monitored_products || 7;
  }

  renderChambersOverview() {
    const container = document.getElementById("overview-chamber-grid");
    if (!container) return;

    if (!this.zones || this.zones.length === 0) {
      container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">No cold chambers found.</div>`;
      return;
    }

    container.innerHTML = this.zones
      .map((z) => {
        const isOffline = z.equipment_status === "OFFLINE";
        const statusClass = isOffline ? "status-offline" : z.status === "Optimal" ? "status-optimal" : "status-warning";
        const statusText = isOffline ? "Offline" : z.status;
        const productsSummary = z.stored_products.map((p) => p.product_name).slice(0, 3).join(", ") || z.category;

        return `
          <div class="chamber-card">
            <div>
              <div class="chamber-card-header">
                <div>
                  <div class="chamber-type-tag">${z.category}</div>
                  <div class="chamber-title">${z.name}</div>
                  <div class="chamber-zone">${z.zone_id} • ${z.controller_model || "PLC Controller"}</div>
                </div>
                <span class="chamber-status-badge ${statusClass}">
                  <span class="pulse-dot"></span> ${statusText}
                </span>
              </div>

              <div class="chamber-metrics-row">
                <div class="chamber-metric">
                  <span class="c-label">Temperature</span>
                  <span class="c-value">${z.current_temperature !== null ? z.current_temperature.toFixed(1) + '°C' : '--'}</span>
                  <span class="c-target">Target: ${z.target_temperature.toFixed(1)}°C</span>
                </div>
                <div class="chamber-metric">
                  <span class="c-label">Humidity</span>
                  <span class="c-value">${z.current_humidity !== null ? z.current_humidity.toFixed(1) + '%' : '--'}</span>
                  <span class="c-target">Range: ${z.permitted_temp_min}°C to ${z.permitted_temp_max}°C</span>
                </div>
              </div>

              <div class="chamber-contents-note">
                <strong>Stored Products:</strong> ${productsSummary}
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
              <span style="font-size:11px; color:var(--text-muted);">Cap: ${z.capacity_used || 0} / ${z.capacity_limit || 5000} ${z.capacity_unit || 'kg'}</span>
              <button class="btn btn-outline btn-sm" onclick="warehouseApp.openTemperatureControlForZone('${z.zone_id}')">
                Adjust Setpoint &rarr;
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  renderZonesManagement() {
    const container = document.getElementById("zones-management-grid");
    if (!container) return;

    if (!this.zones || this.zones.length === 0) {
      container.innerHTML = `<div style="padding:20px; text-align:center;">No zones found.</div>`;
      return;
    }

    container.innerHTML = this.zones
      .map((z) => {
        const isConnected = z.equipment_status === "CONNECTED" || z.equipment_status === "ONLINE";
        return `
          <div class="chamber-card">
            <div>
              <div class="chamber-card-header">
                <div>
                  <div class="chamber-type-tag">${z.category} Vault</div>
                  <div class="chamber-title">${z.name}</div>
                  <div class="chamber-zone">${z.zone_id}</div>
                </div>
                <span class="chamber-status-badge ${isConnected ? 'status-optimal' : 'status-offline'}">
                  <span class="pulse-dot"></span> ${z.equipment_status}
                </span>
              </div>

              <div style="background:var(--bg-surface); padding:10px 12px; border-radius:var(--radius-sm); font-size:12px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                  <span style="color:var(--text-muted);">Controller Endpoint:</span>
                  <code style="color:var(--primary); font-size:11px;">${z.controller_endpoint || 'Virtual PLC'}</code>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--text-muted);">Regulatory Standard:</span>
                  <span style="font-weight:600;">${z.regulatory_source || 'FDA Food Safety'}</span>
                </div>
              </div>

              <div class="chamber-metrics-row">
                <div class="chamber-metric">
                  <span class="c-label">Target Setpoint</span>
                  <span class="c-value">${z.target_temperature.toFixed(1)}°C</span>
                  <span class="c-target">Permitted: [${z.permitted_temp_min}°C, ${z.permitted_temp_max}°C]</span>
                </div>
                <div class="chamber-metric">
                  <span class="c-label">Current Reading</span>
                  <span class="c-value">${z.current_temperature !== null ? z.current_temperature.toFixed(1) + '°C' : '--'}</span>
                  <span class="c-target">Sensor: ${z.sensor_status}</span>
                </div>
              </div>
            </div>

            <button class="btn btn-primary btn-sm" onclick="warehouseApp.openTemperatureControlForZone('${z.zone_id}')" style="width:100%;">
              Configure Target Temperature
            </button>
          </div>
        `;
      })
      .join("");
  }

  renderMonitoringGrid() {
    const container = document.getElementById("monitoring-grid");
    if (!container) return;

    container.innerHTML = this.zones
      .map((z) => {
        const temp = z.current_temperature !== null ? z.current_temperature.toFixed(1) : "--";
        const hum = z.current_humidity !== null ? z.current_humidity.toFixed(1) : "--";
        const inBounds = z.current_temperature >= z.permitted_temp_min && z.current_temperature <= z.permitted_temp_max;

        return `
          <div class="chamber-card">
            <div class="chamber-card-header">
              <div>
                <div class="chamber-type-tag">${z.category}</div>
                <div class="chamber-title">${z.name}</div>
                <div class="chamber-zone">${z.controller_model || "Sensor Loop"}</div>
              </div>
              <span class="chamber-status-badge ${inBounds ? 'status-optimal' : 'status-danger'}">
                ${inBounds ? 'Within Safety Bounds' : 'Out of Bounds'}
              </span>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:14px 0;">
              <div style="background:var(--bg-surface); padding:14px; border-radius:var(--radius-md); text-align:center;">
                <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Temperature</div>
                <div style="font-size:1.6rem; font-weight:800; color:var(--text-main); margin:4px 0;">${temp}°C</div>
                <div style="font-size:11px; color:var(--text-muted);">Target: ${z.target_temperature.toFixed(1)}°C</div>
              </div>
              <div style="background:var(--bg-surface); padding:14px; border-radius:var(--radius-md); text-align:center;">
                <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Relative Humidity</div>
                <div style="font-size:1.6rem; font-weight:800; color:#0284c7; margin:4px 0;">${hum}%</div>
                <div style="font-size:11px; color:var(--text-muted);">Target: ${z.target_humidity.toFixed(1)}%</div>
              </div>
            </div>

            <div style="font-size:12px; color:var(--text-muted); line-height:1.4;">
              <strong>Safety Envelope:</strong> ${z.permitted_temp_min}°C to ${z.permitted_temp_max}°C • 
              <strong>Standard:</strong> ${z.regulatory_source}
            </div>
          </div>
        `;
      })
      .join("");
  }

  renderShelfLifeGrid() {
    const container = document.getElementById("shelflife-grid");
    if (!container) return;

    container.innerHTML = this.zones
      .map((z) => {
        const stored = z.stored_products || [];
        return `
          <div class="chamber-card">
            <div class="chamber-card-header">
              <div>
                <div class="chamber-type-tag">${z.category}</div>
                <div class="chamber-title">${z.name}</div>
                <div class="chamber-zone">Current Temp: ${z.current_temperature ? z.current_temperature.toFixed(1) + '°C' : '--'}</div>
              </div>
            </div>

            <div style="margin:10px 0;">
              ${stored.map((p) => `
                <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <strong style="font-size:13px;">${p.product_name}</strong>
                    <span class="badge" style="background:#dcfce7; color:#166534; font-size:11px;">${p.estimated_shelf_life_days || 7} Days Remaining</span>
                  </div>
                  <div style="font-size:11px; color:var(--text-muted);">
                    FDA Cold Target: ${p.target_temperature}°C (Limit: ${p.permitted_temp_max}°C max)
                  </div>
                  <div style="font-size:10px; color:var(--text-muted); font-style:italic; margin-top:2px;">
                    ${p.regulatory_source}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      })
      .join("");
  }

  openTemperatureControlForZone(zoneId) {
    this.selectedZoneId = zoneId;
    const select = document.getElementById("control-zone-select");
    if (select) select.value = zoneId;
    this.switchSection("temp-control");
    this.loadZoneForTemperatureControl(zoneId);
  }

  async loadZoneForTemperatureControl(zoneId) {
    this.selectedZoneId = zoneId;
    try {
      const zone = await api.getWarehouseZone(zoneId);
      this.selectedZone = zone;

      // Populate Left Column details
      const nameEl = document.getElementById("ctrl-zone-name");
      const idEl = document.getElementById("ctrl-zone-id");
      const catEl = document.getElementById("ctrl-zone-category");
      const targetEl = document.getElementById("ctrl-current-target");
      const measuredTempEl = document.getElementById("ctrl-measured-temp");
      const measuredHumEl = document.getElementById("ctrl-measured-hum");
      const rangeEl = document.getElementById("ctrl-permitted-range");
      const regSourceEl = document.getElementById("ctrl-regulatory-source");
      const equipmentBadge = document.getElementById("selected-zone-equipment-badge");

      if (nameEl) nameEl.textContent = zone.name;
      if (idEl) idEl.textContent = `Zone ID: ${zone.zone_id}`;
      if (catEl) catEl.textContent = `${zone.category} Cold Room`;
      if (targetEl) targetEl.textContent = `${zone.target_temperature.toFixed(1)}°C`;
      if (measuredTempEl) measuredTempEl.textContent = `${zone.current_temperature ? zone.current_temperature.toFixed(1) + '°C' : '--'}`;
      if (measuredHumEl) measuredHumEl.textContent = `Humidity: ${zone.current_humidity ? zone.current_humidity.toFixed(1) + '% RH' : '--'}`;
      if (rangeEl) rangeEl.textContent = `${zone.permitted_temp_min.toFixed(1)}°C to ${zone.permitted_temp_max.toFixed(1)}°C`;
      if (regSourceEl) regSourceEl.innerHTML = `<strong>Regulatory Source:</strong> ${zone.regulatory_source}`;

      const isConnected = zone.equipment_status === "CONNECTED" || zone.equipment_status === "ONLINE";
      if (equipmentBadge) {
        equipmentBadge.innerHTML = `
          <span class="chamber-status-badge ${isConnected ? 'status-optimal' : 'status-offline'}">
            <span class="pulse-dot"></span> Controller: ${zone.controller_model || 'PLC'} (${zone.equipment_status})
          </span>
        `;
      }

      // Populate Stored Products
      const prodsList = document.getElementById("ctrl-stored-products-list");
      if (prodsList) {
        prodsList.innerHTML = (zone.stored_products || [])
          .map((p) => `
            <div class="dairy-product-pill">
              <div>
                <strong>${p.product_name}</strong>
                <div style="font-size:11px; color:var(--text-muted);">${p.regulatory_source}</div>
              </div>
              <div style="text-align:right;">
                <span class="score-pill score-high">${p.permitted_temp_min}°C to ${p.permitted_temp_max}°C</span>
              </div>
            </div>
          `)
          .join("");
      }

      // Initialize the target input with zone's current target or 4.0
      const inputEl = document.getElementById("input-target-temperature");
      if (inputEl) {
        inputEl.value = zone.target_temperature.toFixed(1);
        this.checkInputBounds();
      }

      // Update preset buttons for this zone
      this.updatePresetButtons(zone);

    } catch (err) {
      console.error("Failed to load zone details:", err);
    }
  }

  updatePresetButtons(zone) {
    const group = document.querySelector(".preset-btn-group");
    if (!group) return;

    if (zone.category === "Dairy") {
      group.innerHTML = `
        <button type="button" class="preset-btn" onclick="warehouseApp.setTargetPreset(4.0)">4.0°C (FDA Max Limit)</button>
        <button type="button" class="preset-btn" onclick="warehouseApp.setTargetPreset(3.5)">3.5°C</button>
        <button type="button" class="preset-btn active" onclick="warehouseApp.setTargetPreset(3.0)">3.0°C (Recommended)</button>
        <button type="button" class="preset-btn" onclick="warehouseApp.setTargetPreset(2.5)">2.5°C</button>
        <button type="button" class="preset-btn" onclick="warehouseApp.setTargetPreset(1.0)">1.0°C (Min Safety)</button>
      `;
    } else if (zone.category === "Frozen") {
      group.innerHTML = `
        <button type="button" class="preset-btn" onclick="warehouseApp.setTargetPreset(-15.0)">-15.0°C (Upper Limit)</button>
        <button type="button" class="preset-btn active" onclick="warehouseApp.setTargetPreset(-18.0)">-18.0°C (Standard)</button>
        <button type="button" class="preset-btn" onclick="warehouseApp.setTargetPreset(-20.0)">-20.0°C</button>
        <button type="button" class="preset-btn" onclick="warehouseApp.setTargetPreset(-22.0)">-22.0°C (Deep Freeze)</button>
      `;
    } else {
      group.innerHTML = `
        <button type="button" class="preset-btn active" onclick="warehouseApp.setTargetPreset(${zone.target_temperature})">${zone.target_temperature}°C (Current)</button>
        <button type="button" class="preset-btn" onclick="warehouseApp.setTargetPreset(${zone.permitted_temp_min})">${zone.permitted_temp_min}°C (Min)</button>
        <button type="button" class="preset-btn" onclick="warehouseApp.setTargetPreset(${zone.permitted_temp_max})">${zone.permitted_temp_max}°C (Max)</button>
      `;
    }
  }

  setTargetPreset(val) {
    const input = document.getElementById("input-target-temperature");
    if (input) {
      input.value = parseFloat(val).toFixed(1);
      this.checkInputBounds();
    }
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.textContent.includes(`${val}`));
    });
  }

  checkInputBounds() {
    const input = document.getElementById("input-target-temperature");
    const banner = document.getElementById("target-validation-banner");
    const msg = document.getElementById("target-validation-msg");
    if (!input || !this.selectedZone) return;

    const val = parseFloat(input.value);
    const min = this.selectedZone.permitted_temp_min;
    const max = this.selectedZone.permitted_temp_max;

    if (isNaN(val) || val < min || val > max) {
      if (banner && msg) {
        banner.style.display = "block";
        msg.textContent = `Proposed ${val}°C is outside the server-side permitted safety range of [${min}°C to ${max}°C] for ${this.selectedZone.name}. The backend will reject this request to prevent spoilage.`;
      }
    } else {
      if (banner) banner.style.display = "none";
    }
  }

  async handleSetpointSubmit(event) {
    event.preventDefault();
    const input = document.getElementById("input-target-temperature");
    const reasonInput = document.getElementById("input-target-reason");
    const btn = document.getElementById("btn-submit-temp-command");

    if (!input || !reasonInput) return;
    const targetTemp = parseFloat(input.value);
    const reason = reasonInput.value.trim();

    if (isNaN(targetTemp)) {
      if (typeof showToast === "function") showToast("Please enter a valid temperature setpoint.", "warning");
      return;
    }

    if (!reason || reason.length < 3) {
      if (typeof showToast === "function") showToast("Please provide an audit justification reason (min 3 chars).", "warning");
      return;
    }

    // 1. Open Lifecycle Stepper Modal
    this.openModal("modal-temp-lifecycle");
    this.resetLifecycleStepper(targetTemp);

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "⏳ Transmitting...";
    }

    try {
      // Step 2 & 3: Call FastAPI endpoint
      const result = await api.submitWarehouseTemperatureCommand(
        this.selectedZoneId,
        targetTemp,
        reason
      );

      // Transition Stepper
      this.advanceLifecycleStepper(result);

      if (typeof showToast === "function") {
        if (result.applied_to_hardware) {
          showToast(`Success: Controller acknowledged and applied target ${targetTemp}°C to ${result.zone_name}.`, "success");
        } else {
          showToast(`Warning: Target saved in software. Controller is OFFLINE; physical equipment was NOT modified.`, "warning");
        }
      }

      // Refresh data to reflect new setpoint
      await this.refreshAllData();

    } catch (err) {
      console.error("Adjustment error:", err);
      this.markLifecycleFailed(err.message || "Temperature adjustment rejected by backend.");
      if (typeof showToast === "function") {
        showToast("Adjustment Rejected: " + (err.message || "Safety violation"), "danger");
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "🚀 Transmit Setpoint to Controller";
      }
    }
  }

  resetLifecycleStepper(targetTemp) {
    const s1 = document.getElementById("step-1");
    const s2 = document.getElementById("step-2");
    const s3 = document.getElementById("step-3");
    const s4 = document.getElementById("step-4");
    const s5 = document.getElementById("step-5");
    const rangeSpan = document.getElementById("step-2-range");
    const rawBox = document.getElementById("controller-response-container");

    if (rangeSpan && this.selectedZone) {
      rangeSpan.textContent = `Target: ${targetTemp}°C vs Range [${this.selectedZone.permitted_temp_min}°C, ${this.selectedZone.permitted_temp_max}°C]`;
    }

    if (s1) s1.className = "lifecycle-step completed";
    if (s2) s2.className = "lifecycle-step active";
    if (s3) s3.className = "lifecycle-step";
    if (s4) s4.className = "lifecycle-step";
    if (s5) s5.className = "lifecycle-step";
    if (rawBox) rawBox.style.display = "none";
  }

  advanceLifecycleStepper(result) {
    const s2 = document.getElementById("step-2");
    const s3 = document.getElementById("step-3");
    const s4 = document.getElementById("step-4");
    const s5 = document.getElementById("step-5");
    const rawBox = document.getElementById("controller-response-container");
    const rawContent = document.getElementById("raw-packet-content");

    if (s2) s2.className = "lifecycle-step completed";
    if (s3) s3.className = "lifecycle-step completed";
    if (s4) {
      s4.className = result.applied_to_hardware ? "lifecycle-step completed" : "lifecycle-step active";
      s4.innerHTML = result.applied_to_hardware
        ? `<span>✓</span> <strong>Step 4:</strong> Controller Acknowledgement Handshake (Applied)`
        : `<span>⚠️</span> <strong>Step 4:</strong> Controller OFFLINE (Software Target Saved Only)`;
    }
    if (s5) s5.className = "lifecycle-step completed";

    if (rawBox && rawContent) {
      rawBox.style.display = "block";
      const packet = result.controller_response ? result.controller_response.modbus_packet : null;
      rawContent.textContent = JSON.stringify(
        {
          command_id: result.command_id,
          status: result.status,
          applied_to_hardware: result.applied_to_hardware,
          controller_ack: packet || "CONTROLLER_OFFLINE_SAVED_TO_DB_ONLY",
          message: result.message,
        },
        null,
        2
      );
    }
  }

  markLifecycleFailed(errMsg) {
    const s2 = document.getElementById("step-2");
    const s3 = document.getElementById("step-3");
    const rawBox = document.getElementById("controller-response-container");
    const rawContent = document.getElementById("raw-packet-content");

    if (s2) {
      s2.className = "lifecycle-step failed";
      s2.innerHTML = `<span>❌</span> <strong>Step 2:</strong> Server-Side Rule Validation Failed`;
    }
    if (s3) s3.className = "lifecycle-step";

    if (rawBox && rawContent) {
      rawBox.style.display = "block";
      rawContent.textContent = `[REJECTED BY BACKEND SAFETY ENFORCEMENT]\n${errMsg}`;
    }
  }

  async loadInventoryData() {
    try {
      const items = await api.getInventory().catch(() => []);
      this.cachedInventory = items;
      this.renderInventoryTable();
    } catch (e) {
      console.warn("Could not load inventory:", e);
    }
  }

  renderInventoryTable() {
    const tbody = document.getElementById("inventory-table-body");
    if (!tbody) return;

    const query = (document.getElementById("inventory-search")?.value || "").toLowerCase();
    const cat = document.getElementById("inventory-category-filter")?.value || "All";

    const filtered = this.cachedInventory.filter((item) => {
      const matchesQ =
        !query ||
        (item.food_name || "").toLowerCase().includes(query) ||
        (item.batch_number || "").toLowerCase().includes(query) ||
        (item.location || "").toLowerCase().includes(query);

      const matchesCat = cat === "All" || (item.category || "").toLowerCase().includes(cat.toLowerCase());
      return matchesQ && matchesCat;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No matching inventory items found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((item) => {
        const score = item.freshness_score ? item.freshness_score.toFixed(1) + "%" : "Pending";
        const scoreClass = !item.freshness_score ? "score-mid" : item.freshness_score >= 80 ? "score-high" : "score-low";

        return `
          <tr>
            <td><code>${item.batch_number || "BATCH-" + (item._id || "").slice(-6)}</code></td>
            <td><strong>${item.food_name}</strong></td>
            <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${item.category}</span></td>
            <td>${item.location || "Chamber B - Cold Room"}</td>
            <td>${item.quantity} ${item.unit}</td>
            <td><span class="score-pill ${scoreClass}">${score}</span></td>
            <td>${item.expiry_date || "N/A"}</td>
            <td><span class="chamber-status-badge status-optimal">Compliant</span></td>
          </tr>
        `;
      })
      .join("");
  }

  async loadHistoryChart(zoneId) {
    const canvas = document.getElementById("tempStabilityChart");
    if (!canvas) return;

    try {
      const data = await api.getWarehouseZoneHistory(zoneId, 24);
      const points = data.points || [];

      const labels = points.map((p) => p.timestamp);
      const temps = points.map((p) => p.temperature);
      const targets = points.map((p) => p.target_temp);
      const maxLimit = points.map((p) => p.max_temp);
      const minLimit = points.map((p) => p.min_temp);

      if (this.historyChart) {
        this.historyChart.destroy();
      }

      const ctx = canvas.getContext("2d");
      this.historyChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels.length ? labels : ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "Now"],
          datasets: [
            {
              label: `Actual Temp (°C) - ${data.zone_name}`,
              data: temps.length ? temps : [3.6, 3.7, 3.8, 3.9, 3.8, 3.7, 3.8],
              borderColor: "#0284c7",
              backgroundColor: "rgba(2, 132, 199, 0.08)",
              borderWidth: 2.5,
              tension: 0.35,
              fill: true,
            },
            {
              label: "Target Setpoint (°C)",
              data: targets.length ? targets : [4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0],
              borderColor: "#16a34a",
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
            },
            {
              label: "Max Regulatory Bound (°C)",
              data: maxLimit.length ? maxLimit : [4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0],
              borderColor: "#dc2626",
              borderDash: [2, 4],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
            },
            {
              label: "Min Safety Bound (°C)",
              data: minLimit.length ? minLimit : [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
              borderColor: "#9333ea",
              borderDash: [2, 4],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { font: { size: 11, weight: "bold" } } },
          },
          scales: {
            y: {
              grid: { color: "rgba(0,0,0,0.05)" },
              title: { display: true, text: "Temperature (°C)", font: { weight: "bold" } },
            },
            x: {
              grid: { display: false },
            },
          },
        },
      });

      // Render table rows
      const tableBody = document.getElementById("history-readings-body");
      if (tableBody) {
        tableBody.innerHTML = points
          .slice(-10)
          .reverse()
          .map((p) => `
            <tr>
              <td><strong>${p.timestamp}</strong></td>
              <td style="color:#0284c7; font-weight:700;">${p.temperature.toFixed(1)}°C</td>
              <td>${p.target_temp.toFixed(1)}°C</td>
              <td>${p.humidity.toFixed(1)}%</td>
              <td><span class="badge" style="background:#dcfce7; color:#15803d;">${p.sensor_status}</span></td>
              <td><span class="chamber-status-badge status-optimal">Compliant</span></td>
            </tr>
          `)
          .join("");
      }
    } catch (err) {
      console.warn("Could not load history chart:", err);
    }
  }

  renderAlerts() {
    const container = document.getElementById("alerts-container");
    if (!container) return;

    if (!this.alerts || this.alerts.length === 0) {
      container.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:32px; text-align:center;">
          <div style="font-size:2rem; margin-bottom:8px;">✅</div>
          <h3 style="margin:0 0 4px 0;">All Storage Chambers Normal</h3>
          <p style="color:var(--text-muted); font-size:13px; margin:0;">Zero active temperature excursions or sensor fault alarms.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.alerts
      .map((a) => {
        const isCritical = a.severity === "critical" || a.severity === "high";
        return `
          <div style="background:var(--bg-card); border:1px solid ${isCritical ? '#fecaca' : 'var(--border-color)'}; border-left:4px solid ${isCritical ? '#dc2626' : '#f59e0b'}; border-radius:var(--radius-md); padding:16px 20px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span class="badge" style="background:${isCritical ? '#fee2e2' : '#fef3c7'}; color:${isCritical ? '#991b1b' : '#92400e'}; font-weight:700; text-transform:uppercase; font-size:11px;">
                  ${a.severity}
                </span>
                <strong style="font-size:14px;">${a.zone_name || 'Storage Zone'}</strong>
              </div>
              <div style="font-size:13px; color:var(--text-main);">${a.message}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${new Date(a.created_at).toLocaleString()}</div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="showToast('Alert acknowledged by operator.', 'info')">
              Acknowledge
            </button>
          </div>
        `;
      })
      .join("");
  }

  renderAuditLogs() {
    const tbody = document.getElementById("audit-logs-body");
    if (!tbody) return;

    if (!this.auditLogs || this.auditLogs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No audit events recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.auditLogs
      .map((l) => {
        const meta = l.metadata || {};
        const isSuccess = l.status === "success";

        return `
          <tr>
            <td><small>${new Date(l.timestamp).toLocaleString()}</small></td>
            <td><strong>${l.actor_email || "System"}</strong></td>
            <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${l.actor_role || "Operator"}</span></td>
            <td><code>${l.action}</code></td>
            <td>${l.target_resource || "storage_zone"}</td>
            <td>${l.previous_value?.target_temperature !== undefined ? l.previous_value.target_temperature + '°C' : '--'}</td>
            <td><strong style="color:var(--primary);">${l.new_value?.target_temperature !== undefined ? l.new_value.target_temperature + '°C' : '--'}</strong></td>
            <td>
              <span class="chamber-status-badge ${isSuccess ? 'status-optimal' : 'status-warning'}">
                ${isSuccess ? 'ACK Applied' : 'Software Saved'}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // =========================================================================
  // SECTION 10: QUALITY & COMPLIANCE REPORTS CONTROLLER
  // =========================================================================
  async loadReportsSection() {
    try {
      if (!this.cachedInventory || this.cachedInventory.length === 0) {
        await this.loadInventoryData();
      }
      if (!this.zones || this.zones.length === 0) {
        this.zones = await api.getWarehouseZones().catch(() => []);
      }

      const items = this.cachedInventory || [];
      const zones = this.zones || [];

      // 1. Populate Zone Filter dropdown if not done
      const zoneSelect = document.getElementById("wh-rep-filter-zone");
      if (zoneSelect && zoneSelect.options.length <= 1) {
        const zoneOptions = zones.map(z => `<option value="${escapeHtml(z.zone_name || z.zone_id)}">${escapeHtml(z.zone_name || z.zone_id)}</option>`).join("");
        zoneSelect.innerHTML = `<option value="all">All Storage Zones</option>` + zoneOptions;
      }

      // 2. Compute Executive KPIs
      const totalLots = items.length;
      const compliantZonesCount = zones.filter(z => z.compliance_status === "compliant" || Math.abs((z.current_temperature || 0) - (z.target_temperature || 0)) <= 2.0).length;
      const complianceRate = zones.length > 0 ? Math.round((compliantZonesCount / zones.length) * 100) : 100;

      let freshCount = 0;
      let atRiskCount = 0;
      let fefoCount = 0;

      items.forEach(item => {
        const days = this.computeDaysRemaining(item.expiry_date);
        const score = typeof item.quality_score === "number" ? item.quality_score : 80;
        const status = (item.freshness_status || "").toLowerCase();

        if (score >= 75 || status.includes("fresh")) {
          freshCount++;
        }
        if (days <= 3 || status.includes("expiry") || status.includes("risk") || status.includes("spoil")) {
          atRiskCount++;
        }
        if (days <= 3 || score < 60) {
          fefoCount++;
        }
      });

      const freshPct = totalLots > 0 ? Math.round((freshCount / totalLots) * 100) : 0;
      const avgTemp = zones.length > 0 ? (zones.reduce((sum, z) => sum + (parseFloat(z.current_temperature) || 0), 0) / zones.length).toFixed(1) : "3.4";

      // Update KPI DOM
      const kpiTotal = document.getElementById("wh-rep-kpi-total");
      const kpiComp = document.getElementById("wh-rep-kpi-compliance");
      const kpiFresh = document.getElementById("wh-rep-kpi-fresh-pct");
      const kpiAtRisk = document.getElementById("wh-rep-kpi-at-risk");
      const kpiAvgTemp = document.getElementById("wh-rep-kpi-avg-temp");
      const kpiFefo = document.getElementById("wh-rep-kpi-fefo");

      if (kpiTotal) kpiTotal.textContent = totalLots;
      if (kpiComp) kpiComp.textContent = `${complianceRate}%`;
      if (kpiFresh) kpiFresh.textContent = `${freshPct}%`;
      if (kpiAtRisk) kpiAtRisk.textContent = atRiskCount;
      if (kpiAvgTemp) kpiAvgTemp.textContent = `${avgTemp}°C`;
      if (kpiFefo) kpiFefo.textContent = fefoCount;

      // 3. Render 4 Chart.js Visualizations
      this.renderWarehouseReportsCharts(items, zones);

      // 4. Render Chamber & Zone Quality Matrix Table
      this.renderWarehouseZoneMatrix(items, zones);

      // 5. Render Filterable Quality & Expiry Audit Table
      this.reportsPage = 1;
      this.renderWarehouseReportsTable();

    } catch (err) {
      console.error("Error loading warehouse reports:", err);
      if (typeof showToast === "function") showToast("Error loading warehouse reports: " + err.message, "danger");
    }
  }

  computeDaysRemaining(expiryDateStr) {
    if (!expiryDateStr) return 99;
    const exp = new Date(expiryDateStr);
    const now = new Date();
    const diff = exp.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  renderWarehouseReportsCharts(items, zones) {
    if (typeof Chart === "undefined") return;

    // --- Chart 1: Freshness Distribution (Doughnut) ---
    const ctxFreshness = document.getElementById("chart-wh-freshness-dist");
    if (ctxFreshness) {
      if (this.reportsCharts.freshness) this.reportsCharts.freshness.destroy();

      let fresh = 0, slightlyFresh = 0, nearExpiry = 0, expired = 0;
      items.forEach(it => {
        const s = (it.freshness_status || "").toLowerCase();
        const days = this.computeDaysRemaining(it.expiry_date);
        if (days < 0 || s.includes("expired")) expired++;
        else if (days <= 3 || s.includes("near") || s.includes("risk")) nearExpiry++;
        else if (s.includes("slightly") || (it.quality_score >= 60 && it.quality_score < 80)) slightlyFresh++;
        else fresh++;
      });

      this.reportsCharts.freshness = new Chart(ctxFreshness, {
        type: "doughnut",
        data: {
          labels: ["Fresh (Optimal)", "Slightly Fresh", "Near Expiry / At Risk", "Expired"],
          datasets: [{
            data: [fresh, slightlyFresh, nearExpiry, expired],
            backgroundColor: ["#10b981", "#38bdf8", "#f59e0b", "#ef4444"],
            borderWidth: 2,
            borderColor: "#ffffff",
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 12 } } },
          },
        },
      });
    }

    // --- Chart 2: Category Average Quality Score (Bar) ---
    const ctxCategory = document.getElementById("chart-wh-category-quality");
    if (ctxCategory) {
      if (this.reportsCharts.category) this.reportsCharts.category.destroy();

      const catMap = {};
      items.forEach(it => {
        const cat = it.category || "General";
        if (!catMap[cat]) catMap[cat] = { sum: 0, count: 0 };
        catMap[cat].sum += (typeof it.quality_score === "number" ? it.quality_score : 80);
        catMap[cat].count++;
      });

      const catLabels = Object.keys(catMap).length > 0 ? Object.keys(catMap) : ["Dairy", "Meat", "Fish", "Fruits", "Vegetables", "Bakery"];
      const catData = catLabels.map(c => catMap[c] ? Math.round(catMap[c].sum / catMap[c].count) : 85);

      this.reportsCharts.category = new Chart(ctxCategory, {
        type: "bar",
        data: {
          labels: catLabels,
          datasets: [{
            label: "Average Quality Score (%)",
            data: catData,
            backgroundColor: "#0284c7",
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: { min: 0, max: 100, ticks: { callback: v => v + "%" } },
          },
        },
      });
    }

    // --- Chart 3: Storage Zone Temperature vs Target Bounds (Bar) ---
    const ctxZone = document.getElementById("chart-wh-zone-compliance");
    if (ctxZone) {
      if (this.reportsCharts.zone) this.reportsCharts.zone.destroy();

      const zoneLabels = zones.map(z => z.zone_name ? z.zone_name.replace("Chamber ", "Ch ") : z.zone_id);
      const targetTemps = zones.map(z => parseFloat(z.target_temperature) || 0);
      const currentTemps = zones.map(z => parseFloat(z.current_temperature) || 0);

      this.reportsCharts.zone = new Chart(ctxZone, {
        type: "bar",
        data: {
          labels: zoneLabels.length > 0 ? zoneLabels : ["Ch A: Deep Freeze", "Ch B: Dairy", "Ch C: Fresh Produce", "Ch D: Dry Pantry"],
          datasets: [
            {
              label: "Target Setpoint (°C)",
              data: targetTemps.length > 0 ? targetTemps : [-18.0, 4.0, 7.0, 18.0],
              backgroundColor: "rgba(148, 163, 184, 0.6)",
              borderRadius: 4,
            },
            {
              label: "Current Sensor (°C)",
              data: currentTemps.length > 0 ? currentTemps : [-17.6, 3.8, 6.9, 18.2],
              backgroundColor: "#0d9488",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
          },
          scales: {
            y: { ticks: { callback: v => v + "°C" } },
          },
        },
      });
    }

    // --- Chart 4: Storage Expiry Lifespan Timeline (Bar) ---
    const ctxExpiry = document.getElementById("chart-wh-expiry-timeline");
    if (ctxExpiry) {
      if (this.reportsCharts.expiry) this.reportsCharts.expiry.destroy();

      let crit = 0, urgent = 0, safe = 0, stable = 0;
      items.forEach(it => {
        const days = this.computeDaysRemaining(it.expiry_date);
        if (days <= 3) crit++;
        else if (days <= 7) urgent++;
        else if (days <= 14) safe++;
        else stable++;
      });

      this.reportsCharts.expiry = new Chart(ctxExpiry, {
        type: "bar",
        data: {
          labels: ["Critical (≤ 3 Days)", "Urgent (4 - 7 Days)", "Safe (8 - 14 Days)", "Stable (> 14 Days)"],
          datasets: [{
            label: "Stored Food Batches",
            data: [crit, urgent, safe, stable],
            backgroundColor: ["#dc2626", "#ea580c", "#16a34a", "#2563eb"],
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
        },
      });
    }
  }

  renderWarehouseZoneMatrix(items, zones) {
    const tbody = document.getElementById("wh-zone-matrix-tbody");
    if (!tbody) return;

    if (!zones || zones.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--text-muted);">No storage zones configured.</td></tr>`;
      return;
    }

    const html = zones.map(z => {
      const zName = z.zone_name || z.zone_id;
      // Match items in zone
      const zoneItems = items.filter(it => {
        const loc = (it.storage_location || "").toLowerCase();
        const zn = (z.zone_name || "").toLowerCase();
        const zid = (z.zone_id || "").toLowerCase();
        return loc.includes(zn) || loc.includes(zid) || (z.category && (it.category || "").toLowerCase() === z.category.toLowerCase());
      });

      const totalUnits = zoneItems.reduce((acc, it) => acc + (parseFloat(it.quantity) || 1), 0);
      const activeLots = zoneItems.length;
      const avgQuality = activeLots > 0 ? Math.round(zoneItems.reduce((acc, it) => acc + (typeof it.quality_score === "number" ? it.quality_score : 80), 0) / activeLots) : 88;

      const diff = Math.abs((parseFloat(z.current_temperature) || 0) - (parseFloat(z.target_temperature) || 0));
      const isCompliant = diff <= 2.0;
      const riskLevel = diff <= 1.0 ? "Low" : diff <= 2.5 ? "Moderate" : "High Alert";
      const riskColor = diff <= 1.0 ? "#16a34a" : diff <= 2.5 ? "#d97706" : "#dc2626";

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding:12px 14px;"><strong>${escapeHtml(zName)}</strong><div style="font-size:11px; color:#64748b;">${escapeHtml(z.zone_id)}</div></td>
          <td style="padding:12px 14px;"><span class="badge" style="background:#f1f5f9; color:#334155;">${escapeHtml(z.category || "Multi-Category")}</span></td>
          <td style="text-align:center; padding:12px 14px;"><strong>${z.target_temperature !== undefined ? z.target_temperature + "°C" : "--"}</strong></td>
          <td style="text-align:center; padding:12px 14px; font-weight:700; color:${isCompliant ? '#16a34a' : '#dc2626'};">
            ${z.current_temperature !== undefined ? z.current_temperature + "°C" : "--"}
          </td>
          <td style="text-align:center; padding:12px 14px;">${z.humidity !== undefined ? z.humidity + "%" : "85%"}</td>
          <td style="text-align:center; padding:12px 14px;">
            <span class="chamber-status-badge ${isCompliant ? 'status-optimal' : 'status-warning'}">
              ${isCompliant ? '✓ In Bounds' : '⚠️ Deviating'}
            </span>
          </td>
          <td style="text-align:center; padding:12px 14px; font-weight:700;">${activeLots}</td>
          <td style="text-align:center; padding:12px 14px;">${totalUnits.toFixed(1)}</td>
          <td style="text-align:center; padding:12px 14px; font-weight:700; color:${avgQuality >= 80 ? '#16a34a' : avgQuality >= 60 ? '#d97706' : '#dc2626'};">
            ${avgQuality}%
          </td>
          <td style="text-align:center; padding:12px 14px;">
            <span style="font-weight:700; color:${riskColor};">${riskLevel}</span>
          </td>
        </tr>
      `;
    }).join("");

    tbody.innerHTML = html;
  }

  renderWarehouseReportsTable() {
    const tbody = document.getElementById("wh-reports-table-tbody");
    if (!tbody) return;

    const items = this.cachedInventory || [];
    const searchVal = (document.getElementById("wh-rep-search")?.value || "").toLowerCase().trim();
    const catVal = document.getElementById("wh-rep-filter-cat")?.value || "all";
    const zoneVal = document.getElementById("wh-rep-filter-zone")?.value || "all";
    const statusVal = document.getElementById("wh-rep-filter-status")?.value || "all";
    const urgencyVal = document.getElementById("wh-rep-filter-urgency")?.value || "all";
    const sortVal = document.getElementById("wh-rep-filter-sort")?.value || "expiry_asc";

    // Filtering
    let filtered = items.filter(it => {
      // Search
      if (searchVal) {
        const name = (it.food_name || "").toLowerCase();
        const id = String(it.id || it._id || "").toLowerCase();
        const batch = (it.batch_number || "").toLowerCase();
        if (!name.includes(searchVal) && !id.includes(searchVal) && !batch.includes(searchVal)) {
          return false;
        }
      }

      // Category
      if (catVal !== "all" && it.category !== catVal) {
        return false;
      }

      // Zone
      if (zoneVal !== "all") {
        const loc = (it.storage_location || "").toLowerCase();
        const zv = zoneVal.toLowerCase();
        if (!loc.includes(zv)) return false;
      }

      // Freshness Status
      if (statusVal !== "all") {
        const s = (it.freshness_status || "").toLowerCase();
        const sv = statusVal.toLowerCase();
        if (!s.includes(sv)) return false;
      }

      // Urgency
      const days = this.computeDaysRemaining(it.expiry_date);
      if (urgencyVal === "critical" && (days > 3 || days < 0)) return false;
      if (urgencyVal === "urgent" && (days <= 3 || days > 7)) return false;
      if (urgencyVal === "safe" && days <= 7) return false;
      if (urgencyVal === "expired" && days >= 0) return false;

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortVal === "expiry_asc") return new Date(a.expiry_date || 0) - new Date(b.expiry_date || 0);
      if (sortVal === "expiry_desc") return new Date(b.expiry_date || 0) - new Date(a.expiry_date || 0);
      if (sortVal === "quality_asc") return (a.quality_score || 0) - (b.quality_score || 0);
      if (sortVal === "quality_desc") return (b.quality_score || 0) - (a.quality_score || 0);
      if (sortVal === "name_asc") return (a.food_name || "").localeCompare(b.food_name || "");
      return 0;
    });

    this.reportsFiltered = filtered;

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / this.reportsPerPage) || 1;
    if (this.reportsPage > totalPages) this.reportsPage = totalPages;
    if (this.reportsPage < 1) this.reportsPage = 1;

    const startIdx = (this.reportsPage - 1) * this.reportsPerPage;
    const pageItems = filtered.slice(startIdx, startIdx + this.reportsPerPage);

    // Update pagination controls
    const pageInfo = document.getElementById("wh-rep-page-info");
    const pageNum = document.getElementById("wh-rep-page-num");
    const prevBtn = document.getElementById("wh-rep-btn-prev");
    const nextBtn = document.getElementById("wh-rep-btn-next");

    if (pageInfo) pageInfo.textContent = `Showing ${pageItems.length > 0 ? startIdx + 1 : 0} - ${startIdx + pageItems.length} of ${totalItems} lots`;
    if (pageNum) pageNum.textContent = `Page ${this.reportsPage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = this.reportsPage <= 1;
    if (nextBtn) nextBtn.disabled = this.reportsPage >= totalPages;

    if (pageItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:24px; color:var(--text-muted);">No warehouse lots match your selected filters.</td></tr>`;
      return;
    }

    const html = pageItems.map(it => {
      const lotId = it.batch_number || (it.id ? String(it.id).substring(0, 8).toUpperCase() : "LOT-WH-001");
      const name = it.food_name || "Food Product";
      const cat = it.category || "General";
      const zone = it.storage_location || "Central Cold Hub";
      const qty = `${it.quantity || 1} ${it.unit || 'units'}`;
      const score = typeof it.quality_score === "number" ? Math.round(it.quality_score) : 85;
      const days = this.computeDaysRemaining(it.expiry_date);
      const expiryStr = it.expiry_date ? new Date(it.expiry_date).toLocaleDateString() : "--";

      // Score bar color
      const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

      // Freshness Status Badge
      let statusBadge = `<span class="badge" style="background:#ecfdf5; color:#047857;">Fresh</span>`;
      const s = (it.freshness_status || "").toLowerCase();
      if (s.includes("expired") || days < 0) {
        statusBadge = `<span class="badge" style="background:#fef2f2; color:#b91c1c;">Expired</span>`;
      } else if (s.includes("near") || s.includes("risk") || days <= 3) {
        statusBadge = `<span class="badge" style="background:#fffbeb; color:#b45309;">Near Expiry</span>`;
      } else if (s.includes("slightly") || score < 80) {
        statusBadge = `<span class="badge" style="background:#f0f9ff; color:#0369a1;">Slightly Fresh</span>`;
      }

      // FEFO Action Guidance
      let fefoAction = `<span class="badge" style="background:#f1f5f9; color:#475569;">Normal FIFO</span>`;
      if (days < 0) {
        fefoAction = `<span class="badge" style="background:#fee2e2; color:#991b1b; font-weight:700;">Quarantine / Dispose</span>`;
      } else if (days <= 2) {
        fefoAction = `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700;">🚨 Expedite Immediate</span>`;
      } else if (days <= 5) {
        fefoAction = `<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:600;">⚡ Prioritize Dispatch</span>`;
      }

      const daysColor = days < 0 ? "#dc2626" : days <= 3 ? "#ea580c" : days <= 7 ? "#d97706" : "#16a34a";
      const daysText = days < 0 ? `${Math.abs(days)}d expired` : `${days} days`;

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding:10px 14px; font-family:monospace; font-weight:700; color:#0284c7;">#${escapeHtml(lotId)}</td>
          <td style="padding:10px 14px; font-weight:600;">${escapeHtml(name)}</td>
          <td style="padding:10px 14px;"><span class="badge" style="background:#f8fafc; border:1px solid #e2e8f0;">${escapeHtml(cat)}</span></td>
          <td style="padding:10px 14px; font-size:12px; color:#475569;">${escapeHtml(zone)}</td>
          <td style="text-align:center; padding:10px 14px;">${qty}</td>
          <td style="padding:10px 14px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="flex:1; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                <div style="width:${score}%; height:100%; background:${scoreColor};"></div>
              </div>
              <span style="font-size:12px; font-weight:700; color:${scoreColor}; min-width:32px;">${score}%</span>
            </div>
          </td>
          <td style="text-align:center; padding:10px 14px;">${statusBadge}</td>
          <td style="padding:10px 14px; font-size:12px;">${expiryStr}</td>
          <td style="text-align:center; padding:10px 14px; font-weight:700; color:${daysColor};">${daysText}</td>
          <td style="text-align:center; padding:10px 14px;">${fefoAction}</td>
        </tr>
      `;
    }).join("");

    tbody.innerHTML = html;
  }

  exportReportsCsv() {
    const items = this.reportsFiltered && this.reportsFiltered.length > 0 ? this.reportsFiltered : (this.cachedInventory || []);
    if (items.length === 0) {
      if (typeof showToast === "function") showToast("No items available to export.", "warning");
      return;
    }

    const headers = ["Lot/Batch ID", "Product Name", "Category", "Storage Zone", "Quantity", "Unit", "Quality Score (%)", "Freshness Status", "Expiry Date", "Days Left", "Storage Temp (°C)"];
    const rows = items.map(it => {
      const lotId = it.batch_number || it.id || "";
      const name = it.food_name || "";
      const cat = it.category || "";
      const zone = it.storage_location || "";
      const qty = it.quantity || 0;
      const unit = it.unit || "";
      const score = it.quality_score || 0;
      const status = it.freshness_status || "";
      const expiry = it.expiry_date || "";
      const days = this.computeDaysRemaining(it.expiry_date);
      const temp = it.storage_temperature || "";

      return [
        `"${lotId}"`,
        `"${name.replace(/"/g, '""')}"`,
        `"${cat}"`,
        `"${zone.replace(/"/g, '""')}"`,
        qty,
        `"${unit}"`,
        score,
        `"${status}"`,
        `"${expiry}"`,
        days,
        temp
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `warehouse_quality_compliance_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof showToast === "function") showToast("Warehouse Quality CSV exported successfully.", "success");
  }

  printReportsSection() {
    window.print();
  }


  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("active");
  }
}

// Global App Instance
const warehouseApp = new WarehouseApp();

document.addEventListener("DOMContentLoaded", () => {
  warehouseApp.init();
});
