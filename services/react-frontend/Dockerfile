# Multi-stage build for React frontend
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Set build-time environment variables for Vite
ENV VITE_UNIFIED_API_URL=https://testhelix.com
ENV VITE_API_BASE_URL=https://testhelix.com
ENV VITE_SQL_API_URL=https://testhelix.com/api/v1/sql
ENV VITE_AI_API_URL=https://testhelix.com/api/v1/ai
ENV VITE_HEALING_API_URL=https://testhelix.com/api/v1/healing
ENV VITE_POLICY_API_URL=https://testhelix.com/api/v1/policy

# Build the application with production environment variables
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create a production package.json that overrides the preview script
RUN echo '{"name":"mcp-only-test-planner-frontend","version":"2.0.0","scripts":{"preview":"node server.js","start":"node server.js"}}' > package.json

# Create a simple and reliable Node static server
RUN echo 'const http = require("http");' > server.js && \
    echo 'const fs = require("fs");' >> server.js && \
    echo 'const path = require("path");' >> server.js && \
    echo 'const port = process.env.PORT || 3000;' >> server.js && \
    echo 'const root = path.join(__dirname, "dist");' >> server.js && \
    echo 'const server = http.createServer((req, res) => {' >> server.js && \
    echo '  const url = req.url.split("?")[0];' >> server.js && \
    echo '  console.log("Request:", req.method, url);' >> server.js && \
    echo '  if (url === "/health") {' >> server.js && \
    echo '    res.writeHead(200, {"Content-Type": "application/json"});' >> server.js && \
    echo '    res.end(JSON.stringify({status: "healthy", timestamp: new Date().toISOString()}));' >> server.js && \
    echo '    return;' >> server.js && \
    echo '  }' >> server.js && \
    echo '  let filePath = path.join(root, url === "/" ? "index.html" : url);' >> server.js && \
    echo '  fs.readFile(filePath, (err, data) => {' >> server.js && \
    echo '    if (err) {' >> server.js && \
    echo '      fs.readFile(path.join(root, "index.html"), (err2, indexData) => {' >> server.js && \
    echo '        res.writeHead(200, {"Content-Type": "text/html"});' >> server.js && \
    echo '        res.end(indexData || "Error loading page");' >> server.js && \
    echo '      });' >> server.js && \
    echo '    } else {' >> server.js && \
    echo '      const ext = path.extname(filePath);' >> server.js && \
    echo '      const contentType = {".html":"text/html",".js":"application/javascript",".css":"text/css"}[ext] || "text/plain";' >> server.js && \
    echo '      res.writeHead(200, {"Content-Type": contentType});' >> server.js && \
    echo '      res.end(data);' >> server.js && \
    echo '    }' >> server.js && \
    echo '  });' >> server.js && \
    echo '});' >> server.js && \
    echo 'server.listen(port, () => console.log("Static server listening on", port));' >> server.js

# Set proper permissions and switch to non-root user
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port 3000 (same as before)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the lightweight static server
CMD ["node", "server.js"]