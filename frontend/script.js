// =========================================================
// FRESHSENSE AI - MULTI-PAGE PLATFORM ENGINE
// Target Backend: https://freshsense-ai-to4k.onrender.com
// =========================================================

const API_BASE_URL = "https://freshsense-ai-to4k.onrender.com";
const API_URL = API_BASE_URL;

// Global Cache & Chart Instances
let cachedInventory = [];
let cachedAlerts = [];
let gradeChartInstance = null;
let trendChartInstance = null;
let categoryChartInstance = null;
let spoilageChartInstance = null;
let overviewGradeChartInstance = null;

// =========================================================
// UTILITIES & SAFETY
// =========================================================

function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getLoggedInUserId() {
    return localStorage.getItem("userId") || null;
}

function getLoggedInUserName() {
    return localStorage.getItem("userName") || "User";
}

function getLoggedInUserEmail() {
    return localStorage.getItem("userEmail") || "";
}

function getLoggedInUserRole() {
    return localStorage.getItem("userRole") || "Consumer";
}

function getGradeClass(grade) {
    const g = (grade || "").toLowerCase().replace(/\s+/g, "-");
    if (g.includes("fresh")) return "grade-fresh";
    if (g.includes("good")) return "grade-good";
    if (g.includes("acceptable")) return "grade-acceptable";
    if (g.includes("near") || g.includes("spoilage")) return "grade-near-spoilage";
    return "grade-spoiled";
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (sidebar) sidebar.classList.toggle("open");
    if (backdrop) backdrop.classList.toggle("open");
}

// =========================================================
// AUTHENTICATION & SESSION MANAGEMENT
// =========================================================

function checkDashboardAuth() {
    const path = window.location.pathname.toLowerCase();
    const isIndex = path.endsWith("index.html") || path.endsWith("/") || path === "";

    const userId = getLoggedInUserId();

    if (!isIndex && !userId) {
        window.location.href = "index.html";
        return;
    }

    if (isIndex && userId) {
        // Already logged in, can redirect to dashboard
        // (optional: keep or allow landing page)
    }

    // Populate user info across pages
    const name = getLoggedInUserName();
    const email = getLoggedInUserEmail();
    const role = getLoggedInUserRole();

    const userEmailElems = document.querySelectorAll(".user-email");
    userEmailElems.forEach(el => {
        el.textContent = name || email || "User";
    });

    const headerRole = document.getElementById("headerRole");
    if (headerRole) {
        headerRole.textContent = `Role: ${role}`;
    }

    const sidebarUserName = document.getElementById("sidebarUserName");
    if (sidebarUserName) {
        sidebarUserName.textContent = name || email || "User";
    }

    const sidebarUserRole = document.getElementById("sidebarUserRole");
    if (sidebarUserRole) {
        sidebarUserRole.textContent = role;
    }

    const sidebarAvatar = document.getElementById("sidebarAvatar");
    if (sidebarAvatar && name) {
        sidebarAvatar.textContent = name.charAt(0).toUpperCase();
    }

    // Dynamic Admin Panel Link Injection in Sidebar
    const nav = document.querySelector(".sidebar-nav");
    if (nav && (role === "Administrator" || role === "admin")) {
        if (!document.getElementById("adminNavLink")) {
            const adminLink = document.createElement("a");
            adminLink.id = "adminNavLink";
            adminLink.href = "admin.html";
            const isAdmPage = window.location.pathname.toLowerCase().endsWith("admin.html");
            adminLink.className = "nav-item" + (isAdmPage ? " active" : "");
            adminLink.innerHTML = `<span class="nav-icon">🛡️</span><span class="nav-text">Admin Panel</span>`;
            const profileLink = nav.querySelector('a[href="profile.html"]');
            if (profileLink) {
                nav.insertBefore(adminLink, profileLink);
            } else {
                nav.appendChild(adminLink);
            }
        }
    }
}


function logout() {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    window.location.href = "index.html";
}

// Auth toggles for index.html
function showLogin() {
    const loginBox = document.getElementById("loginBox");
    const registerBox = document.getElementById("registerBox");
    if (loginBox && registerBox) {
        registerBox.classList.add("hidden");
        loginBox.classList.remove("hidden");
    }
}

function showRegister() {
    const loginBox = document.getElementById("loginBox");
    const registerBox = document.getElementById("registerBox");
    if (loginBox && registerBox) {
        loginBox.classList.add("hidden");
        registerBox.classList.remove("hidden");
    }
}

async function register() {
    const nameInput = document.getElementById("registerName");
    const emailInput = document.getElementById("registerEmail");
    const passwordInput = document.getElementById("registerPassword");
    const confirmInput = document.getElementById("registerConfirmPassword");
    const roleInput = document.getElementById("registerRole");
    const btn = document.getElementById("registerBtn");

    if (!nameInput || !emailInput || !passwordInput) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput ? confirmInput.value : password;
    const role = roleInput ? roleInput.value : "Consumer";

    if (!name) {
        alert("Please enter your full name.");
        nameInput.focus();
        return;
    }

    if (!email || !email.includes("@")) {
        alert("Please enter a valid email address.");
        emailInput.focus();
        return;
    }

    if (password.length < 6) {
        alert("Password must contain at least 6 characters.");
        passwordInput.focus();
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match. Please re-enter.");
        if (confirmInput) confirmInput.focus();
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = "Creating Account... <span>⌛</span>";
        }

        const response = await fetch(`${API_BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name,
                email: email,
                password: password,
                role: role
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message || "Registration successful! You can now sign in.");
            nameInput.value = "";
            emailInput.value = "";
            passwordInput.value = "";
            if (confirmInput) confirmInput.value = "";
            showLogin();
            const loginEmail = document.getElementById("loginEmail");
            if (loginEmail) loginEmail.value = email;
        } else {
            alert(data.detail || "Registration failed. Please check your information.");
        }
    } catch (error) {
        console.error("Register network error:", error);
        alert(`Cannot connect to FreshSense AI backend.\nPlease ensure FastAPI is running on ${API_BASE_URL}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = "Create Account <span>→</span>";
        }
    }
}

