/**
 * guest/home.js
 * Behavior for home.html -- Step 1 of the guest flow.
 * Logo + table-session are already server-rendered; this script:
 *  - confirms the table session and shows the table label once resolved
 *  - wires the big centered [ MENU ] button
 *  - prefetches categories in the background so categories.html renders
 *    instantly when the guest taps MENU
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    const tableLabelEl = document.querySelector(".home__table-label");
    const menuButton = document.querySelector(".home__menu-button");

    try {
      const current = await window.Guest.session.ensure();
      if (tableLabelEl && current.tableLabel) {
        tableLabelEl.textContent = current.tableLabel;
      }
    } catch (err) {
      if (err.code === "NO_QR_TOKEN") {
        window.Guest.toast("Please scan the table's QR code to start.", { type: "error" });
      } else {
        window.Guest.toast("Could not start your table session. Please rescan the QR code.", {
          type: "error",
        });
      }
      if (menuButton) menuButton.setAttribute("aria-disabled", "true");
      return;
    }

    // Background prefetch: warms the categories response so the next
    // screen (categories.html) can render without a loading skeleton.
    window.Guest.api("/menu/categories")
      .then(({ data }) => {
        sessionStorage.setItem("guest.categoriesCache", JSON.stringify({ data, ts: Date.now() }));
      })
      .catch(() => {
        /* non-critical prefetch; categories.js will fetch again if this failed */
      });

    if (menuButton) {
      menuButton.addEventListener("click", (event) => {
        // menuButton is a plain <a href="/menu/"> in home.html; this only
        // adds a tactile press state before navigation actually happens.
        menuButton.classList.add("is-pressed");
      });
    }
  });
})();