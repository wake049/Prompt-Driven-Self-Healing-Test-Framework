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
      input: resolve(__dirname, 'src/auth-capture.ts'),
      output: {
        entryFileNames: 'auth-capture.js',
        format: 'iife',
        name: 'AuthCaptureScript'
      }
    },
    target: 'es2020',
    minify: false
  }
});