package demo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.util.EntityUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * API Test Data Service
 * Executes API calls to create precondition data before UI tests.
 * 
 * Example use case: Before testing "Change Booking" flow, this service
 * calls the booking API to create an active booking, then passes the
 * booking_id to the UI test for use in the change flow.
 */
@Service
public class ApiTestDataService {
    
    @Value("${app.unified-api.url}")
    private String unifiedApiUrl;
    
    private static final String API_AUTH_TOKEN = System.getenv("API_AUTH_TOKEN");
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * Result of executing test data setup(s)
     */
    public static class TestDataResult {
        public boolean success;
        public Map<String, String> variables;
        public List<SetupExecutionResult> results;
        public String errorMessage;
        public int executionTimeMs;
        
        public TestDataResult() {
            this.variables = new HashMap<>();
            this.results = new ArrayList<>();
        }
    }
    
    /**
     * Result of a single setup execution
     */
    public static class SetupExecutionResult {
        public String setupId;
        public String setupName;
        public boolean success;
        public String requestUrl;
        public String requestMethod;
        public Integer responseStatus;
        public int durationMs;
        public Map<String, String> extractedVariables;
        public String errorMessage;
    }
    
    /**
     * Configuration for API test data execution
     */
    public static class TestDataConfig {
        public String promptId;              // Execute all setups linked to this prompt
        public List<String> setupIds;        // Or execute specific setup IDs
        public Map<String, String> variableOverrides;  // Override variable values
        public boolean skipOnFailure = false; // Continue UI test even if data setup fails
        
        public TestDataConfig() {
            this.setupIds = new ArrayList<>();
            this.variableOverrides = new HashMap<>();
        }
    }
    
    /**
     * Execute test data setups to create precondition data.
     * Calls the unified API's /api/v1/test-data/execute endpoint.
     * 
     * @param config Configuration specifying which setups to execute
     * @param authToken Authentication token for API calls
     * @return TestDataResult with extracted variables for use in UI test
     */
    public TestDataResult executeTestDataSetups(TestDataConfig config, String authToken) {
        TestDataResult result = new TestDataResult();
        long startTime = System.currentTimeMillis();
        
        System.out.println("=== API TEST DATA SERVICE ===");
        System.out.println("Executing test data setups...");
        
        if (config == null) {
            System.out.println("No test data configuration provided, skipping.");
            result.success = true;
            return result;
        }
        
        // Determine what to execute
        boolean hasPromptId = config.promptId != null && !config.promptId.isEmpty();
        boolean hasSetupIds = config.setupIds != null && !config.setupIds.isEmpty();
        
        if (!hasPromptId && !hasSetupIds) {
            System.out.println("No prompt_id or setup_ids provided, skipping test data setup.");
            result.success = true;
            return result;
        }
        
        try {
            String executeUrl = unifiedApiUrl + "/api/v1/test-data/execute";
            System.out.println("Calling test data execute endpoint: " + executeUrl);
            
            try (CloseableHttpClient httpClient = HttpClientFactory.create()) {
                HttpPost httpPost = new HttpPost(executeUrl);
                httpPost.setHeader("Content-Type", "application/json");
                
                // Add authorization
                String token = authToken != null ? authToken : API_AUTH_TOKEN;
                if (token != null && !token.isEmpty()) {
                    httpPost.setHeader("Authorization", "Bearer " + token);
                }
                
                // Build request body
                Map<String, Object> requestBody = new HashMap<>();
                if (hasPromptId) {
                    requestBody.put("prompt_id", config.promptId);
                    System.out.println("Executing setups for prompt: " + config.promptId);
                } else if (hasSetupIds) {
                    requestBody.put("setup_ids", config.setupIds);
                    System.out.println("Executing specific setups: " + config.setupIds);
                }
                
                if (config.variableOverrides != null && !config.variableOverrides.isEmpty()) {
                    requestBody.put("variable_overrides", config.variableOverrides);
                    System.out.println("Variable overrides: " + config.variableOverrides);
                }
                
                String jsonBody = objectMapper.writeValueAsString(requestBody);
                httpPost.setEntity(new StringEntity(jsonBody));
                
                System.out.println("Request body: " + jsonBody);
                
                try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                    String responseText = EntityUtils.toString(response.getEntity());
                    int statusCode = response.getStatusLine().getStatusCode();
                    
                    System.out.println("Response status: " + statusCode);
                    System.out.println("Response body: " + (responseText.length() > 500 ? 
                        responseText.substring(0, 500) + "..." : responseText));
                    
                    if (statusCode >= 200 && statusCode < 300) {
                        // Parse response
                        JsonNode responseJson = objectMapper.readTree(responseText);
                        
                        if (responseJson.has("success") && responseJson.get("success").asBoolean()) {
                            JsonNode data = responseJson.get("data");
                            
                            // Extract combined variables
                            if (data.has("combined_variables")) {
                                JsonNode combinedVars = data.get("combined_variables");
                                Iterator<Map.Entry<String, JsonNode>> fields = combinedVars.fields();
                                while (fields.hasNext()) {
                                    Map.Entry<String, JsonNode> field = fields.next();
                                    String value = field.getValue().isTextual() ? 
                                        field.getValue().asText() : field.getValue().toString();
                                    result.variables.put(field.getKey(), value);
                                }
                                System.out.println("✓ Extracted " + result.variables.size() + " variables from API test data");
                                for (Map.Entry<String, String> var : result.variables.entrySet()) {
                                    System.out.println("  ${" + var.getKey() + "} = " + var.getValue());
                                }
                            }
                            
                            // Parse individual results
                            if (data.has("results")) {
                                JsonNode resultsArray = data.get("results");
                                for (JsonNode r : resultsArray) {
                                    SetupExecutionResult ser = new SetupExecutionResult();
                                    ser.setupId = r.has("setup_id") ? r.get("setup_id").asText() : null;
                                    ser.setupName = r.has("setup_name") ? r.get("setup_name").asText() : null;
                                    ser.success = r.has("success") && r.get("success").asBoolean();
                                    ser.requestUrl = r.has("request_url") ? r.get("request_url").asText() : null;
                                    ser.requestMethod = r.has("request_method") ? r.get("request_method").asText() : null;
                                    ser.responseStatus = r.has("response_status") ? r.get("response_status").asInt() : null;
                                    ser.durationMs = r.has("duration_ms") ? r.get("duration_ms").asInt() : 0;
                                    ser.errorMessage = r.has("error_message") ? r.get("error_message").asText() : null;
                                    
                                    // Extract variables from this result
                                    ser.extractedVariables = new HashMap<>();
                                    if (r.has("extracted_variables")) {
                                        JsonNode extractedVars = r.get("extracted_variables");
                                        Iterator<Map.Entry<String, JsonNode>> extractedFields = extractedVars.fields();
                                        while (extractedFields.hasNext()) {
                                            Map.Entry<String, JsonNode> field = extractedFields.next();
                                            String value = field.getValue().isTextual() ? 
                                                field.getValue().asText() : field.getValue().toString();
                                            ser.extractedVariables.put(field.getKey(), value);
                                        }
                                    }
                                    
                                    result.results.add(ser);
                                    System.out.println("  Setup '" + ser.setupName + "': " + 
                                        (ser.success ? "✓ SUCCESS" : "✗ FAILED") + 
                                        " (" + ser.durationMs + "ms)");
                                }
                            }
                            
                            // Check overall success
                            boolean allSuccess = data.has("success") ? data.get("success").asBoolean() : true;
                            int failedCount = data.has("failed_setups") ? data.get("failed_setups").asInt() : 0;
                            
                            result.success = allSuccess || failedCount == 0;
                            
                            if (!result.success && !config.skipOnFailure) {
                                result.errorMessage = "Test data setup failed: " + failedCount + " setup(s) failed";
                            }
                            
                        } else {
                            result.success = false;
                            result.errorMessage = responseJson.has("detail") ? 
                                responseJson.get("detail").asText() : "API returned unsuccessful response";
                        }
                    } else {
                        result.success = false;
                        result.errorMessage = "API returned HTTP " + statusCode + ": " + responseText;
                    }
                }
            }
            
        } catch (Exception e) {
            System.err.println("Error executing test data setups: " + e.getMessage());
            e.printStackTrace();
            result.success = false;
            result.errorMessage = "Exception: " + e.getMessage();
        }
        
