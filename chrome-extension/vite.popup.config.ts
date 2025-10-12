import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/popup.ts'),
      output: {
        entryFileNames: 'popup.js',
        format: 'iife',
        name: 'PopupScript'
      }
    },
    target: 'es2020',
    minify: false
  }
});