import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  // Development proxy configuration
  const devProxy = {
    '/api/v1/review': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      secure: false
    },
    '/api': {
      target: 'http://127.0.0.1:8000',  // General fallback for non-analytics APIs
      changeOrigin: true,
      secure: false,
      ws: false,  // Disable websocket proxying
      configure: (proxy: any, _options: any) => {
        proxy.on('proxyReq', (proxyReq: any, req: any, _res: any) => {
          // Force IPv4 by setting the host header explicitly
          proxyReq.setHeader('host', '127.0.0.1:8000');
        });
      }
    },
    '/plan': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
      secure: false
    },
    '/catalog': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
      secure: false
    },
    '/health': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
      secure: false
    }
  };
  
  return {
    plugins: [react()],
    resolve: { 
      alias: { 
        "@": resolve(import.meta.dirname || __dirname, "src") 
      } 
    },
    define: {
      __API_URL__: isProduction 
        ? JSON.stringify('https://testhelix.com/api')
        : JSON.stringify('http://127.0.0.1:8000'),
      __MCP_URL__: isProduction
        ? JSON.stringify('wss://mcp.testhelix.com/mcp/ws')
        : JSON.stringify('ws://127.0.0.1:8001')
    },
    server: { 
      port: 3000, 
      open: true,
      host: '127.0.0.1',  // Force IPv4 for Vite server
      proxy: isProduction ? undefined : devProxy
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs']
          }
        }
      }
    }
  };
});