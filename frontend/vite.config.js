/* vite.config.js
   Dev server for the React dashboard. The proxy forwards /api/* to the Express
   backend on :5000, so the frontend calls "/api/..." with no CORS fuss. */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Build straight into the backend so it serves the dashboard and the whole
    // app ships as one Node service ("host only the backend").
    outDir: '../backend/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:5000' },
  },
});
