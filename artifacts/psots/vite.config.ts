import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async ({ command }) => {
  const isDev = command === "serve";

  // PORT env var is optional locally — default to 5173 for frontend, 4000 for API
  const rawPort = process.env.PORT;
  const parsed = rawPort ? Number(rawPort) : null;
  const port = parsed && !Number.isNaN(parsed) && parsed > 0 ? parsed : 5173;

  const basePath = process.env.BASE_PATH ?? "/";

  // API server port for the dev proxy (backend runs on API_PORT or 4000)
  const apiPort = process.env.API_PORT ?? "4000";

  return {
    base: basePath,
    // Load .env from the workspace root so pnpm dev:web reads it automatically
    envDir: path.resolve(import.meta.dirname, "../.."),
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({ root: path.resolve(import.meta.dirname, "..") }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
      // In dev, proxy /api calls to the Express API server
      ...(isDev && {
        proxy: {
          "/api": {
            target: `http://localhost:${apiPort}`,
            changeOrigin: true,
          },
        },
      }),
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