async function login() {
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const btn = document.getElementById("loginBtn");

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) {
        alert("Please enter your email address.");
        emailInput.focus();
        return;
    }

    if (!password) {
        alert("Please enter your password.");
        passwordInput.focus();
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = "Signing In... <span>⌛</span>";
        }

        const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem("userId", data.user_id);
            localStorage.setItem("userName", data.name || "User");
            localStorage.setItem("userEmail", data.email);
            localStorage.setItem("userRole", data.role || "Consumer");

            window.location.href = "dashboard.html";
        } else {
            alert(data.detail || "Invalid email or password.");
        }
    } catch (error) {
        console.error("Login network error:", error);
        alert(`Cannot connect to FreshSense AI backend.\nPlease ensure FastAPI is running on ${API_BASE_URL}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = "Enter Dashboard <span>→</span>";
        }
    }
}

function updateRoleFocusCard() {
    const role = getLoggedInUserRole();
    const badge = document.getElementById("roleBadgeTitle");
    const heading = document.getElementById("roleFocusHeading");
    const text = document.getElementById("roleFocusText");
    const actions = document.getElementById("roleFocusActions");
    if (!badge || !heading || !text) return;

    badge.textContent = `Role Focus: ${role}`;

    if (role === "Retail Manager") {
        heading.textContent = "Supermarket Stock Rotation & FEFO Markdown";
        text.textContent = "Monitor store shelves for items near expiry, prioritize First-Expired First-Out dispensing, and identify markdowns.";
        if (actions) actions.innerHTML = `<a href="inventory.html" class="btn-primary" style="padding: 6px 14px; font-size: 13px;">Manage FEFO Stock</a><button onclick="exportExcel()" class="btn-secondary" style="padding: 6px 14px; font-size: 13px;">Export Inventory</button>`;
    } else if (role === "Warehouse Operator") {
        heading.textContent = "Cold Chain Telemetry & Bulk Storage Logistics";
        text.textContent = "Track temperature deviations, relative humidity compliance, and batch storage life across warehouse chambers.";
        if (actions) actions.innerHTML = `<a href="storage.html" class="btn-primary" style="padding: 6px 14px; font-size: 13px;">Storage Telemetry</a><a href="inventory.html" class="btn-secondary" style="padding: 6px 14px; font-size: 13px;">Batch Inventory</a>`;
    } else if (role === "Food Quality Inspector") {
        heading.textContent = "Quality Assurance, Defect Classification & Lab Audit";
        text.textContent = "Perform 5-tier classification audits, surface mold detection checks, and generate formal inspection compliance certificates.";
        if (actions) actions.innerHTML = `<a href="inspection.html" class="btn-primary" style="padding: 6px 14px; font-size: 13px;">Quality Inspection</a><button onclick="exportPDF()" class="btn-secondary" style="padding: 6px 14px; font-size: 13px;">Download Audit PDF</button>`;
    } else if (role === "Administrator" || role === "admin") {
        heading.textContent = "System Oversight & Enterprise Platform Control";
        text.textContent = "Monitor active platform users, neural inference latency, system status, and configure organizational access.";
        if (actions) actions.innerHTML = `<a href="admin.html" class="btn-primary" style="padding: 6px 14px; font-size: 13px;">Admin Control Center</a><button onclick="exportPDF()" class="btn-secondary" style="padding: 6px 14px; font-size: 13px;">System Audit PDF</button>`;
    } else {
        // Consumer
        heading.textContent = "Household Freshness & Quality Guidance";
        text.textContent = "Track grocery freshness, avoid food waste, and receive safe consumption recommendations for your home.";
        if (actions) actions.innerHTML = `<a href="inspection.html" class="btn-primary" style="padding: 6px 14px; font-size: 13px;">Analyze Groceries</a><a href="shelf-life.html" class="btn-secondary" style="padding: 6px 14px; font-size: 13px;">Check Shelf-Life</a>`;
    }
}

// =========================================================
// PAGE 2 — OVERVIEW (dashboard.html)
// =========================================================

async function loadOverviewPage() {
    updateRoleFocusCard();

const role = (getLoggedInUserRole() || "Consumer").trim().toLowerCase();
const loggedInUserId = getLoggedInUserId();
const isStaff = [
    "warehouse operator",
    "retail manager",
    "food quality inspector",
    "administrator",
    "admin"
].includes(role);

const userId = isStaff ? null : loggedInUserId;

    // 1. Fetch Statistics for summary counts
    try {
        const statsUrl = userId ? `${API_BASE_URL}/statistics?user_id=${userId}` : `${API_BASE_URL}/statistics`;
        const res = await fetch(statsUrl);
        if (res.ok) {
            const data = await res.json();
            const total = Number(data.total_analyses || 0);
            const dist = data.grade_distribution || {};

            const ovTotal = document.getElementById("ovTotalAnalyses");
            if (ovTotal) ovTotal.textContent = total;

            const ovFresh = document.getElementById("ovFreshCount");
            if (ovFresh) ovFresh.textContent = dist["Fresh"] || 0;

            const ovGood = document.getElementById("ovGoodCount");
            if (ovGood) ovGood.textContent = dist["Good"] || 0;

            const ovAcceptable = document.getElementById("ovAcceptableCount");
            if (ovAcceptable) ovAcceptable.textContent = dist["Acceptable"] || 0;

            const ovNearSpoilage = document.getElementById("ovNearSpoilageCount");
            if (ovNearSpoilage) ovNearSpoilage.textContent = dist["Near Spoilage"] || 0;

            const ovSpoiled = document.getElementById("ovSpoiledCount");
            if (ovSpoiled) ovSpoiled.textContent = dist["Spoiled"] || 0;

            const ovAvgFreshness = document.getElementById("ovAvgFreshness");
            if (ovAvgFreshness) ovAvgFreshness.textContent = `${Number(data.average_freshness_score || 0).toFixed(1)}%`;

            const ovAvgConfidence = document.getElementById("ovAvgConfidence");
            if (ovAvgConfidence) ovAvgConfidence.textContent = `${Number(data.average_confidence || 0).toFixed(1)}%`;

            renderOverviewGradeChart(dist);
        }
    } catch (err) {
        console.error("Error loading overview stats:", err);
    }

    // 2. Fetch inventory insights for Items Near Expiry count
    try {
        const invUrl = userId ? `${API_BASE_URL}/inventory-insights?user_id=${userId}` : `${API_BASE_URL}/inventory-insights`;
        const res = await fetch(invUrl);
        if (res.ok) {
            const data = await res.json();
            const nearExpiry = (data.consume_first || []).length;
            const ovNearExpiry = document.getElementById("ovNearExpiryCount");
            if (ovNearExpiry) ovNearExpiry.textContent = nearExpiry;
        }
    } catch (err) {
        console.error("Error loading overview inventory insights:", err);
    }

    // 3. Fetch Recent Inspections (Last 5)
    try {
        const histUrl = userId ? `${API_BASE_URL}/history?user_id=${userId}` : `${API_BASE_URL}/history`;
        const res = await fetch(histUrl);
        if (res.ok) {
            const history = await res.json();
            const body = document.getElementById("ovRecentHistoryBody");
            if (body && Array.isArray(history)) {
                if (history.length === 0) {
                    body.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No inspections recorded yet. Start by inspecting your first food item!</td></tr>`;
                } else {
                    const recent = history.slice(0, 5);
                    body.innerHTML = recent.map(item => {
                        const isFresh = (item.result || "").toLowerCase() === "fresh";
                        const grade = item.grade || (isFresh ? "Fresh" : "Spoiled");
                        const dateStr = item.created_at ? new Date(item.created_at).toLocaleString() : "Recently";
                        const fScore = Number(item.freshness_score !== undefined ? item.freshness_score : (isFresh ? item.confidence : Math.max(0, 100 - item.confidence)));
                        return `
                            <tr>
                                <td>${escapeHTML(dateStr)}</td>
                                <td>📷 ${escapeHTML(item.image_name || "Food Image")}</td>
                                <td><span class="badge ${isFresh ? 'badge-fresh' : 'badge-spoiled'}">${escapeHTML(item.result)}</span></td>
                                <td><span class="badge ${getGradeClass(grade)}">${escapeHTML(grade)}</span></td>
                                <td>${Number(item.confidence || 0).toFixed(1)}%</td>
                                <td style="color: var(--primary-light); font-weight: 700;">${fScore.toFixed(1)}%</td>
                            </tr>
                        `;
                    }).join("");
                }
            }
        }
    } catch (err) {
        console.error("Error loading overview recent history:", err);
    }

    // 4. Fetch Recent Alerts (Top 4)
    try {
        const alertUrl = userId ? `${API_BASE_URL}/alerts?user_id=${userId}` : `${API_BASE_URL}/alerts`;
        const res = await fetch(alertUrl);
        if (res.ok) {
            const alerts = await res.json();
            const container = document.getElementById("ovRecentAlertsContainer");
            if (container && Array.isArray(alerts)) {
                if (alerts.length === 0) {
                    container.innerHTML = `<div class="insight-card">✅ No active warnings. All tracked items are within safe limits.</div>`;
                } else {
                    const topAlerts = alerts.slice(0, 4);
                    container.innerHTML = topAlerts.map(a => {
                        const type = a.type || "INFO";
                        const icon = type === "CRITICAL" ? "🚨" : (type === "WARNING" ? "⚠️" : (type === "STORAGE_WARNING" ? "🌡️" : "ℹ️"));
                        return `
                            <div class="alert-card alert-${type}" style="padding: 12px 14px; margin-bottom: 8px;">
                                <span style="font-size: 20px;">${icon}</span>
                                <div style="flex: 1;">
                                    <strong>[${escapeHTML(a.badge || type)}] ${escapeHTML(a.title)}</strong>
                                    <div style="font-size: 13px; margin-top: 2px;">${escapeHTML(a.message)}</div>
                                </div>
                            </div>
                        `;
                    }).join("");
                }
            }
        }
    } catch (err) {
        console.error("Error loading overview recent alerts:", err);
    }
}

function renderOverviewGradeChart(dist) {
    const canvas = document.getElementById("overviewGradeChart");
    if (!canvas || !window.Chart) return;

    const labels = ["Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled"];
    const counts = labels.map(l => dist[l] || 0);

    if (overviewGradeChartInstance) {
        overviewGradeChartInstance.data.datasets[0].data = counts;
        overviewGradeChartInstance.update();
        return;
    }

    const ctx = canvas.getContext("2d");
    overviewGradeChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: ["#10b981", "#34d399", "#f59e0b", "#f97316", "#ef4444"],
                borderWidth: 2,
                borderColor: "#0f172a"
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { color: "#94a3b8", font: { size: 12 } }
                }
            }
        }
    });
}

// =========================================================
// PAGE 3 — FOOD INSPECTION (inspection.html)
// =========================================================

function setupInspectionDragAndDrop() {
    const uploadArea = document.getElementById("uploadArea");
    if (!uploadArea) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
        }, false);
    });

    uploadArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            const input = document.getElementById('foodImage');
            if (input) {
                input.files = files;
                handleImageSelection({ target: input });
            }
        }
    }, false);
}

