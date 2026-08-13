/**
 * staff/table_map.js
 * Behavior for table_map.html -- WAITER VIEW, step 1 & 2.
 * GET /api/staff/tables -> every table with status + assigned_waiter.
 * Quick actions available directly from the map (Step 2, "Seating a
 * new guest"):
 *   Seat        -> PATCH /api/staff/tables/:id/status {status:"occupied"}
 *   Assign to me -> PATCH /api/staff/tables/:id/assign
 *   Show QR     -> GET   /api/staff/tables/:id/qr
 * Tapping the card body (not an action button) opens table_detail.html.
 *
 * Expects in the DOM:
 *   <div id="tableGrid" class="table-grid"></div>
 *   <dialog id="qrModal"><img id="qrModalImage"><button data-nav="close-qr"></dialog>
 */
(function () {
  "use strict";

  const STATUS_LABELS = { free: "Free", occupied: "Occupied", bill_requested: "Bill Requested" };
  const STATUS_FILTERS = ["all", "free", "occupied", "bill_requested"];

  let currentFilter = "all";
  let allTables = [];

  function waiterBadge(table) {
    if (!table.assigned_waiter) {
      return `<span class="waiter-badge waiter-badge--unassigned">Unassigned</span>`;
    }
    const initials = table.assigned_waiter.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return `
      <span class="waiter-badge">
        <span class="waiter-badge__avatar">${initials}</span>
        ${table.assigned_waiter.name}
      </span>
    `;
  }

  function cardTemplate(table) {
    const el = document.createElement("div");
    el.className = `table-card card table-card--${table.status}`;
    el.dataset.tableId = String(table.id);
    el.innerHTML = `
      <div class="table-card__header">
        <span class="table-card__number">Table ${table.number}</span>
        <span class="status-badge status-badge--${table.status}">${STATUS_LABELS[table.status]}</span>
      </div>
      <div class="table-card__footer">
        ${waiterBadge(table)}
      </div>
      <div class="table-card__actions" style="display:flex; gap:8px; flex-wrap:wrap;">
        ${
          table.status === "free"
            ? `<button class="btn btn--sm btn--primary" data-action="seat">Seat Guest</button>`
            : ""
        }
        ${
          !table.assigned_waiter
            ? `<button class="btn btn--sm btn--secondary" data-action="assign">Assign to me</button>`
            : ""
        }
        <button class="btn btn--sm btn--secondary" data-action="qr">Show QR</button>
      </div>
    `;

    el.addEventListener("click", (event) => {
      const actionBtn = event.target.closest("[data-action]");
      if (!actionBtn) {
        window.location.href = `/tables/${table.id}/`;
        return;
      }
      event.stopPropagation();
      handleAction(actionBtn.dataset.action, table);
    });

    return el;
  }

  function render(grid) {
    const tables = currentFilter === "all" ? allTables : allTables.filter((t) => t.status === currentFilter);
    grid.innerHTML = "";
    if (!tables.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<h2>No tables here</h2><p>Try a different filter.</p>`;
      grid.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    tables.forEach((table) => fragment.appendChild(cardTemplate(table)));
    grid.appendChild(fragment);
  }

  async function loadTables(grid) {
    const { data } = await window.Staff.api("/tables");
    allTables = data.tables ?? [];
    render(grid);
  }

  async function handleAction(action, table) {
    const grid = document.getElementById("tableGrid");
    try {
      if (action === "seat") {
        // Waiter marks the table Occupied as part of seating a new guest.
        await window.Staff.api(`/tables/${table.id}/status`, {
          method: "PATCH",
          body: { status: "occupied" },
        });
        window.Staff.toast(`Table ${table.number} marked Occupied`, { type: "success" });
      } else if (action === "assign") {
        // Waiter self-assigns to the table (server infers the waiter from the Bearer token).
        await window.Staff.api(`/tables/${table.id}/assign`, { method: "PATCH" });
        window.Staff.toast(`You're now assigned to Table ${table.number}`, { type: "success" });
      } else if (action === "qr") {
        await openQrModal(table);
        return; // no reload needed for a read-only QR view
      }
      await loadTables(grid);
    } catch (err) {
      console.error(`[table_map.js] action "${action}" failed`, err);
      window.Staff.toast("That action could not be completed. Please try again.", { type: "error" });
    }
  }

  async function openQrModal(table) {
    const modal = document.getElementById("qrModal");
    const image = document.getElementById("qrModalImage");
    if (!modal || !image) return;
    try {
      const { data } = await window.Staff.api(`/tables/${table.id}/qr`);
      image.src = data.qr_image_url ?? data.qr_data_url;
      image.alt = `QR code for Table ${table.number}`;
      if (typeof modal.showModal === "function") modal.showModal();
      else modal.setAttribute("open", "");
    } catch (err) {
      console.error("[table_map.js] failed to load QR code", err);
      window.Staff.toast("Could not load the QR code.", { type: "error" });
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const grid = document.getElementById("tableGrid");
    if (!grid) return;

    try {
      await loadTables(grid);
    } catch (err) {
      console.error("[table_map.js] failed to load tables", err);
      window.Staff.toast("Could not load the table map.", { type: "error" });
    }

    document.querySelectorAll(".table-map__filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentFilter = btn.dataset.status ?? "all";
        document.querySelectorAll(".table-map__filter").forEach((b) => b.classList.toggle("is-active", b === btn));
        render(grid);
      });
    });

    document.getElementById("qrModal")?.querySelectorAll('[data-nav="close-qr"]').forEach((btn) => {
      btn.addEventListener("click", () => document.getElementById("qrModal")?.close?.());
    });

    // A payment.requested / order-related event elsewhere can change a
    // table's status; keep the map reasonably fresh without a hard reload.
    window.Staff.ws.on("waiter", "payment.requested", () => loadTables(grid).catch(() => {}));
  });
})();