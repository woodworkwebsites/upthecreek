import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Force a full page reload whenever tailwind.config.js changes so that
    // new colour tokens / variants are picked up without a manual restart.
    {
      name: 'tailwind-config-watcher',
      handleHotUpdate({ file, server }) {
        if (file.endsWith('tailwind.config.js')) {
          server.ws.send({ type: 'full-reload' });
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
    // Forward /api/* to Wrangler (8787) so the full stack works on 5173 too.
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