function handleImageSelection(event) {
    const input = event.target || document.getElementById("foodImage");
    const fileName = document.getElementById("fileName");
    const preview = document.getElementById("preview");
    const previewContainer = document.getElementById("previewContainer");
    const placeholder = document.getElementById("previewPlaceholder");
    const resultBox = document.getElementById("predictionResult");

    if (!input || !input.files || input.files.length === 0) {
        if (fileName) fileName.textContent = "No image selected";
        if (previewContainer) previewContainer.style.display = "none";
        return;
    }

    const file = input.files[0];
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!allowed.includes(file.type) && !["jpg", "jpeg", "png", "webp"].includes(ext)) {
        alert("Invalid file type. Please select a JPG, JPEG, or PNG image.");
        input.value = "";
        if (fileName) fileName.textContent = "No image selected";
        if (previewContainer) previewContainer.style.display = "none";
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert("File size is too large (maximum allowed is 10 MB). Please choose a smaller image.");
        input.value = "";
        if (fileName) fileName.textContent = "No image selected";
        if (previewContainer) previewContainer.style.display = "none";
        return;
    }

    if (fileName) fileName.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    const reader = new FileReader();
    reader.onload = function(e) {
        if (preview) preview.src = e.target.result;
        if (previewContainer) previewContainer.style.display = "flex";
        if (placeholder) placeholder.textContent = "Image ready for analysis";
    };
    reader.readAsDataURL(file);

    if (resultBox) {
        resultBox.innerHTML = `
            <div class="result-empty">
                <div class="result-icon">📷</div>
                <h3>Image Loaded & Ready</h3>
                <p>Click <strong>Analyze Food Freshness & Quality</strong> to begin deep-learning inspection.</p>
            </div>
        `;
    }
}

async function predictFood() {
    const input = document.getElementById("foodImage");
    const button = document.getElementById("analyzeButton");
    const resultBox = document.getElementById("predictionResult");

    if (!input || !input.files || input.files.length === 0) {
        alert("Please choose a food image first before analyzing.");
        return;
    }

    const file = input.files[0];
    const userId = getLoggedInUserId();

    const formData = new FormData();
    formData.append("file", file);
    if (userId) formData.append("user_id", userId);

    // Contextual parameters
    const cat = document.getElementById("analysisCategory");
    const temp = document.getElementById("analysisTemp");
    const hum = document.getElementById("analysisHumidity");
    const days = document.getElementById("analysisDaysStored");
    const pack = document.getElementById("analysisPackaging");
    const exp = document.getElementById("analysisExpiryDate");

    if (cat && cat.value) formData.append("category", cat.value);
    if (temp && temp.value !== "") formData.append("temperature", temp.value);
    if (hum && hum.value !== "") formData.append("humidity", hum.value);
    if (days && days.value !== "") formData.append("storage_duration_days", days.value);
    if (pack && pack.value) formData.append("packaging_type", pack.value);
    if (exp && exp.value) formData.append("expiry_date", exp.value);

    if (resultBox) {
        resultBox.innerHTML = `
            <div class="result-content">
                <div class="result-icon">⏳</div>
                <h3>Analyzing Food Quality & Spoilage...</h3>
                <p>Running MobileNetV2 inference, color degradation metrics, and surface texture mapping...</p>
            </div>
        `;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Inspecting Sample...";
    }

    try {
        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Food analysis failed.");
        }

        displayPrediction(data);

    } catch (error) {
        console.error("Prediction error:", error);
        if (resultBox) {
            resultBox.innerHTML = `
                <div class="result-empty">
                    <div class="result-icon">⚠️</div>
                    <h3>Analysis Failed</h3>
                    <p>${escapeHTML(error.message)}</p>
                </div>
            `;
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "🤖 Analyze Food Freshness & Quality";
        }
    }
}

function displayPrediction(data) {
    const resultBox = document.getElementById("predictionResult");
    if (!resultBox) return;

    const result = data.result || "Unknown";
    const grade = data.grade || (result === "Fresh" ? "Fresh" : "Spoiled");
    const confidence = Number(data.confidence || 0);
    const freshnessScore = Number(data.freshness_score !== undefined ? data.freshness_score : 85.0);
    const overallHealthScore = Number(data.overall_health_score !== undefined ? data.overall_health_score : freshnessScore);
    const isFresh = result.toLowerCase() === "fresh";

    const statusClass = isFresh ? "fresh" : "spoiled";
    const gradeClass = getGradeClass(grade);
    const icon = isFresh ? "🥬" : "⚠️";
    const boxClass = isFresh ? "fresh-box" : "spoiled-box";

    // Dynamic meter color
    let meterColor = "#10b981";
    if (freshnessScore >= 85.0) meterColor = "#10b981";
    else if (freshnessScore >= 70.0) meterColor = "#34d399";
    else if (freshnessScore >= 50.0) meterColor = "#f59e0b";
    else if (freshnessScore >= 25.0) meterColor = "#f97316";
    else meterColor = "#ef4444";

    const color = data.color_analysis || {};
    const avgRgb = color.average_rgb || [0, 0, 0];
    const swatchRgb = `rgb(${avgRgb[0]}, ${avgRgb[1]}, ${avgRgb[2]})`;
    const texture = data.texture_analysis || {};
    const surface = data.surface_indicators || {};

    const consumptionRec = data.consumption_recommendation || data.recommendation || "";
    const storageRec = data.storage_recommendation || "";
    const shelfLife = data.shelf_life_estimate || {};

    resultBox.innerHTML = `
        <div class="result-content">
            <div class="result-icon">${icon}</div>
            <h2>Inspection & Freshness Result</h2>

            <div style="display: flex; justify-content: center; align-items: center; gap: 14px; margin: 12px 0; flex-wrap: wrap;">
                <div class="result-status ${statusClass}" style="margin: 0;">
                    ${escapeHTML(result)}
                </div>
                <div class="badge ${gradeClass}" style="font-size: 15px; padding: 6px 14px; text-transform: uppercase;">
                    Grade: ${escapeHTML(grade)}
                </div>
            </div>

            <!-- FRESHNESS SCORE METER -->
            <div class="freshness-meter-container">
                <div class="meter-header">
                    <span class="meter-title">Food Freshness Score</span>
                    <span class="meter-score" style="color: ${meterColor};">${freshnessScore.toFixed(2)}%</span>
                </div>
                <div class="meter-track">
                    <div class="meter-fill" style="width: ${freshnessScore}%; background: ${meterColor};"></div>
                </div>
                <div class="meter-scale">
                    <span>0% (Spoiled)</span>
                    <span>25% (Near Spoilage)</span>
                    <span>50% (Acceptable)</span>
                    <span>70% (Good)</span>
                    <span>85% - 100% (Fresh)</span>
                </div>
            </div>

            <!-- OVERALL WEIGHTED HEALTH SCORE -->
            <div class="health-score-container">
                <div class="health-score-header">
                    <h4>Overall Food Quality Score</h4>
                    <span class="big-score">${overallHealthScore.toFixed(1)} / 100</span>
                </div>
                <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 8px;">
                    Weighted synthesis: Visual Analysis (40%) + Storage (25%) + Shelf-Life (20%) + Product Age (15%)
                </p>
                <div class="score-breakdown-grid">
                    <div class="score-factor-item">
                        <strong>Visual Score:</strong> ${data.quality_scoring?.visual_condition_score ?? freshnessScore}%
                    </div>
                    <div class="score-factor-item">
                        <strong>Storage Score:</strong> ${data.quality_scoring?.storage_condition_score !== null && data.quality_scoring?.storage_condition_score !== undefined ? data.quality_scoring.storage_condition_score + '%' : 'Default / Missing'}
                    </div>
                    <div class="score-factor-item">
                        <strong>Shelf-Life Score:</strong> ${data.quality_scoring?.shelf_life_score !== null && data.quality_scoring?.shelf_life_score !== undefined ? data.quality_scoring.shelf_life_score.toFixed(1) + '%' : 'Calculated'}
                    </div>
                    <div class="score-factor-item">
                        <strong>Remaining Days:</strong> ${shelfLife.estimated_remaining_days !== undefined ? shelfLife.estimated_remaining_days + ' days' : 'N/A'}
                    </div>
                </div>
            </div>

            <!-- TRI-GRID: COLOR, TEXTURE, SURFACE INDICATORS -->
            <div class="analysis-tri-grid">
                <!-- COLOR ANALYSIS -->
                <div class="analysis-card">
                    <h4>
                        <span>🎨 Color Analysis</span>
                        <span class="badge ${color.color_condition === 'Good' ? 'badge-fresh' : (color.color_condition === 'Moderate' ? 'badge-expiring' : 'badge-spoiled')}">
                            ${escapeHTML(color.color_condition || 'N/A')}
                        </span>
                    </h4>
                    <div class="color-swatch-box">
                        <div class="color-swatch" style="background: ${swatchRgb};"></div>
                        <span style="font-size: 13px; font-weight: 600;">${escapeHTML(color.dominant_color || 'Sampled')}</span>
                    </div>
                    <div class="analysis-metric-row">
                        <span>Avg RGB</span>
                        <strong>${avgRgb.join(', ')}</strong>
                    </div>
                    <div class="analysis-metric-row">
                        <span>Brightness</span>
                        <strong>${color.brightness || 0}%</strong>
                    </div>
                    <div class="analysis-metric-row">
                        <span>Consistency</span>
                        <strong>${escapeHTML(color.color_consistency || 'N/A')}</strong>
                    </div>
                    <div class="analysis-metric-row">
                        <span>Discoloration</span>
                        <strong>${color.discoloration_index || 0}%</strong>
                    </div>
                </div>

                <!-- TEXTURE ANALYSIS -->
                <div class="analysis-card">
                    <h4>
                        <span>🔬 Texture Analysis</span>
                        <span class="badge ${texture.texture_condition === 'Good' ? 'badge-fresh' : (texture.texture_condition === 'Moderate' ? 'badge-expiring' : 'badge-spoiled')}">
                            ${escapeHTML(texture.texture_condition || 'N/A')}
                        </span>
                    </h4>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">
                        ${escapeHTML(texture.summary || 'Surface granularity evaluation')}
                    </div>
                    <div class="analysis-metric-row">
                        <span>Surface Roughness</span>
                        <strong>${texture.surface_roughness || 0} / 100</strong>
                    </div>
                    <div class="analysis-metric-row">
                        <span>Laplacian Variance</span>
                        <strong>${texture.laplacian_variance || 0}</strong>
                    </div>
                    <div class="analysis-metric-row">
                        <span>Edge Density</span>
                        <strong>${texture.edge_density || 0}%</strong>
                    </div>
                    <div class="analysis-metric-row">
                        <span>Local Contrast</span>
                        <strong>${texture.contrast_index || 0}</strong>
                    </div>
                </div>

                <!-- SURFACE INDICATORS (CLEARLY LABELED HEURISTIC) -->
                <div class="analysis-card">
                    <h4>
                        <span>🔍 Surface Indicators</span>
                        <span class="badge badge-info" style="font-size: 11px;">Image-based heuristic</span>
                    </h4>
                    <div class="analysis-metric-row">
                        <span>Mold Spore Indicator</span>
                        <strong style="color: ${surface.mold_detected ? 'var(--spoiled)' : 'var(--fresh)'};">
                            ${surface.mold_detected ? '⚠️ Detected (' + surface.mold_risk + ' Risk)' : '✅ None Detected'}
                        </strong>
                    </div>
                    <div class="analysis-metric-row">
                        <span>Bruising / Softening</span>
                        <strong style="color: ${surface.bruising_detected ? '#f59e0b' : 'var(--fresh)'};">
                            ${surface.bruising_detected ? '⚠️ Detected (' + surface.bruising_ratio + '%)' : '✅ Clear'}
                        </strong>
                    </div>
                    <div class="analysis-metric-row">
                        <span>Physical Damage</span>
                        <strong style="color: ${surface.physical_damage_detected ? '#f97316' : 'var(--fresh)'};">
                            ${surface.physical_damage_detected ? '⚠️ Visible Fractures' : '✅ Intact'}
                        </strong>
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 10px; font-style: italic;">
                        *Transparent computer-vision heuristic using color-contrast gradients.
                    </div>
                </div>
            </div>

            <div style="margin: 12px 0; font-size: 14px; color: var(--text-secondary);">
                Model Confidence: <strong style="color: var(--primary-light);">${confidence.toFixed(2)}%</strong>
            </div>

            <!-- RECOMMENDATIONS -->
            <div class="recommendation ${boxClass}" style="margin-top: 16px;">
                <div style="margin-bottom: 6px;"><strong>🍽️ Consumption Recommendation:</strong> ${escapeHTML(consumptionRec)}</div>
                <div><strong>📦 Recommended Storage Action:</strong> ${escapeHTML(storageRec)}</div>
            </div>

            <div style="display: flex; justify-content: center; gap: 14px; margin-top: 20px; flex-wrap: wrap;">
                <a href="inventory.html" class="btn-primary">➕ Add to Inventory</a>
                <a href="shelf-life.html" class="btn-secondary">⏳ Check Extended Shelf-Life</a>
            </div>
        </div>
    `;
}

