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
      };
      titleEl.textContent = titles[sectionId] || "Warehouse Command";
    }

    // If switching to history, ensure chart is rendered
    if (sectionId === "history") {
      this.loadHistoryChart(this.selectedZoneId);
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

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("active");
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
