package demo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class SqlElementRepository {
    private static final String SQL_BACKEND_URL = System.getenv("UNIFIED_API_URL") != null ? 
        System.getenv("UNIFIED_API_URL") : 
        "https://testhelix.com";
    private static final String ELEMENTS_ENDPOINT = "/api/elements";
    private final ObjectMapper objectMapper;

    public SqlElementRepository() {
        this.objectMapper = new ObjectMapper();
    }

    public List<String> getAlternatives(String elementId, String page) {
        return getAlternatives(elementId, page, null);
    }

    public List<String> getAlternatives(String elementId, String page, String selectorPolicy) {
        try {
            System.out.println("Fetching alternatives from SQL backend for element: " + elementId + " on page: " + page + " with policy: " + selectorPolicy);
            
            // Try to find element by element_id and page
            List<String> alternatives = fetchAlternativesFromApi(elementId, page, selectorPolicy);
            
            if (alternatives.isEmpty()) {
                // Try to find element by element_id on any page (page = "*")
                alternatives = fetchAlternativesFromApi(elementId, null, selectorPolicy);
            }
            
            if (!alternatives.isEmpty()) {
                System.out.println("Found " + alternatives.size() + " alternatives from SQL backend for element: " + elementId);
            } else {
                System.out.println("No alternatives found in SQL backend for element: " + elementId);
            }
            
            return alternatives;
        } catch (Exception e) {
            System.err.println("Error fetching alternatives from SQL backend: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private List<String> fetchAlternativesFromApi(String elementId, String page, String selectorPolicy) throws IOException {
        List<String> alternatives = new ArrayList<>();
        List<String> preferredSelectors = new ArrayList<>();
        List<String> fallbackSelectors = new ArrayList<>();
        
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            // Build query parameters
            StringBuilder urlBuilder = new StringBuilder(SQL_BACKEND_URL + ELEMENTS_ENDPOINT + "?");
            
            if (page != null && !page.isEmpty()) {
                urlBuilder.append("page=").append(URLEncoder.encode(page, StandardCharsets.UTF_8)).append("&");
            }
            urlBuilder.append("limit=100"); // Get up to 100 elements
            
            HttpGet httpGet = new HttpGet(urlBuilder.toString());
            httpGet.setHeader("Accept", "application/json");
            
            try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                int statusCode = response.getStatusLine().getStatusCode();
                
                if (statusCode == 200) {
                    String responseBody = EntityUtils.toString(response.getEntity());
                    JsonNode rootNode = objectMapper.readTree(responseBody);
                    
                    if (rootNode.has("success") && rootNode.get("success").asBoolean()) {
                        JsonNode dataNode = rootNode.get("data");
                        
                        if (dataNode != null && dataNode.isArray()) {
                            for (JsonNode elementNode : dataNode) {
                                String dbElementId = elementNode.get("element_id").asText();
                                
                                // Check if this is the element we're looking for
                                if (dbElementId.equals(elementId)) {
                                    // Extract selectors from the element
                                    JsonNode selectorsNode = elementNode.get("selectors");
                                    if (selectorsNode != null && selectorsNode.isArray()) {
                                        for (JsonNode selectorNode : selectorsNode) {
                                            String selector = selectorNode.asText();
                                            if (selector != null && !selector.trim().isEmpty()) {
                                                alternatives.add(selector);
                                            }
                                        }
                                    }
                                    
                                    // Also add xpath and css_selector if available
                                    JsonNode xpathNode = elementNode.get("xpath");
                                    if (xpathNode != null && !xpathNode.isNull()) {
                                        String xpath = xpathNode.asText();
                                        if (xpath != null && !xpath.trim().isEmpty()) {
                                            String selector = "xpath=" + xpath;
                                            if ("robust".equals(selectorPolicy)) {
                                                preferredSelectors.add(selector);
                                            } else {
                                                fallbackSelectors.add(selector);
                                            }
                                        }
                                    }
                                    
                                    JsonNode cssSelectorNode = elementNode.get("css_selector");
                                    if (cssSelectorNode != null && !cssSelectorNode.isNull()) {
                                        String cssSelector = cssSelectorNode.asText();
                                        if (cssSelector != null && !cssSelector.trim().isEmpty()) {
                                            String selector = cssSelector.startsWith("css=") ? cssSelector : "css=" + cssSelector;
                                            if ("fast".equals(selectorPolicy) || "balanced".equals(selectorPolicy)) {
                                                preferredSelectors.add(selector);
                                            } else {
                                                fallbackSelectors.add(selector);
                                            }
                                        }
                                    }
                                    
                                    // Add preferred selectors first, then fallback selectors
                                    alternatives.addAll(preferredSelectors);
                                    alternatives.addAll(fallbackSelectors);
                                    
                                    System.out.println("  Policy-aware selection: " + preferredSelectors.size() + " preferred (" + selectorPolicy + "), " + fallbackSelectors.size() + " fallback");
                                    
                                    // Log detailed selector analysis for debugging
                                    if (preferredSelectors.size() > 0) {
                                        System.out.println("  ✓ Preferred " + selectorPolicy + " selectors: " + preferredSelectors);
                                    }
                                    if (fallbackSelectors.size() > 0) {
                                        System.out.println("  ⚠ Fallback selectors (policy mismatch): " + fallbackSelectors);
                                    }
                                    
                                    break; // Found the element, no need to continue
                                }
                            }
                        }
                    }
                } else {
                    System.err.println("SQL backend returned status code: " + statusCode);
                }
            }
        }
        
        return alternatives;
    }

    public void saveHealingSuccess(String elementId, String page, String originalLocator, String healedLocator) {
        // In a real implementation, you might want to update the database with successful healing
        // For now, we'll just log it
        System.out.println("Healing success recorded: " + elementId + " healed from " + originalLocator + " to " + healedLocator);
        
        // TODO: Could add an API call to update the element in the database with the new working locator
        // or create a healing log entry in the database
    }

    public boolean isAvailable() {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpGet httpGet = new HttpGet(SQL_BACKEND_URL + "/health");
            httpGet.setHeader("Accept", "application/json");
            
            try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                int statusCode = response.getStatusLine().getStatusCode();
                return statusCode == 200;
            }
        } catch (Exception e) {
            return false;
        }
    }

    public int getElementCount() {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpGet httpGet = new HttpGet(SQL_BACKEND_URL + ELEMENTS_ENDPOINT + "?limit=1");
            httpGet.setHeader("Accept", "application/json");
            
            try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                if (response.getStatusLine().getStatusCode() == 200) {
                    String responseBody = EntityUtils.toString(response.getEntity());
                    JsonNode rootNode = objectMapper.readTree(responseBody);
                    
                    if (rootNode.has("success") && rootNode.get("success").asBoolean()) {
                        JsonNode dataNode = rootNode.get("data");
                        if (dataNode != null && dataNode.isArray()) {
                            return dataNode.size(); // This is not the total count, just sample
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Error getting element count: " + e.getMessage());
        }
        return 0;
    }
}