// =========================================================
// PAGE 4 — STORAGE ANALYSIS (storage.html)
// =========================================================

async function evaluateStorageParams() {
    const cat = document.getElementById("storageCat")?.value || "Fruits";
    const temp = parseFloat(document.getElementById("storageTemp")?.value) || 20.0;
    const hum = parseFloat(document.getElementById("storageHum")?.value) || 55.0;
    const air = document.getElementById("storageAir")?.value || "Good";
    const light = document.getElementById("storageLight")?.value || "Low";
    const pack = document.getElementById("storagePack")?.value || "Standard";
    const box = document.getElementById("storageResultBox");

    if (!box) return;

    box.innerHTML = `<div class="eval-box">Evaluating ambient storage conditions...</div>`;

    try {
        const response = await fetch(`${API_BASE_URL}/storage-analysis`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                category: cat,
                temperature: temp,
                humidity: hum,
                air_circulation: air,
                light_exposure: light,
                packaging_type: pack
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Failed to evaluate storage");

        const cond = data.condition || "Warning";
        const badgeClass = cond === "Good" ? "badge-fresh" : (cond === "Warning" ? "badge-expiring" : "badge-spoiled");

        box.innerHTML = `
            <div class="eval-box">
                <div class="eval-header">
                    <h3>Storage Evaluation for ${escapeHTML(cat)}</h3>
                    <span class="badge ${badgeClass}" style="font-size: 15px; padding: 6px 14px;">
                        Status: ${escapeHTML(cond)} (Score: ${data.storage_score}%)
                    </span>
                </div>

                <div class="eval-status-chips">
                    <div class="eval-chip">🌡️ <strong>Temp Status:</strong> ${temp}°C (${temp <= 4.0 ? 'Refrigerated' : (temp <= 12.0 ? 'Cool' : 'Warm Ambient')})</div>
                    <div class="eval-chip">💧 <strong>Humidity:</strong> ${hum}%</div>
                    <div class="eval-chip">💨 <strong>Airflow:</strong> ${escapeHTML(air)}</div>
                    <div class="eval-chip">☀️ <strong>Light:</strong> ${escapeHTML(light)}</div>
                </div>

                <div style="font-size: 13px; color: var(--text-secondary); margin: 10px 0;">
                    <strong>Recommended Location:</strong> ${escapeHTML(data.preferred_location)} • <strong>Packaging:</strong> ${escapeHTML(data.preferred_packaging)}
                </div>

                <h4 style="color: var(--primary-light); margin-top: 14px;">📦 Storage Recommendations:</h4>
                <ul class="eval-recommendation-list">
                    ${(data.recommendations || []).map(r => `<li>${escapeHTML(r)}</li>`).join("")}
                </ul>
            </div>
        `;
    } catch (err) {
        console.error("Storage eval error:", err);
        box.innerHTML = `<div class="eval-box" style="color: var(--spoiled);">Error evaluating storage parameters.</div>`;
    }
}

// =========================================================
// PAGE 5 — SHELF-LIFE (shelf-life.html)
// =========================================================

async function calculateShelfLifeManual() {
    const cat = document.getElementById("slCat")?.value || "Fruits";
    const freshness = parseFloat(document.getElementById("slFreshness")?.value) || 85.0;
    const temp = parseFloat(document.getElementById("slTemp")?.value) || 4.0;
    const daysStored = parseInt(document.getElementById("slDaysStored")?.value) || 1;
    const expiry = document.getElementById("slExpiry")?.value || null;
    const box = document.getElementById("shelfLifeResultBox");

    if (!box) return;

    box.innerHTML = `<div class="eval-box">Computing kinetic shelf-life degradation...</div>`;

    try {
        const response = await fetch(`${API_BASE_URL}/shelf-life`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                category: cat,
                freshness_score: freshness,
                temperature: temp,
                storage_duration_days: daysStored,
                expiry_date: expiry
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Failed to calculate shelf life");

        const risk = data.risk_level || "Low";
        const badgeClass = risk === "Low" ? "badge-fresh" : (risk === "Moderate" ? "badge-expiring" : "badge-spoiled");

        // Progress calculation
        const baseDays = data.category_base_shelf_life || 7.0;
        const remainDays = data.estimated_remaining_days || 0;
        const progressPct = Math.min(100, Math.max(0, (remainDays / baseDays) * 100));

        box.innerHTML = `
            <div class="eval-box">
                <div class="eval-header">
                    <h3>Estimated Remaining Shelf Life: <span style="color: var(--primary-light); font-weight: 800;">${data.estimated_remaining_days} Days</span></h3>
                    <span class="badge ${badgeClass}" style="font-size: 15px; padding: 6px 14px;">
                        Risk Level: ${escapeHTML(risk)}
                    </span>
                </div>

                <!-- Progress Bar -->
                <div style="margin: 14px 0;">
                    <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">
                        <span>Usable Lifespan Remaining</span>
                        <span>${progressPct.toFixed(0)}%</span>
                    </div>
                    <div class="meter-track" style="height: 10px;">
                        <div class="meter-fill" style="width: ${progressPct}%; background: ${risk === 'Low' ? '#10b981' : (risk === 'Moderate' ? '#f59e0b' : '#ef4444')};"></div>
                    </div>
                </div>

                <div class="score-breakdown-grid" style="margin-top: 14px;">
                    <div class="score-factor-item">
                        <strong>Projected Expiry Date:</strong> ${escapeHTML(data.expiry_forecast || "N/A")}
                    </div>
                    <div class="score-factor-item">
                        <strong>Shelf-Life Trend:</strong> ${escapeHTML(data.shelf_life_trend || "Stable")}
                    </div>
                    <div class="score-factor-item">
                        <strong>Temperature Penalty:</strong> ${temp > 10.0 ? 'Accelerated Degradation' : 'Preserved'}
                    </div>
                    <div class="score-factor-item">
                        <strong>Freshness Score Factor:</strong> ${freshness.toFixed(1)}%
                    </div>
                </div>

                <h4 style="color: var(--primary-light); margin-top: 16px;">💡 Shelf-Life Recommendation:</h4>
                <p style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">
                    ${escapeHTML(data.recommendation || "Maintain cool refrigeration to retard spoilage kinetics.")}
                </p>

                <p style="font-size: 11px; color: var(--text-muted); margin-top: 12px; font-style: italic;">
                    *Kinetic Basis: ${escapeHTML(data.basis || "Q10 temperature coefficient model and category baseline.")}
                </p>
            </div>
        `;
    } catch (err) {
        console.error("Shelf-life calc error:", err);
        box.innerHTML = `<div class="eval-box" style="color: var(--spoiled);">Error calculating shelf-life.</div>`;
    }
}

// =========================================================
// PAGE 6 — INVENTORY & FEFO (inventory.html)
// =========================================================

async function loadInventoryPage() {
    await loadInventory();
    await loadInventoryInsights();
    setupInventoryFilters();
}

async function loadInventory() {
    const body = document.getElementById("inventoryBody");
    if (!body) return;

    const userId = getLoggedInUserId();
    const url = userId ? `${API_BASE_URL}/inventory?user_id=${userId}` : `${API_BASE_URL}/inventory`;

    try {
        const response = await fetch(url);
        const items = await response.json();

        if (!response.ok) throw new Error(items.detail || "Could not load inventory");

        cachedInventory = Array.isArray(items) ? items : [];
        renderInventoryTable(cachedInventory);

    } catch (err) {
        console.error("Load inventory error:", err);
        body.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--spoiled); padding: 18px;">Error loading inventory from database.</td></tr>`;
    }
}

function renderInventoryTable(items) {
    const body = document.getElementById("inventoryBody");
    if (!body) return;

    if (!items || items.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    No food items found matching your filters. Add items using the registration form above!
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = items.map(item => {
        let priorityBadge = `<span class="badge badge-stable">Stable</span>`;
        if (item.consumption_priority === "Consume First" || item.is_urgent || item.is_expired) {
            priorityBadge = `<span class="badge badge-consume-first">Consume First</span>`;
        } else if (item.days_left !== null && item.days_left <= 5) {
            priorityBadge = `<span class="badge badge-expiring">Expiring Soon</span>`;
        }

        const daysText = item.days_left !== null
            ? (item.days_left < 0 ? `<span style="color: var(--spoiled); font-weight:700;">Expired (${Math.abs(item.days_left)}d ago)</span>` : `${item.days_left} days`)
            : "N/A";

        return `
            <tr>
                <td><strong>${escapeHTML(item.food_name)}</strong></td>
                <td><span class="badge badge-info">${escapeHTML(item.category || 'General')}</span></td>
                <td>${item.quantity} ${escapeHTML(item.unit || 'items')}</td>
                <td>${escapeHTML(item.batch_info || '-')}</td>
                <td>${escapeHTML(item.storage_location || "Refrigerator")}</td>
                <td>${escapeHTML(item.purchase_date || '-')}</td>
                <td>${escapeHTML(item.expiry_date)}</td>
                <td>${daysText}</td>
                <td><span class="badge ${getGradeClass(item.freshness_status)}">${escapeHTML(item.freshness_status || 'Good')}</span></td>
                <td>${priorityBadge}</td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="openEditInventoryModal(${item.id})">Edit</button>
                        <button class="btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="deleteInventoryItem(${item.id})">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function setupInventoryFilters() {
    const searchInput = document.getElementById("invSearchInput");
    const catFilter = document.getElementById("invCategoryFilter");
    const expiryFilter = document.getElementById("invExpiryFilter");

    const applyFilter = () => {
        const query = (searchInput?.value || "").toLowerCase().trim();
        const cat = catFilter?.value || "ALL";
        const exp = expiryFilter?.value || "ALL";

        const filtered = cachedInventory.filter(it => {
            const matchesQuery = !query ||
                (it.food_name && it.food_name.toLowerCase().includes(query)) ||
                (it.batch_info && it.batch_info.toLowerCase().includes(query)) ||
                (it.storage_location && it.storage_location.toLowerCase().includes(query));

            const matchesCat = (cat === "ALL") || (it.category === cat);

            let matchesExp = true;
            if (exp === "CONSUME_FIRST") {
                matchesExp = it.consumption_priority === "Consume First" || it.is_urgent || it.is_expired;
            } else if (exp === "EXPIRING_SOON") {
                matchesExp = it.days_left !== null && it.days_left <= 5 && it.days_left >= 0;
            } else if (exp === "STABLE") {
                matchesExp = it.days_left === null || it.days_left > 5;
            }

            return matchesQuery && matchesCat && matchesExp;
        });

        renderInventoryTable(filtered);
    };

    if (searchInput) searchInput.addEventListener("input", applyFilter);
    if (catFilter) catFilter.addEventListener("change", applyFilter);
    if (expiryFilter) expiryFilter.addEventListener("change", applyFilter);
}

async function addInventoryItem() {
    const userId = getLoggedInUserId();
    if (!userId) {
        alert("Please login first to manage inventory.");
        return;
    }

    const name = document.getElementById("invName")?.value.trim();
    const category = document.getElementById("invCat")?.value || "Fruits";
    const qty = parseFloat(document.getElementById("invQty")?.value) || 1.0;
    const unit = document.getElementById("invUnit")?.value || "items";
    const expiry = document.getElementById("invExpiry")?.value;
    const purchase = document.getElementById("invPurchaseDate")?.value || null;
    const batch = document.getElementById("invBatch")?.value.trim() || null;
    const location = document.getElementById("invLocation")?.value || "Refrigerator";
    const freshness = document.getElementById("invFreshness")?.value || "Fresh";
    const temp = parseFloat(document.getElementById("invStorageTemp")?.value) || null;
    const hum = parseFloat(document.getElementById("invHumidity")?.value) || null;

    if (!name) {
        alert("Please enter a food item name.");
        return;
    }
    if (!expiry) {
        alert("Please select an expiry date.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/inventory`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: parseInt(userId),
                food_name: name,
                category: category,
                quantity: qty,
                unit: unit,
                expiry_date: expiry,
                purchase_date: purchase,
                batch_info: batch,
                storage_location: location,
                freshness_status: freshness,
                storage_temperature: temp,
                humidity: hum
            })
        });

        const res = await response.json();
        if (!response.ok) throw new Error(res.detail || "Failed to add item");

        alert(`✅ ${name} added to inventory!`);
        document.getElementById("invName").value = "";
        document.getElementById("invExpiry").value = "";

        await loadInventory();
        await loadInventoryInsights();

    } catch (err) {
        console.error("Add inventory error:", err);
        alert(err.message || "Failed to add inventory item.");
    }
}

