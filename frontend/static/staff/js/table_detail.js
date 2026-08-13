/**
 * staff/table_detail.js
 * Behavior for table_detail.html -- shown after tapping a table on the
 * map. Combines documented endpoints for this table:
 *   - table info: derived from GET /api/staff/tables (list), matched by id
 *     (no separate single-table GET is part of the documented API)
 *   - GET  /api/staff/tables/:id/qr               -> QR panel
 *   - PATCH /api/staff/tables/:id/assign           -> self-assign
 *   - PATCH /api/staff/tables/:id/status           -> free / occupied
 *   - GET  /api/staff/orders/pending (filtered by this table)
 *   - PATCH /api/staff/orders/:id/confirm          -> forwards to kitchen
 *   - PATCH /api/staff/orders/:id/served           -> unlocks guest [Pay]
 * There is no documented per-table order-history endpoint, so the
 * session-history panel is built best-effort from what's fetched plus
 * live ws/staff/waiter/<id>/ events received while this page is open
 * (order.submitted, ticket.ready) -- it will not show older history
 * from before the page was loaded.
 *
 * Expects in the DOM:
 *   <div id="tableDetail" data-table-id="{{ table.id }}">
 *     <span class="status-badge" id="tableStatusBadge"></span>
 *     <span id="assignedWaiter"></span>
 *     <button id="assignToMeBtn">Assign to me</button>
 *     <img id="qrImage" class="qr-panel__image">
 *     <button id="showQrBtn">Show QR</button>
 *     <ul id="pendingConfirmList"></ul>
 *     <ul id="sessionHistoryList" class="session-history"></ul>
 *   </div>
 */
