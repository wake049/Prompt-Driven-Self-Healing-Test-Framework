package demo;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPut;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;

import java.util.HashMap;
import java.util.Map;

public class TestSelfHealing {
    private static final String SQL_BACKEND_URL = "http://localhost:3001";
    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static void main(String[] args) {
        System.out.println("=== Self-Healing Test Setup ===");
        System.out.println("This will break the username field locator to test self-healing...");
        
        try {
            // Break the username field CSS selector to test healing
            breakUsernameLocator();
            
            System.out.println("✓ Username locator has been intentionally broken!");
            System.out.println("✓ Now run the framework again to see self-healing in action:");
            System.out.println("  mvn exec:java \"-Dexec.mainClass=demo.Main\"");
            System.out.println();
            System.out.println("Expected behavior:");
            System.out.println("  1. Framework will try css=#BROKEN-LOCATOR (will fail)");
            System.out.println("  2. Self-healing will try alternatives from 'selectors' field");
            System.out.println("  3. Should succeed with an alternative locator");
            System.out.println("  4. Step will show as 'HEALED' instead of 'PASS'");
            
        } catch (Exception e) {
            System.err.println("Error setting up self-healing test: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void breakUsernameLocator() throws Exception {
        // We need to find the username element ID first, then update it
        String elementId = "01b013d1-47f7-423e-a0be-155114526508"; // From your previous output
        
        Map<String, Object> updateData = new HashMap<>();
        updateData.put("css_selector", "#BROKEN-LOCATOR-FOR-TESTING");
        
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpPut httpPut = new HttpPut(SQL_BACKEND_URL + "/api/elements/" + elementId);
            httpPut.setHeader("Content-Type", "application/json");
            
            String json = objectMapper.writeValueAsString(updateData);
            httpPut.setEntity(new StringEntity(json));
            
            try (CloseableHttpResponse response = httpClient.execute(httpPut)) {
                int statusCode = response.getStatusLine().getStatusCode();
                if (statusCode >= 200 && statusCode < 300) {
                    System.out.println("Successfully broke username locator for testing");
                } else {
                    String responseBody = org.apache.http.util.EntityUtils.toString(response.getEntity());
                    throw new Exception("HTTP " + statusCode + ": " + responseBody);
                }
            }
        }
    }
}