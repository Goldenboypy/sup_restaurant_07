/**
 * frontend/static/js/auth.js
 * --------------------------
 * Authentication module — login, register, logout, session management.
 *
 * Connection map:
 *   -> POST /api/auth/login      auth.py :: login()     returns {access, token_type}
 *   -> POST /api/auth/register   auth.py :: register()  returns {access, token_type}
 *   -> POST /api/auth/logout     auth.py :: logout()    invalidates token in cache
 *   -> GET  /api/auth/me         auth.py :: me()        returns UserOut
 *   -> auth.html                 renders login/register tabs, wires all form events
 *   -> cart.js / main.js         calls Auth.getToken() for every protected request
 *
 * Storage:
 *   localStorage["token"]    Bearer token (string)
 *   localStorage["user"]     JSON-serialised UserOut object
 *
 * Public API on window.Auth:
 *   Auth.getToken()           returns stored token or null
 *   Auth.getUser()            returns parsed UserOut or null
 *   Auth.isLoggedIn()         boolean
 *   Auth.login(data)          POST /api/auth/login  → stores token + user
 *   Auth.register(data)       POST /api/auth/register → stores token + fetches user
 *   Auth.logout()             POST /api/auth/logout → clears storage → redirect
 *   Auth.requireAuth(path)    redirect to /login/ if not logged in
 *   Auth.updateNavbar()       sync navbar UI (name, logout button)
 */

"use strict";

