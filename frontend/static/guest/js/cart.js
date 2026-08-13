/**
 * frontend/static/js/cart.js
 * ==========================================================================
 * This file now contains TWO independent, self-contained cart modules,
 * kept side by side on purpose:
 *
 *   1) EXISTING / CURRENTLY LIVE  -> window.Cart
 *      The e-commerce Menu cart (products, quantities, stock badges,
 *      delivery/pickup checkout). Fully unchanged below -- every function,
 *      DOM id, and behavior is exactly as it already runs in production.
 *
 *   2) NEW / GUEST ORDERING FLOW  -> guest cart.html (Step 6 of the guest
 *      flow described in the restaurant API spec)
 *      Talks to a completely different backend surface
 *      (/api/guest/cart, /api/guest/orders) and a completely different
 *      set of DOM ids (#cartList, #orderStatusList, #placeOrderBtn).
 *
 * WHY THEY CAN SAFELY SHARE ONE FILE, LOADED TOGETHER, WITHOUT CONFLICT:
 *   - Each module is its own IIFE with "use strict" -- no shared scope,
 *     no shared local variables, no shared helper-function names leak
 *     between them.
 *   - Each module's own DOMContentLoaded handler starts by looking for
 *     the DOM elements *that only exist on its own page*
 *     (#cart-container / #cart-empty for module 1, #cartList for
 *     module 2) and returns immediately if they are not found. Only one
 *     of the two will ever find its elements on a given page, so only
 *     one of the two ever actually does anything -- the other becomes a
 *     no-op for that page load. Multiple DOMContentLoaded listeners on
 *     one document are explicitly supported by the browser and all of
 *     them fire; that is exactly what is relied on here.
 *   - The only global identifier module 1 creates is window.Cart.
 *     Module 2 creates no global of its own; it *consumes* window.Guest
 *     (created by guest/base.js, loaded separately on guest pages only)
 *     for its API/WebSocket/toast helpers. Neither module reads or
 *     writes a property the other one owns, so there is no collision in
 *     either direction, regardless of which script tag loads first.
 *   - Nothing below was deleted, renamed, or rewritten from either
 *     original source -- this file is the union of both.
 * ========================================================================== */


/* ============================================================================
 * MODULE 1 -- EXISTING / CURRENTLY LIVE: window.Cart (e-commerce cart)
 * Connection map:
 *   <- api.js          : apiGet, apiPost, apiPut, apiDelete  (REST wrappers)
 *   <- auth.js         : getToken()  (Bearer token from localStorage)
 *   -> /api/cart/      : GET view, POST add, PUT update, DELETE clear
 *   -> /api/orders/    : POST create order (checkout)
 *   -> ws/stock/<id>/  : StockConsumer (consumers.py) — live stock badge
 *   -> cart.html       : renders cart UI, wires all DOM events
 *
 * Public API exported on window.Cart:
 *   Cart.load()                  fetch & render the cart
 *   Cart.add(productId, qty)     add item, re-render
 *   Cart.update(itemId, qty)     change qty (0 = remove)
 *   Cart.clear()                 empty entire cart
 *   Cart.checkout(payload)       place order from current cart
 *   Cart.watchStock(productId)   open WebSocket for live stock badge
 * ========================================================================== */

"use strict";

