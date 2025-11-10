FROM python:3.11-slim

# Create non-root user
RUN groupadd -r mcpuser && useradd -r -g mcpuser mcpuser

WORKDIR /app

# Copy requirements and install dependencies (including curl for health checks)
COPY requirements.txt .
RUN apt-get update && apt-get install -y curl && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy the application
COPY . .

# Set proper permissions
RUN chown -R mcpuser:mcpuser /app && \
    chmod -R 755 /app

# Switch to non-root user
USER mcpuser

# Expose port
EXPOSE 8001

# Health check with longer startup period
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

# Start the HTTP wrapper (includes WebSocket support)
CMD ["python", "http_wrapper.py"]