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
    
    // Data classes remain the same...
    public static class ExecutionRequest {
        public String promptId;
        public List<Map<String, Object>> steps;
        public String authToken;
        public String executionId;
        
        public String getPromptId() { return promptId; }
        public void setPromptId(String promptId) { this.promptId = promptId; }
        
        public List<Map<String, Object>> getSteps() { return steps; }
        public void setSteps(List<Map<String, Object>> steps) { this.steps = steps; }
        
        public String getAuthToken() { return authToken; }
        public void setAuthToken(String authToken) { this.authToken = authToken; }
        
        public String getExecutionId() { return executionId; }
        public void setExecutionId(String executionId) { this.executionId = executionId; }
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