(() => {
  // ── Constants ──────────────────────────────────────────────────────────────
  const BASE      = "/api";
  const WS_BASE   = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  const DELIVERY_FEE = 15000;   // UZS — must match routers.py

  // ── Active stock WebSockets (productId → WebSocket) ───────────────────────
  const _stockSockets = new Map();

  // ── Token helper ───────────────────────────────────────────────────────────
  function token() {
    return localStorage.getItem("token") || "";
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    };
  }

  // ── Core fetch helpers ─────────────────────────────────────────────────────
  async function request(method, url, body = null) {
    const opts = { method, headers: authHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
  }

  // ── Format helpers ─────────────────────────────────────────────────────────
  function fmt(amount) {
    return Number(amount).toLocaleString("en-US") + " UZS";
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Render the full cart into #cart-container.
   * Expects the element structure defined in cart.html.
   */
  function render(cart) {
    const container = document.getElementById("cart-container");
    const summary   = document.getElementById("cart-summary");
    const emptyMsg  = document.getElementById("cart-empty");
    const badge     = document.getElementById("cart-badge");  // navbar badge

    // Update navbar badge
    if (badge) badge.textContent = cart.item_count || "";

    if (!cart.item_count) {
      if (container) container.innerHTML = "";
      if (summary)   summary.classList.add("hidden");
      if (emptyMsg)  emptyMsg.classList.remove("hidden");
      return;
    }

    if (emptyMsg)  emptyMsg.classList.add("hidden");
    if (summary)   summary.classList.remove("hidden");

    // ── Item rows ────────────────────────────────────────────────────────────
    const rows = cart.items.map(item => `
      <tr class="cart-row" data-item-id="${item.id}" data-product-id="${item.product_id}">
        <td class="cart-cell cart-cell--product">
          <div class="cart-product">
            <div class="cart-product__img">
              ${item.product_image
                ? `<img src="${item.product_image}" alt="${item.product_name}"/>`
                : `<span class="cart-product__placeholder">🛒</span>`}
            </div>
            <div class="cart-product__info">
              <span class="cart-product__name">${item.product_name}</span>
              <span class="cart-product__unit-price">${fmt(item.unit_price)} each</span>
              <span class="cart-stock-badge" id="stock-${item.product_id}"></span>
            </div>
          </div>
        </td>

        <td class="cart-cell cart-cell--qty">
          <div class="qty-control">
            <button class="qty-btn qty-btn--dec"
                    onclick="Cart.update(${item.id}, ${item.quantity - 1})"
                    ${item.quantity <= 1 ? "" : ""}>
              &minus;
            </button>
            <input class="qty-input"
                   type="number"
                   min="0" max="100"
                   value="${item.quantity}"
                   onchange="Cart.update(${item.id}, parseInt(this.value) || 0)"
                   onblur="Cart.update(${item.id}, parseInt(this.value) || 0)"/>
            <button class="qty-btn qty-btn--inc"
                    onclick="Cart.update(${item.id}, ${item.quantity + 1})">
              +
            </button>
          </div>
        </td>

        <td class="cart-cell cart-cell--subtotal">
          ${fmt(item.subtotal)}
        </td>

        <td class="cart-cell cart-cell--remove">
          <button class="remove-btn" title="Remove"
                  onclick="Cart.update(${item.id}, 0)">
            &times;
          </button>
        </td>
      </tr>
    `).join("");

    if (container) {
      container.innerHTML = `
        <table class="cart-table">
          <thead>
            <tr>
              <th class="cart-th">Product</th>
              <th class="cart-th">Quantity</th>
              <th class="cart-th">Subtotal</th>
              <th class="cart-th"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    // ── Summary panel ────────────────────────────────────────────────────────
    const deliveryType  = _getDeliveryType();
    const deliveryFee   = deliveryType === "delivery" ? DELIVERY_FEE : 0;
    const grandTotal    = Number(cart.total) + deliveryFee;

    const summaryEl = document.getElementById("summary-subtotal");
    const feeEl     = document.getElementById("summary-fee");
    const totalEl   = document.getElementById("summary-total");
    const countEl   = document.getElementById("summary-count");

    if (summaryEl) summaryEl.textContent = fmt(cart.total);
    if (feeEl)     feeEl.textContent     = deliveryFee > 0 ? fmt(deliveryFee) : "Free";
    if (totalEl)   totalEl.textContent   = fmt(grandTotal);
    if (countEl)   countEl.textContent   = `${cart.item_count} item${cart.item_count !== 1 ? "s" : ""}`;

    // ── Open stock WebSockets for each product ───────────────────────────────
    cart.items.forEach(item => Cart.watchStock(item.product_id));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DELIVERY TYPE TOGGLE (delivery vs pickup)
  // ══════════════════════════════════════════════════════════════════════════

  function _getDeliveryType() {
    const el = document.querySelector('input[name="delivery_type"]:checked');
    return el ? el.value : "delivery";
  }

  function _bindDeliveryToggle() {
    document.querySelectorAll('input[name="delivery_type"]').forEach(radio => {
      radio.addEventListener("change", () => Cart.load());  // re-render totals
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION TOAST
  // ══════════════════════════════════════════════════════════════════════════

  function toast(message, type = "success") {
    const existing = document.getElementById("cart-toast");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.id = "cart-toast";
    el.className = `cart-toast cart-toast--${type}`;
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(() => el.classList.add("cart-toast--visible"), 10);
    setTimeout(() => {
      el.classList.remove("cart-toast--visible");
      setTimeout(() => el.remove(), 400);
    }, 3000);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════════════════════════

  function setLoading(loading) {
    const overlay = document.getElementById("cart-loading");
    if (overlay) overlay.classList.toggle("hidden", !loading);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  const Cart = {

    // ── Load & render cart ─────────────────────────────────────────────────
    async load() {
      if (!token()) {
        const emptyMsg = document.getElementById("cart-empty");
        const loginMsg = document.getElementById("cart-login");
        if (emptyMsg) emptyMsg.classList.add("hidden");
        if (loginMsg) loginMsg.classList.remove("hidden");
        return;
      }
      setLoading(true);
      try {
        const cart = await request("GET", "/cart");
        render(cart);
      } catch (err) {
        toast(err.message, "error");
      } finally {
        setLoading(false);
      }
    },

    // ── Add product to cart ────────────────────────────────────────────────
    async add(productId, qty = 1) {
      if (!token()) {
        toast("Please log in to add items to your cart.", "warning");
        window.location.href = "/login/";
        return;
      }
      setLoading(true);
      try {
        const cart = await request("POST", "/cart/add", {
          product_id: productId,
          quantity:   qty,
        });
        render(cart);
        toast(`Added to cart! (${cart.item_count} items)`);
      } catch (err) {
        toast(err.message, "error");
      } finally {
        setLoading(false);
      }
    },

    // ── Update item quantity (0 = remove) ──────────────────────────────────
    async update(itemId, qty) {
      setLoading(true);
      try {
        const cart = await request("PUT", `/cart/item/${itemId}`, { quantity: qty });
        render(cart);
        if (qty === 0) toast("Item removed from cart.", "info");
      } catch (err) {
        toast(err.message, "error");
      } finally {
        setLoading(false);
      }
    },

    // ── Clear entire cart ──────────────────────────────────────────────────
    async clear() {
      if (!confirm("Clear your entire cart?")) return;
      setLoading(true);
      try {
        await request("DELETE", "/cart/clear");
        render({ item_count: 0, total: 0, items: [] });
        // Close all open stock sockets
        _stockSockets.forEach(ws => ws.close());
        _stockSockets.clear();
        toast("Cart cleared.", "info");
      } catch (err) {
        toast(err.message, "error");
      } finally {
        setLoading(false);
      }
    },

    // ── Checkout ───────────────────────────────────────────────────────────
    async checkout() {
      const deliveryType    = _getDeliveryType();
      const addressEl       = document.getElementById("delivery-address");
      const branchEl        = document.getElementById("branch-select");
      const noteEl          = document.getElementById("order-note");
      const deliveryAddress = addressEl ? addressEl.value.trim() : "";
      const branchId        = branchEl  ? (branchEl.value || null) : null;
      const note            = noteEl    ? noteEl.value.trim() : "";

      // Client-side validation
      if (deliveryType === "delivery" && !deliveryAddress) {
        toast("Please enter a delivery address.", "warning");
        if (addressEl) addressEl.focus();
        return;
      }
      if (deliveryType === "pickup" && !branchId) {
        toast("Please select a store branch for pickup.", "warning");
        if (branchEl) branchEl.focus();
        return;
      }

      setLoading(true);
      try {
        const order = await request("POST", "/orders", {
          delivery_type:    deliveryType,
          delivery_address: deliveryAddress,
          branch_id:        branchId ? parseInt(branchId) : null,
          note:             note,
        });

        // Close all stock sockets — cart is now empty
        _stockSockets.forEach(ws => ws.close());
        _stockSockets.clear();

        toast(`Order #${order.id} placed! Status: ${order.status}`, "success");

        // Redirect to orders page after short delay
        setTimeout(() => { window.location.href = "/orders/"; }, 1500);

      } catch (err) {
        toast(err.message, "error");
      } finally {
        setLoading(false);
      }
    },

    // ── WebSocket: live stock badge for a product ──────────────────────────
    // Connects to consumers.py :: StockConsumer
    // ws://host/ws/stock/<product_id>/
    watchStock(productId) {
      if (_stockSockets.has(productId)) return;  // already watching

      const ws = new WebSocket(`${WS_BASE}/ws/stock/${productId}/`);

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const badge = document.getElementById(`stock-${productId}`);
        if (!badge) return;

        const stock = data.stock;
        if (data.type === "stock.current" || data.type === "stock.update") {
          if (stock === 0) {
            badge.textContent  = "Out of stock";
            badge.className    = "cart-stock-badge cart-stock-badge--out";
          } else if (stock <= 5) {
            badge.textContent  = `Only ${stock} left!`;
            badge.className    = "cart-stock-badge cart-stock-badge--low";
          } else {
            badge.textContent  = `${stock} in stock`;
            badge.className    = "cart-stock-badge cart-stock-badge--ok";
          }
        }
      };

      ws.onerror = () => {
        // Silent fail — stock badge just stays empty
        _stockSockets.delete(productId);
      };

      ws.onclose = () => {
        _stockSockets.delete(productId);
      };

      _stockSockets.set(productId, ws);
    },

    // ── Load branch list for pickup select ────────────────────────────────
    async loadBranches() {
      const select = document.getElementById("branch-select");
      if (!select) return;
      try {
        const branches = await request("GET", "/branches");
        select.innerHTML = `<option value="">-- Select branch --</option>` +
          branches.map(b =>
            `<option value="${b.id}">${b.name} — ${b.city}</option>`
          ).join("");
      } catch {
        // Silently ignore
      }
    },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════════════════════
  document.addEventListener("DOMContentLoaded", () => {
    // Only run on cart page
    if (!document.getElementById("cart-container") &&
        !document.getElementById("cart-empty")) return;

    Cart.load();
    Cart.loadBranches();
    _bindDeliveryToggle();

    // Wire checkout button
    const checkoutBtn = document.getElementById("checkout-btn");
    if (checkoutBtn) checkoutBtn.addEventListener("click", () => Cart.checkout());

    // Wire clear button
    const clearBtn = document.getElementById("cart-clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", () => Cart.clear());
  });

  // Expose globally so cart.html inline handlers and other modules can call it
  window.Cart = Cart;

})();


