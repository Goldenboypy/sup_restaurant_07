/**
 * guest/base.js
 * Loaded on every guest page, BEFORE the page-specific script.
 * Provides the shared `Guest` namespace used by home.js, categories.js,
 * products.js, product_detail.js, cart.js and bill.js:
 *
 *   Guest.session   -- table-session bootstrap (identity = the QR scan)
 *   Guest.api()     -- fetch wrapper for /api/guest/*
 *   Guest.ws        -- single shared socket to ws/guest/table/<token>/
 *   Guest.cart      -- cart-icon badge (base.css .cart-icon__badge)
 *   Guest.nav       -- [data-nav="back"] helpers
 *   Guest.toast()   -- lightweight toast notifications
 *
 * No build step / no framework: plain ES modules-free script, safe to load
 * with a normal <script src="{% static 'guest/js/base.js' %}" defer></script>.
 */
(function () {
  "use strict";

  const API_BASE = "/api/guest";
  const SESSION_STORAGE_KEY = "guest.session"; // { token, tableId, tableLabel }

  /* ------------------------------------------------------------------ */
  /* Session bootstrap                                                  */
  /* GET /api/guest/session/:qr_token -> create/reuse session           */
  /* ------------------------------------------------------------------ */
  const session = {
    _cached: null,

    /** Pulls the qr_token out of the current URL, e.g. /t/<qr_token>/ or ?qr=<token> */
    _extractQrToken() {
      const params = new URLSearchParams(window.location.search);
      if (params.has("qr")) return params.get("qr");
      const match = window.location.pathname.match(/\/t\/([^/]+)\/?/);
      return match ? decodeURIComponent(match[1]) : null;
    },

    get() {
      if (this._cached) return this._cached;
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      this._cached = raw ? JSON.parse(raw) : null;
      return this._cached;
    },

    _persist(data) {
      this._cached = data;
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    },

    /**
     * Guarantees a valid table-session before any /api/guest/* call.
     * Reuses the cached session unless a *new* qr_token appears in the
     * URL (guest re-scanned, possibly a different table).
     */
    async ensure() {
      const qrToken = this._extractQrToken();
      const existing = this.get();

      if (existing && (!qrToken || existing.qrToken === qrToken)) {
        return existing;
      }

      if (!qrToken) {
        // No session and no QR token in the URL: nothing we can do here.
        throw new Object.assign(new Error("Missing table QR token"), {
          code: "NO_QR_TOKEN",
        });
      }

      const res = await fetch(`${API_BASE}/session/${encodeURIComponent(qrToken)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw Object.assign(new Error("Could not start table session"), {
          code: "SESSION_FAILED",
          status: res.status,
        });
      }

      const data = await res.json();
      const record = {
        qrToken,
        token: data.session_token,
        tableId: data.table_id,
        tableLabel: data.table_label ?? null,
      };
      this._persist(record);
      return record;
    },

    clear() {
      this._cached = null;
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    },
  };

  /* ------------------------------------------------------------------ */
  /* API wrapper                                                        */
  /* ------------------------------------------------------------------ */
  async function api(path, { method = "GET", body, allow403 = false } = {}) {
    const current = await session.ensure();

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        "X-Table-Session": current.token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 403 && allow403) {
      return { ok: false, status: 403, data: null };
    }

    if (res.status === 401 || res.status === 404) {
      // Session is gone / table session expired -> guest must re-scan.
      session.clear();
      throw Object.assign(new Error("Table session expired"), {
        code: "SESSION_EXPIRED",
        status: res.status,
      });
    }

    if (!res.ok) {
      let detail = null;
      try {
        detail = await res.json();
      } catch (_) {
        /* no JSON body */
      }
      throw Object.assign(new Error(detail?.message || `Request failed (${res.status})`), {
        code: "API_ERROR",
        status: res.status,
        detail,
      });
    }

    const data = res.status === 204 ? null : await res.json();
    return { ok: true, status: res.status, data };
  }

  /* ------------------------------------------------------------------ */
  /* Shared WebSocket: ws/guest/table/<session_token>/                  */
  /* Single connection, page scripts subscribe by event `type`.         */
  /* ------------------------------------------------------------------ */
  const ws = (function () {
    let socket = null;
    let reconnectDelay = 1000;
    const MAX_RECONNECT_DELAY = 15000;
    const listeners = new Map(); // eventType -> Set<handler>

    function dispatch(eventType, payload) {
      listeners.get(eventType)?.forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[Guest.ws] handler for "${eventType}" threw`, err);
        }
      });
    }

    async function connect() {
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
      }
      const current = await session.ensure().catch(() => null);
      if (!current) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws/guest/table/${current.token}/`);

      socket.addEventListener("open", () => {
        reconnectDelay = 1000;
      });

      socket.addEventListener("message", (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (_) {
          return;
        }
        if (message?.type) dispatch(message.type, message.payload ?? message);
      });

      socket.addEventListener("close", () => {
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      });

      socket.addEventListener("error", () => socket.close());
    }

    function on(eventType, handler) {
      if (!listeners.has(eventType)) listeners.set(eventType, new Set());
      listeners.get(eventType).add(handler);
      connect();
      return () => listeners.get(eventType)?.delete(handler);
    }

    return { on };
  })();

  /* ------------------------------------------------------------------ */
  /* Cart-icon badge (base.css .cart-icon__badge)                       */
  /* ------------------------------------------------------------------ */
  const cart = {
    async refreshBadge() {
      try {
        const { data } = await api("/cart");
        const count = (data?.items ?? []).reduce((sum, item) => sum + (item.quantity ?? 1), 0);
        document.querySelectorAll(".cart-icon__badge").forEach((el) => {
          el.textContent = count > 0 ? String(count) : "";
          el.dataset.count = String(count);
        });
        return count;
      } catch (err) {
        // Badge is a non-critical enhancement; never break the page for it.
        console.warn("[Guest.cart] could not refresh badge", err);
        return null;
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* Nav helpers                                                        */
  /* ------------------------------------------------------------------ */
  const nav = {
    init(root = document) {
      root.querySelectorAll('[data-nav="back"]').forEach((el) => {
        el.addEventListener("click", (event) => {
          event.preventDefault();
          const fallback = el.getAttribute("href");
          if (document.referrer && window.history.length > 1) {
            window.history.back();
          } else if (fallback) {
            window.location.href = fallback;
          }
        });
      });
    },
  };

  /* ------------------------------------------------------------------ */
  /* Toast                                                              */
  /* ------------------------------------------------------------------ */
  function toast(message, { type = "info", duration = 2600 } = {}) {
    let host = document.querySelector(".toast-host");
    if (!host) {
      host = document.createElement("div");
      host.className = "toast-host";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("toast--visible"));
    setTimeout(() => {
      el.classList.remove("toast--visible");
      el.addEventListener("transitionend", () => el.remove(), { once: true });
    }, duration);
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  window.Guest = { session, api, ws, cart, nav, toast };

  document.addEventListener("DOMContentLoaded", () => {
    nav.init();
    session
      .ensure()
      .then(() => cart.refreshBadge())
      .catch((err) => {
        if (err.code === "NO_QR_TOKEN") return; // e.g. a page reached without ever scanning
        console.error("[Guest.base] session bootstrap failed", err);
      });
  });
})();