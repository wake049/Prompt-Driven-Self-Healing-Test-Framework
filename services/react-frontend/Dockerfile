# Multi-stage build for React frontend
FROM cgr.dev/chainguard/node:latest-dev AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Set build-time environment variables for Vite (override via --build-arg)
ARG VITE_UNIFIED_API_URL=http://localhost:8000
ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_SQL_API_URL=http://localhost:8000/api/v1/sql
ARG VITE_AI_API_URL=http://localhost:8000/api/v1/ai
ARG VITE_HEALING_API_URL=http://localhost:8000/api/v1/healing
ARG VITE_POLICY_API_URL=http://localhost:8000/api/v1/policy
ARG VITE_MCP_SERVER_URL=ws://localhost:8001
ARG VITE_MCP_AUTH_TOKEN=

ENV VITE_UNIFIED_API_URL=${VITE_UNIFIED_API_URL}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SQL_API_URL=${VITE_SQL_API_URL}
ENV VITE_AI_API_URL=${VITE_AI_API_URL}
ENV VITE_HEALING_API_URL=${VITE_HEALING_API_URL}
ENV VITE_POLICY_API_URL=${VITE_POLICY_API_URL}
ENV VITE_MCP_SERVER_URL=${VITE_MCP_SERVER_URL}
ENV VITE_MCP_AUTH_TOKEN=${VITE_MCP_AUTH_TOKEN}

# Build the application with production environment variables
RUN npm run build

# Create a simple and reliable Node static server script
RUN cat > /app/server.js <<'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const root = path.join(__dirname, 'dist');

const contentTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy' }));
    return;
  }

  const requestedPath = url === '/' ? '/index.html' : url;
  const filePath = path.join(root, requestedPath);

  fs.readFile(filePath, (err, data) => {
    if (!err) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
      res.end(data);
      return;
    }

    fs.readFile(path.join(root, 'index.html'), (indexErr, indexData) => {
      if (indexErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading application');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(indexData);
    });
  });
});

server.listen(port, () => {
  console.log(`Static server listening on ${port}`);
});
EOF

# Production stage
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS production

WORKDIR /app

# Copy built application and runtime server from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js

# Expose port 3000 (same as before)
EXPOSE 3000

# Start distroless node runtime (entrypoint is node)
CMD ["server.js"]