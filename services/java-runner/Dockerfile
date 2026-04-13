# Java Test Runner Dockerfile
FROM eclipse-temurin:17-jdk-jammy

# Create non-root user
RUN groupadd -r javauser && useradd -r -g javauser javauser

# Install Maven and dependencies for Selenium
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    maven \
    wget \
    curl \
    gnupg \
    unzip \
    xvfb \
    netcat-openbsd \
    libnss3 \
    libgconf-2-4 \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Install Firefox
RUN apt-get update && apt-get install -y --no-install-recommends firefox \
    && rm -rf /var/lib/apt/lists/*

# Install Edge (Microsoft Edge for Linux)
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-edge.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-edge.gpg] https://packages.microsoft.com/repos/edge stable main" > /etc/apt/sources.list.d/microsoft-edge.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends microsoft-edge-stable \
    && rm -rf /var/lib/apt/lists/*

# Install ChromeDriver, GeckoDriver (Firefox), and Edge Driver (WebDriverManager will handle this)
RUN apt-get update && apt-get install -y chromium-chromedriver \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Maven configuration
COPY pom.xml .

# Download dependencies (as root for now)
RUN mvn dependency:go-offline -B

# Copy source code
COPY src/ src/
COPY lib/ lib/

# Build the application
RUN mvn clean package -DskipTests

# Install additional tools for user switching
RUN apt-get update && apt-get install -y --no-install-recommends gosu && \
    rm -rf /var/lib/apt/lists/*

# Create screenshots directory and set permissions
RUN mkdir -p screenshots && \
    mkdir -p /home/javauser/.m2/repository && \
    mkdir -p /tmp/.X11-unix && \
    chown -R javauser:javauser /app && \
    chown -R javauser:javauser /home/javauser && \
    chmod -R 755 /app && \
    chmod -R 755 /home/javauser && \
    chmod 1777 /tmp/.X11-unix

# Create entrypoint script to handle X11 setup and app startup
RUN echo '#!/bin/bash\n\
set -e\n\
echo "==============================================="\n\
echo "JAVA RUNNER CONTAINER STARTUP - $(date)"\n\
echo "==============================================="\n\
echo "Container Environment:"\n\
echo "- User: $(whoami) ($(id))"\n\
echo "- Working Directory: $(pwd)"\n\
echo "- Java Version: $(java -version 2>&1 | head -n 1)"\n\
echo "- Available Memory: $(cat /proc/meminfo | grep MemAvailable)"\n\
echo "- Disk Space: $(df -h /app | tail -1)"\n\
echo "- Network interfaces:"\n\
ip addr show | grep "inet " | head -3\n\
echo "- Environment Variables:"\n\
echo "  HOME: $HOME"\n\
echo "  DISPLAY: $DISPLAY"\n\
echo "  JAVA_HOME: $JAVA_HOME"\n\
echo "==============================================="\n\
echo "Pre-startup Network Check:"\n\
echo "- Port 8080 status:"\n\
netstat -tuln | grep 8080 || echo "  Port 8080 available"\n\
echo "- Testing localhost connectivity:"\n\
ping -c 2 localhost || echo "  Localhost ping failed"\n\
echo "==============================================="\n\
echo "X11 Display Server Setup:"\n\
echo "- Starting Xvfb virtual display..."\n\
Xvfb :99 -ac -screen 0 1920x1080x24 -nolisten tcp -dpi 96 +extension GLX +render -noreset &\n\
XVFB_PID=$!\n\
echo "- Xvfb started with PID: $XVFB_PID"\n\
echo "- Waiting for X server to initialize..."\n\
sleep 3\n\
export DISPLAY=:99\n\
echo "- Testing X11 display $DISPLAY:"\n\
xdpyinfo -display $DISPLAY 2>/dev/null | head -3 || echo "  X11 test failed (continuing anyway)"\n\
echo "==============================================="\n\
echo "Spring Boot Application Startup:"\n\
cd /app\n\
echo "- Application directory contents:"\n\
ls -la target/ | head -5\n\
if [ ! -f "target/self-healing-test-framework-1.0-SNAPSHOT.jar" ]; then\n\
    echo "ERROR: JAR file not found!"\n\
    exit 1\n\
fi\n\
JAR_SIZE=$(stat -c%s "target/self-healing-test-framework-1.0-SNAPSHOT.jar" 2>/dev/null)\n\
echo "- JAR file size: ${JAR_SIZE} bytes"\n\
echo "- Final port check before startup:"\n\
netstat -tuln | grep 8080 || echo "  Port 8080 confirmed available"\n\
echo "- Starting Spring Boot application on 0.0.0.0:8080..."\n\
echo "- Command: java -server -Xms256m -Xmx512m [options] -jar target/...jar"\n\
echo "==============================================="\n\
echo "APPLICATION STARTING - $(date)"\n\
echo "==============================================="\n\
exec java -server \\\n\
     -Xms256m -Xmx512m \\\n\
     -Djava.awt.headless=false \\\n\
     -Dspring.profiles.active=production \\\n\
     -Dserver.port=8080 \\\n\
     -Dserver.address=0.0.0.0 \\\n\
     -Dlogging.level.org.springframework.boot.web.embedded.tomcat=INFO \\\n\
     -Dlogging.level.demo=DEBUG \\\n\
     -jar target/self-healing-test-framework-1.0-SNAPSHOT.jar\n\
' > /app/start.sh && chmod +x /app/start.sh && chown javauser:javauser /app/start.sh

# Switch to non-root user
USER javauser

# Expose port for HTTP API (if applicable)
EXPOSE 8080

# Health check for Spring Boot - simplified approach with longer startup time
HEALTHCHECK --interval=10s --timeout=3s --start-period=180s --retries=5 \
  CMD curl -f http://localhost:8080/health || nc -z localhost 8080 || exit 1

# Set display for headless Chrome and fix X11 permissions
ENV DISPLAY=:99
ENV HOME=/home/javauser

# Start using the entrypoint script
CMD ["/app/start.sh"]