import { defineConfig } from 'vite';
import { resolve } from 'path';

// Build each entry separately to avoid module issues
export default defineConfig({
  publicDir: 'public',
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
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/background.ts'),
      output: {
        entryFileNames: 'background.js',
        format: 'iife',
        name: 'BackgroundScript'
      }
    },
    target: 'es2020',
    minify: false
  }
});