(function () {
  "use strict";

  const STATUS_LABELS = { free: "Free", occupied: "Occupied", bill_requested: "Bill Requested" };

  function historyRow(text, timestamp) {
    const li = document.createElement("li");
    li.className = "session-history__row";
    li.innerHTML = `
      <span>${text}</span>
      <span class="session-history__timestamp">${new Date(timestamp).toLocaleTimeString()}</span>
    `;
    return li;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("tableDetail");
    if (!root) return;

    const tableId = Number(root.dataset.tableId);
    if (!tableId) {
      console.error("[table_detail.js] #tableDetail is missing data-table-id");
      return;
    }

    const statusBadge = document.getElementById("tableStatusBadge");
    const assignedWaiterEl = document.getElementById("assignedWaiter");
    const assignBtn = document.getElementById("assignToMeBtn");
    const qrImage = document.getElementById("qrImage");
    const showQrBtn = document.getElementById("showQrBtn");
    const pendingList = document.getElementById("pendingConfirmList");
    const historyList = document.getElementById("sessionHistoryList");

    let table = null;

    async function loadTable() {
      const { data } = await window.Staff.api("/tables");
      table = (data.tables ?? []).find((t) => t.id === tableId) ?? null;
      if (!table) {
        window.Staff.toast("This table could not be found.", { type: "error" });
        return;
      }
      if (statusBadge) {
        statusBadge.className = `status-badge status-badge--${table.status}`;
        statusBadge.textContent = STATUS_LABELS[table.status];
      }
      if (assignedWaiterEl) {
        assignedWaiterEl.textContent = table.assigned_waiter ? table.assigned_waiter.name : "Unassigned";
      }
      if (assignBtn) assignBtn.disabled = Boolean(table.assigned_waiter);
    }

    async function loadPendingConfirmations() {
      if (!pendingList) return;
      const { data } = await window.Staff.api("/orders/pending");
      const ordersForTable = (data.orders ?? []).filter((order) => order.table_id === tableId);

      pendingList.innerHTML = "";
      if (!ordersForTable.length) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.innerHTML = "<p>No orders waiting for confirmation.</p>";
        pendingList.appendChild(empty);
        return;
      }

      ordersForTable.forEach((order) => {
        const li = document.createElement("li");
        li.className = "order-confirm-card";
        li.dataset.orderId = String(order.id);
        const itemNames = (order.items ?? []).map((item) => item.name).join(", ");
        li.innerHTML = `
          <div class="order-confirm-card__info">
            <span class="order-confirm-card__id">Order #${order.id}</span>
            <span class="order-confirm-card__items">${itemNames}</span>
          </div>
          <button class="btn btn--sm btn--primary" data-action="confirm">Confirm</button>
        `;
        li.querySelector('[data-action="confirm"]').addEventListener("click", async (event) => {
          const btn = event.currentTarget;
          btn.disabled = true;
          try {
            await window.Staff.api(`/orders/${order.id}/confirm`, { method: "PATCH" });
            window.Staff.toast(`Order #${order.id} confirmed and sent to the kitchen`, { type: "success" });
            li.remove();
            historyList?.prepend(historyRow(`Order #${order.id} confirmed`, Date.now()));
          } catch (err) {
            console.error("[table_detail.js] failed to confirm order", err);
            window.Staff.toast("Could not confirm this order.", { type: "error" });
            btn.disabled = false;
          }
        });
        pendingList.appendChild(li);
      });
    }

    try {
      await loadTable();
      await loadPendingConfirmations();
    } catch (err) {
      console.error("[table_detail.js] failed to load table detail", err);
      window.Staff.toast("Could not load this table.", { type: "error" });
    }

    assignBtn?.addEventListener("click", async () => {
      assignBtn.disabled = true;
      try {
        await window.Staff.api(`/tables/${tableId}/assign`, { method: "PATCH" });
        window.Staff.toast("You're now assigned to this table", { type: "success" });
        await loadTable();
      } catch (err) {
        console.error("[table_detail.js] failed to self-assign", err);
        window.Staff.toast("Could not assign you to this table.", { type: "error" });
        assignBtn.disabled = false;
      }
    });

    showQrBtn?.addEventListener("click", async () => {
      try {
        const { data } = await window.Staff.api(`/tables/${tableId}/qr`);
        if (qrImage) {
          qrImage.src = data.qr_image_url ?? data.qr_data_url;
          qrImage.alt = `QR code for Table ${table?.number ?? tableId}`;
        }
      } catch (err) {
        console.error("[table_detail.js] failed to load QR code", err);
        window.Staff.toast("Could not load the QR code.", { type: "error" });
      }
    });

    // Live: a new order for this table needs confirmation.
    window.Staff.ws.on("waiter", "order.submitted", (payload) => {
      if (payload.table_id !== tableId) return;
      historyList?.prepend(historyRow(`Order #${payload.order_id} submitted by guest`, Date.now()));
      loadPendingConfirmations().catch(() => {});
    });

    // Live: kitchen finished a ticket -> render a "Mark Served" row.
    window.Staff.ws.on("waiter", "ticket.ready", (payload) => {
      if (payload.table_id !== tableId || !historyList) return;
      const li = document.createElement("li");
      li.className = "session-history__row";
      li.innerHTML = `
        <span>Order #${payload.order_id} is ready</span>
        <button class="btn btn--sm btn--success" data-action="serve">Mark Served</button>
      `;
      li.querySelector('[data-action="serve"]').addEventListener("click", async (event) => {
        const btn = event.currentTarget;
        btn.disabled = true;
        try {
          await window.Staff.api(`/orders/${payload.order_id}/served`, { method: "PATCH" });
          li.innerHTML = `<span>Order #${payload.order_id} served</span>
                           <span class="session-history__timestamp">${new Date().toLocaleTimeString()}</span>`;
          window.Staff.toast(`Order #${payload.order_id} marked served`, { type: "success" });
        } catch (err) {
          console.error("[table_detail.js] failed to mark order served", err);
          window.Staff.toast("Could not mark this order as served.", { type: "error" });
          btn.disabled = false;
        }
      });
      historyList.prepend(li);
    });

    // Live: guest requested payment for this table.
    window.Staff.ws.on("waiter", "payment.requested", (payload) => {
      if (payload.table_id !== tableId) return;
      window.Staff.toast("Guest is ready to pay -- bring the bill.", { type: "info" });
      loadTable().catch(() => {});
    });
  });
})();