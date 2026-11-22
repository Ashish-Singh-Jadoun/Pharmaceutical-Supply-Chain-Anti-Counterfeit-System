(function () {
  const api = window.SupplyChainAPI;
  const content = document.getElementById("page-content");
  const backdrop = document.getElementById("modal-backdrop");
  const toastRegion = document.getElementById("toast-region");
  const pageTitles = { overview: "Overview", batches: "Batch tracking", verification: "QR verification", temperature: "Cold chain", recalls: "Recall center", analytics: "Analytics" };
  const rolePages = {
    Regulator: ["overview", "batches", "verification", "temperature", "recalls", "analytics"],
    Manufacturer: ["overview", "batches", "verification", "temperature"],
    Distributor: ["overview", "batches", "verification", "temperature"],
    Pharmacist: ["overview", "batches", "verification", "temperature", "recalls"],
    Customer: ["verification"]
  };
  const roleProfiles = {
    Regulator: ["Alexandra Smith", "Regulatory officer"],
    Manufacturer: ["Maya Patel", "Novartis Pharma"],
    Distributor: ["Jonas Weber", "Frankfurt distribution"],
    Pharmacist: ["Lena Fischer", "Central Pharmacy, Berlin"],
    Customer: ["Public visitor", "Medicine verification"]
  };
  let currentRole = sessionStorage.getItem("medledger-demo-role") || "Regulator";
  if (!rolePages[currentRole]) currentRole = "Regulator";
  let activePage = rolePages[currentRole][0];
  let searchTerm = "";
  let batchFilter = "All batches";
  let batchData = [];
  let selectedSensorId = "MED-2025-0841";
  let scannerStream = null;

  const icon = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></svg>',
    temp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 14.76V5a3 3 0 0 0-6 0v9.76a5 5 0 1 0 6 0Z"/><path d="M11 11v7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const fmtDate = (date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
  const fmtNumber = (num) => new Intl.NumberFormat("en").format(num);
  const statusClass = (status) => status.toLowerCase().replace(/[^a-z]+/g, "-");
  function safeBounds(range) {
    const match = String(range || "").match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
    return match ? [Number(match[1]), Number(match[2])] : [2, 8];
  }
  function isWithinRange(batch) {
    const [minimum, maximum] = safeBounds(batch.range);
    return batch.temperature >= minimum && batch.temperature <= maximum;
  }
  function getRoleBatches(batches) {
    if (currentRole === "Regulator") return batches;
    if (currentRole === "Manufacturer") return batches.filter((batch) => batch.manufacturer === "Novartis Pharma");
    if (currentRole === "Distributor") return batches.filter((batch) => /distribution hub|transit center/i.test(`${batch.location} ${batch.destination}`));
    if (currentRole === "Pharmacist") return batches.filter((batch) => /pharmacy|hospital pharmacy/i.test(`${batch.location} ${batch.destination}`));
    return [];
  }
  function updateRoleUI() {
    const allowedPages = rolePages[currentRole];
    document.getElementById("role-select").value = currentRole;
    document.querySelectorAll(".nav-link").forEach((el) => {
      el.hidden = !allowedPages.includes(el.dataset.page);
      el.classList.toggle("active", el.dataset.page === activePage);
    });
    document.querySelector(".sidebar-user .user-copy strong").textContent = roleProfiles[currentRole][0];
    document.querySelector(".sidebar-user .user-copy small").textContent = roleProfiles[currentRole][1];
    document.querySelector(".sidebar-user .avatar").textContent = roleProfiles[currentRole][0].split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
    document.querySelector(".role-switcher > span").textContent = "Demo role";
    document.getElementById("breadcrumb-current").textContent = pageTitles[activePage];
  }

  function toast(message, type) {
    const node = document.createElement("div");
    node.className = `toast ${type || ""}`;
    node.innerHTML = `<span class="toast-mark">${type === "error" ? "!" : "✓"}</span><span>${escapeHtml(message)}</span>`;
    toastRegion.appendChild(node);
    setTimeout(() => node.remove(), 3400);
  }
  function showModal(markup) {
    backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${markup}</div>`;
    backdrop.hidden = false;
    document.body.classList.add("modal-open");
    backdrop.querySelector("[data-close]")?.focus();
  }
  function closeModal() {
    stopScanner();
    backdrop.hidden = true;
    backdrop.innerHTML = "";
    document.body.classList.remove("modal-open");
  }
  async function navigate(page) {
    if (!rolePages[currentRole].includes(page)) {
      toast(`Access denied: ${currentRole} cannot open ${pageTitles[page] || "that page"}.`, "error");
      return;
    }
    activePage = page;
    if (page !== "verification") stopScanner();
    updateRoleUI();
    document.getElementById("sidebar").classList.remove("sidebar-open");
    await renderPage();
  }
  async function renderPage() {
    content.innerHTML = '<div class="loading-state"><span class="loader"></span>Loading verified supply chain data…</div>';
    try {
      const data = await api.getDashboard();
      const scopedBatches = getRoleBatches(data.batches);
      batchData = scopedBatches;
      const scopedData = {
        ...data,
        batches: scopedBatches,
        activeBatches: scopedBatches.filter((batch) => batch.status !== "Delivered").length,
        deliveredToday: scopedBatches.filter((batch) => batch.status === "Delivered").length,
        alerts: scopedBatches.filter((batch) => batch.status === "Temperature alert" || batch.status === "Recall active").length,
        recentEvents: data.recentEvents.filter((event) => scopedBatches.some((batch) => batch.id === event.batchId))
      };
      if (activePage === "overview") content.innerHTML = renderOverview(scopedData);
      if (activePage === "batches") content.innerHTML = renderBatches(scopedBatches);
      if (activePage === "verification") content.innerHTML = renderVerification();
      if (activePage === "temperature") content.innerHTML = renderTemperature(scopedData);
      if (activePage === "recalls") content.innerHTML = renderRecalls(data.recalls, currentRole !== "Regulator");
      if (activePage === "analytics") content.innerHTML = renderAnalytics(data);
      bindPageActions();
      document.getElementById("batch-nav-count").textContent = String(data.batches.length).padStart(2, "0");
    } catch (error) {
      console.error(error);
      content.innerHTML = `<div class="empty-state"><strong>We couldn't load the demo data.</strong><p>${escapeHtml(error.message)}</p><button class="button button-primary" data-action="retry">Try again</button></div>`;
      content.querySelector('[data-action="retry"]')?.addEventListener("click", renderPage);
    }
  }
  function pageHeading(eyebrow, title, description, actions) {
    return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions || ""}</div></div>`;
  }
  function renderOverview(data) {
    const alerts = data.batches.filter((batch) => batch.status === "Temperature alert" || batch.status === "Recall active").length;
    const title = currentRole === "Manufacturer" ? "Manufacturer overview" : currentRole === "Distributor" ? "Distribution overview" : "Pharmacy overview";
    const canRegister = currentRole === "Manufacturer";
    const today = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase();
    const headingActions = `<button class="button button-secondary" data-action="export">↓ <span>Export my batches</span></button>${canRegister ? '<button class="button button-primary" data-action="new-batch">'+icon.plus+'<span>Register batch</span></button>' : ""}`;
    return `${pageHeading(today, title, `Welcome, ${escapeHtml(roleProfiles[currentRole][0])}. This view is limited to ${escapeHtml(roleProfiles[currentRole][1])}.`, headingActions)}
      <div class="network-banner"><div class="banner-icon">◈</div><div class="banner-copy"><strong>Role-scoped supply chain view</strong><span>Only records assigned to this demo role are shown. Regulator permissions are broader.</span></div><button class="banner-link" data-page="batches">View my batches ${icon.arrow}</button><div class="banner-decoration">◈</div></div>
      <div class="stats-grid">
        ${statCard("My active batches", fmtNumber(data.activeBatches), "In this role's scope", "▤", "stat-blue", "Scoped view", false)}
        ${statCard("Delivered batches", fmtNumber(data.deliveredToday), "In this role's scope", "↗", "stat-green", "Scoped view", false)}
        ${statCard("Needs attention", String(alerts).padStart(2, "0"), "Temperature & recall alerts", "⚑", "stat-amber", alerts ? "Action needed" : "All clear", false)}
        ${statCard("Visible records", fmtNumber(data.batches.length), "You are authorized to view", "⌗", "stat-purple", "Access scoped", false)}
      </div>
      <div class="dashboard-grid">
        <section class="panel activity-panel"><div class="panel-header"><div><h2>Supply chain activity</h2><p>Verified handoffs across your network</p></div><button class="select-button" id="activity-range">Last 7 days⌄</button></div>${renderActivityChart()}<div class="chart-legend"><span><i class="legend-dot blue"></i>Verified handoffs <b>2,481</b></span><span><i class="legend-dot mint"></i>On-time delivery <b>98.6%</b></span></div></section>
        <section class="panel cold-panel"><div class="panel-header"><div><h2>Cold chain health</h2><p>Authorized sensor readings</p></div><span class="live-pill"><i></i> DEMO</span></div><div class="cold-main"><div class="cold-gauge"><svg viewBox="0 0 150 100"><path class="gauge-track" d="M17 79a58 58 0 0 1 116 0"/><path class="gauge-value" d="M17 79a58 58 0 0 1 87-50"/></svg><strong>${data.batches.length ? (data.batches.reduce((sum, batch) => sum + batch.temperature, 0) / data.batches.length).toFixed(1) : "—"}°</strong><span>SCOPED AVG TEMP</span></div><div class="cold-summary"><span><i class="legend-dot mint"></i>Within range <b>${data.batches.filter(isWithinRange).length} batches</b></span><span><i class="legend-dot amber"></i>Attention <b>${String(Math.max(0, alerts)).padStart(2, "0")} batches</b></span><span><i class="legend-dot red"></i>Scope <b>${data.batches.length} batches</b></span></div></div><div class="cold-footer"><span>Per-product safe ranges</span><button class="text-link" data-page="temperature">View sensors ${icon.arrow}</button></div></section>
      </div>
      <div class="lower-grid"><section class="panel batch-panel"><div class="panel-header"><div><h2>Recent batches</h2><p>Latest movement in your supply chain</p></div><button class="text-link" data-page="batches">View all ${icon.arrow}</button></div>${renderBatchTable(data.batches.slice(0, 4), false)}</section><section class="panel event-panel"><div class="panel-header"><div><h2>Recent activity</h2><p>Latest ledger events</p></div><button class="icon-button more-button" title="More options">···</button></div>${renderEvents(data.recentEvents)}</section></div>
      <div class="disclaimer"><span>ⓘ</span> Demo role-based view only; a real system must enforce these permissions on its authenticated API.</div>`;
  }
  function statCard(label, value, note, glyph, color, change, positive) {
    return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${color}">${glyph}</span></div><div class="stat-value">${value}</div><div class="stat-note"><span class="${positive ? "trend-up" : "trend-alert"}">${change}</span><span>${note}</span></div></article>`;
  }
  function renderActivityChart() {
    const heights = [34, 43, 38, 57, 47, 63, 54, 68, 51, 74, 62, 84, 70, 91, 64, 77, 60, 85, 72, 96, 67, 83, 75, 100, 79, 91, 69, 86];
    const bars = heights.map((height, i) => `<span style="height:${height}%;opacity:${0.45 + height / 200}" class="${i === 23 ? "chart-highlight" : ""}"></span>`).join("");
    return `<div class="activity-chart"><div class="chart-y-labels"><span>2,000</span><span>1,500</span><span>1,000</span><span>500</span><span>0</span></div><div class="chart-plot"><div class="chart-grid"><i></i><i></i><i></i><i></i><i></i></div><div class="bar-series">${bars}</div><div class="chart-x-labels"><span>Nov 16</span><span>Nov 17</span><span>Nov 18</span><span>Nov 19</span><span>Nov 20</span><span>Nov 21</span><span>Nov 22</span></div></div></div>`;
  }
  function renderBatchTable(batches, interactive) {
    const rows = batches.map((batch) => `<tr data-batch="${escapeHtml(batch.id)}" class="${interactive ? "clickable-row" : ""}"><td><div class="product-cell"><span class="medicine-icon">${batch.product.startsWith("Insulin") ? "⌁" : "✚"}</span><span><strong>${escapeHtml(batch.product)}</strong><small>${escapeHtml(batch.id)}</small></span></div></td><td>${escapeHtml(batch.manufacturer)}</td><td><span class="status-badge status-${statusClass(batch.status)}"><i></i>${escapeHtml(batch.status)}</span></td><td>${escapeHtml(batch.location)}</td><td><span class="temp-value ${batch.temperature > 8 ? "temp-alert" : ""}">${batch.temperature.toFixed(1)}°C</span><small class="table-sub">${batch.range} range</small></td><td class="updated-cell">${fmtDate(batch.updated)}</td><td><button class="row-more" data-detail="${escapeHtml(batch.id)}" title="View batch details">···</button></td></tr>`).join("");
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>PRODUCT / BATCH ID</th><th>MANUFACTURER</th><th>STATUS</th><th>CURRENT LOCATION</th><th>TEMPERATURE</th><th>LAST UPDATED</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty-table">No batches match your filters.</td></tr>'}</tbody></table></div>`;
  }
  function renderEvents(events) {
    return `<div class="event-list">${events.map((event, i) => `<div class="event-item"><div class="event-marker ${i === 0 ? "event-marker-current" : ""}">${i === 0 ? "✓" : "•"}</div><div class="event-copy"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.product)} · ${escapeHtml(event.batchId)}</span><small>${escapeHtml(event.place)} <b>·</b> ${fmtDate(event.time)}</small></div><button class="event-hash" title="Demo ledger entry">${escapeHtml(event.hash)}</button></div>`).join("")}</div>`;
  }
  function renderBatches(batches) {
    const filtered = batches.filter((batch) => (batchFilter === "All batches" || (batchFilter === "Attention" ? ["Temperature alert", "Recall active", "Quality review"].includes(batch.status) : batch.status === batchFilter)) && `${batch.product} ${batch.id} ${batch.manufacturer} ${batch.location}`.toLowerCase().includes(searchTerm.toLowerCase()));
    const registerAction = currentRole === "Manufacturer" ? '<button class="button button-primary" data-action="new-batch">'+icon.plus+'<span>Register batch</span></button>' : "";
    return `${pageHeading("AUTHORIZED RECORDS", "Batch tracking", `Showing ${escapeHtml(currentRole.toLowerCase())}-authorized records only.`, '<button class="button button-secondary" data-action="export">↓ <span>Export my records</span></button>'+registerAction)}
      <div class="filter-toolbar"><label class="search-box">${icon.search}<input id="batch-search" type="search" placeholder="Search product, batch ID, location…" value="${escapeHtml(searchTerm)}"></label><label class="filter-select"><span>Filter:</span><select id="batch-filter">${["All batches", "In transit", "Delivered", "Attention", "Manufactured"].map((item) => `<option ${batchFilter === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><span class="result-count">${filtered.length} batches</span></div>
      <section class="panel full-table-panel">${renderBatchTable(filtered, true)}</section><div class="disclaimer"><span>ⓘ</span> Each status represents a simulated handoff on the demonstration ledger. Select a row to inspect batch history.</div>`;
  }
  function renderVerification() {
    return `${pageHeading("MEDICINE AUTHENTICITY", "Verify a medicine", "Check a product's provenance before it reaches a patient.", "")}
      <div class="verify-layout"><section class="panel verify-panel"><div class="verify-title-icon">⌗</div><h2>Scan product code</h2><p>Scan the QR code on the medicine package or enter its batch ID below.</p><div class="scan-placeholder" id="scan-placeholder"><div class="scan-frame"><span></span><span></span><span></span><span></span><i class="scan-line"></i><div class="scan-qr">▦</div></div><span>Position the code inside the frame</span></div><div class="scan-actions"><button class="button button-primary" id="start-scan">◎ <span>Open camera scanner</span></button><span>or enter manually</span></div><form class="verify-form" id="verify-form"><label for="verify-id">Medicine batch ID</label><div class="verify-input-row"><input id="verify-id" name="batchId" placeholder="e.g. MED-2025-0842" autocomplete="off" required><button class="button button-dark" type="submit">Verify ${icon.arrow}</button></div><div class="sample-hint">Try a demo batch: <button type="button" class="inline-code" data-sample="MED-2025-0842">MED-2025-0842</button></div></form></section>
      <aside class="verify-aside"><div class="verify-aside-icon">${icon.shield}</div><h3>Why verify?</h3><p>Counterfeit medicines can look identical to the real thing. A quick check helps confirm the product's recorded journey.</p><div class="verify-points"><div><span>01</span><strong>Authentic origin</strong><small>Confirm who manufactured this batch</small></div><div><span>02</span><strong>Safe handling</strong><small>Review recorded storage conditions</small></div><div><span>03</span><strong>Recall status</strong><small>Check for active safety notices</small></div></div><div class="public-info">🔒 ${currentRole === "Customer" ? "Public verification reveals safety and authenticity results only; private custody details are withheld." : "Verification is checked against this browser's role-scoped demo ledger."}</div></aside></div><div id="verification-result"></div>`;
  }
  function renderTemperature(data) {
    const sensorBatches = data.batches;
    const sensor = sensorBatches.find((batch) => batch.id === selectedSensorId) || sensorBatches[0];
    if (sensor) selectedSensorId = sensor.id;
    const log = sensor ? (data.temperatureLogs[sensor.id] || [{ time: sensor.updated, value: sensor.temperature }]) : [];
    const excursions = sensorBatches.filter((batch) => !isWithinRange(batch)).length;
    const regulatorControls = currentRole === "Regulator";
    return `${pageHeading("COLD CHAIN MONITORING", "Temperature monitoring", "Simulated IoT readings help you spot cold-chain excursions.", '<button class="button button-secondary" data-action="export">↓ <span>Export readings</span></button>')}
      <div class="sensor-summary"><article class="panel sensor-stat"><span class="sensor-stat-icon stat-green">${icon.temp}</span><div><small>AUTHORIZED SENSORS</small><strong>${sensorBatches.length}</strong><span>Only records in your role's scope</span></div></article><article class="panel sensor-stat"><span class="sensor-stat-icon stat-amber">♧</span><div><small>SELECTED SENSOR</small><strong>${sensor ? `${sensor.temperature.toFixed(1)}°C` : "—"}</strong><span>${sensor ? (isWithinRange(sensor) ? "Within product-specific safe range" : "Outside product-specific safe range") : "No scoped sensor"}</span></div></article><article class="panel sensor-stat"><span class="sensor-stat-icon ${excursions ? "stat-red" : "stat-green"}">⚠</span><div><small>OUT-OF-RANGE BATCHES</small><strong>${String(excursions).padStart(2, "0")}</strong><span>Compared with each product's range</span></div></article></div>
      <section class="panel temp-chart-panel"><div class="panel-header"><div><h2>Temperature trend</h2><p>${sensor ? `${escapeHtml(sensor.product)} · ${escapeHtml(sensor.id)} · ${escapeHtml(sensor.location)}` : "No batches are available in this role's scope"}</p></div><label class="sensor-select-label"><span>Sensor</span><select id="sensor-batch-select">${sensorBatches.map((batch) => `<option value="${escapeHtml(batch.id)}" ${sensor && sensor.id === batch.id ? "selected" : ""}>${escapeHtml(batch.id)} · ${escapeHtml(batch.product)}</option>`).join("")}</select></label></div>${sensor ? renderTempChart(log, sensor.range) : '<div class="empty-state">No sensors are available in your authorized scope.</div>'}<div class="temp-chart-legend"><span><i class="legend-dot blue"></i>Recorded temperature</span><span class="range-legend"></span>Safe product range: ${sensor ? escapeHtml(sensor.range) : "n/a"}${log.some((point) => point.value < safeBounds(sensor.range)[0] || point.value > safeBounds(sensor.range)[1]) ? '<span class="excursion-legend">Red points indicate excursions</span>' : ""}</div></section>
      <section class="panel sensor-table-panel"><div class="panel-header"><div><h2>Monitored batches</h2><p>Readings are checked against each product's own safe range.</p></div>${regulatorControls ? '<button class="button button-primary" id="simulate-selected">↻ <span>Simulate selected sensor</span></button>' : '<span class="read-only-label">Read-only · regulator controls simulation</span>'}</div><div class="table-wrap"><table class="data-table"><thead><tr><th>BATCH / PRODUCT</th><th>SENSOR LOCATION</th><th>READING</th><th>SAFE RANGE</th><th>LAST READING</th><th>STATUS</th><th></th></tr></thead><tbody>${sensorBatches.map((b) => `<tr><td><div class="product-cell"><span class="medicine-icon">♧</span><span><strong>${escapeHtml(b.product)}</strong><small>${escapeHtml(b.id)}</small></span></div></td><td>${escapeHtml(b.location)}</td><td><strong class="${isWithinRange(b) ? "" : "temp-alert"}">${b.temperature.toFixed(1)}°C</strong></td><td>${escapeHtml(b.range)}</td><td>${fmtDate(b.updated)}</td><td><span class="status-badge status-${isWithinRange(b) ? "delivered" : "temperature-alert"}"><i></i>${isWithinRange(b) ? "Normal" : "Out of range"}</span></td><td>${regulatorControls ? `<button class="text-link simulate-one" data-simulate="${escapeHtml(b.id)}">Simulate</button>` : ""}</td></tr>`).join("")}</tbody></table></div></section>
      <div class="disclaimer"><span>ⓘ</span> Sensor values are simulated. Only regulators can write simulated readings; a production system must enforce this on its API.</div>`;
  }
  function renderTempChart(log, range) {
    const points = log.slice(-12);
    const [minimum, maximum] = safeBounds(range);
    const values = points.map((point) => point.value);
    const domainMin = Math.min(0, Math.floor((Math.min(minimum, ...values) - 2) / 2) * 2);
    const domainMax = Math.max(maximum + 2, Math.ceil((Math.max(maximum, ...values) + 2) / 2) * 2);
    const y = (value) => 30 + ((domainMax - value) / (domainMax - domainMin)) * 156;
    const x = (index) => 52 + (index * 660 / Math.max(points.length - 1, 1));
    const safeTop = y(maximum);
    const safeBottom = y(minimum);
    const grid = Array.from({ length: 5 }, (_, i) => {
      const value = domainMax - ((domainMax - domainMin) * i / 4);
      const position = 30 + i * 39;
      return `<path d="M52 ${position}H712"/><text x="8" y="${position + 4}">${value.toFixed(0)}°C</text>`;
    }).join("");
    const segments = points.slice(1).map((point, i) => {
      const previous = points[i];
      const unsafe = [previous.value, point.value].some((value) => value < minimum || value > maximum);
      return `<line x1="${x(i)}" y1="${y(previous.value)}" x2="${x(i + 1)}" y2="${y(point.value)}" stroke="${unsafe ? "#e16b5f" : "#3867db"}" stroke-width="2.5" stroke-linecap="round"/>`;
    }).join("");
    const dots = points.map((point, i) => `<circle cx="${x(i)}" cy="${y(point.value)}" r="4" fill="${point.value < minimum || point.value > maximum ? "#e16b5f" : "#3867db"}"/>`).join("");
    const timeLabels = points.map((point, i) => `<text x="${x(i)}" y="218" text-anchor="middle">${new Date(point.time).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}</text>`).join("");
    return `<div class="temp-chart"><svg viewBox="0 0 760 240" preserveAspectRatio="none"><rect x="52" y="${safeTop}" width="660" height="${safeBottom - safeTop}" rx="4" fill="#e9f7f1"/><text x="64" y="${Math.min(safeBottom - 4, safeTop + 14)}" fill="#4a9b79" font-size="9">SAFE RANGE ${escapeHtml(range)}</text><g class="temp-grid">${grid}</g><g class="temp-labels">${timeLabels}</g>${segments}${dots}</svg></div>`;
  }
  function renderRecalls(recalls, readOnly) {
    const active = recalls.filter((item) => item.status === "Active").length;
    const action = readOnly ? "" : '<button class="button button-primary" data-action="new-recall">'+icon.plus+'<span>Initiate recall</span></button>';
    return `${pageHeading("PATIENT SAFETY", "Recall center", readOnly ? "View published safety notices. Only regulators can create or resolve recalls." : "Manage product safety notices and trace affected batches.", action)}
      <div class="recall-banner"><div class="recall-alert-icon">!</div><div><strong>${active} active safety notice${active === 1 ? "" : "s"}</strong><span>Review active notices and contact affected supply-chain partners.</span></div><button class="text-link" id="scroll-active">Review now ${icon.arrow}</button></div>
      <div class="recall-stats"><div><small>TOTAL NOTICES</small><strong>${String(recalls.length).padStart(2, "0")}</strong></div><div><small>ACTIVE</small><strong class="recall-red">${String(active).padStart(2, "0")}</strong></div><div><small>RESOLVED</small><strong>${String(recalls.length - active).padStart(2, "0")}</strong></div><div><small>AFFECTED PARTNERS</small><strong>12</strong></div></div>
      <section class="panel recall-panel" id="recall-list"><div class="panel-header"><div><h2>Safety notices</h2><p>Recalls linked to a batch stay visible in the ledger.</p></div><span class="network-pill">Updated just now</span></div><div class="recall-list">${recalls.map((r) => `<article class="recall-item"><div class="recall-severity ${r.severity.toLowerCase()}">${r.severity === "Critical" ? "!" : "i"}</div><div class="recall-copy"><div><strong>${escapeHtml(r.product)}</strong><span class="severity-tag ${r.severity.toLowerCase()}">${escapeHtml(r.severity)}</span></div><p>${escapeHtml(r.reason)}</p><div class="recall-meta"><span>Batch <b>${escapeHtml(r.batch)}</b></span><span>Notice <b>${escapeHtml(r.id)}</b></span><span>${fmtDate(r.date)}</span></div></div><div class="recall-side"><span class="status-badge status-${r.status.toLowerCase()}"><i></i>${r.status}</span>${!readOnly && r.status === "Active" ? `<button class="text-link resolve-recall" data-resolve="${escapeHtml(r.id)}">Mark resolved</button>` : r.status === "Resolved" ? '<span class="resolved-note">Closed</span>' : ""}</div></article>`).join("")}</div></section><div class="disclaimer"><span>ⓘ</span> This recall center is a demonstration. Always follow official regulator guidance for real product safety issues.</div>`;
  }
  function renderAnalytics(data) {
    const delivered = data.batches.filter((batch) => batch.status === "Delivered").length + 126;
    return `${pageHeading("NETWORK PERFORMANCE", "Analytics", "A real-time overview of the demonstration supply network.", '<button class="button button-secondary" data-action="export">↓ <span>Export report</span></button>')}
      <div class="analytics-kpis">${statCard("Batches tracked", fmtNumber(data.batches.length + 176), "Across 12 network partners", "▤", "stat-blue", "+12.8%", true)}${statCard("Delivery success", "98.6%", "On-time delivery rate", "↗", "stat-green", "+2.4%", true)}${statCard("Authenticity checks", fmtNumber(data.verified), "Medicine verification scans", "⌗", "stat-purple", "+24.3%", true)}${statCard("Safety notices", String(data.recalls.filter((r) => r.status === "Active").length).padStart(2, "0"), "Active recalls", "⚑", "stat-amber", "Monitored", false)}</div>
      <div class="analytics-grid"><section class="panel"><div class="panel-header"><div><h2>Batch movement</h2><p>Volume by supply chain stage · last 7 days</p></div><span class="select-button">Last 7 days⌄</span></div>${renderStageBars()}</section><section class="panel"><div class="panel-header"><div><h2>Network distribution</h2><p>Partner activity by role</p></div></div>${renderRoleStats()}</section></div>
      <section class="panel performance-panel"><div class="panel-header"><div><h2>Network health indicators</h2><p>Operational health across tracked organizations</p></div></div><div class="health-grid"><div><span class="health-icon green">✓</span><small>LEDGER UPTIME</small><strong>99.98%</strong><span class="health-note">All nodes responding</span></div><div><span class="health-icon blue">ϟ</span><small>AVG. CONFIRMATION</small><strong>2.4 sec</strong><span class="health-note">Network median</span></div><div><span class="health-icon purple">◈</span><small>PARTICIPATING ORGS</small><strong>12</strong><span class="health-note">Across 4 countries</span></div><div><span class="health-icon amber">↗</span><small>DELIVERED TODAY</small><strong>${fmtNumber(delivered)}</strong><span class="health-note">Across all partners</span></div></div></section>
      <div class="disclaimer"><span>ⓘ</span> Analytics include sample values for presentation. They are not verified real-world network metrics.</div>`;
  }
  function renderStageBars() {
    const stages = [["Manufactured", 100, "127"], ["In transit", 72, "92"], ["At distributor", 59, "74"], ["At pharmacy", 47, "61"], ["Delivered", 35, "48"]];
    return `<div class="stage-bars">${stages.map(([label, width, count]) => `<div class="stage-row"><span>${label}</span><div class="stage-track"><i style="width:${width}%"></i></div><b>${count}</b></div>`).join("")}</div>`;
  }
  function renderRoleStats() {
    const roles = [["Manufacturers", "04", "stat-blue", 80], ["Distributors", "03", "stat-green", 61], ["Pharmacies", "04", "stat-purple", 84], ["Regulators", "01", "stat-amber", 32]];
    return `<div class="role-stats">${roles.map(([role, count, color, width]) => `<div class="role-stat"><span class="role-bullet ${color}"></span><span>${role}</span><b>${count}</b><div class="role-track"><i class="${color}" style="width:${width}%"></i></div></div>`).join("")}</div>`;
  }
  function bindPageActions() {
    content.querySelectorAll("[data-page]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.page)));
    content.querySelectorAll("[data-action='new-batch']").forEach((el) => el.addEventListener("click", openNewBatch));
    content.querySelectorAll("[data-action='new-recall']").forEach((el) => el.addEventListener("click", openNewRecall));
    content.querySelectorAll("[data-action='export']").forEach((el) => el.addEventListener("click", exportCsv));
    content.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", (event) => { event.stopPropagation(); openBatchDetails(el.dataset.detail); }));
    content.querySelectorAll("tr[data-batch]").forEach((el) => el.addEventListener("click", () => openBatchDetails(el.dataset.batch)));
    const search = document.getElementById("batch-search");
    if (search) search.addEventListener("input", (event) => { searchTerm = event.target.value; content.innerHTML = renderBatches(batchData); bindPageActions(); restoreSearchFocus(searchTerm); });
    const filter = document.getElementById("batch-filter");
    if (filter) filter.addEventListener("change", (event) => { batchFilter = event.target.value; content.innerHTML = renderBatches(batchData); bindPageActions(); });
    const verifyForm = document.getElementById("verify-form");
    if (verifyForm) verifyForm.addEventListener("submit", (event) => { event.preventDefault(); verifyBatch(new FormData(verifyForm).get("batchId")); });
    content.querySelectorAll("[data-sample]").forEach((el) => el.addEventListener("click", () => { document.getElementById("verify-id").value = el.dataset.sample; }));
    document.getElementById("start-scan")?.addEventListener("click", startScanner);
    content.querySelectorAll("[data-simulate]").forEach((el) => el.addEventListener("click", () => simulateTemperature(el.dataset.simulate)));
    document.getElementById("simulate-all")?.addEventListener("click", simulateAll);
    document.getElementById("simulate-selected")?.addEventListener("click", () => simulateTemperature(selectedSensorId));
    document.getElementById("sensor-batch-select")?.addEventListener("change", (event) => { selectedSensorId = event.target.value; renderPage(); });
    content.querySelectorAll("[data-resolve]").forEach((el) => el.addEventListener("click", () => resolveRecall(el.dataset.resolve)));
    document.getElementById("scroll-active")?.addEventListener("click", () => document.getElementById("recall-list").scrollIntoView({ behavior: "smooth" }));
    document.getElementById("activity-range")?.addEventListener("click", (event) => { event.currentTarget.textContent = event.currentTarget.textContent.startsWith("Last 7") ? "Last 30 days⌄" : "Last 7 days⌄"; toast("Chart range updated for the demo."); });
  }
  function restoreSearchFocus(value) {
    const input = document.getElementById("batch-search");
    if (input) { input.focus(); input.setSelectionRange(value.length, value.length); }
  }
  async function openBatchDetails(id) {
    const batch = await api.getBatch(id);
    if (!batch) return toast("Batch not found.", "error");
    if (!getRoleBatches(await api.getBatches()).some((item) => item.id === batch.id)) {
      toast("Access denied: this batch is outside your assigned organization.", "error");
      return;
    }
    showModal(`<div class="modal-header"><div><span class="eyebrow">BATCH RECORD</span><h2>${escapeHtml(batch.product)}</h2><p>${escapeHtml(batch.id)} <span class="status-badge status-${statusClass(batch.status)}"><i></i>${escapeHtml(batch.status)}</span></p></div><button class="icon-button modal-close" data-close aria-label="Close">×</button></div><div class="detail-grid"><div><small>MANUFACTURER</small><strong>${escapeHtml(batch.manufacturer)}</strong></div><div><small>QUANTITY</small><strong>${fmtNumber(batch.quantity)} ${escapeHtml(batch.unit)}</strong></div><div><small>LOCATION</small><strong>${escapeHtml(batch.location)}</strong></div><div><small>EXPIRY DATE</small><strong>${escapeHtml(batch.expiry)}</strong></div><div><small>TEMPERATURE</small><strong class="${batch.temperature > 8 ? "temp-alert" : ""}">${batch.temperature.toFixed(1)}°C <span class="detail-range">· safe ${escapeHtml(batch.range)}</span></strong></div><div><small>LEDGER ENTRY</small><strong class="hash">${escapeHtml(batch.hash)}</strong></div></div><div class="modal-section-title">Verified journey <span>${batch.events.length} events</span></div><div class="timeline">${batch.events.map((event, i) => `<div class="timeline-event"><div class="timeline-node ${i === 0 ? "complete" : ""}">${i === 0 ? "✓" : ""}</div><div><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.place)}</span><small>${escapeHtml(event.actor)} · ${fmtDate(event.time)} · <b>${escapeHtml(event.hash)}</b></small></div></div>`).join("")}</div><div class="modal-footer"><span>${icon.shield} Tamper-evident demo record</span><button class="button button-secondary" data-close>Close</button></div>`);
  }
  function openNewBatch() {
    if (currentRole !== "Manufacturer") {
      toast("Access denied: batch registration is restricted to manufacturers.", "error");
      return;
    }
    showModal(`<div class="modal-header"><div><span class="eyebrow">MANUFACTURER WORKSPACE</span><h2>Register a new batch</h2><p>Create a traceable batch record for the demo ledger.</p></div><button class="icon-button modal-close" data-close aria-label="Close">×</button></div><form id="new-batch-form"><div class="form-grid"><label>Batch ID<input name="id" placeholder="MED-2025-0843" pattern="[A-Za-z0-9-]+" required></label><label>Product name<input name="product" placeholder="e.g. Paracetamol 500mg" required></label><label>Manufacturer<input name="manufacturer" placeholder="Your organization" required></label><label>Quantity<input name="quantity" type="number" min="1" placeholder="10000" required></label><label>Unit<input name="unit" placeholder="tablets, vials…" required></label><label>Expiry date<input name="expiry" type="date" required></label><label class="form-wide">Current location<input name="location" placeholder="Manufacturing facility, city" required></label><label>Safe temperature range<input name="range" value="15–25°C" required></label><label>Current temperature (°C)<input name="temperature" type="number" step="0.1" value="20.0" required></label></div><div class="modal-footer"><span>All fields are saved in this browser only.</span><button type="button" class="button button-secondary" data-close>Cancel</button><button class="button button-primary" type="submit">Register batch ${icon.arrow}</button></div></form>`);
    const manufacturerInput = document.querySelector('#new-batch-form input[name="manufacturer"]');
    manufacturerInput.value = roleProfiles.Manufacturer[1];
    manufacturerInput.readOnly = true;
    document.getElementById("new-batch-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        await api.createBatch({ ...form, quantity: Number(form.quantity), temperature: Number(form.temperature), destination: "Awaiting distributor", events: [] });
        closeModal(); toast("Batch registered on the demo ledger."); navigate("batches");
      } catch (error) { toast(error.message, "error"); }
    });
  }
  async function verifyBatch(rawId) {
    const id = String(rawId || "").trim();
    if (!id) return;
    const result = document.getElementById("verification-result");
    result.innerHTML = '<div class="verification-loading"><span class="loader"></span>Checking batch on the demo ledger…</div>';
    const [batch, data] = await Promise.all([api.getBatch(id), api.getDashboard()]);
    const recall = data.recalls.find((item) => item.batch.toLowerCase() === id.toLowerCase() && item.status === "Active");
    if (!batch) {
      result.innerHTML = `<div class="verification-card verification-invalid"><span class="result-icon">!</span><div><strong>Batch not recognized</strong><p>No matching record was found on this browser's demo ledger. Check the printed batch code or contact the supplier.</p></div></div>`;
      return;
    }
    const [minimum, maximum] = safeBounds(batch.range);
    const safe = batch.temperature >= minimum && batch.temperature <= maximum;
    const heading = recall ? "Safety notice found" : safe ? "Product record verified" : "Temperature excursion recorded";
    const regulatorView = currentRole === "Regulator";
    const authorizedPartner = getRoleBatches(await api.getBatches()).some((item) => item.id === batch.id);
    const detailRows = regulatorView
      ? `<span><small>PRODUCT</small><b>${escapeHtml(batch.product)}</b></span><span><small>BATCH</small><b>${escapeHtml(batch.id)}</b></span><span><small>MANUFACTURER</small><b>${escapeHtml(batch.manufacturer)}</b></span><span><small>STATUS</small><b>${escapeHtml(batch.status)}</b></span><span><small>LAST RECORDED TEMPERATURE</small><b>${batch.temperature.toFixed(1)}°C · ${escapeHtml(batch.range)}</b></span><span><small>EXPIRY</small><b>${escapeHtml(batch.expiry)}</b></span>`
      : `<span><small>PRODUCT</small><b>${escapeHtml(batch.product)}</b></span><span><small>BATCH</small><b>${escapeHtml(batch.id)}</b></span><span><small>MANUFACTURER</small><b>${escapeHtml(batch.manufacturer)}</b></span><span><small>AUTHENTICITY</small><b>Matching record</b></span><span><small>SAFE-HANDLING CHECK</small><b>${recall ? "Recall notice applies" : safe ? "Within recorded product range" : "Recorded excursion"}</b></span><span><small>EXPIRY</small><b>${escapeHtml(batch.expiry)}</b></span>`;
    result.innerHTML = `<div class="verification-card ${recall ? "verification-invalid" : safe ? "verification-valid" : "verification-warning"}"><span class="result-icon">${recall ? "!" : safe ? "✓" : "!"}</span><div class="result-body"><strong>${heading}</strong><p>${recall ? `An active recall applies to this batch: ${escapeHtml(recall.reason)}.` : safe ? "A matching batch record exists. Review the safety details below." : "This batch has a recorded temperature outside its listed safe range. Do not rely on this demo for clinical decisions."}</p><div class="verification-details">${detailRows}</div>${regulatorView || authorizedPartner ? `<button class="text-link" data-detail="${escapeHtml(batch.id)}">View authorized journey ${icon.arrow}</button>` : '<span class="public-info">Internal custody history and sensor values are restricted to authorized supply-chain partners and regulators.</span>'}</div></div>`;
    result.querySelector("[data-detail]")?.addEventListener("click", () => openBatchDetails(batch.id));
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia || typeof window.jsQR !== "function") {
      toast("Camera scanning requires a modern browser on localhost or HTTPS. Enter the batch ID manually.", "error");
      return;
    }
    try {
      const detector = "BarcodeDetector" in window ? new BarcodeDetector({ formats: ["qr_code"] }) : null;
      scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const placeholder = document.getElementById("scan-placeholder");
      placeholder.innerHTML = '<video id="scanner-video" autoplay playsinline></video><span class="camera-caption">Point your camera at a medicine QR code</span><button class="text-link" id="stop-scan">Stop camera</button>';
      document.getElementById("scanner-video").srcObject = scannerStream;
      document.getElementById("stop-scan").addEventListener("click", stopScanner);
      const video = document.getElementById("scanner-video");
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const scan = async () => {
        if (!scannerStream) return;
        if (video.readyState < 2 || !video.videoWidth) return setTimeout(scan, 120);
        try {
          let rawValue = "";
          if (detector) {
            try {
              const codes = await detector.detect(video);
              if (codes.length) rawValue = codes[0].rawValue;
            } catch (error) {
              console.warn("Native QR detector unavailable; using the bundled camera decoder.", error);
            }
          }
          if (!rawValue) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = window.jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
            if (code) rawValue = code.data;
          }
          if (rawValue) {
            const batchId = extractBatchId(rawValue);
            stopScanner();
            document.getElementById("verify-id").value = batchId;
            verifyBatch(batchId);
            return;
          }
          setTimeout(scan, 120);
        } catch (error) {
          stopScanner();
          toast(`Could not read the camera image: ${error.message}`, "error");
        }
      };
      video.addEventListener("loadeddata", scan, { once: true });
    } catch (error) {
      stopScanner();
      const hint = error.name === "NotAllowedError" ? "Allow camera access in your browser settings" : error.name === "NotFoundError" ? "No camera was found on this device" : error.message;
      toast(`Camera unavailable: ${hint}. Enter a batch ID manually.`, "error");
    }
  }
  function extractBatchId(value) {
    try {
      const url = new URL(value);
      return url.searchParams.get("batchId") || url.searchParams.get("batch") || url.pathname.split("/").filter(Boolean).pop() || value.trim();
    } catch {
      return value.trim();
    }
  }
  function stopScanner() {
    scannerStream?.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }
  async function simulateTemperature(id) {
    if (currentRole !== "Regulator") {
      toast("Access denied: only regulators can write simulated sensor readings.", "error");
      return;
    }
    try {
      const batch = await api.simulateTemperature(id);
      const outOfRange = !isWithinRange(batch);
      toast(`${batch.id}: simulated reading ${batch.temperature}°C${outOfRange ? " — product-range excursion alert!" : " recorded."}`, outOfRange ? "error" : "");
      renderPage();
    } catch (error) { toast(error.message, "error"); }
  }
  async function simulateAll() {
    if (currentRole !== "Regulator") {
      toast("Access denied: only regulators can write simulated sensor readings.", "error");
      return;
    }
    const batches = await api.getBatches();
    await Promise.all(batches.map((batch) => api.simulateTemperature(batch.id)));
    toast("New simulated readings recorded for all monitored batches.");
    renderPage();
  }
  function openNewRecall() {
    if (currentRole !== "Regulator") {
      toast("Access denied: recall management is restricted to regulators.", "error");
      return;
    }
    showModal(`<div class="modal-header"><div><span class="eyebrow">PATIENT SAFETY</span><h2>Initiate a product recall</h2><p>Record a safety notice and flag the linked batch.</p></div><button class="icon-button modal-close" data-close aria-label="Close">×</button></div><form id="new-recall-form"><div class="form-grid"><label class="form-wide">Batch to recall<select name="batch" required><option value="">Select a batch…</option>${(window.currentBatches || []).map((b) => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.id)} · ${escapeHtml(b.product)}</option>`).join("")}</select></label><label>Severity<select name="severity"><option>Critical</option><option>Moderate</option><option>Low</option></select></label><label class="form-wide">Reason for recall<textarea name="reason" placeholder="Describe the safety or quality concern…" required></textarea></label></div><div class="modal-footer"><span>Recall will be added to this browser's demo ledger.</span><button type="button" class="button button-secondary" data-close>Cancel</button><button class="button button-primary" type="submit">Initiate recall ${icon.arrow}</button></div></form>`);
    api.getBatches().then((batches) => { window.currentBatches = batches; const select = document.querySelector('#new-recall-form select[name="batch"]'); if (select) select.innerHTML = `<option value="">Select a batch…</option>${batches.map((b) => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.id)} · ${escapeHtml(b.product)}</option>`).join("")}`; });
    document.getElementById("new-recall-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.currentTarget).entries());
      const batch = await api.getBatch(form.batch);
      await api.createRecall({ ...form, product: batch.product });
      closeModal(); toast("Recall initiated. The linked batch is flagged."); navigate("recalls");
    });
  }
  async function resolveRecall(id) {
    if (currentRole !== "Regulator") {
      toast("Access denied: recall management is restricted to regulators.", "error");
      return;
    }
    await api.resolveRecall(id);
    toast(`${id} marked as resolved.`);
    renderPage();
  }
  async function exportCsv() {
    const batches = getRoleBatches(await api.getBatches());
    const rows = [["Batch ID", "Product", "Manufacturer", "Status", "Current location", "Temperature", "Safe range", "Expiry", "Ledger hash"], ...batches.map((b) => [b.id, b.product, b.manufacturer, b.status, b.location, `${b.temperature}°C`, b.range, b.expiry, b.hash])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "medledger-batch-report.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    toast("CSV report downloaded.");
  }
  document.querySelectorAll(".nav-link").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.page)));
  document.querySelector(".brand").addEventListener("click", (event) => { event.preventDefault(); navigate(rolePages[currentRole][0]); });
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop || event.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !backdrop.hidden) closeModal(); });
  document.getElementById("mobile-menu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("sidebar-open"));
  document.getElementById("help-button").addEventListener("click", () => showModal(`<div class="modal-header"><div><span class="eyebrow">ABOUT THIS PROJECT</span><h2>MedLedger demo</h2><p>A frontend showcase for medicine traceability and anti-counterfeit workflows.</p></div><button class="icon-button modal-close" data-close aria-label="Close">×</button></div><div class="about-copy"><p>This project simulates a blockchain-inspired medicine ledger, temperature sensors, and partner roles using browser storage. It is not connected to a real blockchain, API, sensor, or medical data system.</p><p>Use the sidebar to explore batch tracking, QR verification (manual code or camera where supported), cold-chain simulations, recalls, and analytics.</p><button class="button button-secondary" id="reset-demo">Reset demo data</button></div>`));
  document.getElementById("notification-button").addEventListener("click", () => { navigate("recalls"); });
  document.getElementById("role-select").addEventListener("change", (event) => {
    currentRole = event.target.value;
    sessionStorage.setItem("medledger-demo-role", currentRole);
    if (!rolePages[currentRole].includes(activePage)) activePage = rolePages[currentRole][0];
    searchTerm = "";
    batchFilter = "All batches";
    updateRoleUI();
    toast(`Demo workspace switched to ${currentRole}.`);
    renderPage();
  });
  document.body.addEventListener("click", async (event) => {
    if (event.target.id === "reset-demo") {
      await api.resetDemo();
      closeModal();
      searchTerm = ""; batchFilter = "All batches";
      toast("Demo data reset to its original state.");
      navigate("overview");
    }
  });
  updateRoleUI();
  navigate(activePage);
})();
