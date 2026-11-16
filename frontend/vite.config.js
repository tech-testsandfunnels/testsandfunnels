/* vite.config.js
   Dev server for the React dashboard. The proxy forwards /api/* to the Express
   backend on :5000, so the frontend calls "/api/..." with no CORS fuss.
   `npm run build` writes the dashboard into backend/public, which the API
   serves at "/" (one service hosts the API and the CRM). */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../backend/public',
    emptyOutDir: true, // outDir is outside the frontend root, so allow clearing it
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:5000' },
  },
});
