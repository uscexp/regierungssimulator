import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // Statisches Deployment: alle Assets relativ, keine absoluten Pfade
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'dist',
  },
  // Dev-Server für lokale Entwicklung
  server: {
    port: 5173,
    open: false,
  },
});
