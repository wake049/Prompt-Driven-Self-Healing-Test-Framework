#!/usr/bin/env bash
# ============================================================
# Build a portable runner agent ZIP for distribution.
# Produces: dist/self-healing-runner.zip
# Contents: fat JAR + start scripts + config
#
# Prerequisites: JDK 17+, Maven 3.8+
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

DIST_DIR="dist"
STAGE_DIR="$DIST_DIR/self-healing-runner"
JAR_NAME="self-healing-test-framework-1.0-SNAPSHOT.jar"

echo "=============================="
echo " Building Runner Agent"
echo "=============================="

# 1. Maven build
echo "[1/4] Building JAR..."
mvn clean package -DskipTests -q

# 2. Stage
echo "[2/4] Staging distribution..."
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/logs"
cp "target/$JAR_NAME" "$STAGE_DIR/runner.jar"

# 3. Config + scripts
echo "[3/4] Copying configuration..."
cp "src/main/resources/application-agent.properties" "$STAGE_DIR/application-agent.properties.example"

cat > "$STAGE_DIR/start-runner.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Self-Healing Test Runner Agent
RUNNER_DIR="$(cd "$(dirname "$0")" && pwd)"

# Use bundled JRE if present, otherwise system Java
if [ -x "$RUNNER_DIR/jre/bin/java" ]; then
    JAVA="$RUNNER_DIR/jre/bin/java"
else
    JAVA="java"
fi

echo "Starting Self-Healing Test Runner Agent..."
echo "API URL: ${RUNNER_API_URL:-see runner-config.properties}"
echo ""

exec "$JAVA" -Xms256m -Xmx512m \
  -jar "$RUNNER_DIR/runner.jar" \
  --spring.profiles.active=agent \
  --spring.config.additional-location="file:$RUNNER_DIR/runner-config.properties"
SCRIPT
chmod +x "$STAGE_DIR/start-runner.sh"

cat > "$STAGE_DIR/runner-config.properties" << 'CONFIG'
# Self-Healing Runner Agent Configuration
# Edit these values before first run.

# Your platform API URL
runner.api-url=http://localhost:8000

# Your organization ID (from the web dashboard)
runner.organization-id=

# Runner name (leave blank for auto hostname)
runner.name=

# API key (if required by your server)
runner.api-key=

# Browsers this runner supports (comma-separated: chrome,firefox,edge)
runner.capabilities=chrome

# Run browsers in headless mode? (true/false)
HEADLESS=false

# Port for health check endpoint
server.port=8080
CONFIG

cat > "$STAGE_DIR/README.md" << 'README'
# Self-Healing Test Runner Agent

## Quick Start

1. Edit `runner-config.properties` — set your API URL and organization ID.
2. Run `./start-runner.sh` (Mac/Linux) or `start-runner.bat` (Windows).
3. The runner registers with your platform and starts polling for work.

## Requirements

- Chrome, Firefox, or Edge installed on this machine
- No Java installation needed (bundled JRE, if included)
- Outbound HTTPS access to your platform API

## Bundling a JRE (optional)

Download a JRE 17 from https://adoptium.net/, extract into `jre/` next to `runner.jar`.
README

# 4. ZIP
echo "[4/4] Creating ZIP..."
(cd "$DIST_DIR" && zip -rq "self-healing-runner.zip" "self-healing-runner")

echo ""
echo "=============================="
echo " Build complete!"
echo " Output: $DIST_DIR/self-healing-runner.zip"
echo "=============================="
