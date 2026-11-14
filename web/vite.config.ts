import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5174 },
  build: {
    rollupOptions: {
      // Two entry pages: the P1-6 hello world (index.html) and the Phase 2
      // present mode (present.html).
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        present: path.resolve(import.meta.dirname, "present.html"),
      },
    },
  },
});
