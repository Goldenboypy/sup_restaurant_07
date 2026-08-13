/**
 * shop/src/main.tsx
 * -----------------
 * React application entry point.
 *
 * Connection map:
 *   <- index.html          : <div id="root"> is the mount target.
 *                            index.html declares window.__appReady() and
 *                            window.__loadTimeout — we call/clear them here.
 *   <- vite.config.ts      : Vite injects this file via
 *                            <script type="module" src="/src/main.tsx">
 *   -> App.tsx             : the root component — contains React Router + routes
 *   -> context/TableSessionContext : provides the QR-derived table session
 *   -> context/CartContext : provides the session cart and cart operations
 *   -> styles/global.css   : CSS variables, reset, typography — loaded once here
 *
 * Responsibility:
 *   1. Import global CSS (single import, applied to the whole app)
 *   2. Wrap <App /> in the table-session and cart providers
 *   3. Mount the React tree into #root using the React 18 createRoot API
 *   4. Remove the loading screen (index.html #app-loading) via window.__appReady()
 *   5. Clear the loading timeout set by index.html
 *
 * Provider order matters:
 *   <TableSessionProvider>  — establishes guest identity from the QR code
 *     <CartProvider>        — guest cart requests use that session token
 *       <App />             — router + guest pages
 *
 * React 18 StrictMode:
 *   Enabled in development only. Causes every component to render twice
 *   to detect side effects. Disabled in production for performance.
 *   useEffect cleanup functions are essential — StrictMode calls them too.
 */

import { StrictMode } from "react";
import { createRoot }  from "react-dom/client";

// ── Global styles (CSS variables, reset, typography) ──────────────────────
// Imported once here — applies to the entire app.
// All component-level styles use CSS Modules (*.module.css) on top of these.
import "./styles/global.css";

// ── Context providers ─────────────────────────────────────────────────────
// TableSessionContext: stores the active QR-derived table session.
// CartContext: stores the session cart and syncs with /api/guest/cart.
import { CartProvider } from "./context/CartContext";
import { TableSessionProvider } from "./context/TableSessionContext";

// ── Root component ────────────────────────────────────────────────────────
// App.tsx sets up React Router v6 with all page routes.
import App from "./App";

// ══════════════════════════════════════════════════════════════════════════
// MOUNT
// ══════════════════════════════════════════════════════════════════════════

// Find the mount target declared in index.html
const rootElement = document.getElementById("root");

if (!rootElement) {
  // This should never happen — index.html always has <div id="root">
  throw new Error(
    "[main.tsx] Could not find #root element. " +
    "Make sure index.html contains <div id=\"root\"></div>."
  );
}

// React 18 concurrent root (replaces ReactDOM.render from React 17)
const root = createRoot(rootElement);

root.render(
  // StrictMode only active in development (Vite strips it in production build)
  <StrictMode>
    {/*
      Provider tree:
        TableSessionProvider — QR-derived table identity
          CartProvider       — session cart state and API sync
            App              — React Router + guest pages
    */}
    <TableSessionProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </TableSessionProvider>
  </StrictMode>
);

// ══════════════════════════════════════════════════════════════════════════
// POST-MOUNT CLEANUP
// ══════════════════════════════════════════════════════════════════════════

// Remove the loading screen declared in index.html.
// window.__appReady is a plain function (not a module) so it always exists
// even if this module is the first thing to run.
if (typeof window.__appReady === "function") {
  window.__appReady();
}

// Clear the "taking too long" timeout set by index.html
if (typeof window.__loadTimeout !== "undefined") {
  clearTimeout(window.__loadTimeout);
}

// ── Extend Window type for TypeScript ─────────────────────────────────────
// Prevents "Property does not exist on type Window" errors for the globals
// set by index.html inline scripts.
declare global {
  interface Window {
    __appReady?: () => void;
    __loadTimeout?: ReturnType<typeof setTimeout>;
  }
}