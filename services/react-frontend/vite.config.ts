import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { 
    alias: { 
      "@": resolve(import.meta.dirname || __dirname, "src") 
    } 
  },
  server: { 
    port: 3000, 
    open: true,
    proxy: {
      '/api/v1/review': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false
      },
      '/plan': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false
      },
      '/catalog': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false
      },
      '/health': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});