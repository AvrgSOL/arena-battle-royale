import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Root-level vite config for Vercel deployment.
// Vercel runs "vite build" from repo root; this redirects it into client/.
export default defineConfig({
  root: 'client',
  plugins: [react()],
  define: {
    'process.env': '{}',
    global: 'globalThis',
  },
  resolve: {
    alias: { buffer: 'buffer' },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
