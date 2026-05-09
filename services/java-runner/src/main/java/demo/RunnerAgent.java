package demo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.http.client.methods.*;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.util.EntityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import javax.annotation.PreDestroy;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.net.InetAddress;
import java.util.*;
import java.util.concurrent.*;

/**
 * Runner Agent — polls the Unified API for queued test executions and
 * dispatches them to the existing {@link TestExecutionService}.
 * <p>
 * Activated by Spring profile "agent":
 *   java -jar runner.jar --spring.profiles.active=agent
 * <p>
 * On first run, registers with the API and stores the runner_token locally
 * in {@code runner-credentials.properties} so it survives restarts.
 */
@Component
@Profile("agent")
public class RunnerAgent {

    private static final Logger log = LoggerFactory.getLogger(RunnerAgent.class);

    @Value("${runner.api-url:http://localhost:8000}")
    private String apiUrl;

    @Value("${runner.organization-id:}")
    private String organizationId;

    @Value("${runner.name:}")
    private String runnerName;

    @Value("${runner.api-key:}")
    private String apiKey;

    @Value("${runner.capabilities:chrome}")
    private String capabilitiesRaw;

    @Value("${runner.poll-interval-ms:3000}")
    private long pollIntervalMs;

    @Value("${runner.heartbeat-interval-ms:30000}")
    private long heartbeatIntervalMs;

    @Value("${runner.credentials-file:runner-credentials.properties}")
    private String credentialsFile;

    @Autowired
    private TestExecutionService testExecutionService;

    @Autowired
    private AppiumServerManager appiumServerManager;

    private final ObjectMapper mapper = new ObjectMapper();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(3);
    private final ExecutorService workExecutor = Executors.newFixedThreadPool(5);
    private final ConcurrentHashMap<String, String> activeExecutions = new ConcurrentHashMap<>();

    private String runnerToken;
    private String runnerId;
    private volatile boolean running = true;
    private final List<Map<String, String>> logBuffer = Collections.synchronizedList(new ArrayList<>());
    private volatile String currentExecutionId = null;

    private RunnerWebSocketClient wsClient;

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        log.info("=== Runner Agent starting ===");
        log.info("API URL: {}", apiUrl);
        log.info("Organization: {}", organizationId);

