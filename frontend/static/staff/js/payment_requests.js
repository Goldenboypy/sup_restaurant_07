/**
 * staff/payment_requests.js
 * Behavior for payment_requests.html -- WAITER VIEW, step 7.
 * GET   /api/staff/payment-requests       -> tables awaiting payment
 * PATCH /api/staff/payment-requests/:id   -> complete -> table becomes Free
 * ws/staff/waiter/<id>/ "payment.requested" pushes new rows in live,
 * without waiting for a manual refresh.
 *
 * Expects in the DOM:
 *   <ul id="paymentRequestsList" class="payment-requests-list"></ul>
 */
(function () {
  "use strict";

  function rowTemplate(request) {
    const li = document.createElement("li");
    li.className = "payment-request-row card";
    li.dataset.requestId = String(request.id);
    li.innerHTML = `
      <span class="payment-request-row__table">Table ${request.table_number}</span>
      <div class="payment-request-row__meta">
        <span class="payment-method-tag payment-method-tag--${request.method}">${request.method}</span>
        <span class="payment-request-row__requested-at">
          Requested ${new Date(request.requested_at).toLocaleTimeString()}
        </span>
      </div>
      <span class="payment-request-row__total">${request.total_display}</span>
      <div class="payment-request-row__actions">
        <button class="btn btn--sm btn--success" data-action="complete">Mark Paid &amp; Clear</button>
      </div>
    `;

    li.querySelector('[data-action="complete"]').addEventListener("click", async (event) => {
      const btn = event.currentTarget;
      btn.disabled = true;
      try {
        // PATCH complete -> table becomes Free again.
        await window.Staff.api(`/payment-requests/${request.id}`, {
          method: "PATCH",
          body: { status: "completed" },
        });
        window.Staff.toast(`Table ${request.table_number} cleared`, { type: "success" });
        li.remove();
        maybeShowEmptyState();
      } catch (err) {
        console.error("[payment_requests.js] failed to complete payment request", err);
        window.Staff.toast("Could not complete this payment.", { type: "error" });
        btn.disabled = false;
      }
    });

    return li;
  }

  function maybeShowEmptyState() {
    const list = document.getElementById("paymentRequestsList");
    if (!list || list.children.length) return;
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.innerHTML = "<h2>No tables waiting to pay</h2><p>New requests will appear here automatically.</p>";
    list.appendChild(empty);
  }

  async function loadRequests(list) {
    const { data } = await window.Staff.api("/payment-requests");
    const requests = data.payment_requests ?? [];
    list.innerHTML = "";
    if (!requests.length) {
      maybeShowEmptyState();
      return;
    }
    const fragment = document.createDocumentFragment();
    requests.forEach((request) => fragment.appendChild(rowTemplate(request)));
    list.appendChild(fragment);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const list = document.getElementById("paymentRequestsList");
    if (!list) return;

    try {
      await loadRequests(list);
    } catch (err) {
      console.error("[payment_requests.js] failed to load payment requests", err);
      window.Staff.toast("Could not load payment requests.", { type: "error" });
    }

    // Guest just tapped [ Pay ] somewhere -> add the row live.
    window.Staff.ws.on("waiter", "payment.requested", () => {
      loadRequests(list).catch((err) => console.error("[payment_requests.js] refresh failed", err));
    });
  });
})();