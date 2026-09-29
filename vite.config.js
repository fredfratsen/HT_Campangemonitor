import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs on :3000 (see scripts/dev.js); Vite forwards /api to it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/login': 'http://localhost:3000',
      '/logout': 'http://localhost:3000',
    },
  },
});
