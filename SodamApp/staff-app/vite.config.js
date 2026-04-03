import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, readFileSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Stamp build time into sw.js after build
    {
      name: 'sw-version-stamp',
      closeBundle() {
        const swPath = resolve(__dirname, 'dist/sw.js');
        try {
          let sw = readFileSync(swPath, 'utf-8');
          sw = sw.replace('__BUILD_TIME__', Date.now().toString(36));
          writeFileSync(swPath, sw);
        } catch { /* sw.js might not exist during dev */ }
      }
    }
  ],
  base: './',
  server: {
    port: 5174,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react'],
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
})