async function deleteInventoryItem(id) {
    if (!confirm("Remove this food item from your inventory?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/inventory/${id}`, { method: "DELETE" });
        if (response.ok) {
            await loadInventory();
            await loadInventoryInsights();
        } else {
            alert("Could not remove inventory item.");
        }
    } catch (err) {
        console.error("Delete inventory error:", err);
    }
}

function openEditInventoryModal(id) {
    const item = cachedInventory.find(it => it.id === id);
    if (!item) return;

    const modal = document.getElementById("editModal");
    if (!modal) return;

    document.getElementById("editItemId").value = item.id;
    document.getElementById("editItemName").value = item.food_name || "";
    document.getElementById("editItemCat").value = item.category || "Fruits";
    document.getElementById("editItemQty").value = item.quantity || 1;
    document.getElementById("editItemUnit").value = item.unit || "items";
    document.getElementById("editItemExpiry").value = item.expiry_date || "";
    document.getElementById("editItemLocation").value = item.storage_location || "Refrigerator";
    document.getElementById("editItemFreshness").value = item.freshness_status || "Good";

    modal.classList.add("open");
}

function closeEditInventoryModal() {
    const modal = document.getElementById("editModal");
    if (modal) modal.classList.remove("open");
}

async function saveEditInventoryItem() {
    const id = document.getElementById("editItemId")?.value;
    if (!id) return;

    const name = document.getElementById("editItemName")?.value.trim();
    const cat = document.getElementById("editItemCat")?.value;
    const qty = parseFloat(document.getElementById("editItemQty")?.value);
    const unit = document.getElementById("editItemUnit")?.value;
    const expiry = document.getElementById("editItemExpiry")?.value;
    const location = document.getElementById("editItemLocation")?.value;
    const freshness = document.getElementById("editItemFreshness")?.value;

    try {
        const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                food_name: name,
                category: cat,
                quantity: qty,
                unit: unit,
                expiry_date: expiry,
                storage_location: location,
                freshness_status: freshness
            })
        });

        if (response.ok) {
            closeEditInventoryModal();
            await loadInventory();
            await loadInventoryInsights();
        } else {
            alert("Could not update item.");
        }
    } catch (err) {
        console.error("Error updating inventory item:", err);
    }
}

