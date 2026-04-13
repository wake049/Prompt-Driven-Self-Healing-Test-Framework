package demo;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPut;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.util.EntityUtils;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TestExecutionService {
    
    @Value("${app.unified-api.url}")
    private String unifiedApiUrl;
    
    @Autowired
    private ApiTestDataService apiTestDataService;
    
    private static final String API_AUTH_TOKEN = System.getenv("API_AUTH_TOKEN");
    
    public void executeTestSteps(TestExecutionController.ExecutionRequest request, String executionId, 
                               Map<String, TestExecutionController.ExecutionStatus> executions) {
        
        System.out.println("=== TEST EXECUTION SERVICE STARTED ===");
        System.out.println("Execution ID: " + executionId);
        System.out.println("Prompt ID: " + request.getPromptId());
        System.out.println("Steps to execute: " + (request.getSteps() != null ? request.getSteps().size() : "null"));
        
        WebDriver driver = null;
        try {
            // Update status to running
            System.out.println("Updating execution status to running...");
            executions.put(executionId, new TestExecutionController.ExecutionStatus("running", "Initializing browser for execution " + executionId));
            
            // Create a fresh WebDriver instance for this execution
            System.out.println("Creating WebDriver instance...");
            String browserType = request.getBrowserType();
            boolean headless = Boolean.parseBoolean(System.getProperty("headless", "false"));
            driver = createWebDriverInstance(browserType, headless);
            System.out.println("WebDriver created successfully");
            
            // Create isolated execution context
            System.out.println("Creating execution context...");
            TestExecutionContext context = new TestExecutionContext(
                executionId, 
                request.getPromptId(), 
                request.getAuthToken(), 
                driver
            );
            
            // Apply policy configuration if provided
            if (request.getPolicyConfig() != null) {
                System.out.println("Applying policy configuration to execution context...");
                context.policyConfig = request.getPolicyConfig();
            }
            
            System.out.println("Execution context created");
            
            // Execute API test data setups to create precondition data
            executeApiTestDataSetups(request, context, executions, executionId);
            
            // Execute the test steps
            System.out.println("Starting step execution...");
            executeSteps(context, request.getSteps(), executions);
            
            // Mark as completed
            System.out.println("Test execution completed successfully for ID: " + executionId);
            executions.put(executionId, new TestExecutionController.ExecutionStatus("completed", 
                "Test execution completed successfully for " + executionId));
            
            // Report completion to unified API
            reportExecutionStatus(executionId, "completed", "Test execution completed successfully", null);
            
        } catch (Exception e) {
            System.err.println("TEST EXECUTION FAILED for ID: " + executionId);
            System.err.println("Error message: " + e.getMessage());
            e.printStackTrace();
            executions.put(executionId, new TestExecutionController.ExecutionStatus("failed", 
                "Test execution failed: " + e.getMessage()));
                
            // Report failure to unified API
            reportExecutionStatus(executionId, "failed", "Test execution failed: " + e.getMessage(), null);
        } finally {
            // Always clean up the WebDriver instance
            if (driver != null) {
                try {
                    System.out.println("Closing WebDriver for execution: " + executionId);
                    driver.quit();
                    System.out.println("WebDriver closed successfully");
                } catch (Exception e) {
                    System.err.println("Error closing WebDriver for execution " + executionId + ": " + e.getMessage());
                }
            }
            System.out.println("=== TEST EXECUTION SERVICE FINISHED ===");
        }
    }
    
    /**
     * Execute API test data setups to create precondition data before UI tests.
     * Variables extracted from API responses are injected into the execution context
     * for use in UI test steps (e.g., ${booking_id}).
     */
    private void executeApiTestDataSetups(
            TestExecutionController.ExecutionRequest request,
            TestExecutionContext context,
            Map<String, TestExecutionController.ExecutionStatus> executions,
            String executionId) {
        
        // Check if test data config is provided
        TestExecutionController.TestDataConfig testDataConfig = request.getTestDataConfig();
        
        // Determine if we should execute test data setups
        boolean hasExplicitConfig = testDataConfig != null && 
            (testDataConfig.getSetupIds() != null && !testDataConfig.getSetupIds().isEmpty());
        boolean shouldExecuteForPrompt = testDataConfig == null || testDataConfig.isExecuteForPrompt();
        
        if (!hasExplicitConfig && !shouldExecuteForPrompt) {
            System.out.println("No API test data configuration provided, skipping.");
            return;
        }
        
        System.out.println("=== EXECUTING API TEST DATA SETUPS ===");
        executions.put(executionId, new TestExecutionController.ExecutionStatus(
            "running", "Executing API test data setups..."));
        
        try {
            ApiTestDataService.TestDataConfig config = new ApiTestDataService.TestDataConfig();
            
            if (hasExplicitConfig) {
                // Use explicitly provided setup IDs
                config.setupIds = testDataConfig.getSetupIds();
                if (testDataConfig.getVariableOverrides() != null) {
                    config.variableOverrides = testDataConfig.getVariableOverrides();
                }
                config.skipOnFailure = testDataConfig.isSkipOnFailure();
            } else {
                // Execute all setups linked to the prompt
                config.promptId = request.getPromptId();
                if (testDataConfig != null && testDataConfig.getVariableOverrides() != null) {
                    config.variableOverrides = testDataConfig.getVariableOverrides();
                }
                config.skipOnFailure = testDataConfig != null && testDataConfig.isSkipOnFailure();
            }
            
            // Execute the API test data setups
            ApiTestDataService.TestDataResult result = apiTestDataService.executeTestDataSetups(
                config, request.getAuthToken());
            
            if (result.success) {
                // Inject extracted variables into the execution context
                if (result.variables != null && !result.variables.isEmpty()) {
                    context.initialVariables.putAll(result.variables);
                    System.out.println("✓ Injected " + result.variables.size() + 
                        " variables from API test data into execution context");
                    for (Map.Entry<String, String> var : result.variables.entrySet()) {
                        System.out.println("  ${" + var.getKey() + "} = " + var.getValue());
                    }
                }
                
                executions.put(executionId, new TestExecutionController.ExecutionStatus(
                    "running", "API test data setup completed, starting UI tests..."));
                    
            } else {
                String errorMsg = "API test data setup failed: " + result.errorMessage;
                System.err.println("✗ " + errorMsg);
                
                if (!config.skipOnFailure) {
                    throw new RuntimeException(errorMsg);
                } else {
                    System.out.println("Skipping failure and continuing with UI tests...");
                    executions.put(executionId, new TestExecutionController.ExecutionStatus(
                        "running", "API test data setup failed but continuing: " + result.errorMessage));
                }
            }
            
        } catch (RuntimeException e) {
            throw e;  // Re-throw to stop execution
        } catch (Exception e) {
            System.err.println("Error executing API test data setups: " + e.getMessage());
            e.printStackTrace();
            
            boolean skipOnFailure = testDataConfig != null && testDataConfig.isSkipOnFailure();
            if (!skipOnFailure) {
                throw new RuntimeException("API test data setup failed: " + e.getMessage(), e);
            }
        }
        
        System.out.println("=== END API TEST DATA SETUPS ===\n");
    }
    
    private void reportExecutionStatus(String executionId, String status, String message, Map<String, Object> results) {
        try {
            System.out.println("=== REPORTING EXECUTION STATUS ===");
            System.out.println("UNIFIED_API_URL environment variable: " + System.getenv("UNIFIED_API_URL"));
            System.out.println("Using unifiedApiUrl: " + unifiedApiUrl);
            System.out.println("Reporting execution status to unified API: " + status + " for ID: " + executionId);
            
            String statusUrl = unifiedApiUrl + "/api/v1/execution/execution/" + executionId + "/status";
            System.out.println("Status URL: " + statusUrl);
            
            try (CloseableHttpClient httpClient = HttpClientFactory.create()) {
                HttpPut httpPut = new HttpPut(statusUrl);
                httpPut.setHeader("Content-Type", "application/json");
                
                if (API_AUTH_TOKEN != null) {
                    httpPut.setHeader("Authorization", "Bearer " + API_AUTH_TOKEN);
                }
                
                // Create request body
                ObjectMapper mapper = new ObjectMapper();
                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("status", status);
                requestBody.put("message", message);
                if (results != null) {
                    requestBody.put("results", results);
                }
                
                String jsonBody = mapper.writeValueAsString(requestBody);
                httpPut.setEntity(new StringEntity(jsonBody));
                
                try (CloseableHttpResponse response = httpClient.execute(httpPut)) {
                    String responseText = EntityUtils.toString(response.getEntity());
                    int statusCode = response.getStatusLine().getStatusCode();
                    
                    if (statusCode >= 200 && statusCode < 300) {
                        System.out.println("✓ Successfully reported execution status to unified API");
                    } else {
                        System.err.println("Failed to report execution status. HTTP " + statusCode + ": " + responseText);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error reporting execution status to unified API: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private void updateStepStatus(String stepId, String status, String errorDetails, String screenshotPath, Boolean healed) {
        updateStepStatus(stepId, status, errorDetails, screenshotPath, healed, null);
    }
    
    private void updateStepStatus(String stepId, String status, String errorDetails, String screenshotPath, Boolean healed, StepResult result) {
        try {
            if (stepId == null) {
                System.err.println("Cannot update step status: stepId is null");
                return;
            }
            
            System.out.println("=== UPDATING STEP STATUS ===");
            System.out.println("Step ID: " + stepId);
            System.out.println("Status: " + status);
            System.out.println("Error Details: " + errorDetails);
            System.out.println("Screenshot Path: " + screenshotPath);
            System.out.println("Healed: " + healed);
            
            String stepStatusUrl = unifiedApiUrl + "/api/v1/execution/step/" + stepId + "/status";
            System.out.println("Step Status URL: " + stepStatusUrl);
            
            try (CloseableHttpClient httpClient = HttpClientFactory.create()) {
                HttpPut httpPut = new HttpPut(stepStatusUrl);
                httpPut.setHeader("Content-Type", "application/json");
                
                if (API_AUTH_TOKEN != null) {
                    httpPut.setHeader("Authorization", "Bearer " + API_AUTH_TOKEN);
                }
                
                // Create request body for step status update
                ObjectMapper mapper = new ObjectMapper();
                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("status", status);
                
                if (errorDetails != null) {
                    requestBody.put("error_details", errorDetails);
                }
                
                if (screenshotPath != null) {
                    requestBody.put("screenshot_path", screenshotPath);
                }
                
                // Add healed flag if present
                if (healed != null && healed) {
                    requestBody.put("healed", true);
                    
                    // Add healing attempts if result is provided
                    if (result != null && result.getAttemptedAlternatives() != null && !result.getAttemptedAlternatives().isEmpty()) {
                        List<Map<String, Object>> healingAttempts = new ArrayList<>();
                        Map<String, Object> healingAttempt = new HashMap<>();
                        
                        healingAttempt.put("originalLocator", result.getOriginalLocator());
                        healingAttempt.put("attemptedAlternatives", result.getAttemptedAlternatives());
                        healingAttempt.put("healedLocator", result.getHealedLocator());
                        healingAttempt.put("result", result.getHealedLocator() != null ? "success" : "failed");
                        if (errorDetails != null) {
                            healingAttempt.put("error", errorDetails);
                        }
                        
                        healingAttempts.add(healingAttempt);
                        requestBody.put("healing_attempts", healingAttempts);
                        
                        System.out.println("Added healing attempts: " + result.getAttemptedAlternatives().size() + " alternatives");
                    }
                }
                
                // Add timestamp
                requestBody.put("finished_at", new Date());
                
                String jsonBody = mapper.writeValueAsString(requestBody);
                httpPut.setEntity(new StringEntity(jsonBody));
                
                try (CloseableHttpResponse response = httpClient.execute(httpPut)) {
                    String responseText = EntityUtils.toString(response.getEntity());
                    int statusCode = response.getStatusLine().getStatusCode();
                    
                    if (statusCode >= 200 && statusCode < 300) {
                        System.out.println("✓ Successfully updated step status in unified API");
                    } else {
                        System.err.println("Failed to update step status. HTTP " + statusCode + ": " + responseText);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error updating step status to unified API: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private WebDriver createWebDriverInstance() {
        return createWebDriverInstance(null, false);
    }
    
    private WebDriver createWebDriverInstance(String browserTypeStr, boolean headless) {
        // Parse browser type, default to Chrome
        BrowserType browserType = BrowserType.CHROME;
        if (browserTypeStr != null && !browserTypeStr.trim().isEmpty()) {
            try {
                browserType = BrowserType.fromValue(browserTypeStr);
                System.out.println("Using browser: " + browserType.getDisplayName());
            } catch (IllegalArgumentException e) {
                System.err.println("Invalid browser type: " + browserTypeStr + ". Defaulting to Chrome.");
            }
        } else {
            System.out.println("No browser specified, defaulting to Chrome");
        }
        
        // Create driver using factory
        return WebDriverFactory.createDriver(browserType, headless);
    }
    
    private void executeSteps(TestExecutionContext context, List<Map<String, Object>> steps,
                            Map<String, TestExecutionController.ExecutionStatus> executions) throws Exception {
        
        System.out.println("=== EXECUTING STEPS ===");
        System.out.println("Total steps to execute: " + steps.size());
        
        // Create element repository and self-healing service
        System.out.println("Creating element repository and self-healing service...");
        ElementRepository elementRepository = new ElementRepository();
        SelfHealing selfHealing = new SelfHealing(context.driver, elementRepository);
        ExecutionService executionService = new ExecutionService(context.driver, selfHealing);
        
        // Inject initial variables from API test data setup
        if (context.initialVariables != null && !context.initialVariables.isEmpty()) {
            System.out.println("Injecting " + context.initialVariables.size() + " variables from API test data...");
            executionService.injectInitialVariables(context.initialVariables);
        }
        
        // Apply policy configuration if provided
        if (context.policyConfig != null) {
            System.out.println("Applying policy configuration to self-healing...");
            selfHealing.setPolicyConfig(context.policyConfig);
            
            // Apply execution safety policy to ExecutionService
            if (context.policyConfig.containsKey("blockDestructiveActions")) {
                boolean blockDestructive = Boolean.TRUE.equals(context.policyConfig.get("blockDestructiveActions"));
                boolean allowTestOverride = Boolean.TRUE.equals(context.policyConfig.get("allowTestModeOverride"));
                
                @SuppressWarnings("unchecked")
                List<String> keywordsList = (List<String>) context.policyConfig.get("destructiveKeywords");
                String[] keywords = keywordsList != null ? keywordsList.toArray(new String[0]) : null;
                
                executionService.setSafetyPolicy(blockDestructive, allowTestOverride, keywords);
                
                // Check if test mode is enabled (could come from request or environment)
                boolean isTestMode = Boolean.TRUE.equals(context.policyConfig.get("testMode"));
                executionService.setTestMode(isTestMode);
                
                System.out.println("Execution Safety Policy configured");
            }
        }
        System.out.println("Services created successfully");
        
        for (int i = 0; i < steps.size(); i++) {
            Map<String, Object> step = steps.get(i);
            String stepDescription = (String) step.get("description");
            
            System.out.println("--- Executing Step " + (i + 1) + "/" + steps.size() + " ---");
            System.out.println("Step data: " + step);
            System.out.println("Description: " + stepDescription);
            
            // Update status with current step
            executions.put(context.executionId, new TestExecutionController.ExecutionStatus("running", 
                "Executing step " + (i + 1) + "/" + steps.size() + ": " + stepDescription));
            
            try {
                // Execute individual step
                executeStep(context, step, executionService, i);
                System.out.println("Step " + (i + 1) + " completed successfully");
            } catch (Exception e) {
                System.err.println("Step " + (i + 1) + " failed: " + e.getMessage());
                throw e; // Re-throw to stop execution
            }
            
            // Small delay between steps for stability
            System.out.println("Waiting 1 second before next step...");
            Thread.sleep(1000);
        }
        
        System.out.println("=== ALL STEPS COMPLETED ===");
    }
    
    private void executeStep(TestExecutionContext context, Map<String, Object> step, ExecutionService executionService, int stepIndex) throws Exception {
        String action = (String) step.get("action");
        String elementId = (String) step.get("elementId");
        String value = (String) step.get("value");
        String url = (String) step.get("url");
        String locator = (String) step.get("locator");
        String stepId = (String) step.get("id"); // Get step ID for database updates
        
        System.out.println(">>> Individual Step Execution <<<");
        System.out.println("Step ID: " + stepId);
        System.out.println("Action: " + action);
        System.out.println("Element ID: " + elementId);
        System.out.println("Value: " + value);
        System.out.println("URL: " + url);
        System.out.println("Locator: " + locator);
        
        // Update step status to running
        updateStepStatus(stepId, "running", null, null, null);
        
        StepResult result = null;
        boolean success = false;
        Exception stepException = null;
        
        try {
            // Convert API step format to Step object
            Step stepObj = new Step();
            stepObj.setAction(action);
            stepObj.setElementId(elementId);
            stepObj.setData(value);  // Use setData() instead of setValue()
            
            // Set locator if available (fallback to elementId)
            if (locator != null) {
                stepObj.setLocator(locator);
                System.out.println("Using provided locator: " + locator);
            } else if (elementId != null) {
                stepObj.setLocator("#" + elementId); // Assume ID selector as fallback
                System.out.println("Using fallback locator (ID): #" + elementId);
            } else {
                System.out.println("WARNING: No locator available for step");
            }
            
            System.out.println("Created Step object: " + stepObj);
            
            // Execute step using the existing ExecutionService
            System.out.println("Executing action: " + action.toLowerCase());
            switch (action.toLowerCase()) {
                case "navigate":
                case "open":
                    System.out.println("Navigating to URL: " + (url != null ? url : value));
                    context.driver.get(url != null ? url : value);
                    System.out.println("Navigation completed");
                    success = true;
                    break;
                
                case "api_setup":
                    // Execute API test data setup before UI test
                    System.out.println("Executing API test data setup");
                    try {
                        String setupId = null;
                        @SuppressWarnings("unchecked")
                        Map<String, Object> argsMap = (Map<String, Object>) step.get("args");
                        if (argsMap != null) {
                            setupId = (String) argsMap.get("setup_id");
                        }
                        if (setupId == null) {
                            setupId = (String) step.get("setup_id");
                        }
                        
                        if (setupId != null && !setupId.isEmpty()) {
                            ApiTestDataService.TestDataConfig config = new ApiTestDataService.TestDataConfig();
                            config.setupIds = java.util.Collections.singletonList(setupId);
                            
                            @SuppressWarnings("unchecked")
                            Map<String, String> varOverrides = argsMap != null ? 
                                (Map<String, String>) argsMap.get("variables") : null;
                            if (varOverrides != null) {
                                config.variableOverrides = varOverrides;
                            }
                            
                            ApiTestDataService.TestDataResult apiResult = apiTestDataService.executeTestDataSetups(config, null);
                            
                            if (apiResult.success) {
                                // Inject extracted variables for use in subsequent steps
                                executionService.injectInitialVariables(apiResult.variables);
                                System.out.println("API setup completed successfully. Extracted variables: " + apiResult.variables);
                                success = true;
                            } else {
                                System.err.println("API setup failed: " + apiResult.errorMessage);
                                success = false;
                            }
                        } else {
                            System.err.println("api_setup action missing setup_id");
                            success = false;
                        }
                    } catch (Exception e) {
                        System.err.println("API setup execution failed: " + e.getMessage());
                        success = false;
                        stepException = e;
                    }
                    break;
                    
                case "click":
                case "type":
                case "enter_text":
                case "select":
                case "verify":
                case "verify_text":
                case "verify_element":
                case "assert_text":
                case "assert_element":
                case "assert_visible":
                case "screenshot":
                case "wait":
                case "wait_for":
                case "extract_data":
                case "calculate":
                    System.out.println("Using ExecutionService for action: " + action);
                    // Use ExecutionService which handles self-healing automatically
                    result = executionService.executeStep(stepIndex, stepObj);  // Pass stepIndex as required
                    success = "PASS".equals(result.getStatus()) || "HEALED".equals(result.getStatus());
                    System.out.println("ExecutionService completed action: " + action + " with status: " + result.getStatus());
                    break;
                    
                default:
                    System.err.println("UNSUPPORTED ACTION: " + action);
                    throw new IllegalArgumentException("Unsupported action: " + action);
            }
            
        } catch (Exception e) {
            stepException = e;
            success = false;
            System.err.println("Step execution failed: " + e.getMessage());
        }
        
        // Update step status in database based on result
        try {
            if (success) {
                String status = "passed";
                Boolean wasHealed = result != null ? result.isHealed() : false;
                if (result != null && "HEALED".equals(result.getStatus())) {
                    status = "healed";  // Special status for healed steps
                }
                updateStepStatus(stepId, status, null, result != null ? result.getScreenshotPath() : null, wasHealed, result);
                System.out.println("Updated step " + (stepIndex + 1) + " status to: " + status + (wasHealed ? " (healed)" : ""));
            } else {
                String errorDetails = stepException != null ? stepException.getMessage() : 
                    (result != null ? result.getError() : "Unknown error");
                Boolean wasHealed = result != null ? result.isHealed() : false;
                updateStepStatus(stepId, "failed", errorDetails, result != null ? result.getScreenshotPath() : null, wasHealed, result);
                System.out.println("Updated step " + (stepIndex + 1) + " status to failed: " + errorDetails + (wasHealed ? " (healing attempted)" : ""));
            }
        } catch (Exception e) {
            System.err.println("Failed to update step status in database: " + e.getMessage());
        }
        
        // Re-throw the original exception if the step failed
        if (stepException != null) {
            throw stepException;
        }
        
        System.out.println("<<< Individual Step Execution Complete <<<");
    }
    
    // Isolated execution context for each run
    private static class TestExecutionContext {
        public final String executionId;
        public final String promptId;
        public final String authToken;
        public final WebDriver driver;
        public final Date startTime;
        public Map<String, Object> policyConfig;  // Policy configuration
        public Map<String, String> initialVariables;  // Variables from API test data setup
        
        public TestExecutionContext(String executionId, String promptId, String authToken, WebDriver driver) {
            this.executionId = executionId;
            this.promptId = promptId;
            this.authToken = authToken;
            this.driver = driver;
            this.startTime = new Date();
            this.policyConfig = null;  // Will be set if provided
            this.initialVariables = new HashMap<>();  // Empty by default
        }
    }
}