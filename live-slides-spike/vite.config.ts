import { defineConfig } from 'vite';

// Two pages: the presenter spike (index.html) and the provider comparison (compare.html).
export default defineConfig({
  server: { port: 5173, strictPort: true },
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      input: { main: 'index.html', compare: 'compare.html' },
    },
  },
});
