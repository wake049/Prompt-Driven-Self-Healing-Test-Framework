#!/bin/bash

# Unified API Startup Script
echo " Starting Unified MCP API Server..."

# Set environment variables
export HOST=${HOST:-"0.0.0.0"}
export PORT=${PORT:-"8000"}
export RELOAD=${RELOAD:-"true"}

# Database configuration
export DB_HOST=${DB_HOST:-"localhost"}
export DB_PORT=${DB_PORT:-"5432"}
export DB_NAME=${DB_NAME:-"mcp_test_framework"}
export DB_USER=${DB_USER:-"postgres"}
export DB_PASSWORD=${DB_PASSWORD:-"password"}

# AI service configuration
export OPENAI_API_KEY=${OPENAI_API_KEY:-""}
export OPENAI_MODEL=${OPENAI_MODEL:-"gpt-4o"}
export OPENAI_MAX_TOKENS=${OPENAI_MAX_TOKENS:-"1500"}

echo " Configuration:"
echo "  Host: $HOST"
echo "  Port: $PORT"
echo "  Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "  OpenAI Model: $OPENAI_MODEL"

# Install dependencies if requirements.txt is newer than last install
if [ requirements.txt -nt .last_install ] || [ ! -f .last_install ]; then
    echo "📦 Installing/updating dependencies..."
    pip install -r requirements.txt
    touch .last_install
fi

# Start the server
echo " Starting FastAPI server..."
python -m uvicorn main:app --host $HOST --port $PORT --reload