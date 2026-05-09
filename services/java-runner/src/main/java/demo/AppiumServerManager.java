package demo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.annotation.PreDestroy;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import java.util.concurrent.*;

/**
 * Manages an embedded Appium server process.
 * <p>
 * When runner capabilities include any "appium-*" entry, this manager
 * automatically starts the Appium server on the configured port so that
 * non-technical users never need to touch a terminal.
 * <p>
 * Lifecycle:
 *   1. {@link #startIfNeeded(String)} — called by RunnerAgent on startup
 *   2. Waits up to 30s for Appium to become reachable
 *   3. Monitors the process and restarts on crash (up to 3 times)
 *   4. {@link #stop()} — called on JVM shutdown via @PreDestroy
 */
@Component
public class AppiumServerManager {

    private static final Logger log = LoggerFactory.getLogger(AppiumServerManager.class);

    @Value("${runner.appium-server-url:http://localhost:4723}")
    private String appiumServerUrl;

    @Value("${runner.appium-auto-start:true}")
    private boolean autoStart;

    @Value("${runner.appium-startup-timeout-seconds:120}")
    private int startupTimeoutSeconds;

    private Process appiumProcess;
    private volatile boolean managed = false;
    private volatile boolean running = false;
    private int restartCount = 0;
    private static final int MAX_RESTARTS = 3;
    private ScheduledExecutorService monitor;

    /**
     * Start the Appium server if capabilities require it and it isn't already running.
     *
     * @param capabilities comma-separated capability string from runner config
     * @return true if Appium is available (either started or already running)
     */
    public boolean startIfNeeded(String capabilities) {
        boolean needsAppium = capabilities != null &&
                Arrays.stream(capabilities.split(","))
                      .map(String::trim)
                      .anyMatch(c -> c.startsWith("appium-"));

        if (!needsAppium) {
            log.info("No appium-* capabilities configured — skipping Appium server");
            return true;
        }

        // Check if Appium is already running externally
        if (isAppiumReachable()) {
            log.info("Appium server already running at {}", appiumServerUrl);
            managed = false;
            return true;
        }

        if (!autoStart) {
            log.warn("Appium server not reachable and auto-start is disabled");
            return false;
        }

        log.info("Starting Appium server on {}...", appiumServerUrl);
        return startAppiumProcess();
    }

    /**
     * Launch the appium process and wait for it to become reachable.
     */
    private boolean startAppiumProcess() {
        try {
            // Extract port from URL
            int port = extractPort(appiumServerUrl);

            // Try 'appium' command (npm global install)
            ProcessBuilder pb = new ProcessBuilder();
            pb.redirectErrorStream(true);

            // On Windows, need to use cmd /c for npm-installed commands
            String os = System.getProperty("os.name", "").toLowerCase();
            if (os.contains("win")) {
                pb.command("cmd", "/c", "appium", "--port", String.valueOf(port),
                        "--log-level", "info", "--relaxed-security");
            } else {
                pb.command("appium", "--port", String.valueOf(port),
                        "--log-level", "info", "--relaxed-security");
            }

            appiumProcess = pb.start();
            managed = true;
            running = true;

            // Stream Appium logs in background
            Thread logThread = new Thread(() -> streamProcessOutput(appiumProcess), "appium-log-reader");
            logThread.setDaemon(true);
            logThread.start();

            // Wait for server to become reachable
            boolean ready = waitForServer(startupTimeoutSeconds);
            if (ready) {
                log.info("Appium server started successfully on port {}", port);
                startMonitor();
                return true;
            } else {
                log.error("Appium server failed to start within {}s", startupTimeoutSeconds);
                stop();
                return false;
            }

        } catch (Exception e) {
            log.error("Failed to start Appium server: {}", e.getMessage());
            if (e.getMessage() != null && e.getMessage().contains("Cannot run program")) {
                log.error("Appium not found. Install it with: npm install -g appium");
                log.error("Then install drivers: appium driver install uiautomator2");
            }
            return false;
        }
    }

    /**
     * Wait for the Appium /status endpoint to respond.
     */
    private boolean waitForServer(int timeoutSeconds) {
        long deadline = System.currentTimeMillis() + (timeoutSeconds * 1000L);
        int attempt = 0;
        while (System.currentTimeMillis() < deadline) {
            attempt++;
            if (isAppiumReachable()) {
                log.info("Appium became reachable after {} attempts", attempt);
                return true;
            }
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return false;
    }

    /**
     * Monitor the process and restart if it crashes unexpectedly.
     */
    private void startMonitor() {
        monitor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "appium-monitor");
            t.setDaemon(true);
            return t;
        });

        monitor.scheduleWithFixedDelay(() -> {
            if (!running || !managed) return;

            if (appiumProcess == null || !appiumProcess.isAlive()) {
                if (restartCount < MAX_RESTARTS) {
                    restartCount++;
                    log.warn("Appium process died — restarting (attempt {}/{})", restartCount, MAX_RESTARTS);
                    startAppiumProcess();
                } else {
                    log.error("Appium process died and max restarts ({}) reached", MAX_RESTARTS);
                    running = false;
                }
            }
        }, 10, 10, TimeUnit.SECONDS);
    }

    /**
     * Check if the Appium server /status endpoint is reachable.
     */
    public boolean isAppiumReachable() {
        try {
            URL url = new URL(appiumServerUrl + "/status");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            int code = conn.getResponseCode();
            conn.disconnect();
            return code == 200;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Get the URL of the managed (or external) Appium server.
     */
    public String getServerUrl() {
        return appiumServerUrl;
    }

    /**
     * Whether we started the Appium process ourselves.
     */
    public boolean isManaged() {
        return managed;
    }

    /**
     * Whether Appium is currently running (managed or external).
     */
    public boolean isRunning() {
        return isAppiumReachable();
    }

    /**
     * Get status info for diagnostics / UI display.
     */
    public Map<String, Object> getStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("server_url", appiumServerUrl);
        status.put("managed", managed);
        status.put("reachable", isAppiumReachable());
        status.put("auto_start", autoStart);
        if (managed && appiumProcess != null) {
            status.put("process_alive", appiumProcess.isAlive());
            status.put("restart_count", restartCount);
        }
        return status;
    }

    @PreDestroy
    public void stop() {
        running = false;
        if (monitor != null) {
            monitor.shutdownNow();
        }
        if (appiumProcess != null && appiumProcess.isAlive()) {
            log.info("Stopping managed Appium server...");
            appiumProcess.destroy();
            try {
                if (!appiumProcess.waitFor(5, TimeUnit.SECONDS)) {
                    appiumProcess.destroyForcibly();
                }
            } catch (InterruptedException e) {
                appiumProcess.destroyForcibly();
            }
            log.info("Appium server stopped");
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private int extractPort(String url) {
        try {
            return new URL(url).getPort();
        } catch (Exception e) {
            return 4723; // Appium default
        }
    }

    private void streamProcessOutput(Process process) {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = br.readLine()) != null) {
                log.debug("[Appium] {}", line);
            }
        } catch (Exception e) {
            // Process ended
        }
    }
}