        result.executionTimeMs = (int)(System.currentTimeMillis() - startTime);
        System.out.println("Test data setup completed in " + result.executionTimeMs + "ms");
        System.out.println("Overall success: " + result.success);
        System.out.println("=== END API TEST DATA SERVICE ===\n");
        
        return result;
    }
    
    /**
     * Get available test data setups for a prompt.
     * Useful for displaying what precondition data will be created.
     * 
     * @param promptId The prompt/test ID
     * @param authToken Authentication token
     * @return List of setup configurations
     */
    public List<Map<String, Object>> getSetupsForPrompt(String promptId, String authToken) {
        List<Map<String, Object>> setups = new ArrayList<>();
        
        try {
            String url = unifiedApiUrl + "/api/v1/test-data/prompts/" + promptId + "/setups";
            
            try (CloseableHttpClient httpClient = HttpClientFactory.create()) {
                HttpGet httpGet = new HttpGet(url);
                httpGet.setHeader("Content-Type", "application/json");
                
                String token = authToken != null ? authToken : API_AUTH_TOKEN;
                if (token != null && !token.isEmpty()) {
                    httpGet.setHeader("Authorization", "Bearer " + token);
                }
                
                try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                    String responseText = EntityUtils.toString(response.getEntity());
                    int statusCode = response.getStatusLine().getStatusCode();
                    
                    if (statusCode >= 200 && statusCode < 300) {
                        JsonNode responseJson = objectMapper.readTree(responseText);
                        if (responseJson.has("data")) {
                            JsonNode dataArray = responseJson.get("data");
                            for (JsonNode setup : dataArray) {
                                Map<String, Object> setupMap = objectMapper.convertValue(setup, Map.class);
                                setups.add(setupMap);
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error fetching setups for prompt: " + e.getMessage());
        }
        
        return setups;
    }
    
    /**
     * Execute a single setup by ID.
     * 
     * @param setupId The setup ID to execute
     * @param variableOverrides Optional variable overrides
     * @param authToken Authentication token
     * @return TestDataResult with extracted variables
     */
    public TestDataResult executeSingleSetup(String setupId, Map<String, String> variableOverrides, String authToken) {
        TestDataConfig config = new TestDataConfig();
        config.setupIds = Collections.singletonList(setupId);
        config.variableOverrides = variableOverrides != null ? variableOverrides : new HashMap<>();
        return executeTestDataSetups(config, authToken);
    }
    
    /**
     * Execute all setups linked to a prompt.
     * Variables are chained - output from earlier setups are available to later ones.
     * 
     * @param promptId The prompt/test ID
     * @param variableOverrides Optional variable overrides
     * @param authToken Authentication token
     * @return TestDataResult with combined variables from all setups
     */
    public TestDataResult executeSetupsForPrompt(String promptId, Map<String, String> variableOverrides, String authToken) {
        TestDataConfig config = new TestDataConfig();
        config.promptId = promptId;
        config.variableOverrides = variableOverrides != null ? variableOverrides : new HashMap<>();
        return executeTestDataSetups(config, authToken);
    }
}
