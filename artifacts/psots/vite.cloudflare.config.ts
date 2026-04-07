import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Cloudflare Pages build config — outputs to repo root /dist for easy Cloudflare setup
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    // Output to repo root dist/ so Cloudflare Pages output directory = "dist"
    outDir: path.resolve(import.meta.dirname, "../../dist"),
    emptyOutDir: true,
  },
});
