package demo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

/**
 * Persistent WebSocket client that connects to the Unified API backend
 * and receives commands (gather-elements, execute, ping) over the connection.
 *
 * Replaces the HTTP polling loop in RunnerAgent for real-time communication
 * with no timeout limitations.
 */
public class RunnerWebSocketClient extends WebSocketClient {

    private static final Logger log = LoggerFactory.getLogger(RunnerWebSocketClient.class);
    private static final int RECONNECT_DELAY_MS = 5000;
    private static final int MAX_RECONNECT_DELAY_MS = 60000;

    private final ObjectMapper mapper = new ObjectMapper();
    private final ExecutorService workExecutor = Executors.newFixedThreadPool(5);
    private final String apiUrl;
    private final String runnerToken;
    private final TestExecutionService testExecutionService;

    private volatile boolean shouldReconnect = true;
    private int reconnectAttempts = 0;

    // Callback for logging
    private final java.util.function.BiConsumer<String, String> logCallback;

    public RunnerWebSocketClient(String apiUrl, String runnerToken,
                                  TestExecutionService testExecutionService,
                                  java.util.function.BiConsumer<String, String> logCallback) {
        super(buildWsUri(apiUrl, runnerToken));
        this.apiUrl = apiUrl;
        this.runnerToken = runnerToken;
        this.testExecutionService = testExecutionService;
        this.logCallback = logCallback;

        // Set connection timeout
        this.setConnectionLostTimeout(120);

        // Allow large messages (element gather results can be 500KB+)
        // Java-WebSocket default is ~16KB which is too small
    }

    private static URI buildWsUri(String apiUrl, String token) {
        String wsUrl = apiUrl.replace("http://", "ws://")
                             .replace("https://", "wss://");
        // Remove trailing slash
        if (wsUrl.endsWith("/")) wsUrl = wsUrl.substring(0, wsUrl.length() - 1);
        String uri = wsUrl + "/ws/runner?token=" + token;
        try {
            return new URI(uri);
        } catch (Exception e) {
            throw new RuntimeException("Invalid WebSocket URI: " + uri, e);
        }
    }

    @Override
    public void onOpen(ServerHandshake handshake) {
        log.info("WebSocket connected to backend (status={})", handshake.getHttpStatus());
        reconnectAttempts = 0;
        if (logCallback != null) {
            logCallback.accept("INFO", "WebSocket connected to backend");
        }
    }

    @Override
    public void onMessage(String message) {
        try {
            JsonNode msg = mapper.readTree(message);
            String type = msg.has("type") ? msg.get("type").asText() : "";
            String requestId = msg.has("request_id") ? msg.get("request_id").asText() : "";

            switch (type) {
                case "gather-elements":
                    workExecutor.submit(() -> handleGatherElements(requestId, msg.get("payload")));
                    break;

                case "execute":
                    workExecutor.submit(() -> handleExecute(requestId, msg.get("payload")));
                    break;

                case "ping":
                    sendPong();
                    break;

                default:
                    log.debug("Unknown command type: {}", type);
            }
        } catch (Exception e) {
            log.error("Failed to process message: {}", e.getMessage(), e);
        }
    }

    @Override
    public void onClose(int code, String reason, boolean remote) {
        log.info("WebSocket closed: code={} reason='{}' remote={}", code, reason, remote);

        if (shouldReconnect && code != 4001) {
            scheduleReconnect();
        }
    }

    @Override
    public void onError(Exception ex) {
        log.warn("WebSocket error: {}", ex.getMessage());
    }

    // -----------------------------------------------------------------------
    // Command handlers
    // -----------------------------------------------------------------------

    private void handleGatherElements(String requestId, JsonNode payload) {
        log.info("Received gather-elements command (requestId={})", requestId);
        try {
            String browserType = payload.has("browserType") ? payload.get("browserType").asText() : "chrome";
            Map<String, Object> appiumConfig = null;
            if (payload.has("appiumConfig")) {
                appiumConfig = mapper.convertValue(payload.get("appiumConfig"), Map.class);
            }

            BrowserType bt = BrowserType.fromValue(browserType);
            Map<String, Object> result = AppiumElementGatherer.gatherElements(bt, appiumConfig);

            sendResult(requestId, result);
            log.info("gather-elements completed: {} elements", 
                    result.containsKey("elements") ? ((java.util.List<?>) result.get("elements")).size() : 0);

        } catch (Exception e) {
            log.error("gather-elements failed: {}", e.getMessage(), e);
            sendError(requestId, e.getMessage());
        }
    }

