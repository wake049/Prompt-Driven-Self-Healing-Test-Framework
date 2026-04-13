package demo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.util.EntityUtils;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;

public class HealingReviewService {
    private static final String REVIEW_API_URL = System.getenv("UNIFIED_API_URL") != null ? 
        System.getenv("UNIFIED_API_URL") + "/api/v1/healing/submit" : 
        "https://fluxtest.io/api/v1/healing/submit";
    private final ObjectMapper objectMapper;

    public HealingReviewService() {
        this.objectMapper = new ObjectMapper();
    }

    public void submitHealingData(List<Map<String, Object>> healingAttempts, String sessionId, String testRunId) {
        try {
            System.out.println("Submitting " + healingAttempts.size() + " healing attempts for review...");
            
            // Create submission payload
            Map<String, Object> submission = new HashMap<>();
            submission.put("session_id", sessionId);
            submission.put("test_run_id", testRunId);
            submission.put("healing_attempts", healingAttempts);
            submission.put("healing_attempts", healingAttempts);
            submission.put("source", "java-framework"); // Add source identification
            
            // Convert to JSON
            String jsonPayload = objectMapper.writeValueAsString(submission);
            
            // Submit to review API
            try (CloseableHttpClient httpClient = HttpClientFactory.create()) {
                HttpPost httpPost = new HttpPost(REVIEW_API_URL);
                httpPost.setHeader("Content-Type", "application/json");
                
                // Add authentication if token is available
                String authToken = System.getenv("API_AUTH_TOKEN");
                if (authToken != null && !authToken.isEmpty()) {
                    httpPost.setHeader("Authorization", "Bearer " + authToken);
                }
                
                httpPost.setEntity(new StringEntity(jsonPayload, "UTF-8"));
                
                try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                    int statusCode = response.getStatusLine().getStatusCode();
                    String responseBody = EntityUtils.toString(response.getEntity());
                    
                    if (statusCode == 200) {
                        JsonNode responseJson = objectMapper.readTree(responseBody);
                        int successfulHealings = responseJson.get("successful_healings").asInt();
                        int createdReviews = responseJson.get("created_reviews").asInt();
                        String message = responseJson.get("message").asText();
                        System.out.println("✓ Successfully submitted healing data: " + message);
                        System.out.println("  Successful healings: " + successfulHealings);
                        System.out.println("  Review items created: " + createdReviews);
                    } else {
                        System.err.println("⚠ Failed to submit healing data. Status: " + statusCode);
                        System.err.println("Response: " + responseBody);
                    }
                }
            }
            
        } catch (Exception e) {
            System.err.println("⚠ Error submitting healing data for review: " + e.getMessage());
            // Don't fail the test run if review submission fails
        }
    }

    public boolean isReviewApiAvailable() {
        try (CloseableHttpClient httpClient = HttpClientFactory.create()) {
            String healthUrl = System.getenv("UNIFIED_API_URL") != null ? 
                System.getenv("UNIFIED_API_URL") + "/health" : 
                "https://fluxtest.io/health";
            HttpGet httpGet = new HttpGet(healthUrl);
            httpGet.setHeader("Accept", "application/json");
            
            try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                return response.getStatusLine().getStatusCode() < 500;
            }
        } catch (Exception e) {
            return false;
        }
    }

    public static Map<String, Object> createHealingAttempt(
            String elementId,
            String page,
            String originalLocator,
            List<String> attemptedAlternatives,
            String healedLocator,
            String result,
            String error) {
        
        Map<String, Object> attempt = new HashMap<>();
        attempt.put("timestamp", java.time.LocalDateTime.now().toString());
        attempt.put("elementId", elementId);
        attempt.put("element_identifier", elementId); // Critical: This must match recorded_elements.element_identifier
        attempt.put("logical_key", elementId);
        attempt.put("page", page != null ? page : "unknown");
        attempt.put("originalLocator", originalLocator);
        attempt.put("current_selectors", originalLocator != null ? List.of(originalLocator) : new ArrayList<>());
        attempt.put("suggested_selectors", healedLocator != null ? List.of(healedLocator) : new ArrayList<>());
        attempt.put("attemptedAlternatives", attemptedAlternatives != null ? attemptedAlternatives : new ArrayList<>());
        attempt.put("healedLocator", healedLocator);
        attempt.put("result", result);
        attempt.put("error", error);
        attempt.put("healingSource", "java-framework");
        
        // Add identity data structure that matches the expected format
        Map<String, Object> identityData = new HashMap<>();
        identityData.put("timestamp", java.time.LocalDateTime.now().toString());
        identityData.put("healingSource", "java-framework");
        identityData.put("attemptedAlternatives", attemptedAlternatives != null ? attemptedAlternatives : new ArrayList<>());
        attempt.put("identity_data", identityData);
        
        return attempt;
    }
}