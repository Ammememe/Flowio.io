import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5174 },
  build: {
    rollupOptions: {
      // index.html: P1-6 hello world. present.html: Phase 2 present mode.
      // signin/dashboard/editor.html: Phase 3.
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        present: path.resolve(import.meta.dirname, "present.html"),
        signin: path.resolve(import.meta.dirname, "signin.html"),
        dashboard: path.resolve(import.meta.dirname, "dashboard.html"),
        editor: path.resolve(import.meta.dirname, "editor.html"),
      },
    },
  },
});
