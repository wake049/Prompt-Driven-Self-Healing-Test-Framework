package demo;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

@RestController
@RequestMapping("/api/v1")
@EnableAsync
public class TestExecutionController {
    
    private final Map<String, ExecutionStatus> executions = new ConcurrentHashMap<>();
    private final ExecutorService executorService = Executors.newFixedThreadPool(10); // Support 10 concurrent runs
    private final AtomicInteger activeExecutions = new AtomicInteger(0);
    
    @Autowired
    private TestExecutionService testExecutionService;

    @Autowired
    private AppiumServerManager appiumServerManager;
    
    @PostMapping("/execute")
    public ResponseEntity<ExecutionResponse> executeTest(@RequestBody ExecutionRequest request) {
        System.out.println("=== EXECUTION REQUEST RECEIVED ===");
        System.out.println("Timestamp: " + new Date());
        System.out.println("Prompt ID: " + request.getPromptId());
        System.out.println("Auth Token present: " + (request.getAuthToken() != null && !request.getAuthToken().isEmpty()));
        System.out.println("Steps count: " + (request.getSteps() != null ? request.getSteps().size() : "null"));
        
        if (request.getSteps() != null) {
            System.out.println("Steps details:");
            for (int i = 0; i < request.getSteps().size(); i++) {
                Map<String, Object> step = request.getSteps().get(i);
                System.out.println("  Step " + (i+1) + ": " + step);
            }
        }
        
        try {
            String executionId = request.getExecutionId();
            
            // If no execution ID provided, generate one (fallback)
            if (executionId == null || executionId.isEmpty()) {
                executionId = UUID.randomUUID().toString();
                System.out.println("No execution ID provided, generated new one: " + executionId);
            } else {
                System.out.println("Using provided execution ID: " + executionId);
            }
            
            // Make variables effectively final for lambda
            final String finalExecutionId = executionId;
            final ExecutionRequest finalRequest = request;
            final Map<String, ExecutionStatus> finalExecutions = executions;
            
            // Check if we can handle more concurrent runs
            if (activeExecutions.get() >= 10) {
                System.out.println("ERROR: Too many concurrent executions (" + activeExecutions.get() + "/10)");
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new ExecutionResponse(null, "queue_full", "Too many concurrent executions. Please try again later."));
            }
            
            System.out.println("Active executions before: " + activeExecutions.get());
            
            // Update status to queued
            finalExecutions.put(finalExecutionId, new ExecutionStatus("queued", "Test execution queued"));
            System.out.println("Execution status set to queued for ID: " + finalExecutionId);
            
            // Submit to thread pool for execution
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                int currentActive = activeExecutions.incrementAndGet();
                System.out.println("=== STARTING BACKGROUND EXECUTION ===");
                System.out.println("Execution ID: " + finalExecutionId);
                System.out.println("Active executions now: " + currentActive);
                try {
                    testExecutionService.executeTestSteps(finalRequest, finalExecutionId, finalExecutions);
                    System.out.println("Background execution completed successfully for: " + finalExecutionId);
                } catch (Exception e) {
                    System.err.println("Background execution failed for: " + finalExecutionId);
                    System.err.println("Error: " + e.getMessage());
                    e.printStackTrace();
                    finalExecutions.put(finalExecutionId, new ExecutionStatus("failed", "Execution failed: " + e.getMessage()));
                } finally {
                    int finalActive = activeExecutions.decrementAndGet();
                    System.out.println("Background execution finished. Active executions now: " + finalActive);
                }
            }, executorService);
            
            System.out.println("Returning success response for execution ID: " + finalExecutionId);
            return ResponseEntity.ok(new ExecutionResponse(finalExecutionId, "started", "Test execution started"));
            
        } catch (Exception e) {
            System.err.println("ERROR: Failed to start execution");
            System.err.println("Error message: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ExecutionResponse(null, "error", "Failed to start execution: " + e.getMessage()));
        }
    }
    
    @GetMapping("/execution/{executionId}/status")
    public ResponseEntity<ExecutionStatus> getStatus(@PathVariable String executionId) {
        ExecutionStatus status = executions.get(executionId);
        if (status == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(status);
    }
    
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        System.out.println("=== HEALTH CHECK REQUEST - /api/v1/health ===");
        System.out.println("Timestamp: " + new Date());
        System.out.println("Active executions: " + activeExecutions.get());
        
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "java-runner");
        health.put("activeExecutions", activeExecutions.get());
        health.put("maxConcurrentExecutions", 10);
        health.put("timestamp", new Date());
        health.put("endpoint", "/api/v1/health");
        
        System.out.println("Health check response: " + health);
        System.out.println("=== HEALTH CHECK COMPLETE ===");
        
        return ResponseEntity.ok(health);
    }
    
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("activeExecutions", activeExecutions.get());
        stats.put("totalExecutions", executions.size());
        stats.put("queuedExecutions", executions.values().stream().mapToInt(s -> "queued".equals(s.status) ? 1 : 0).sum());
        stats.put("runningExecutions", executions.values().stream().mapToInt(s -> "running".equals(s.status) ? 1 : 0).sum());
        return ResponseEntity.ok(stats);
    }

    @PostMapping("/gather-elements")
    public ResponseEntity<Map<String, Object>> gatherElements(@RequestBody Map<String, Object> request) {
        System.out.println("=== GATHER ELEMENTS REQUEST ===");
        String browserType = (String) request.getOrDefault("browserType", "");
        @SuppressWarnings("unchecked")
        Map<String, Object> appiumConfig = (Map<String, Object>) request.get("appiumConfig");

        if (browserType.isEmpty() || appiumConfig == null) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("error", "browserType and appiumConfig are required");
            return ResponseEntity.badRequest().body(err);
        }

        try {
            BrowserType bt = BrowserType.fromValue(browserType);
            if (!bt.isAppium()) {
                Map<String, Object> err = new HashMap<>();
                err.put("success", false);
                err.put("error", "browserType must be an Appium type");
                return ResponseEntity.badRequest().body(err);
            }

            Map<String, Object> elements = AppiumElementGatherer.gatherElements(bt, appiumConfig);
            elements.put("success", true);
            return ResponseEntity.ok(elements);
        } catch (Exception e) {
            System.err.println("Gather elements failed: " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("error", "Element gathering failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    @PostMapping("/check-appium-connection")
    public ResponseEntity<Map<String, Object>> checkAppiumConnection(@RequestBody Map<String, Object> request) {
        System.out.println("=== CHECK APPIUM CONNECTION ===");
        String serverUrl = (String) request.getOrDefault("appiumServerUrl", "http://localhost:4723");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("appium_server_url", serverUrl);

        // 1. Check Appium server status
        try {
            java.net.URL url = new java.net.URL(serverUrl + "/status");
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            int code = conn.getResponseCode();

            if (code == 200) {
                java.io.BufferedReader br = new java.io.BufferedReader(
                        new java.io.InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();
                result.put("server_reachable", true);
                result.put("server_status", sb.toString());
            } else {
                result.put("server_reachable", false);
                result.put("server_error", "HTTP " + code);
            }
            conn.disconnect();
        } catch (Exception e) {
            result.put("server_reachable", false);
            result.put("server_error", e.getMessage());
        }

        // 2. Check connected Android devices via ADB
        List<String> androidDevices = new ArrayList<>();
        try {
            ProcessBuilder pb = new ProcessBuilder("adb", "devices");
            pb.redirectErrorStream(true);
            Process proc = pb.start();
            java.io.BufferedReader br = new java.io.BufferedReader(
                    new java.io.InputStreamReader(proc.getInputStream()));
            String line;
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (!line.isEmpty() && !line.startsWith("List") && !line.startsWith("*")) {
                    androidDevices.add(line);
                }
            }
            proc.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
        } catch (Exception e) {
            // ADB not available — not an error if testing iOS/desktop
        }
        result.put("android_devices", androidDevices);

        // 3. Overall status
        boolean serverOk = Boolean.TRUE.equals(result.get("server_reachable"));
        boolean hasDevices = !androidDevices.isEmpty();
        result.put("connected", serverOk);
        result.put("has_devices", hasDevices);
        result.put("success", true);

        // 4. Managed server info
        result.put("appium_managed", appiumServerManager.isManaged());
        result.put("appium_auto_start", true);

        System.out.println("Connection check result: server=" + serverOk + " devices=" + androidDevices.size());
        return ResponseEntity.ok(result);
    }
    
    // Data classes remain the same...
    public static class ExecutionRequest {
        public String promptId;
        public List<Map<String, Object>> steps;
        public String authToken;
        public String executionId;
        public Map<String, Object> policyConfig;  // Policy configuration
        public String browserType;  // Browser type: chrome, firefox, edge, safari, chrome-mobile, chrome-tablet, appium-*
        public Map<String, Object> deviceConfig;  // Mobile device emulation profile
        public Map<String, Object> appiumConfig;  // Appium server & capability configuration
        public TestDataConfig testDataConfig;  // API test data configuration
        
        public String getPromptId() { return promptId; }
        public void setPromptId(String promptId) { this.promptId = promptId; }
        
        public List<Map<String, Object>> getSteps() { return steps; }
        public void setSteps(List<Map<String, Object>> steps) { this.steps = steps; }
        
        public String getAuthToken() { return authToken; }
        public void setAuthToken(String authToken) { this.authToken = authToken; }
        
        public String getExecutionId() { return executionId; }
        public void setExecutionId(String executionId) { this.executionId = executionId; }
        
        public Map<String, Object> getPolicyConfig() { return policyConfig; }
        public void setPolicyConfig(Map<String, Object> policyConfig) { this.policyConfig = policyConfig; }
        
        public String getBrowserType() { return browserType; }
        public void setBrowserType(String browserType) { this.browserType = browserType; }
        
        public Map<String, Object> getDeviceConfig() { return deviceConfig; }
        public void setDeviceConfig(Map<String, Object> deviceConfig) { this.deviceConfig = deviceConfig; }
        
        public Map<String, Object> getAppiumConfig() { return appiumConfig; }
        public void setAppiumConfig(Map<String, Object> appiumConfig) { this.appiumConfig = appiumConfig; }
        
        public TestDataConfig getTestDataConfig() { return testDataConfig; }
        public void setTestDataConfig(TestDataConfig testDataConfig) { this.testDataConfig = testDataConfig; }
    }
    
    /**
     * Configuration for API test data setup before UI test execution.
     * Allows creating precondition data (e.g., bookings, users) via API calls.
     */
    public static class TestDataConfig {
        public List<String> setupIds;              // Specific setup IDs to execute
        public Map<String, String> variableOverrides;  // Override variable values
        public boolean skipOnFailure = false;      // Continue UI test even if setup fails
        public boolean executeForPrompt = true;    // Execute all setups linked to prompt
        
        public List<String> getSetupIds() { return setupIds; }
        public void setSetupIds(List<String> setupIds) { this.setupIds = setupIds; }
        
        public Map<String, String> getVariableOverrides() { return variableOverrides; }
        public void setVariableOverrides(Map<String, String> variableOverrides) { this.variableOverrides = variableOverrides; }
        
        public boolean isSkipOnFailure() { return skipOnFailure; }
        public void setSkipOnFailure(boolean skipOnFailure) { this.skipOnFailure = skipOnFailure; }
        
        public boolean isExecuteForPrompt() { return executeForPrompt; }
        public void setExecuteForPrompt(boolean executeForPrompt) { this.executeForPrompt = executeForPrompt; }
    }
    
    public static class ExecutionResponse {
        public String executionId;
        public String status;
        public String message;
        
        public ExecutionResponse(String executionId, String status, String message) {
            this.executionId = executionId;
            this.status = status;
            this.message = message;
        }
    }
    
    public static class ExecutionStatus {
        public String status;
        public String message;
        public Date timestamp;
        public Map<String, Object> details;
        
        public ExecutionStatus(String status, String message) {
            this.status = status;
            this.message = message;
            this.timestamp = new Date();
            this.details = new HashMap<>();
        }
    }
}