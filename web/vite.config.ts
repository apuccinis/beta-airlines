import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages sirve el sitio en /<repositorio>/
  base: mode === 'pages' ? (process.env.BASE_PATH ?? '/beta-airlines/') : '/',
  server: {
    port: 5173,
    proxy: { '/api': process.env.BETA_API ?? 'http://localhost:3001' },
    fs: { allow: ['..'] },
  },
  preview: { port: 4174 },
  build: { outDir: mode === 'pages' ? 'dist-pages' : 'dist', chunkSizeWarningLimit: 1500 },
}));
