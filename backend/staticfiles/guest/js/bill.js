/**
 * guest/bill.js
 * Behavior for bill.html -- Step 7 of the guest flow.
 *
 * Gating (per the order state machine): the [ Pay ] button only becomes
 * active once the most recent order's status is "served". Tapping
 * [ Pay ] reveals the payment-method picker; choosing Card or Cash
 * calls POST /api/guest/payment, which is what actually unlocks
 * GET /api/guest/bill (403 before a payment is requested, per the API
 * spec) -- so the order here is deliberately: request -> then fetch.
 *
 *   GET  /api/guest/orders  -> checks whether the latest order is served
 *   POST /api/guest/payment -> {method: "card" | "cash"}
 *   GET  /api/guest/bill    -> itemized total, only after payment requested
 *
 * WebSocket events consumed (ws/guest/table/<session_token>/):
 *   order.status_changed -> unlocks Pay as soon as status becomes "served"
 *   bill.ready            -> server confirms the bill is ready; re-fetched
 *
 * Expects in the DOM:
 *   <div id="billLocked" class="bill--locked" hidden>...</div>
 *   <div id="paymentMethodPicker" class="payment-method-picker" hidden>
 *     <button class="payment-method-option" data-method="card">Card</button>
 *     <button class="payment-method-option" data-method="cash">Cash</button>
 *   </div>
 *   <div id="billSummary" class="bill-summary card" hidden></div>
 *   <div id="billRequested" class="bill--requested" hidden></div>
 *   <button id="payBtn" class="btn btn--primary bill__pay-btn" disabled>Pay</button>
 */
(function () {
  "use strict";

  function setHidden(el, hidden) {
    if (el) el.hidden = hidden;
  }

  function renderSummary(container, bill) {
    if (!container) return;
    const rows = (bill.items ?? [])
      .map(
        (item) => `
          <div class="bill-summary__row">
            <span class="bill-summary__item-name">
              ${item.name}
              ${
                item.excluded_ingredients?.length
                  ? `<span class="bill-summary__item-exclusions">no ${item.excluded_ingredients.join(", ")}</span>`
                  : ""
              }
            </span>
            <span class="bill-summary__item-price">${item.price_display}</span>
          </div>`
      )
      .join("");

    container.innerHTML = `
      ${rows}
      <div class="bill-summary__total-row">
        <span class="bill-summary__total-label">Total</span>
        <span class="bill-summary__total-value">${bill.total_display}</span>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const lockedEl = document.getElementById("billLocked");
    const pickerEl = document.getElementById("paymentMethodPicker");
    const summaryEl = document.getElementById("billSummary");
    const requestedEl = document.getElementById("billRequested");
    const payBtn = document.getElementById("payBtn");
    if (!payBtn) return;

    let latestOrderStatus = null;
    let paymentRequested = false;

    function refreshPayButtonState() {
      const isServed = latestOrderStatus === "served";
      payBtn.disabled = !isServed || paymentRequested;
    }

    async function checkOrders() {
      try {
        const { data } = await window.Guest.api("/orders");
        const orders = data.orders ?? [];
        latestOrderStatus = orders.length ? orders[orders.length - 1].status : null;
        refreshPayButtonState();
      } catch (err) {
        console.error("[bill.js] failed to check order status", err);
      }
    }

    async function fetchBill() {
      const { ok, data } = await window.Guest.api("/bill", { allow403: true });
      if (!ok) return null; // still hidden -> payment not requested yet
      return data;
    }

    async function submitPayment(method) {
      payBtn.disabled = true;
      try {
        // POST /api/guest/payment {method} -> notifies waiter.
        await window.Guest.api("/payment", { method: "POST", body: { method } });
        paymentRequested = true;

        const bill = await fetchBill();
        if (bill) {
          renderSummary(summaryEl, bill);
          setHidden(summaryEl, false);
        }

        setHidden(pickerEl, true);
        setHidden(lockedEl, true);
        setHidden(requestedEl, false);
        window.Guest.toast("Your waiter has been notified.", { type: "success" });
      } catch (err) {
        console.error("[bill.js] failed to submit payment request", err);
        window.Guest.toast("Could not send your payment request. Please try again.", { type: "error" });
        refreshPayButtonState();
      }
    }

    // Initial state: locked until the order is served.
    setHidden(pickerEl, true);
    setHidden(summaryEl, true);
    setHidden(requestedEl, true);
    await checkOrders();

    // [ Pay ] reveals the Card / Cash picker; it does not call the API
    // by itself -- the guest still has to choose a method.
    payBtn.addEventListener("click", () => {
      setHidden(lockedEl, true);
      setHidden(pickerEl, false);
    });

    pickerEl?.querySelectorAll(".payment-method-option").forEach((option) => {
      option.addEventListener("click", () => {
        pickerEl.querySelectorAll(".payment-method-option").forEach((el) => {
          el.classList.remove("is-selected");
          el.setAttribute("aria-pressed", "false");
        });
        option.classList.add("is-selected");
        option.setAttribute("aria-pressed", "true");
        submitPayment(option.dataset.method);
      });
    });

    // Live-unlock Pay the moment the waiter marks the order Served.
    window.Guest.ws.on("order.status_changed", (payload) => {
      latestOrderStatus = payload.status;
      refreshPayButtonState();
    });

    // Server confirmation that pricing has been computed -- re-fetch to
    // make sure the summary reflects the authoritative total.
    window.Guest.ws.on("bill.ready", async () => {
      const bill = await fetchBill();
      if (bill) {
        renderSummary(summaryEl, bill);
        setHidden(summaryEl, false);
      }
    });
  });
})();