import path from 'path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@staatslenker/core': path.resolve(__dirname, '../core'),
      '@staatslenker/cli': path.resolve(__dirname, '../cli'),
    },
  },
  // Statisches Deployment: alle Assets relativ, keine absoluten Pfade
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'dist',
    ssr: false,
  },
  // Dev-Server für lokale Entwicklung
  server: {
    port: 5173,
    open: false,
  },
});
