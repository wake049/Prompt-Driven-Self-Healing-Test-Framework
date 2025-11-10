# Python FastAPI Unified API Dockerfile
FROM python:3.11-slim-bullseye

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy requirements and install dependencies
COPY services/unified-api/requirements.txt .
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends gcc curl && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get purge -y gcc && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Copy application code
COPY services/unified-api/ .

# Set ownership and permissions
RUN chown -R appuser:appuser /app && \
    chmod -R 755 /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