        try {
            // Auto-start Appium server if needed
            boolean appiumOk = appiumServerManager.startIfNeeded(capabilitiesRaw);
            if (!appiumOk) {
                log.warn("Appium server not available — mobile tests may fail");
            }

            runnerToken = loadOrRegister();
            log.info("Runner ID: {}", runnerId);
            log.info("Capabilities: {}", capabilitiesRaw);

            // Connect to backend via WebSocket (persistent connection)
            wsClient = new RunnerWebSocketClient(apiUrl, runnerToken, testExecutionService, (level, msg) -> bufferLog(level, msg, null));
            wsClient.connectBlocking(15, TimeUnit.SECONDS);

            if (wsClient.isOpen()) {
                log.info("=== Runner Agent connected via WebSocket — waiting for commands ===");
                bufferLog("INFO", "WebSocket connected to " + apiUrl, null);
            } else {
                log.warn("WebSocket connection failed — falling back to HTTP polling");
            }

            // Keep the HTTP poll loop running even when WebSocket is open.
            // The backend still claims queued executions through /runners/poll.
            startHttpPolling();

            // Keep log flush running (sends buffered logs via HTTP as backup)
            scheduler.scheduleWithFixedDelay(this::flushLogs, 10000, 5000, TimeUnit.MILLISECONDS);

        } catch (Exception e) {
            log.error("Failed to start runner agent", e);
        }
    }

    /**
     * Fallback: start the original HTTP polling + heartbeat loops.
     */
    private void startHttpPolling() {
        log.info("Starting HTTP polling fallback (poll={}ms, heartbeat={}ms)", pollIntervalMs, heartbeatIntervalMs);
        scheduler.scheduleWithFixedDelay(this::pollOnce, 0, pollIntervalMs, TimeUnit.MILLISECONDS);
        scheduler.scheduleWithFixedDelay(this::heartbeat, 5000, heartbeatIntervalMs, TimeUnit.MILLISECONDS);
    }

    @PreDestroy
    public void stop() {
        running = false;
        if (wsClient != null) {
            wsClient.shutdown();
        }
        scheduler.shutdownNow();
        workExecutor.shutdownNow();
        log.info("Runner agent stopped");
    }

    // -----------------------------------------------------------------------
    // Registration
    // -----------------------------------------------------------------------

    private String loadOrRegister() throws Exception {
        // Try loading saved credentials
        File creds = new File(credentialsFile);
        if (creds.exists()) {
            Properties props = new Properties();
            try (FileReader reader = new FileReader(creds)) {
                props.load(reader);
            }
            String saved = props.getProperty("runner_token");
            runnerId = props.getProperty("runner_id", "unknown");
            if (saved != null && !saved.isEmpty()) {
                log.info("Loaded saved runner credentials (id={})", runnerId);
                return saved;
            }
        }

        // Register with the API
        if (organizationId == null || organizationId.isEmpty()) {
            throw new IllegalStateException(
                "runner.organization-id is required for first-time registration. " +
                "Set it in application-agent.properties or via --runner.organization-id=<uuid>"
            );
        }

        String hostname;
        try {
            hostname = InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            hostname = "unknown";
        }

        String name = (runnerName != null && !runnerName.isEmpty())
                ? runnerName
                : "runner-" + hostname;

        List<String> caps = Arrays.asList(capabilitiesRaw.split(","));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("organization_id", organizationId);
        body.put("runner_name", name);
        body.put("capabilities", caps);
        body.put("hostname", hostname);
        body.put("os_name", System.getProperty("os.name"));

        try (CloseableHttpClient http = HttpClientFactory.create()) {
            HttpPost post = new HttpPost(apiUrl + "/api/v1/runners/register");
            post.setHeader("Content-Type", "application/json");
            if (apiKey != null && !apiKey.isEmpty()) {
                post.setHeader("X-Api-Key", apiKey);
            }
            post.setEntity(new StringEntity(mapper.writeValueAsString(body)));

            var response = http.execute(post);
            int status = response.getStatusLine().getStatusCode();
            String respBody = EntityUtils.toString(response.getEntity());

            if (status != 200) {
                throw new RuntimeException("Registration failed (" + status + "): " + respBody);
            }

            JsonNode json = mapper.readTree(respBody);
            String token = json.get("runner_token").asText();
            runnerId = json.get("runner_id").asText();

            // Save to file
            Properties props = new Properties();
            props.setProperty("runner_token", token);
            props.setProperty("runner_id", runnerId);
            props.setProperty("registered_at", new Date().toString());
            try (FileWriter writer = new FileWriter(creds)) {
                props.store(writer, "Runner agent credentials — do not share");
            }

            log.info("Registered successfully as {} (id={})", name, runnerId);
            bufferLog("INFO", "Registered as " + name + " (id=" + runnerId + ")", null);
            return token;
        }
    }

    // -----------------------------------------------------------------------
    // Polling
    // -----------------------------------------------------------------------

    private void pollOnce() {
        if (!running) return;

        try (CloseableHttpClient http = HttpClientFactory.create()) {
            HttpGet get = new HttpGet(apiUrl + "/api/v1/runners/poll");
            get.setHeader("Authorization", "Bearer " + runnerToken);

            var response = http.execute(get);
            int status = response.getStatusLine().getStatusCode();

            if (status == 204) {
                // No work — that's fine
                return;
            }

            if (status == 401) {
                log.error("Runner token rejected (401). Re-register by deleting {} and restarting.", credentialsFile);
                return;
            }

            if (status != 200) {
                String body = EntityUtils.toString(response.getEntity());
                log.warn("Poll returned {}: {}", status, body);
                return;
            }

            String body = EntityUtils.toString(response.getEntity());
            JsonNode work = mapper.readTree(body);
            String executionId = work.get("executionId").asText();
            String browserType = work.has("browserType") ? work.get("browserType").asText() : "chrome";

            if (activeExecutions.containsKey(executionId)) {
                log.warn("Already running execution {}", executionId);
                return;
            }

            log.info("Received work: execution={} browser={} steps={}",
                    executionId, browserType,
                    work.has("steps") ? work.get("steps").size() : 0);

            bufferLog("INFO", "Claimed execution " + executionId + " (" + browserType + ")", executionId);

            // Dispatch to worker thread
            activeExecutions.put(executionId, "running");
            workExecutor.submit(() -> executeWork(work));

        } catch (Exception e) {
            log.warn("Poll error: {}", e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Execution dispatch
    // -----------------------------------------------------------------------

    private void executeWork(JsonNode work) {
        String executionId = work.get("executionId").asText();
        currentExecutionId = executionId;
        try {
            bufferLog("INFO", "Starting execution " + executionId, executionId);

            // Convert JSON to the format TestExecutionService expects
            TestExecutionController.ExecutionRequest request = new TestExecutionController.ExecutionRequest();
            request.setExecutionId(executionId);
            request.setPromptId(work.has("promptId") ? work.get("promptId").asText() : "");
            request.setBrowserType(work.has("browserType") ? work.get("browserType").asText() : "chrome");

            // Parse steps
            List<Map<String, Object>> steps = new ArrayList<>();
            if (work.has("steps")) {
                for (JsonNode stepNode : work.get("steps")) {
                    Map<String, Object> step = mapper.convertValue(stepNode, Map.class);
                    steps.add(step);
                }
            }
            request.setSteps(steps);
            bufferLog("INFO", "Loaded " + steps.size() + " steps for browser " + request.getBrowserType(), executionId);

            // Parse policy config
            if (work.has("policyConfig")) {
                Map<String, Object> policyConfig = mapper.convertValue(work.get("policyConfig"), Map.class);
                request.setPolicyConfig(policyConfig);
            }

            // Parse mobile/runtime configs for Appium-based executions
            if (work.has("deviceConfig")) {
                Map<String, Object> deviceConfig = mapper.convertValue(work.get("deviceConfig"), Map.class);
                request.setDeviceConfig(deviceConfig);
            }

            if (work.has("appiumConfig")) {
                Map<String, Object> appiumConfig = mapper.convertValue(work.get("appiumConfig"), Map.class);
                request.setAppiumConfig(appiumConfig);
            }

            // Execute using the existing service — results are PUT back to the API by
            // TestExecutionService.updateStepStatus() and reportExecutionStatus()
            ConcurrentHashMap<String, TestExecutionController.ExecutionStatus> statuses = new ConcurrentHashMap<>();
            statuses.put(executionId, new TestExecutionController.ExecutionStatus("running", "Agent executing"));
            testExecutionService.executeTestSteps(request, executionId, statuses);

            bufferLog("INFO", "Execution " + executionId + " completed successfully", executionId);
            log.info("Execution {} completed", executionId);
        } catch (Exception e) {
            bufferLog("ERROR", "Execution " + executionId + " failed: " + e.getMessage(), executionId);
            log.error("Execution {} failed: {}", executionId, e.getMessage(), e);
        } finally {
            currentExecutionId = null;
            activeExecutions.remove(executionId);
            // Flush logs immediately after execution ends
            flushLogs();
        }
    }

    // -----------------------------------------------------------------------
    // Log forwarding
    // -----------------------------------------------------------------------

    /**
     * Buffer a log entry for batch-sending to the API.
     */
    private void bufferLog(String level, String message, String executionId) {
        Map<String, String> entry = new LinkedHashMap<>();
        entry.put("level", level);
        entry.put("message", message);
        if (executionId != null) {
            entry.put("execution_id", executionId);
        }
        entry.put("timestamp", java.time.Instant.now().toString());
        logBuffer.add(entry);
    }

    /**
     * Flush buffered logs to the API in a single batch POST.
     */
    private void flushLogs() {
        if (logBuffer.isEmpty() || runnerToken == null) return;

        // Drain the buffer
        List<Map<String, String>> batch;
        synchronized (logBuffer) {
            batch = new ArrayList<>(logBuffer);
            logBuffer.clear();
        }

        try (CloseableHttpClient http = HttpClientFactory.create()) {
            HttpPost post = new HttpPost(apiUrl + "/api/v1/runners/logs");
            post.setHeader("Authorization", "Bearer " + runnerToken);
            post.setHeader("Content-Type", "application/json");

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("logs", batch);
            post.setEntity(new StringEntity(mapper.writeValueAsString(body)));

            var response = http.execute(post);
            int status = response.getStatusLine().getStatusCode();
            EntityUtils.consumeQuietly(response.getEntity());

            if (status != 200) {
                log.warn("Log flush returned {}", status);
            }
        } catch (Exception e) {
            // Don't lose logs on transient failure — re-add them
            logBuffer.addAll(batch);
            log.warn("Log flush failed: {}", e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Heartbeat
    // -----------------------------------------------------------------------

    private void heartbeat() {
        if (!running || runnerToken == null) return;

        try (CloseableHttpClient http = HttpClientFactory.create()) {
            HttpPut put = new HttpPut(apiUrl + "/api/v1/runners/heartbeat");
            put.setHeader("Authorization", "Bearer " + runnerToken);

            var response = http.execute(put);
            int status = response.getStatusLine().getStatusCode();
            EntityUtils.consumeQuietly(response.getEntity());

            if (status != 200) {
                log.warn("Heartbeat returned {}", status);
            }
        } catch (Exception e) {
            log.warn("Heartbeat failed: {}", e.getMessage());
        }
    }
}