async function loadInventoryInsights() {
    const box = document.getElementById("wasteReductionBox");
    if (!box) return;

    const userId = getLoggedInUserId();
    const url = userId ? `${API_BASE_URL}/inventory-insights?user_id=${userId}` : `${API_BASE_URL}/inventory-insights`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) return;

        const atRiskCount = (data.consume_first || []).length;

        box.innerHTML = `
            <div class="eval-box">
                <div class="eval-header">
                    <h4>💡 Waste Reduction & FEFO Priority Insights</h4>
                    <span class="badge ${atRiskCount > 0 ? 'badge-consume-first' : 'badge-fresh'}">
                        ${atRiskCount} Item(s) Need Priority Consumption
                    </span>
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 10px;">
                    Total Tracked: <strong>${data.total_items}</strong> • Quantity at Risk: <strong>${data.quantity_at_risk} units</strong>
                </div>
                ${(data.consume_first || []).length > 0 ? `
                    <div style="background: var(--bg-card); padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3); margin-bottom: 12px;">
                        <strong style="color: #f87171;">🚨 Consume First (FEFO Priority):</strong>
                        <ul style="margin: 6px 0 0 18px; font-size: 13px; color: var(--text-primary);">
                            ${data.consume_first.map(it => `<li><strong>${escapeHTML(it.food_name)}</strong> (${it.quantity} ${escapeHTML(it.unit || '')}) - ${escapeHTML(it.reason)}</li>`).join("")}
                        </ul>
                    </div>
                ` : ''}
                <ul class="eval-recommendation-list">
                    ${(data.waste_reduction_recommendations || []).map(r => `<li>${escapeHTML(r)}</li>`).join("")}
                </ul>
            </div>
        `;
    } catch (err) {
        console.error("Inventory insights error:", err);
    }
}

// =========================================================
// PAGE 7 — ALERTS (alerts.html)
// =========================================================

async function loadAlertsPage() {
    const list = document.getElementById("alertsList");
    if (!list) return;

    list.innerHTML = `<div class="insight-card">Checking system alerts and spoilage risks...</div>`;

    const userId = getLoggedInUserId();
    const url = userId ? `${API_BASE_URL}/alerts?user_id=${userId}` : `${API_BASE_URL}/alerts`;

    try {
        const response = await fetch(url);
        const alerts = await response.json();
        if (!response.ok) throw new Error("Could not load alerts");

        cachedAlerts = Array.isArray(alerts) ? alerts : [];
        renderAlertsList("ALL");

    } catch (err) {
        console.error("Load alerts error:", err);
        list.innerHTML = `<div class="insight-card" style="color: var(--spoiled);">Error loading alerts.</div>`;
    }
}

function renderAlertsList(severityFilter) {
    const list = document.getElementById("alertsList");
    if (!list) return;

    let filtered = cachedAlerts;
    if (severityFilter === "CRITICAL") {
        filtered = cachedAlerts.filter(a => a.type === "CRITICAL");
    } else if (severityFilter === "WARNING") {
        filtered = cachedAlerts.filter(a => a.type === "WARNING" || a.type === "STORAGE_WARNING");
    } else if (severityFilter === "INFO") {
        filtered = cachedAlerts.filter(a => a.type === "INFO");
    }

    if (filtered.length === 0) {
        list.innerHTML = `<div class="insight-card">✅ No active alerts under this filter. All items are safe!</div>`;
        return;
    }

    list.innerHTML = filtered.map(a => {
        const type = a.type || "INFO";
        const severity = type === "CRITICAL" ? "HIGH" : (type === "WARNING" || type === "STORAGE_WARNING" ? "MEDIUM" : "LOW");
        const icon = type === "CRITICAL" ? "🚨" : (type === "WARNING" ? "⚠️" : (type === "STORAGE_WARNING" ? "🌡️" : "ℹ️"));
        const dateStr = a.created_at ? new Date(a.created_at).toLocaleString() : "Active Now";

        let action = "Inspect product and follow standard preservation guidelines.";
        if (type === "CRITICAL") action = "Safely discard spoiled stock immediately or do not consume.";
        else if (type === "WARNING") action = "Prioritize for consumption within 24-48 hours (FEFO).";
        else if (type === "STORAGE_WARNING") action = "Adjust storage thermostat or reposition product into recommended compartment.";

        return `
            <div class="alert-card alert-${type}">
                <div class="alert-icon">${icon}</div>
                <div class="alert-body">
                    <div class="alert-title-row">
                        <span class="alert-title">[${escapeHTML(a.badge || type)}] ${escapeHTML(a.title)}</span>
                        <span class="badge ${severity === 'HIGH' ? 'badge-spoiled' : (severity === 'MEDIUM' ? 'badge-expiring' : 'badge-info')}">
                            SEVERITY: ${severity}
                        </span>
                    </div>
                    <div style="margin: 6px 0; color: var(--text-primary);">${escapeHTML(a.message)}</div>
                    <div class="alert-action-box">💡 Recommended Action: ${escapeHTML(action)}</div>
                    <div class="alert-timestamp">Logged: ${escapeHTML(dateStr)}</div>
                </div>
            </div>
        `;
    }).join("");
}

function filterAlerts(severity, btn) {
    const pills = document.querySelectorAll(".filter-pill");
    pills.forEach(p => p.classList.remove("active"));
    if (btn) btn.classList.add("active");
    renderAlertsList(severity);
}

// =========================================================
// PAGE 8 — ANALYTICS (analytics.html)
// =========================================================

async function loadAnalyticsPage() {
    const userId = getLoggedInUserId();

    // 1. Fetch statistics
    try {
        const statsUrl = userId ? `${API_BASE_URL}/statistics?user_id=${userId}` : `${API_BASE_URL}/statistics`;
        const res = await fetch(statsUrl);
        if (res.ok) {
            const data = await res.json();
            const total = Number(data.total_analyses || 0);
            const fresh = Number(data.fresh || 0);
            const spoiled = Number(data.spoiled || 0);
            const avgConf = Number(data.average_confidence || 0);
            const avgFresh = Number(data.average_freshness_score || 0);
            const freshPct = Number(data.fresh_percentage || 0);
            const spoiledPct = total > 0 ? (spoiled / total * 100) : 0;

            const elTotal = document.getElementById("anTotalAnalyses");
            if (elTotal) elTotal.textContent = total;

            const elAvgScore = document.getElementById("anAvgFreshScore");
            if (elAvgScore) elAvgScore.textContent = `${avgFresh.toFixed(1)}%`;

            const elAvgConf = document.getElementById("anAvgConfidence");
            if (elAvgConf) elAvgConf.textContent = `${avgConf.toFixed(1)}%`;

            const elFreshPct = document.getElementById("anFreshPct");
            if (elFreshPct) elFreshPct.textContent = `${freshPct.toFixed(1)}%`;

            const elSpoiledPct = document.getElementById("anSpoiledPct");
            if (elSpoiledPct) elSpoiledPct.textContent = `${spoiledPct.toFixed(1)}%`;

            // Render Chart 1: Grade Distribution
            renderGradeChart(data.grade_distribution || {});
        }
    } catch (err) {
        console.error("Error loading analytics statistics:", err);
    }

    // 2. Fetch history for Trend & Spoilage charts
    try {
        const histUrl = userId ? `${API_BASE_URL}/history?user_id=${userId}` : `${API_BASE_URL}/history`;
        const res = await fetch(histUrl);
        if (res.ok) {
            const history = await res.json();
            if (Array.isArray(history)) {
                renderTrendChart(history);
                renderSpoilageChart(history);
            }
        }
    } catch (err) {
        console.error("Error loading analytics history:", err);
    }

    // 3. Fetch inventory for Inventory by Category chart
    try {
        const invUrl = userId ? `${API_BASE_URL}/inventory?user_id=${userId}` : `${API_BASE_URL}/inventory`;
        const res = await fetch(invUrl);
        if (res.ok) {
            const items = await res.json();
            if (Array.isArray(items)) {
                renderCategoryChart(items);
            }
        }
    } catch (err) {
        console.error("Error loading analytics inventory:", err);
    }
}

