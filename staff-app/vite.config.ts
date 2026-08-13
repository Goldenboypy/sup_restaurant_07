import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Fixed port: the Django backend's CORS_ALLOWED_ORIGINS only
    // trusts the two known frontend origins (Guest App on 3000,
    // Staff App on 3001) -- letting Vite auto-increment on conflict
    // would silently break auth requests and the ws/staff/* sockets.
    port: 3001,
    strictPort: true,
    proxy: {
      "/api/staff": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3001,
    strictPort: true,
  },
});