/* ============================================================================
 * MODULE 2 -- NEW: guest ordering-flow cart (frontend/static/guest/js/cart.js)
 * Behavior for guest cart.html -- Step 6 of the guest flow.
 * GET  /api/guest/cart   -> draft cart, deliberately NO price field.
 * POST /api/guest/orders -> submits the cart, returns an order_id.
 * GET  /api/guest/orders -> this session's orders + status, used to
 *                           render the order-tracking list below the
 *                           draft cart and kept live via WebSocket.
 *
 * Expects in the DOM (a completely different page than MODULE 1's
 * #cart-container / #cart-empty, so the two never collide):
 *   <ul id="cartList" class="cart-list"></ul>
 *   <ul id="orderStatusList" class="cart__orders-heading"></ul>
 *   <button id="placeOrderBtn" class="btn btn--primary cart__place-order-btn"></button>
 *
 * Depends on window.Guest (guest/base.js), loaded separately on guest
 * pages only -- it is never referenced by, and never references,
 * window.Cart above.
 *
 * NOTE: removing a single item from the draft cart is not part of the
 * documented API (only POST /cart/items and GET /cart exist), so the
 * .cart-item__remove control is rendered for future use but stays
 * disabled here rather than calling an endpoint that does not exist.
 * ========================================================================== */