(() => {
  const BASE = "/api/auth";

  // ── Storage keys ───────────────────────────────────────────────────────────
  const KEY_TOKEN = "token";
  const KEY_USER  = "user";

  // ── Helpers ────────────────────────────────────────────────────────────────
  function storeSession(token, user) {
    localStorage.setItem(KEY_TOKEN, token);
    localStorage.setItem(KEY_USER, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USER);
  }

  async function apiFetch(method, path, body = null, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VALIDATION  (client-side, mirrors auth.py server-side rules)
  // ══════════════════════════════════════════════════════════════════════════

  const rules = {
    username(v)  { return v.length >= 3   ? null : "Username must be at least 3 characters."; },
    email(v)     { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter a valid email address."; },
    password(v)  { return v.length >= 6   ? null : "Password must be at least 6 characters."; },
    first_name(v){ return v.length > 0    ? null : "First name is required."; },
    last_name(v) { return v.length > 0    ? null : "Last name is required."; },
    confirm(v, pw){ return v === pw       ? null : "Passwords do not match."; },
  };

  function validate(fields) {
    // fields: array of { id, rule, extra? }
    // Returns true if all pass, false + shows errors if not
    let valid = true;
    fields.forEach(({ id, rule, extra }) => {
      const el    = document.getElementById(id);
      const errEl = document.getElementById(`${id}-error`);
      if (!el) return;

      const msg = rule(el.value.trim(), extra);
      if (msg) {
        el.classList.add("input--error");
        if (errEl) { errEl.textContent = msg; errEl.classList.remove("hidden"); }
        valid = false;
      } else {
        el.classList.remove("input--error");
        if (errEl) errEl.classList.add("hidden");
      }
    });
    return valid;
  }

  function clearErrors() {
    document.querySelectorAll(".input--error").forEach(el => el.classList.remove("input--error"));
    document.querySelectorAll(".field-error").forEach(el => el.classList.add("hidden"));
    const formErr = document.getElementById("form-error");
    if (formErr) { formErr.textContent = ""; formErr.classList.add("hidden"); }
  }

  function showFormError(msg) {
    const el = document.getElementById("form-error");
    if (el) { el.textContent = msg; el.classList.remove("hidden"); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════════════════════════

  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.dataset.original = btn.dataset.original || btn.innerHTML;
    btn.innerHTML = loading
      ? `<span class="spinner-inline"></span> Please wait…`
      : btn.dataset.original;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASSWORD STRENGTH METER
  // ══════════════════════════════════════════════════════════════════════════

  function getStrength(pw) {
    let score = 0;
    if (pw.length >= 8)               score++;
    if (pw.length >= 12)              score++;
    if (/[A-Z]/.test(pw))            score++;
    if (/[0-9]/.test(pw))            score++;
    if (/[^A-Za-z0-9]/.test(pw))    score++;
    return score;   // 0-5
  }

  function updateStrengthMeter(pw) {
    const bar   = document.getElementById("strength-bar");
    const label = document.getElementById("strength-label");
    if (!bar || !label) return;

    const score = getStrength(pw);
    const levels = [
      { text: "",          color: "#e5e7eb", width: "0%" },
      { text: "Very weak", color: "#ef4444", width: "20%" },
      { text: "Weak",      color: "#f97316", width: "40%" },
      { text: "Fair",      color: "#eab308", width: "60%" },
      { text: "Strong",    color: "#22c55e", width: "80%" },
      { text: "Very strong",color:"#16a34a", width: "100%" },
    ];

    const level     = levels[score] || levels[0];
    bar.style.width = level.width;
    bar.style.background = level.color;
    label.textContent    = level.text;
    label.style.color    = level.color;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB SWITCH  (Login ↔ Register)
  // ══════════════════════════════════════════════════════════════════════════

  function switchTab(tab) {
    const loginPanel    = document.getElementById("login-panel");
    const registerPanel = document.getElementById("register-panel");
    const loginTab      = document.getElementById("tab-login");
    const registerTab   = document.getElementById("tab-register");

    clearErrors();

    if (tab === "login") {
      loginPanel.classList.remove("hidden");
      registerPanel.classList.add("hidden");
      loginTab.classList.add("tab--active");
      registerTab.classList.remove("tab--active");
      document.getElementById("login-username")?.focus();
    } else {
      loginPanel.classList.add("hidden");
      registerPanel.classList.remove("hidden");
      loginTab.classList.remove("tab--active");
      registerTab.classList.add("tab--active");
      document.getElementById("reg-first-name")?.focus();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  async function handleLogin(e) {
    e.preventDefault();
    clearErrors();

    const usernameEl = document.getElementById("login-username");
    const passwordEl = document.getElementById("login-password");
    if (!usernameEl || !passwordEl) return;

    const username = usernameEl.value.trim();
    const password = passwordEl.value;

    if (!username || !password) {
      showFormError("Please fill in all fields.");
      return;
    }

    setLoading("login-btn", true);
    try {
      // POST /api/auth/login → { access, token_type }
      const tokenData = await apiFetch("POST", "/login", { username, password });

      // Fetch user profile with the new token
      // GET /api/auth/me → { id, username, email, first_name, last_name }
      const user = await apiFetch("GET", "/me", null, tokenData.access);

      storeSession(tokenData.access, user);
      Auth.updateNavbar();

      // Redirect: back to previous page or homepage
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next;

    } catch (err) {
      showFormError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading("login-btn", false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    clearErrors();

    const pw = document.getElementById("reg-password")?.value || "";

    const ok = validate([
      { id: "reg-first-name", rule: rules.first_name },
      { id: "reg-last-name",  rule: rules.last_name  },
      { id: "reg-username",   rule: rules.username   },
      { id: "reg-email",      rule: rules.email      },
      { id: "reg-password",   rule: rules.password   },
      { id: "reg-confirm",    rule: (v) => rules.confirm(v, pw) },
    ]);

    if (!ok) return;

    const payload = {
      username:   document.getElementById("reg-username").value.trim(),
      email:      document.getElementById("reg-email").value.trim(),
      password:   pw,
      first_name: document.getElementById("reg-first-name").value.trim(),
      last_name:  document.getElementById("reg-last-name").value.trim(),
    };

    setLoading("register-btn", true);
    try {
      // POST /api/auth/register → { access, token_type }
      const tokenData = await apiFetch("POST", "/register", payload);

      // Fetch newly created user profile
      const user = await apiFetch("GET", "/me", null, tokenData.access);

      storeSession(tokenData.access, user);
      Auth.updateNavbar();

      // New users always go to homepage
      window.location.href = "/";

    } catch (err) {
      showFormError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading("register-btn", false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TOGGLE PASSWORD VISIBILITY
  // ══════════════════════════════════════════════════════════════════════════

  function toggleVisibility(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn   = document.getElementById(btnId);
    if (!input || !btn) return;
    const show  = input.type === "password";
    input.type  = show ? "text" : "password";
    btn.textContent = show ? "🙈" : "👁";
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  const Auth = {

    getToken() {
      return localStorage.getItem(KEY_TOKEN) || null;
    },

    getUser() {
      try { return JSON.parse(localStorage.getItem(KEY_USER)); }
      catch { return null; }
    },

    isLoggedIn() {
      return !!this.getToken();
    },

    // Redirect to /login/?next=<currentPath> if not authenticated
    requireAuth() {
      if (!this.isLoggedIn()) {
        window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`;
      }
    },

    async login(data) {
      const tokenData = await apiFetch("POST", "/login", data);
      const user      = await apiFetch("GET", "/me", null, tokenData.access);
      storeSession(tokenData.access, user);
      this.updateNavbar();
      return user;
    },

    async register(data) {
      const tokenData = await apiFetch("POST", "/register", data);
      const user      = await apiFetch("GET", "/me", null, tokenData.access);
      storeSession(tokenData.access, user);
      this.updateNavbar();
      return user;
    },

    async logout() {
      const token = this.getToken();
      if (token) {
        try {
          // POST /api/auth/logout — invalidates token in Django cache
          await apiFetch("POST", "/logout", null, token);
        } catch {
          // Even if server-side invalidation fails, clear client storage
        }
      }
      clearSession();
      this.updateNavbar();
      window.location.href = "/";
    },

    // Sync navbar: show username + logout button, or Login link
    updateNavbar() {
      const user       = this.getUser();
      const userEl     = document.getElementById("navbar-user");
      const loginEl    = document.getElementById("navbar-login");
      const logoutEl   = document.getElementById("navbar-logout");
      const greetEl    = document.getElementById("navbar-greeting");

      if (user) {
        if (userEl)    userEl.classList.remove("hidden");
        if (loginEl)   loginEl.classList.add("hidden");
        if (logoutEl)  logoutEl.classList.remove("hidden");
        if (greetEl)   greetEl.textContent = `Hi, ${user.first_name || user.username}`;
      } else {
        if (userEl)    userEl.classList.add("hidden");
        if (loginEl)   loginEl.classList.remove("hidden");
        if (logoutEl)  logoutEl.classList.add("hidden");
      }
    },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // INIT — wire DOM events on auth page
  // ══════════════════════════════════════════════════════════════════════════

  document.addEventListener("DOMContentLoaded", () => {

    // Always sync navbar on every page load
    Auth.updateNavbar();

    // Logout button (present on all pages via base.html)
    document.getElementById("navbar-logout")
      ?.addEventListener("click", () => Auth.logout());

    // Only run the rest on the auth page itself
    if (!document.getElementById("auth-page")) return;

    // ── If already logged in, redirect away ──────────────────────────────
    if (Auth.isLoggedIn()) {
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next;
      return;
    }

    // ── Tab switching ─────────────────────────────────────────────────────
    document.getElementById("tab-login")
      ?.addEventListener("click", () => switchTab("login"));
    document.getElementById("tab-register")
      ?.addEventListener("click", () => switchTab("register"));

    // Check URL hash to open correct tab
    if (window.location.hash === "#register") switchTab("register");

    // ── Login form ────────────────────────────────────────────────────────
    document.getElementById("login-form")
      ?.addEventListener("submit", handleLogin);

    // ── Register form ─────────────────────────────────────────────────────
    document.getElementById("register-form")
      ?.addEventListener("submit", handleRegister);

    // ── Password strength meter ───────────────────────────────────────────
    document.getElementById("reg-password")
      ?.addEventListener("input", (e) => updateStrengthMeter(e.target.value));

    // ── Toggle password visibility ────────────────────────────────────────
    document.getElementById("toggle-login-pw")
      ?.addEventListener("click", () => toggleVisibility("login-password", "toggle-login-pw"));

    document.getElementById("toggle-reg-pw")
      ?.addEventListener("click", () => toggleVisibility("reg-password", "toggle-reg-pw"));

    document.getElementById("toggle-confirm-pw")
      ?.addEventListener("click", () => toggleVisibility("reg-confirm", "toggle-confirm-pw"));

    // ── Real-time field validation (on blur) ──────────────────────────────
    [
      { id: "reg-username",   rule: rules.username   },
      { id: "reg-email",      rule: rules.email      },
      { id: "reg-first-name", rule: rules.first_name },
      { id: "reg-last-name",  rule: rules.last_name  },
    ].forEach(({ id, rule }) => {
      document.getElementById(id)?.addEventListener("blur", () => {
        validate([{ id, rule }]);
      });
    });

    document.getElementById("reg-confirm")?.addEventListener("blur", () => {
      const pw = document.getElementById("reg-password")?.value || "";
      validate([{ id: "reg-confirm", rule: (v) => rules.confirm(v, pw) }]);
    });

    // ── Enter key on login fields ─────────────────────────────────────────
    ["login-username", "login-password"].forEach(id => {
      document.getElementById(id)?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("login-form")?.requestSubmit();
      });
    });

    // ── Auto-focus ────────────────────────────────────────────────────────
    document.getElementById("login-username")?.focus();
  });

  // Expose globally
  window.Auth = Auth;

})();