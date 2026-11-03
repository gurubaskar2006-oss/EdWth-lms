import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// =========================================================================
// Lumina LMS — Isolated Staging Vite Configuration
// 6th Civilians Corporation
//
// Proxies exclusively to Staging Backend on port 5001.
// Preserves existing development vite.config.js untouched on port 3000 -> 5000.
// =========================================================================
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3001,
    strictPort: true,
    open: false,
    cors: true,
    watch: {
      ignored: ['**/scratch/**', '**/.staging_mongo_data/**', '**/node_modules/**']
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5001',
        ws: true,
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 3001
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        trainer: resolve(__dirname, 'trainer.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});

