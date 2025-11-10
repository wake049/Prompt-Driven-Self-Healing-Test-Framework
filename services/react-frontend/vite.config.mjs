import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { 
    port: 3000,
    host: 'localhost',
    proxy: {
      '/api/v1/review': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'https://testhelix.com',
        changeOrigin: true,
        secure: false
      },
      '/plan': {
        target: 'https://testhelix.com',
        changeOrigin: true,
        secure: false
      },
      '/catalog': {
        target: 'https://testhelix.com',
        changeOrigin: true,
        secure: false
      },
      '/health': {
        target: 'https://testhelix.com',
        changeOrigin: true,
        secure: false
      }
    }
  }
});