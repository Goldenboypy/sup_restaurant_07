/**
 * staff/kitchen.js
 * Behavior for kitchen.html -- KITCHEN VIEW.
 * GET   /api/staff/kitchen/tickets       -> active tickets, polled/refreshed
 * PATCH /api/staff/kitchen/tickets/:id   -> status: in_progress / ready
 * Polling is the primary refresh mechanism (per spec); ws/staff/kitchen/
 * "ticket.new" is also used as a live nice-to-have so a fresh ticket can
 * appear immediately instead of waiting for the next poll tick.
 *
 * Expects in the DOM:
 *   <div class="kitchen-column kitchen-column--new" data-status="new">
 *     <ul class="kitchen-column__list"></ul>
 *   </div>
 *   (same pattern for data-status="in_progress" and "ready")
 *   <button id="refreshTicketsBtn"></button>
 */
(function () {
  "use strict";

  const POLL_INTERVAL_MS = 10_000;
  const NEXT_STATUS = { new: "in_progress", in_progress: "ready", ready: null };
  const NEXT_LABEL = { new: "Start Preparing", in_progress: "Mark Ready" };

  let knownTicketIds = new Set();
  let pollTimer = null;

  function elapsedLabel(createdAt) {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    return `${minutes}m`;
  }

  function ticketTemplate(ticket, { isNewArrival = false } = {}) {
    const li = document.createElement("li");
    li.className = `ticket-card${isNewArrival ? " ticket-card--new-arrival" : ""}`;
    li.dataset.ticketId = String(ticket.id);

    const itemRows = (ticket.items ?? [])
      .map(
        (item) => `
          <div class="ticket-card__item">
            <span>${item.quantity ?? 1}&times; ${item.name}</span>
          </div>
          ${
            item.excluded_ingredients?.length
              ? `<span class="ticket-card__item-exclusions">no ${item.excluded_ingredients.join(", ")}</span>`
              : ""
          }`
      )
      .join("");

    const minutes = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000);
    const nextStatus = NEXT_STATUS[ticket.status];

    li.innerHTML = `
      <div class="ticket-card__header">
        <span class="ticket-card__order-id">Order #${ticket.order_id}</span>
        <span class="ticket-card__table">Table ${ticket.table_number}</span>
      </div>
      <div class="ticket-card__items">${itemRows}</div>
      <div class="ticket-card__footer">
        <span class="ticket-card__elapsed${minutes >= 15 ? " ticket-card__elapsed--overdue" : ""}">
          ${elapsedLabel(ticket.created_at)}
        </span>
        ${
          nextStatus
            ? `<button class="btn btn--sm btn--primary" data-action="advance">${NEXT_LABEL[ticket.status]}</button>`
            : ""
        }
      </div>
    `;

    li.querySelector('[data-action="advance"]')?.addEventListener("click", async (event) => {
      const btn = event.currentTarget;
      btn.disabled = true;
      try {
        await window.Staff.api(`/kitchen/tickets/${ticket.id}`, {
          method: "PATCH",
          body: { status: nextStatus },
        });
        await refresh();
      } catch (err) {
        console.error("[kitchen.js] failed to advance ticket status", err);
        window.Staff.toast("Could not update this ticket.", { type: "error" });
        btn.disabled = false;
      }
    });

    return li;
  }

  function renderColumn(status, tickets, freshIds) {
    const column = document.querySelector(`.kitchen-column[data-status="${status}"]`);
    if (!column) return;
    const list = column.querySelector(".kitchen-column__list") ?? column;
    const countEl = column.querySelector(".kitchen-column__count");
    if (countEl) countEl.textContent = String(tickets.length);

    list.innerHTML = "";
    if (!tickets.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.innerHTML = "<p>Nothing here right now.</p>";
      list.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    tickets.forEach((ticket) => fragment.appendChild(ticketTemplate(ticket, { isNewArrival: freshIds.has(ticket.id) })));
    list.appendChild(fragment);
  }

  async function refresh() {
    try {
      const { data } = await window.Staff.api("/kitchen/tickets");
      const tickets = data.tickets ?? [];

      const currentIds = new Set(tickets.map((t) => t.id));
      const freshIds = new Set([...currentIds].filter((id) => !knownTicketIds.has(id)));
      knownTicketIds = currentIds;

      renderColumn("new", tickets.filter((t) => t.status === "new"), freshIds);
      renderColumn("in_progress", tickets.filter((t) => t.status === "in_progress"), freshIds);
      renderColumn("ready", tickets.filter((t) => t.status === "ready"), freshIds);
    } catch (err) {
      console.error("[kitchen.js] failed to refresh tickets", err);
      window.Staff.toast("Could not refresh the ticket board.", { type: "error" });
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.querySelector(".kitchen-board")) return;

    await refresh();
    pollTimer = window.setInterval(refresh, POLL_INTERVAL_MS);

    document.getElementById("refreshTicketsBtn")?.addEventListener("click", () => refresh());

    // A waiter-confirmed order just arrived -> refresh immediately
    // instead of waiting for the next poll tick.
    window.Staff.ws.on("kitchen", "ticket.new", () => refresh());

    window.addEventListener("beforeunload", () => {
      if (pollTimer) window.clearInterval(pollTimer);
    });
  });
})();