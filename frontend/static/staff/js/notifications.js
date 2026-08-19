"use strict";
(function () {
  const waiterId = document.body.dataset.waiterId;
  if (!waiterId) return; // Nutzer hat kein Waiter-Profil (z.B. reiner Admin)

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/ws/staff/waiter/${waiterId}/`;

  function toast(message, type = "info") {
    let host = document.querySelector(".toast-host");
    if (!host) {
      host = document.createElement("div");
      host.className = "toast-host";
      host.style.cssText = "position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.style.cssText =
      "background:#1B2430;color:#fff;padding:.75rem 1rem;border-radius:8px;" +
      "box-shadow:0 4px 12px rgba(0,0,0,.15);font-size:.88rem;max-width:320px;" +
      "display:flex;align-items:center;gap:.6rem;cursor:pointer;";
    if (type === "success") el.style.background = "#2F9E64";

    const text = document.createElement("span");
    text.textContent = message;
    text.style.flex = "1";
    el.appendChild(text);

    const closeBtn = document.createElement("span");
    closeBtn.textContent = "×";
    closeBtn.style.cssText = "font-weight:700;opacity:.7;";
    el.appendChild(closeBtn);

    // Manuell schließbar statt automatisch nach wenigen Sekunden zu verschwinden
    el.addEventListener("click", () => el.remove());

    host.appendChild(el);

    // Falls nicht angeklickt: nach 20s automatisch weg, nicht nach 6s
    setTimeout(() => el.remove(), 20000);
  }

  function markTableReady(tableNumber) {
    const dot = document.querySelector(`[data-table-number="${tableNumber}"] [data-ready-dot]`);
    if (dot) dot.classList.add("ready-dot--active");
  }

  function connect() {
    const socket = new WebSocket(url);

    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (_) {
        return;
      }
      if (message.event === "ticket.ready") {
        toast(`Order #${message.payload.order_id} (Table ${message.payload.table_number}) is ready to serve!`, "success");
        markTableReady(message.payload.table_number);
      } else if (message.event === "order.submitted") {
        toast(`New order from Table ${message.payload.table_number} needs confirmation.`);
      } else if (message.event === "payment.requested") {
        toast(`Table ${message.payload.table_number} requested payment (${message.payload.method}).`);
      }
    });

    socket.addEventListener("close", () => setTimeout(connect, 3000));
  }

  connect();
})();