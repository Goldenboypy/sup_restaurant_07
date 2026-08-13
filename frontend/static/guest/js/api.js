/**
 * guest/api.js
 * NOT part of the documented frontend/static/guest/js/ file list in the
 * spec (that lists base.js, home.js, categories.js, products.js,
 * product_detail.js, cart.js, bill.js). This module exists to give the
 * server-rendered fallback the same clean endpoint layer the React app
 * has in guest-app/src/api/{session,menu,cart,orders,payment}.ts, so
 * page scripts call named methods instead of hand-typed path strings.
 *
 * Load order: base.js (defines window.Guest.api / .session / .ws)
 *             -> api.js (this file, adds window.Guest.endpoints)
 *             -> the page-specific script (categories.js, cart.js, ...)
 *
 * This file does not replace the direct window.Guest.api() calls in the
 * scripts already delivered; it is additive and safe to include -- if
 * omitted, nothing else breaks, since it changes no existing behavior.
 */
(function () {
  "use strict";

  if (!window.Guest || typeof window.Guest.api !== "function") {
    console.error("[api.js] Guest.api() from base.js is required and must load first");
    return;
  }

  const { api } = window.Guest;

  const endpoints = {
    /* ---- session -------------------------------------------------- */
    // GET /api/guest/session/:qr_token is handled inside Guest.session.ensure()
    // (base.js) since every call below needs a session first anyway.
    session: {
      current: () => window.Guest.session.get(),
      ensure: () => window.Guest.session.ensure(),
    },

    /* ---- menu ------------------------------------------------------ */
    menu: {
      /** GET /api/guest/menu/categories */
      getCategories: () => api("/menu/categories").then((r) => r.data.categories ?? []),

      /** GET /api/guest/menu/categories/:id/items */
      getCategoryItems: (categoryId) =>
        api(`/menu/categories/${encodeURIComponent(categoryId)}/items`).then((r) => r.data.items ?? []),

      /** GET /api/guest/menu/items/:id */
      getItem: (itemId) => api(`/menu/items/${encodeURIComponent(itemId)}`).then((r) => r.data),
    },

    /* ---- cart -------------------------------------------------------
     * Only the documented endpoints exist (POST /cart/items, GET /cart);
     * there is no per-item delete endpoint in the spec, so none is
     * offered here -- callers must not invent one.
     * ------------------------------------------------------------------ */
    cart: {
      /** GET /api/guest/cart -> draft cart, no price field */
      get: () => api("/cart").then((r) => r.data),

      /** POST /api/guest/cart/items -> add item (+ exclusions optional) */
      addItem: (itemId, excludedIngredients = []) =>
        api("/cart/items", {
          method: "POST",
          body: {
            item_id: Number(itemId),
            ...(excludedIngredients.length ? { excluded_ingredients: excludedIngredients } : {}),
          },
        }).then((r) => r.data),

      /** Sum of item quantities, used for the cart-icon badge */
      countItems: (cart) => (cart?.items ?? []).reduce((sum, item) => sum + (item.quantity ?? 1), 0),
    },

    /* ---- orders ------------------------------------------------------ */
    orders: {
      /** POST /api/guest/orders -> submit cart -> { order_id } */
      place: () => api("/orders", { method: "POST" }).then((r) => r.data),

      /** GET /api/guest/orders -> this session's orders + status */
      list: () => api("/orders").then((r) => r.data.orders ?? []),

      /** Convenience: status of the most recently placed order, or null */
      latestStatus: (orders) => (orders.length ? orders[orders.length - 1].status : null),
    },

    /* ---- payment ------------------------------------------------------
     * GET /bill returns 403 until POST /payment has been called, so
     * getBill() surfaces that as { ready:false } instead of throwing --
     * callers should always request payment before fetching the bill.
     * ------------------------------------------------------------------ */
    payment: {
      /** GET /api/guest/bill -> 403 until payment requested, then itemized total */
      getBill: async () => {
        const { ok, data } = await api("/bill", { allow403: true });
        return ok ? { ready: true, bill: data } : { ready: false, bill: null };
      },

      /** POST /api/guest/payment {method} -> notifies waiter */
      request: (method) => {
        if (method !== "card" && method !== "cash") {
          throw new Error(`[api.js] invalid payment method "${method}", expected "card" or "cash"`);
        }
        return api("/payment", { method: "POST", body: { method } }).then((r) => r.data);
      },
    },
  };

  window.Guest.endpoints = endpoints;
})();