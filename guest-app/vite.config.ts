/**
 * shop/vite.config.ts
 * -------------------
 * Vite build tool + dev server configuration for the React SPA.
 *
 * Connection map:
 *   <- tsconfig.json       : path alias "@/" must match here too
 *   <- .env / .env.local   : VITE_API_URL, VITE_STRIPE_PUBLISHABLE_KEY
 *   -> Django API          : http://localhost:8000  (proxied in dev)
 *   -> Django WebSocket    : ws://localhost:8000    (proxied in dev)
 *   -> src/main.tsx        : app entry point
 *   -> index.html          : HTML shell that Vite injects the bundle into
 *   -> dist/               : production build output (serve from Django or CDN)
 *
 * Dev proxy (why):
 *   In development the React app runs on http://localhost:5173 and Django on
 *   http://localhost:8000. Without a proxy, every /api call would be a
 *   cross-origin request and require CORS headers. The Vite proxy forwards
 *   /api/*, /ws/*, and /static/* to Django transparently, so the browser
 *   never sees a different origin — no CORS config needed in development.
 *
 *   In production, serve the built dist/ folder from the same domain as
 *   Django (e.g. Nginx serves / from dist/ and proxies /api/ to Django).
 *   Then no CORS is needed in production either.
 *
 * WebSocket proxy:
 *   Django Channels WebSocket endpoints:
 *     ws://localhost:8000/ws/orders/?token=<t>        -> OrderConsumer
 *     ws://localhost:8000/ws/notifications/?token=<t>  -> NotificationConsumer
 *     ws://localhost:8000/ws/stock/<id>/               -> StockConsumer
 *   All matched by the "/ws" proxy entry with ws:true.
 *   Used by hooks/useWebSocket.ts and components/StockBadge.tsx.
 *
 * Path alias:
 *   "@/" -> "src/"  — must match tsconfig.json "paths" exactly.
 *   Allows:  import ProductCard from "@/components/ProductCard"
 *   Instead: import ProductCard from "../../components/ProductCard"
 *
 * Build output:
 *   dist/index.html       — HTML shell
 *   dist/assets/*.js      — hashed JS bundle (code-split by route)
 *   dist/assets/*.css     — hashed CSS bundle
 *   Copy dist/ to Django's STATIC_ROOT or serve from CDN.
 */

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  // Load env variables for the current mode (development / production).
  // Vite only exposes vars prefixed with VITE_ to client code.
  const env = loadEnv(mode, process.cwd(), "");

  // Django backend URL — defaults to localhost:8000 in development.
  // Override in .env.local:  DJANGO_API_URL=http://staging.example.com
  const djangoUrl = env["DJANGO_API_URL"] ?? "http://localhost:8000";
  const djangoWsUrl = djangoUrl.replace(/^http/, "ws");

  return {
    /* ── Plugin: React fast refresh + JSX transform ─────────────────── */
    plugins: [react()],

    /* ── Path alias: "@/" -> "src/" ─────────────────────────────────── */
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },

    /* ── Development server ──────────────────────────────────────────── */
    server: {
      port: 5173,
      strictPort: true, // fail loudly if the port is taken

      proxy: {
        /**
         * /api/* -> Django REST API (Django Ninja)
         * All calls from api/client.ts (fetchProducts, addToCart, etc.)
         * are transparently forwarded to Django.
         *
         * Example:
         *   fetch("/api/products?page=1")
         *   -> proxied to http://localhost:8000/api/products?page=1
         */
        "/api": {
          target: djangoUrl,
          changeOrigin: true,
          secure: false,
        },

        /**
         * /ws/* -> Django Channels WebSocket endpoints
         * ws: true tells Vite to upgrade the HTTP connection to WebSocket.
         */
        "/ws": {
          target: djangoWsUrl,
          changeOrigin: true,
          ws: true,
          secure: false,
        },

        /**
         * /static/* -> Django static files (admin CSS etc. during dev)
         */
        "/static": {
          target: djangoUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    /* ── Production build ────────────────────────────────────────────── */
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: false, // set to true if you need production source maps

      rollupOptions: {
        output: {
          /**
           * Code splitting: vendor chunk (React, React Router, Stripe)
           * is separated from app code so browsers cache it longer.
           * App code chunk changes on every deploy; vendor rarely does.
           */
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            stripe: ["@stripe/stripe-js", "@stripe/react-stripe-js"],
          },
        },
      },

      // Warn when a chunk exceeds 500 kB (helps keep bundles lean)
      chunkSizeWarningLimit: 500,
    },

    /* ── Preview server (after npm run build) ────────────────────────── */
    preview: {
      port: 4173,
    },

    /* ── CSS ─────────────────────────────────────────────────────────── */
    css: {
      // CSS modules: files named *.module.css are scoped automatically.
      // ProductCard.module.css, Navbar.module.css, etc.
      modules: {
        localsConvention: "camelCase",
      },
    },

    /* ── Env variable exposure ───────────────────────────────────────── */
    // Only VITE_* prefixed vars are injected into client code.
    // Access them as: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    // Never put STRIPE_SECRET_KEY or DJANGO secrets here.
    envPrefix: "VITE_",
  };
});