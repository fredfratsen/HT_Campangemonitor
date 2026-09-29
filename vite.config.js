import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API runs on :3000 (see scripts/dev.js); Vite forwards the API and the server-rendered
// pages (login, setup/invite/reset links, privacy) to it. The Host header is kept (changeOrigin: false), so the
// server's same-origin check sees localhost:5173 on both sides.
const api = { target: 'http://localhost:3000', changeOrigin: false };
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(['/api', '/login', '/logout', '/setup/', '/invite/', '/reset/', '/privacy'].map(p => [p, api])),
  },
});
