/**
 * staff/base.js
 * Loaded on every staff page, BEFORE the page-specific script.
 * Provides the shared `Staff` namespace used by login.js, table_map.js,
 * table_detail.js, kitchen.js and payment_requests.js:
 *
 *   Staff.auth      -- Bearer token storage (same auth.py pattern as v1.0)
 *   Staff.api()     -- fetch wrapper for /api/staff/*
 *   Staff.ws        -- shared sockets for ws/staff/waiter/<id>/ and
 *                      ws/staff/kitchen/, resolved lazily per role
 *   Staff.toast()   -- notification toast (staff/base.css .toast-host)
 *   Staff.nav       -- side-nav active state, logout, [data-nav="back"]
 *
 * No build step / no framework: plain script, loaded with a normal
 * <script src="{% static 'staff/js/base.js' %}" defer></script>.
 */
(function () {
  "use strict";

  const API_BASE = "/api/staff";
  const AUTH_STORAGE_KEY = "staff.auth"; // { token, waiterId, waiterName, role }
  const LOGIN_URL = "/login/";

  /* ------------------------------------------------------------------ */
  /* Auth: Bearer token, same auth.py pattern as v1.0                   */
  /* ------------------------------------------------------------------ */
  const auth = {
    get() {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    },

    set({ token, waiterId, waiterName, role }) {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token, waiterId, waiterName, role })
      );
    },

    isAuthenticated() {
      return Boolean(this.get()?.token);
    },

    clear() {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    },

    logout() {
      this.clear();
      window.location.href = LOGIN_URL;
    },

    /** Call on any page that requires a logged-in waiter/kitchen user. */
    require() {
      if (!this.isAuthenticated()) {
        window.location.href = LOGIN_URL;
        return null;
      }
      return this.get();
    },
  };

  /* ------------------------------------------------------------------ */
  /* API wrapper                                                        */
  /* ------------------------------------------------------------------ */
  async function api(path, { method = "GET", body } = {}) {
    const current = auth.get();

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(current?.token ? { Authorization: `Bearer ${current.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      auth.logout();
      throw Object.assign(new Error("Session expired"), { code: "UNAUTHORIZED", status: 401 });
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
  /* WebSockets: ws/staff/waiter/<waiter_id>/ and ws/staff/kitchen/     */
  /* One socket per resolved URL, page scripts subscribe by event type. */
  /* ------------------------------------------------------------------ */
  const ws = (function () {
    const sockets = new Map(); // resolvedUrl -> { socket, listeners, reconnectDelay }
    const MAX_RECONNECT_DELAY = 15000;

    function resolveUrl(channel) {
      const current = auth.get();
      if (!current?.token) return null;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      if (channel === "kitchen") {
        return `${protocol}//${window.location.host}/ws/staff/kitchen/`;
      }
      if (channel === "waiter") {
        if (!current.waiterId) return null;
        return `${protocol}//${window.location.host}/ws/staff/waiter/${current.waiterId}/`;
      }
      return null;
    }

    function connect(channel) {
      const url = resolveUrl(channel);
      if (!url) return;

      let entry = sockets.get(url);
      if (entry && (entry.socket.readyState === WebSocket.OPEN || entry.socket.readyState === WebSocket.CONNECTING)) {
        return;
      }

      if (!entry) {
        entry = { socket: null, listeners: new Map(), reconnectDelay: 1000 };
        sockets.set(url, entry);
      }

      const socket = new WebSocket(url);
      entry.socket = socket;

      socket.addEventListener("open", () => {
        entry.reconnectDelay = 1000;
      });

      socket.addEventListener("message", (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (_) {
          return;
        }
        if (!message?.type) return;
        entry.listeners.get(message.type)?.forEach((handler) => {
          try {
            handler(message.payload ?? message);
          } catch (err) {
            console.error(`[Staff.ws] handler for "${message.type}" threw`, err);
          }
        });
      });

      socket.addEventListener("close", () => {
        setTimeout(() => connect(channel), entry.reconnectDelay);
        entry.reconnectDelay = Math.min(entry.reconnectDelay * 2, MAX_RECONNECT_DELAY);
      });

      socket.addEventListener("error", () => socket.close());
    }

    /**
     * Subscribe to an event on a channel ("waiter" | "kitchen").
     * Returns an unsubscribe function.
     */
    function on(channel, eventType, handler) {
      const url = resolveUrl(channel);
      if (!url) return () => {};
      let entry = sockets.get(url);
      if (!entry) {
        entry = { socket: null, listeners: new Map(), reconnectDelay: 1000 };
        sockets.set(url, entry);
      }
      if (!entry.listeners.has(eventType)) entry.listeners.set(eventType, new Set());
      entry.listeners.get(eventType).add(handler);
      connect(channel);
      return () => entry.listeners.get(eventType)?.delete(handler);
    }

    return { on };
  })();

  /* ------------------------------------------------------------------ */
  /* Toast (staff/base.css .toast-host)                                 */
  /* ------------------------------------------------------------------ */
  function toast(message, { type = "info", duration = 3200 } = {}) {
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
  /* Nav helpers: side-nav active state, logout, back                   */
  /* ------------------------------------------------------------------ */
  const nav = {
    init(root = document) {
      const path = window.location.pathname;
      root.querySelectorAll(".side-nav__link").forEach((link) => {
        const href = link.getAttribute("href");
        link.classList.toggle("is-active", Boolean(href) && path.startsWith(href));
      });

      root.querySelectorAll("[data-nav=\"logout\"]").forEach((el) => {
        el.addEventListener("click", (event) => {
          event.preventDefault();
          auth.logout();
        });
      });

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

      const nameEl = root.querySelector(".app-header__waiter-name");
      if (nameEl) {
        const current = auth.get();
        nameEl.textContent = current?.waiterName ?? "";
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  window.Staff = { auth, api, ws, toast, nav };

  document.addEventListener("DOMContentLoaded", () => {
    const requiresAuth = document.body.dataset.requiresAuth !== "false";
    if (requiresAuth && window.location.pathname !== LOGIN_URL) {
      if (!auth.require()) return; // redirected to /login/
    }
    nav.init();
  });
})();