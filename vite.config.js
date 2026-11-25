import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/clash-room/' : '/',
  server: { host: true },
  build: { outDir: 'dist', sourcemap: true }
});