function renderGradeChart(gradeDist) {
    const canvas = document.getElementById("gradeChart");
    if (!canvas || !window.Chart) return;

    const labels = ["Fresh", "Good", "Acceptable", "Near Spoilage", "Spoiled"];
    const counts = labels.map(l => gradeDist[l] || 0);

    if (gradeChartInstance) {
        gradeChartInstance.data.datasets[0].data = counts;
        gradeChartInstance.update();
        return;
    }

    const ctx = canvas.getContext("2d");
    gradeChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: ["#10b981", "#34d399", "#f59e0b", "#f97316", "#ef4444"],
                borderWidth: 2,
                borderColor: "#0f172a"
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "bottom", labels: { color: "#94a3b8", font: { size: 12 } } }
            }
        }
    });
}

function renderCategoryChart(items) {
    const canvas = document.getElementById("categoryChart");
    if (!canvas || !window.Chart) return;

    const categories = ["Fruits", "Vegetables", "Dairy Products", "Meat & Poultry", "Seafood", "Bakery Products", "Packaged Foods", "Beverages"];
    const counts = categories.map(cat => items.filter(it => it.category === cat).length);

    if (categoryChartInstance) {
        categoryChartInstance.data.datasets[0].data = counts;
        categoryChartInstance.update();
        return;
    }

    const ctx = canvas.getContext("2d");
    categoryChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: categories.map(c => c.split(" ")[0]), // short label
            datasets: [{
                label: "Tracked Items",
                data: counts,
                backgroundColor: "#0284c7",
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, ticks: { color: "#94a3b8", stepSize: 1 }, grid: { color: "rgba(255, 255, 255, 0.05)" } },
                x: { ticks: { color: "#94a3b8" }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderTrendChart(history) {
    const canvas = document.getElementById("trendChart");
    if (!canvas || !window.Chart || !Array.isArray(history)) return;

    const reversed = [...history].reverse().slice(-10);
    const labels = reversed.map((item, idx) => `Sample ${idx + 1}`);
    const dataPoints = reversed.map(item => item.freshness_score || item.confidence || 0);

    if (trendChartInstance) {
        trendChartInstance.data.labels = labels;
        trendChartInstance.data.datasets[0].data = dataPoints;
        trendChartInstance.update();
        return;
    }

    const ctx = canvas.getContext("2d");
    trendChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Freshness Score (%)",
                data: dataPoints,
                borderColor: "#38bdf8",
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                fill: true,
                tension: 0.35,
                pointBackgroundColor: "#38bdf8",
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { min: 0, max: 100, ticks: { color: "#94a3b8" }, grid: { color: "rgba(255, 255, 255, 0.05)" } },
                x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255, 255, 255, 0.05)" } }
            },
            plugins: {
                legend: { labels: { color: "#94a3b8" } }
            }
        }
    });
}

function renderSpoilageChart(history) {
    const canvas = document.getElementById("spoilageChart");
    if (!canvas || !window.Chart || !Array.isArray(history)) return;

    const freshCount = history.filter(h => (h.result || "").toLowerCase() === "fresh").length;
    const spoiledCount = history.filter(h => (h.result || "").toLowerCase() === "spoiled").length;

    if (spoilageChartInstance) {
        spoilageChartInstance.data.datasets[0].data = [freshCount, spoiledCount];
        spoilageChartInstance.update();
        return;
    }

    const ctx = canvas.getContext("2d");
    spoilageChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Safe / Fresh", "Spoiled / At Risk"],
            datasets: [{
                data: [freshCount, spoiledCount],
                backgroundColor: ["#10b981", "#ef4444"],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, ticks: { color: "#94a3b8", stepSize: 1 }, grid: { color: "rgba(255, 255, 255, 0.05)" } },
                x: { ticks: { color: "#94a3b8" }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// =========================================================
// PAGE 9 — REPORTS & EXPORTS (reports.html)
// =========================================================

async function loadReportsPage() {
    const userId = getLoggedInUserId();
    const url = userId ? `${API_BASE_URL}/reports?user_id=${userId}` : `${API_BASE_URL}/reports`;

    try {
        const response = await fetch(url);
        const rep = await response.json();
        if (!response.ok) return;

        const f = rep.freshness_report || {};
        const i = rep.inventory_report || {};
        const w = rep.waste_reduction_report || {};
        const s = rep.storage_condition_report || {};

        const rf = document.getElementById("repFreshness");
        if (rf) rf.innerHTML = `Total Analyses: <strong>${f.total_analyses}</strong><br>Compliance Rate: <strong>${f.compliance_rate}</strong><br>Average Quality: <strong>${f.average_freshness_score}%</strong>`;

        const rsl = document.getElementById("repShelfLife");
        if (rsl) rsl.innerHTML = `Category Models: <strong>8 Categories Active</strong><br>Degradation Kinetic Model: <strong>Q10 Arrhenius</strong><br>Status: <strong>Predictive Monitoring Active</strong>`;

        const ri = document.getElementById("repInventory");
        if (ri) ri.innerHTML = `Total Items: <strong>${i.total_inventory_items}</strong><br>Near Expiry (≤3d): <strong>${i.near_expiry_items}</strong><br>Expired: <strong>${i.expired_items}</strong>`;

        const rs = document.getElementById("repStorage");
        if (rs) rs.innerHTML = `Monitoring Status: <strong>${s.monitoring_status}</strong><br>Categories Tracked: <strong>${s.active_categories_tracked}</strong>`;

        const rw = document.getElementById("repWaste");
        if (rw) rw.innerHTML = `Safe Consumptions: <strong>${w.prevented_waste_estimate}</strong><br>Rotation Strategy: <strong>${w.rotation_strategy}</strong>`;

    } catch (err) {
        console.error("Load reports error:", err);
    }

    // Also populate recent history log table on reports page
    loadReportsInspectionHistory();
}

async function loadReportsInspectionHistory() {
    const body = document.getElementById("reportsHistoryBody");
    if (!body) return;

    const userId = getLoggedInUserId();
    const url = userId ? `${API_BASE_URL}/history?user_id=${userId}` : `${API_BASE_URL}/history`;

    try {
        const response = await fetch(url);
        const history = await response.json();

        if (response.ok && Array.isArray(history)) {
            if (history.length === 0) {
                body.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 18px;">No inspection records in database yet.</td></tr>`;
                return;
            }

            body.innerHTML = history.map(item => {
                const isFresh = (item.result || "").toLowerCase() === "fresh";
                const grade = item.grade || (isFresh ? "Fresh" : "Spoiled");
                const dateStr = item.created_at ? new Date(item.created_at).toLocaleString() : "Recently";
                const fScore = Number(item.freshness_score !== undefined ? item.freshness_score : (isFresh ? item.confidence : Math.max(0, 100 - item.confidence)));

                return `
                    <tr>
                        <td>#${item.id}</td>
                        <td>${escapeHTML(dateStr)}</td>
                        <td>📷 ${escapeHTML(item.image_name || "Food Sample")}</td>
                        <td><span class="badge ${isFresh ? 'badge-fresh' : 'badge-spoiled'}">${escapeHTML(item.result)}</span></td>
                        <td><span class="badge ${getGradeClass(grade)}">${escapeHTML(grade)}</span></td>
                        <td>${Number(item.confidence || 0).toFixed(2)}%</td>
                        <td style="color: var(--primary-light); font-weight: 700;">${fScore.toFixed(2)}%</td>
                    </tr>
                `;
            }).join("");
        }
    } catch (err) {
        console.error("Error loading reports history:", err);
    }
}

function exportData(type) {
    const userId = getLoggedInUserId();
    const url = `${API_BASE_URL}/reports/export?report_type=${type}${userId ? `&user_id=${userId}` : ''}`;
    window.open(url, "_blank");
}

function exportPDF() {
    const userId = getLoggedInUserId();
    const url = `${API_BASE_URL}/reports/export?report_type=pdf${userId ? `&user_id=${userId}` : ''}`;
    window.open(url, "_blank");
}

function exportExcel() {
    const userId = getLoggedInUserId();
    const url = `${API_BASE_URL}/reports/export?report_type=excel${userId ? `&user_id=${userId}` : ''}`;
    window.open(url, "_blank");
}

// =========================================================
// PAGE 10 — PROFILE (profile.html)
// =========================================================

function loadProfilePage() {
    const name = getLoggedInUserName();
    const email = getLoggedInUserEmail();
    const role = getLoggedInUserRole();
    const userId = getLoggedInUserId() || "N/A";

    const elName = document.getElementById("profileName");
    if (elName) elName.textContent = name;

    const elEmail = document.getElementById("profileEmail");
    if (elEmail) elEmail.textContent = email;

    const elRole = document.getElementById("profileRole");
    if (elRole) elRole.textContent = role;

    const elId = document.getElementById("profileUserId");
    if (elId) elId.textContent = `#${userId}`;

    const elAvatar = document.getElementById("profileAvatar");
    if (elAvatar && name) {
        elAvatar.textContent = name.charAt(0).toUpperCase();
    }
}

// =========================================================
// PAGE 11 — ADMIN CONTROL CENTER (admin.html)
// =========================================================

let cachedAdminUsers = [];

async function loadAdminPage() {
    const role = getLoggedInUserRole();
    if (role !== "Administrator" && role !== "admin") {
        alert("Access restricted: Administrator role required.");
        window.location.href = "dashboard.html";
        return;
    }

    await Promise.all([
        fetchAdminUsers(),
        fetchAdminAnalytics(),
        fetchAdminSystemStatus()
    ]);
}

async function fetchAdminUsers() {
    const search = document.getElementById("adminUserSearch")?.value || "";
    const role = document.getElementById("adminRoleFilter")?.value || "All";

    let url = `${API_BASE_URL}/admin/users?`;
    if (search.trim()) url += `search=${encodeURIComponent(search.trim())}&`;
    if (role && role !== "All") url += `role=${encodeURIComponent(role)}&`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        cachedAdminUsers = data.users || [];
        renderAdminUsers(cachedAdminUsers);

        const badge = document.getElementById("userCountBadge");
        if (badge) badge.textContent = `${cachedAdminUsers.length} registered users`;

        const tot = document.getElementById("admTotalUsers");
        if (tot) tot.textContent = data.total_count || cachedAdminUsers.length;

        const act = document.getElementById("admActiveUsers");
        if (act) {
            const activeCount = cachedAdminUsers.filter(u => u.is_active !== false).length;
            act.textContent = activeCount;
        }
    } catch (err) {
        console.error("fetchAdminUsers error:", err);
    }
}

function renderAdminUsers(users) {
    const tbody = document.getElementById("adminUsersTableBody");
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 20px;">No matching users found.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const isActive = u.is_active !== false;
        const regDate = u.created_at ? new Date(u.created_at).toLocaleDateString() : "N/A";
        return `
            <tr>
                <td>#${u.id}</td>
                <td><strong>${escapeHTML(u.name)}</strong></td>
                <td>${escapeHTML(u.email)}</td>
                <td><span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">${escapeHTML(u.role || 'Consumer')}</span></td>
                <td>
                    <span class="${isActive ? 'status-badge-active' : 'status-badge-inactive'}">
                        ${isActive ? '● Active' : '○ Deactivated'}
                    </span>
                </td>
                <td>${u.prediction_count || 0}</td>
                <td>${u.inventory_count || 0}</td>
                <td>${escapeHTML(regDate)}</td>
                <td>
                    <button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;" onclick="openAdminUserModal(${u.id}, '${escapeHTML(u.name)}', '${escapeHTML(u.role)}', ${isActive})">Edit</button>
                    <button class="${isActive ? 'btn-secondary' : 'btn-primary'}" style="padding: 4px 8px; font-size: 12px;" onclick="toggleUserStatus(${u.id}, ${isActive})">
                        ${isActive ? 'Deactivate' : 'Activate'}
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function filterAdminUsers() {
    const search = (document.getElementById("adminUserSearch")?.value || "").toLowerCase().trim();
    const role = document.getElementById("adminRoleFilter")?.value || "All";

    const filtered = cachedAdminUsers.filter(u => {
        const matchesSearch = !search ||
            (u.name && u.name.toLowerCase().includes(search)) ||
            (u.email && u.email.toLowerCase().includes(search));
        const matchesRole = role === "All" || u.role === role;
        return matchesSearch && matchesRole;
    });

    renderAdminUsers(filtered);
}

function openAdminUserModal(id, name, role, isActive) {
    const modal = document.getElementById("adminUserModal");
    if (!modal) return;
    document.getElementById("modalUserId").value = id;
    document.getElementById("modalUserDesc").textContent = `Modifying account: ${name} (ID: #${id})`;
    document.getElementById("modalUserRole").value = role || "Consumer";
    document.getElementById("modalUserStatus").value = isActive ? "true" : "false";
    modal.style.display = "flex";
}

function closeAdminModal() {
    const modal = document.getElementById("adminUserModal");
    if (modal) modal.style.display = "none";
}

async function submitAdminUserUpdate() {
    const userId = document.getElementById("modalUserId")?.value;
    const role = document.getElementById("modalUserRole")?.value;
    const isActive = document.getElementById("modalUserStatus")?.value === "true";

    if (!userId) return;

    try {
        const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                is_active: isActive,
                role: role
            })
        });

        const data = await res.json();
        if (res.ok) {
            closeAdminModal();
            fetchAdminUsers();
        } else {
            alert(data.detail || "Failed to update user.");
        }
    } catch (err) {
        console.error("submitAdminUserUpdate error:", err);
        alert("Network error updating user.");
    }
}

