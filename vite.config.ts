import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  root: "apps/web",
  build: { outDir: "../../dist", emptyOutDir: true, rollupOptions: { output: { manualChunks: {
    "react-vendor": ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
    "validation": ["zod"],
    "offline": ["dexie"],
  } } } },
  server: {
    allowedHosts: ["terminal.local"],
    proxy: { "/api": "http://127.0.0.1:3470" },
  },
});
