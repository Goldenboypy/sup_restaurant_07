/**
 * staff/login.js
 * Behavior for login.html. Uses the same Bearer-token auth.py pattern
 * as v1.0: POST credentials, receive a token, store it via Staff.auth,
 * then land the waiter on the right view. Role decides which screens
 * are shown after login (WAITER VIEW vs KITCHEN VIEW).
 *
 * Expects in the DOM:
 *   <form id="loginForm" class="login-form">
 *     <div class="form-field"><label>...<input id="username"></div>
 *     <div class="form-field"><label>...<input id="password" type="password"></div>
 *     <div id="loginError" class="login-form__error" hidden></div>
 *     <button type="submit" class="btn btn--primary btn--block">Log in</button>
 *   </form>
 */
(function () {
  "use strict";

  const LOGIN_ENDPOINT = "/auth/login"; // -> POST /api/staff/auth/login, same auth.py as v1.0

  document.addEventListener("DOMContentLoaded", () => {
    // Already logged in? Skip straight past the login screen.
    if (window.Staff.auth.isAuthenticated()) {
      window.location.href = "/tables/";
      return;
    }

    const form = document.getElementById("loginForm");
    if (!form) return;

    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const errorEl = document.getElementById("loginError");
    const submitBtn = form.querySelector('button[type="submit"]');

    function setError(message) {
      if (!errorEl) return;
      if (message) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      } else {
        errorEl.hidden = true;
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setError(null);

      const username = usernameInput?.value.trim();
      const password = passwordInput?.value;
      if (!username || !password) {
        setError("Please enter your username and password.");
        return;
      }

      submitBtn.disabled = true;
      try {
        const res = await fetch(`/api/staff${LOGIN_ENDPOINT}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
          setError(res.status === 401 ? "Incorrect username or password." : "Login failed. Please try again.");
          submitBtn.disabled = false;
          return;
        }

        const data = await res.json();
        window.Staff.auth.set({
          token: data.token,
          waiterId: data.waiter_id,
          waiterName: data.waiter_name,
          role: data.role, // "waiter" | "kitchen"
        });

        window.Staff.toast(`Welcome back, ${data.waiter_name}`, { type: "success" });

        // Role decides which screens are shown after login.
        window.location.href = data.role === "kitchen" ? "/kitchen/" : "/tables/";
      } catch (err) {
        console.error("[login.js] login request failed", err);
        setError("Could not reach the server. Please check your connection and try again.");
        submitBtn.disabled = false;
      }
    });
  });
})();