async function toggleUserStatus(userId, currentStatus) {
    const newStatus = !currentStatus;
    const promptMsg = newStatus ? "Reactivate this user account?" : "Deactivate this user account? The user will not be able to log in.";
    if (!confirm(promptMsg)) return;

    try {
        const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                is_active: newStatus
            })
        });
        if (res.ok) {
            fetchAdminUsers();
        } else {
            const data = await res.json();
            alert(data.detail || "Failed to toggle status.");
        }
    } catch (err) {
        console.error("toggleUserStatus error:", err);
    }
}

async function fetchAdminAnalytics() {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/analytics`);
        if (!res.ok) return;
        const data = await res.json();

        const insp = data.inspection_analytics || {};
        const inv = data.inventory_analytics || {};

        const totInsp = document.getElementById("admTotalInspections");
        if (totInsp) totInsp.textContent = insp.total_inspections || 0;

        const comp = document.getElementById("admComplianceRate");
        if (comp) comp.textContent = insp.quality_compliance_pct || "N/A";

        const avg = document.getElementById("admAvgScore");
        if (avg) avg.textContent = `${insp.average_freshness_score || 0}%`;

        const tInv = document.getElementById("admTotalInv");
        if (tInv) tInv.textContent = inv.total_items || 0;

        const expInv = document.getElementById("admExpiredInv");
        if (expInv) expInv.textContent = inv.expired_items || 0;

        const nearInv = document.getElementById("admNearExpInv");
        if (nearInv) nearInv.textContent = inv.near_expiry_items || 0;

        const stabInv = document.getElementById("admStableInv");
        if (stabInv) stabInv.textContent = inv.stable_items || 0;

    } catch (err) {
        console.error("fetchAdminAnalytics error:", err);
    }
}

async function fetchAdminSystemStatus() {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/system-status`);
        if (!res.ok) return;
        const data = await res.json();

        const dbEl = document.getElementById("diagDb");
        if (dbEl && data.database_status) dbEl.textContent = `${data.database_status.engine} (${data.database_status.status})`;

        const mEl = document.getElementById("diagModel");
        if (mEl && data.model_status) mEl.textContent = `${data.model_status.architecture} (${data.model_status.loaded ? 'Loaded' : 'Unavailable'})`;

        const dEl = document.getElementById("diagDataset");
        if (dEl && data.dataset_status) {
            dEl.textContent = `${data.dataset_status.total_images} Images (${data.dataset_status.fresh_images} Fresh / ${data.dataset_status.spoiled_images} Spoiled)`;
        }

        const tEl = document.getElementById("diagServerTime");
        if (tEl) tEl.textContent = data.server_time ? new Date(data.server_time).toUTCString() : "N/A";

    } catch (err) {
        console.error("fetchAdminSystemStatus error:", err);
    }
}

// =========================================================
// ONLOAD INITIALIZATION DISPATCHER
// =========================================================

window.addEventListener("DOMContentLoaded", () => {
    checkDashboardAuth();

    const path = window.location.pathname.toLowerCase();

    if (path.endsWith("dashboard.html")) {
        loadOverviewPage();
    } else if (path.endsWith("inspection.html")) {
        setupInspectionDragAndDrop();
    } else if (path.endsWith("inventory.html")) {
        loadInventoryPage();
    } else if (path.endsWith("alerts.html")) {
        loadAlertsPage();
    } else if (path.endsWith("analytics.html")) {
        loadAnalyticsPage();
    } else if (path.endsWith("reports.html")) {
        loadReportsPage();
    } else if (path.endsWith("admin.html")) {
        loadAdminPage();
    } else if (path.endsWith("profile.html")) {
        loadProfilePage();
    }
});