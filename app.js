(function () {
  "use strict";

  const data = window.APP_DATA;
  if (!data || !Array.isArray(data.junctions) || !Array.isArray(data.pmAssignments)) {
    document.body.innerHTML = '<main style="font:14px Segoe UI,Arial,sans-serif;padding:32px;color:#172635"><h1>App data is unavailable</h1><p>Reload the page from the project folder so the bundled data file can load.</p></main>';
    return;
  }

  const junctions = data.junctions;
  const assignments = data.pmAssignments;
  const junctionById = new Map(junctions.map((junction) => [junction.id, junction]));
  const state = { view: "overview", limit: 50, lastFocusElement: null };
  const labels = {
    overview: ["Traffic signal overview", "A clear view of the junction register and planned maintenance workload."],
    junctions: ["Junction directory", "Search the asset register and review record completeness by location."],
    maintenance: ["Preventive maintenance plan", "Browse planned route assignments by junction and routine."]
  };

  const el = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const statusClass = (status) => status === "Operational" ? "operational" : status === "Needs verification" ? "review" : "other";
  const statusPill = (status) => `<span class="status-pill ${statusClass(status)}">${escapeHtml(status)}</span>`;
  const routineTags = (routines) => routines.length
    ? `<div class="routine-tags">${routines.slice(0, 3).map((routine) => `<span class="routine-tag">${escapeHtml(routine)}</span>`).join("")}${routines.length > 3 ? `<span class="routine-tag">+${routines.length - 3}</span>` : ""}</div>`
    : '<span class="routine-tag">Not assigned</span>';

  function populateFilters() {
    const municipalities = Array.from(new Set(junctions.map((item) => item.municipality))).sort();
    el("municipality-filter").insertAdjacentHTML("beforeend", municipalities.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join(""));
    el("routine-filter").insertAdjacentHTML("beforeend", data.routines.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join(""));
    el("nav-junction-count").textContent = junctions.length.toLocaleString();
    el("footer-count").textContent = `${junctions.length.toLocaleString()} assets · ${assignments.length.toLocaleString()} PM assignments`;
  }

  function renderMetrics() {
    const stats = data.summary;
    const cards = [
      { label: "Junctions in register", value: stats.junctions, note: "Traffic signal asset records", icon: '<path d="M4 16.5h12M6 16.5V9l4-3 4 3v7.5M8.5 16.5v-4h3v4"/>' },
      { label: "Operating", value: stats.operational, note: "Recorded as operating or operational", icon: '<path d="m4.5 10.5 3.6 3.6L15.8 6"/>' , tone: "good" },
      { label: "Needs verification", value: stats.needsVerification, note: "Register status marked “Not Found”", icon: '<path d="M10 3.3 18 17H2L10 3.3Z"/><path d="M10 8v4.3M10 15h.01"/>' , tone: "warning" },
      { label: "PM assignments", value: stats.pmAssignments, note: "Listed across six routine types", icon: '<path d="M4 4.5h12M4 10h12M4 15.5h12"/><circle cx="2.5" cy="4.5" r=".6"/><circle cx="2.5" cy="10" r=".6"/><circle cx="2.5" cy="15.5" r=".6"/>' , tone: "accent" }
    ];
    el("metric-grid").innerHTML = cards.map((card) => `
      <article class="metric-card ${card.tone || ""}">
        <div class="metric-top"><span>${card.label}</span><span class="metric-icon"><svg viewBox="0 0 20 20" aria-hidden="true">${card.icon}</svg></span></div>
        <p class="metric-value">${Number(card.value).toLocaleString()}</p>
        <p class="metric-caption">${card.note}</p>
      </article>`).join("");
    el("review-title").textContent = `${stats.needsVerification} records need confirmation`;
    el("review-copy").textContent = "The source register lists these junctions as “Not Found”. Review the records with the asset owner before relying on them for planning.";
  }

  function renderRoutineChart() {
    const max = Math.max(...data.routines.map((item) => item.count), 1);
    el("routine-chart").innerHTML = data.routines.map((item) => `
      <div class="routine-row">
        <span class="routine-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="display:block;width:${Math.max(3, (item.count / max) * 100)}%"></span></span>
        <span class="routine-count">${Number(item.count).toLocaleString()}</span>
      </div>`).join("");
  }

  function currentFilters() {
    return {
      query: el("search-input").value.trim().toLowerCase(),
      municipality: el("municipality-filter").value,
      status: el("status-filter").value,
      routine: el("routine-filter").value
    };
  }

  function filteredJunctions() {
    const filters = currentFilters();
    return junctions.filter((junction) => {
      const haystack = `${junction.id} ${junction.location} ${junction.municipality} ${junction.zone} ${junction.type}`.toLowerCase();
      return (!filters.query || haystack.includes(filters.query))
        && (!filters.municipality || junction.municipality === filters.municipality)
        && (!filters.status || (filters.status === "Other" ? junction.status !== "Operational" && junction.status !== "Needs verification" : junction.status === filters.status))
        && (!filters.routine || junction.routines.includes(filters.routine));
    });
  }

  function filteredAssignments() {
    const filters = currentFilters();
    return assignments.filter((assignment) => {
      const junction = junctionById.get(assignment.junctionId);
      if (!junction) return false;
      const haystack = `${assignment.junctionId} ${junction.location} ${junction.municipality} ${assignment.mxLocation} ${assignment.routine}`.toLowerCase();
      return (!filters.query || haystack.includes(filters.query))
        && (!filters.municipality || junction.municipality === filters.municipality)
        && (!filters.status || (filters.status === "Other" ? junction.status !== "Operational" && junction.status !== "Needs verification" : junction.status === filters.status))
        && (!filters.routine || assignment.routine === filters.routine);
    });
  }

  function junctionRow(junction, includeZone) {
    const cols = `<td class="junction-cell"><div class="junction-primary">J-${escapeHtml(junction.id)}</div><div class="junction-secondary" title="${escapeHtml(junction.location)}">${escapeHtml(junction.location)}</div></td>
      <td>${escapeHtml(junction.municipality)}</td>${includeZone ? `<td>${escapeHtml(junction.zone || "—")}</td>` : ""}
      <td>${escapeHtml(junction.type || "Not specified")}</td>
      <td>${routineTags(junction.routines)}</td>
      <td>${statusPill(junction.status)}</td>
      <td><button class="row-action" type="button" data-detail-id="${escapeHtml(junction.id)}" aria-label="Open details for junction ${escapeHtml(junction.id)}">›</button></td>`;
    return `<tr>${cols}</tr>`;
  }

  function pmRow(assignment) {
    const junction = junctionById.get(assignment.junctionId);
    return `<tr>
      <td class="junction-cell"><div class="junction-primary">J-${escapeHtml(assignment.junctionId)}</div><div class="junction-secondary" title="${escapeHtml(junction.location)}">${escapeHtml(junction.location)}</div></td>
      <td>${escapeHtml(junction.municipality)}</td>
      <td><span class="routine-tag">${escapeHtml(assignment.routine)}</span></td>
      <td>${escapeHtml(assignment.mxLocation || "—")}</td>
      <td><button class="row-action" type="button" data-detail-id="${escapeHtml(assignment.junctionId)}" aria-label="Open details for junction ${escapeHtml(assignment.junctionId)}">›</button></td>
    </tr>`;
  }

  function emptyRow(columns) {
    return `<tr><td class="no-results" colspan="${columns}">No records match these filters. Try changing the search or reset the filters.</td></tr>`;
  }

  function renderTables() {
    const visibleJunctions = filteredJunctions();
    const visibleAssignments = filteredAssignments();
    const preview = visibleJunctions.slice(0, 7);
    const pageRows = visibleJunctions.slice(0, state.limit);
    const planRows = visibleAssignments.slice(0, state.limit);
    el("overview-table").innerHTML = preview.length ? preview.map((item) => junctionRow(item, false)).join("") : emptyRow(6);
    el("junction-table").innerHTML = pageRows.length ? pageRows.map((item) => junctionRow(item, true)).join("") : emptyRow(7);
    el("pm-table").innerHTML = planRows.length ? planRows.map(pmRow).join("") : emptyRow(5);
    el("junction-result-count").textContent = `${visibleJunctions.length.toLocaleString()} matching junction${visibleJunctions.length === 1 ? "" : "s"}`;
    el("pm-result-count").textContent = `${visibleAssignments.length.toLocaleString()} matching route assignment${visibleAssignments.length === 1 ? "" : "s"}`;
    el("junction-footer").innerHTML = footerHtml(pageRows.length, visibleJunctions.length);
    el("pm-footer").innerHTML = footerHtml(planRows.length, visibleAssignments.length);
    document.querySelectorAll("[data-detail-id]").forEach((button) => button.addEventListener("click", () => openDetails(button.dataset.detailId)));
    document.querySelectorAll(".load-more").forEach((button) => button.addEventListener("click", () => { state.limit += 50; renderTables(); }));
  }

  function footerHtml(shown, total) {
    return `<span>Showing ${shown.toLocaleString()} of ${total.toLocaleString()} records</span>${shown < total ? '<button class="load-more" type="button">Show 50 more</button>' : ""}`;
  }

  function setView(view) {
    state.view = view;
    state.limit = 50;
    document.querySelectorAll(".view-panel").forEach((panel) => { panel.hidden = panel.id !== `${view}-view`; });
    document.querySelectorAll(".nav-item").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    el("page-title").textContent = labels[view][0];
    el("page-subtitle").textContent = labels[view][1];
    el("breadcrumb-current").textContent = view === "maintenance" ? "PM schedule" : view === "junctions" ? "Junctions" : "Overview";
    el("status-filter-wrap").hidden = view === "maintenance";
    if (view === "maintenance") el("status-filter").value = "";
    el("routine-filter-wrap").hidden = false;
    renderTables();
  }

  function openDetails(id) {
    const junction = junctionById.get(String(id));
    if (!junction) return;
    state.lastFocusElement = document.activeElement;
    el("detail-id").textContent = `J-${junction.id}`;
    el("detail-name").textContent = junction.location;
    el("detail-location").textContent = `${junction.municipality}${junction.zone ? ` · Zone ${junction.zone}` : ""}`;
    el("detail-status").innerHTML = statusPill(junction.status);
    el("detail-municipality").textContent = junction.municipality;
    el("detail-zone").textContent = junction.zone || "Not listed";
    el("detail-type").textContent = junction.type || "Not specified";
    el("detail-routine-count").textContent = `${junction.routines.length} assigned`;
    el("detail-routines").innerHTML = junction.routines.length
      ? junction.routines.map((routine) => `<li><span>${escapeHtml(routine)}</span><span>Planned</span></li>`).join("")
      : "<li><span>No routine in the supplied PM list</span></li>";
    el("drawer-backdrop").hidden = false;
    el("detail-drawer").classList.add("is-open");
    el("detail-drawer").setAttribute("aria-hidden", "false");
    el("close-drawer").focus();
  }

  function closeDetails() {
    el("detail-drawer").classList.remove("is-open");
    el("detail-drawer").setAttribute("aria-hidden", "true");
    el("drawer-backdrop").hidden = true;
    if (state.lastFocusElement && typeof state.lastFocusElement.focus === "function") state.lastFocusElement.focus();
    state.lastFocusElement = null;
  }

  function resetFilters() {
    el("search-input").value = "";
    el("municipality-filter").value = "";
    el("status-filter").value = "";
    el("routine-filter").value = "";
    state.limit = 50;
    renderTables();
  }

  populateFilters();
  renderMetrics();
  renderRoutineChart();
  renderTables();

  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.openView)));
  ["search-input", "municipality-filter", "status-filter", "routine-filter"].forEach((id) => {
    el(id).addEventListener(id === "search-input" ? "input" : "change", () => { state.limit = 50; renderTables(); });
  });
  el("reset-filters").addEventListener("click", resetFilters);
  el("source-button").addEventListener("click", () => {
    const popover = el("source-popover");
    const expanded = el("source-button").getAttribute("aria-expanded") === "true";
    el("source-button").setAttribute("aria-expanded", String(!expanded));
    popover.hidden = expanded;
  });
  el("close-drawer").addEventListener("click", closeDetails);
  el("drawer-backdrop").addEventListener("click", closeDetails);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetails();
    if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      el("search-input").focus();
    }
  });
}());