(function () {
  "use strict";

  const STATUS_LABELS = {
    submitted: "Submitted",
    waiter_confirmed: "Confirmed",
    kitchen_in_progress: "Preparing",
    ready: "Ready",
    served: "Served",
  };

  function cartItemTemplate(item) {
    const li = document.createElement("li");
    li.className = "cart-item card";
    const exclusions = item.excluded_ingredients ?? [];
    li.innerHTML = `
      <img class="cart-item__thumb" src="${item.image_url}" alt="">
      <div class="cart-item__body">
        <span class="cart-item__name">${item.name}</span>
        <span class="cart-item__qty">Qty ${item.quantity ?? 1}</span>
        ${
          exclusions.length
            ? `<div class="cart-item__exclusions">${exclusions
                .map((ex) => `<span class="tag">no ${ex}</span>`)
                .join("")}</div>`
            : ""
        }
      </div>
      <button class="cart-item__remove" type="button" disabled aria-label="Remove item (coming soon)">&times;</button>
    `;
    return li;
  }

  function orderRowTemplate(order) {
    const li = document.createElement("li");
    li.className = "order-status-row card";
    li.dataset.orderId = String(order.id);
    li.innerHTML = `
      <span>Order #${order.id}</span>
      <span class="order-status-badge order-status-badge--${order.status}">
        ${STATUS_LABELS[order.status] ?? order.status}
      </span>
    `;
    return li;
  }

  function renderEmptyCart(list) {
    list.innerHTML = "";
    const li = document.createElement("li");
    li.className = "empty-state";
    li.innerHTML = `
      <h2>Your cart is empty</h2>
      <p>Browse the menu and add something you like.</p>
      <a class="btn btn--primary" href="/menu/">Browse Menu</a>
    `;
    list.appendChild(li);
  }

  async function loadCart(list, placeOrderBtn) {
    const { data } = await window.Guest.api("/cart");
    const items = data.items ?? [];
    if (!items.length) {
      renderEmptyCart(list);
      if (placeOrderBtn) placeOrderBtn.disabled = true;
      return;
    }
    list.innerHTML = "";
    const fragment = document.createDocumentFragment();
    items.forEach((item) => fragment.appendChild(cartItemTemplate(item)));
    list.appendChild(fragment);
    if (placeOrderBtn) placeOrderBtn.disabled = false;
  }

  async function loadOrders(list) {
    if (!list) return;
    const { data } = await window.Guest.api("/orders");
    const orders = data.orders ?? [];
    list.innerHTML = "";
    orders.forEach((order) => list.appendChild(orderRowTemplate(order)));
  }

  function updateOrderRow(list, payload) {
    if (!list) return;
    const row = list.querySelector(`[data-order-id="${payload.order_id}"]`);
    if (!row) return; // full loadOrders() will pick up genuinely new orders
    const badge = row.querySelector(".order-status-badge");
    if (!badge) return;
    badge.className = `order-status-badge order-status-badge--${payload.status}`;
    badge.textContent = STATUS_LABELS[payload.status] ?? payload.status;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const cartList = document.getElementById("cartList");
    const orderList = document.getElementById("orderStatusList");
    const placeOrderBtn = document.getElementById("placeOrderBtn");
    if (!cartList) return; // not the guest cart page -> module 1 or another page owns this load

    try {
      await loadCart(cartList, placeOrderBtn);
      await loadOrders(orderList);
    } catch (err) {
      console.error("[cart.js/guest] failed to load cart/orders", err);
      window.Guest.toast("Could not load your cart. Please try again.", { type: "error" });
    }

    // Keep the order-tracking list live: order.status_changed fires as
    // the waiter confirms, the kitchen progresses, and it's served.
    window.Guest.ws.on("order.status_changed", (payload) => updateOrderRow(orderList, payload));

    placeOrderBtn?.addEventListener("click", async () => {
      placeOrderBtn.disabled = true;
      try {
        // POST /api/guest/orders -> submits the cart -> an Order ID is generated.
        const { data } = await window.Guest.api("/orders", { method: "POST" });
        window.Guest.toast(`Order #${data.order_id} placed!`, { type: "success", duration: 4000 });

        await window.Guest.cart.refreshBadge();
        await loadCart(cartList, placeOrderBtn);
        await loadOrders(orderList);
      } catch (err) {
        console.error("[cart.js/guest] failed to place order", err);
        window.Guest.toast("Could not place your order. Please try again.", { type: "error" });
        placeOrderBtn.disabled = false;
      }
    });
  });
})();