    private void handleExecute(String requestId, JsonNode payload) {
        log.info("Received execute command (requestId={})", requestId);
        try {
            TestExecutionController.ExecutionRequest request = new TestExecutionController.ExecutionRequest();
            request.setExecutionId(payload.has("executionId") ? payload.get("executionId").asText() : requestId);
            request.setPromptId(payload.has("promptId") ? payload.get("promptId").asText() : "");
            request.setBrowserType(payload.has("browserType") ? payload.get("browserType").asText() : "chrome");

            List<Map<String, Object>> steps = new ArrayList<>();
            if (payload.has("steps") && payload.get("steps").isArray()) {
                for (JsonNode stepNode : payload.get("steps")) {
                    steps.add(mapper.convertValue(stepNode, Map.class));
                }
            }
            request.setSteps(steps);

            if (payload.has("policyConfig")) {
                request.setPolicyConfig(mapper.convertValue(payload.get("policyConfig"), Map.class));
            }
            if (payload.has("appiumConfig")) {
                request.setAppiumConfig(mapper.convertValue(payload.get("appiumConfig"), Map.class));
            }
            if (payload.has("deviceConfig")) {
                request.setDeviceConfig(mapper.convertValue(payload.get("deviceConfig"), Map.class));
            }
            if (payload.has("authToken")) {
                request.setAuthToken(payload.get("authToken").asText());
            }

            ConcurrentHashMap<String, TestExecutionController.ExecutionStatus> statuses = new ConcurrentHashMap<>();
            statuses.put(request.getExecutionId(), new TestExecutionController.ExecutionStatus("running", "Agent executing"));
            testExecutionService.executeTestSteps(request, request.getExecutionId(), statuses);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            result.put("executionId", request.getExecutionId());
            result.put("message", "Execution completed");
            sendResult(requestId, result);
        } catch (Exception e) {
            log.error("execute failed: {}", e.getMessage(), e);
            sendError(requestId, e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Message senders
    // -----------------------------------------------------------------------

    private void sendResult(String requestId, Map<String, Object> payload) {
        try {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", "result");
            msg.put("request_id", requestId);
            msg.put("payload", payload);
            String json = mapper.writeValueAsString(msg);
            log.info("Sending result for requestId={} ({} bytes)", requestId, json.length());
            if (!isOpen()) {
                log.error("WebSocket not open — cannot send result for requestId={}", requestId);
                return;
            }
            send(json);
            log.info("Result sent successfully for requestId={}", requestId);
        } catch (Exception e) {
            log.error("Failed to send result for requestId={}: {} - {}", requestId, e.getClass().getSimpleName(), e.getMessage(), e);
        }
    }

    private void sendError(String requestId, String error) {
        try {
            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", "error");
            msg.put("request_id", requestId);
            msg.put("error", error != null ? error : "Unknown error");
            String json = mapper.writeValueAsString(msg);
            send(json);
        } catch (Exception e) {
            log.error("Failed to send error: {}", e.getMessage());
        }
    }

    private void sendPong() {
        try {
            send("{\"type\":\"pong\"}");
        } catch (Exception e) {
            log.warn("Failed to send pong: {}", e.getMessage());
        }
    }

    public void sendLog(String level, String message, String executionId) {
        try {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("level", level);
            entry.put("message", message);
            if (executionId != null) entry.put("execution_id", executionId);
            entry.put("timestamp", java.time.Instant.now().toString());

            Map<String, Object> msg = new LinkedHashMap<>();
            msg.put("type", "log");
            msg.put("entries", java.util.Collections.singletonList(entry));
            send(mapper.writeValueAsString(msg));
        } catch (Exception e) {
            log.warn("Failed to send log over WebSocket: {}", e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Reconnection
    // -----------------------------------------------------------------------

    private void scheduleReconnect() {
        reconnectAttempts++;
        int delay = Math.min(RECONNECT_DELAY_MS * reconnectAttempts, MAX_RECONNECT_DELAY_MS);
        log.info("Reconnecting in {}ms (attempt {})", delay, reconnectAttempts);

        new Thread(() -> {
            try {
                Thread.sleep(delay);
                if (shouldReconnect) {
                    reconnect();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                log.error("Reconnect failed: {}", e.getMessage());
                if (shouldReconnect) {
                    scheduleReconnect();
                }
            }
        }, "ws-reconnect").start();
    }

    public void shutdown() {
        shouldReconnect = false;
        workExecutor.shutdownNow();
        try {
            closeBlocking();
        } catch (Exception e) {
            log.warn("Error closing WebSocket: {}", e.getMessage());
        }
    }
}
