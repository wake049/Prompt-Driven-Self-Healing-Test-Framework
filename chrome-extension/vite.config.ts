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
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        popup: resolve(__dirname, 'src/popup.ts'),
        'popup-mcp': resolve(__dirname, 'src/popup-mcp.ts'),
        content: resolve(__dirname, 'src/content.ts')
      },
      output: {
        entryFileNames: '[name].js',
        format: 'iife',
        name: 'ChromeExtensionScript'
      }
    },
    target: 'es2020',
    minify: false
  }
});