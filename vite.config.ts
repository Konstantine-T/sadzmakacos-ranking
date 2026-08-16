import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          mui: ['@mui/material', '@mui/icons-material'],
          // No `charts` entry: the rank history is hand-drawn bars now, so
          // naming @mui/x-charts here only forced a dead chunk into dist.
          pickers: ['@mui/x-date-pickers'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
