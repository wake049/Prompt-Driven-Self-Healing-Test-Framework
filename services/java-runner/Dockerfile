# Java Test Runner Dockerfile
FROM openjdk:17-jdk-slim

# Create non-root user
RUN groupadd -r javauser && useradd -r -g javauser javauser

# Install Maven, Chrome, and dependencies for Selenium
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    maven \
    wget \
    curl \
    gnupg \
    unzip \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Install ChromeDriver
RUN CHROME_DRIVER_VERSION=$(curl -sS chromedriver.storage.googleapis.com/LATEST_RELEASE) \
    && wget -O /tmp/chromedriver.zip http://chromedriver.storage.googleapis.com/$CHROME_DRIVER_VERSION/chromedriver_linux64.zip \
    && unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/ \
    && rm /tmp/chromedriver.zip \
    && chmod +x /usr/local/bin/chromedriver

WORKDIR /app

# Copy Maven configuration
COPY pom.xml .

# Download dependencies (as root for now)
RUN mvn dependency:go-offline -B

# Copy source code
COPY src/ src/
COPY lib/ lib/

# Build the application
RUN mvn clean compile

# Create screenshots directory and set permissions
RUN mkdir -p screenshots && \
    chown -R javauser:javauser /app && \
    chmod -R 755 /app

# Switch to non-root user
USER javauser

# Expose port for HTTP API (if applicable)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Set display for headless Chrome
ENV DISPLAY=:99

# Start xvfb and run the application
CMD ["sh", "-c", "Xvfb :99 -ac -screen 0 1024x768x24 & mvn exec:java -Dexec.mainClass='com.selfhealing.TestRunner'"]