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

public class SqlTestStepRepository {
    private static final String SQL_BACKEND_URL = "http://localhost:8000";
    private static final String ELEMENTS_ENDPOINT = "/api/v1/sql/elements";
    private static final String SESSIONS_ENDPOINT = "/api/v1/sql/sessions";
    private final ObjectMapper objectMapper;

    public SqlTestStepRepository() {
        this.objectMapper = new ObjectMapper();
    }

    public List<Step> generateTestStepsFromElements(String sessionName) {
        List<Step> steps = new ArrayList<>();
        
        try {
            System.out.println("Loading test steps from unified API...");
            
            // Try to load the latest prompt/plan steps first
            steps = loadLatestPromptSteps();
            
            if (!steps.isEmpty()) {
                System.out.println("✓ Loaded " + steps.size() + " test steps from latest prompt");
                return steps;
            }
            
            System.out.println("No prompt steps found, trying element-based generation...");
            
            // Fallback to element-based generation (original logic)
            // First, find the session by name
            String sessionId = findSessionByName(sessionName);
            if (sessionId == null) {
                System.err.println("Session not found: " + sessionName);
                return steps;
            }
            
            // Get all elements for this session
            List<JsonNode> elements = getElementsForSession(sessionId);
            
            System.out.println("  Found " + elements.size() + " elements in session");
            for (JsonNode element : elements) {
                String elementId = element.get("element_id").asText();
                String tag = element.get("tag").asText();
                String cssSelector = element.has("css_selector") ? element.get("css_selector").asText() : "none";
                System.out.println("    - " + elementId + " (" + tag + ") → " + cssSelector);
            }
            
            if (elements.isEmpty()) {
                System.err.println("  No elements found for session: " + sessionName);
                return steps;
            }
            
            // Generate test steps based on element types and attributes
            steps = generateStepsFromElements(elements);
            
            if (!steps.isEmpty()) {
                System.out.println("✓ Generated " + steps.size() + " test steps from SQL backend elements");
            } else {
                System.out.println("⚠ Failed to generate any test steps from " + elements.size() + " elements");
            }
            
        } catch (Exception e) {
            System.err.println("Error generating test steps from SQL backend: " + e.getMessage());
        }
        
        return steps;
    }
    
    private List<Step> loadLatestPromptSteps() throws IOException {
        List<Step> steps = new ArrayList<>();
        
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            // Get the latest prompt with steps
            HttpGet httpGet = new HttpGet(SQL_BACKEND_URL + "/api/v1/sql/prompts?limit=1&order_by=created_at&order=desc");
            httpGet.setHeader("Accept", "application/json");
            
            try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                if (response.getStatusLine().getStatusCode() == 200) {
                    String responseBody = EntityUtils.toString(response.getEntity());
                    JsonNode rootNode = objectMapper.readTree(responseBody);
                    
                    if (rootNode.has("success") && rootNode.get("success").asBoolean()) {
                        JsonNode dataNode = rootNode.get("data");
                        if (dataNode != null && dataNode.isArray() && dataNode.size() > 0) {
                            JsonNode latestPrompt = dataNode.get(0);
                            System.out.println("Found latest prompt: " + latestPrompt.get("prompt").asText().substring(0, Math.min(50, latestPrompt.get("prompt").asText().length())) + "...");
                            
                            // Check if this prompt has steps
                            JsonNode stepsNode = latestPrompt.get("steps");
                            if (stepsNode != null && stepsNode.isArray()) {
                                System.out.println("Converting " + stepsNode.size() + " steps from prompt to Java Step objects...");
                                
                                for (JsonNode stepNode : stepsNode) {
                                    Step step = convertJsonStepToJavaStep(stepNode);
                                    if (step != null) {
                                        steps.add(step);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return steps;
    }
    
    private Step convertJsonStepToJavaStep(JsonNode stepNode) {
        try {
            String action = stepNode.get("action").asText();
            JsonNode argsNode = stepNode.get("args");
            String description = stepNode.has("description") ? stepNode.get("description").asText() : "";
            
            // Convert different action types to Java Step format
            switch (action) {
                case "open_url":
                    String url = argsNode.get("url").asText();
                    return new Step("page", "open", "", "page", url);
                    
                case "type":
                    String selector = argsNode.get("selector").asText();
                    String text = argsNode.has("text") ? argsNode.get("text").asText() : "";
                    return new Step("page", "enter_text", selector, generateElementId(selector), text);
                    
                case "click":
                    String clickSelector = argsNode.get("selector").asText();
                    return new Step("page", "click", clickSelector, generateElementId(clickSelector), "");
                    
                case "assert_visible":
                    String visibleSelector = argsNode.get("selector").asText();
                    return new Step("page", "verify_element", visibleSelector, generateElementId(visibleSelector), "");
                    
                case "assert_text":
                    String textSelector = argsNode.get("selector").asText();
                    String expectedText = argsNode.has("text") ? argsNode.get("text").asText() : "";
                    return new Step("page", "verify_text", textSelector, generateElementId(textSelector), expectedText);
                    
                case "wait_for":
                    String waitSelector = argsNode.get("selector").asText();
                    return new Step("page", "wait", waitSelector, generateElementId(waitSelector), "");
                    
                case "screenshot":
                    return new Step("page", "screenshot", "", "screenshot", description);
                    
                default:
                    System.out.println("Unknown action type: " + action + ", treating as verify_element");
                    String defaultSelector = argsNode.has("selector") ? argsNode.get("selector").asText() : "";
                    return new Step("page", "verify_element", defaultSelector, generateElementId(defaultSelector), "");
            }
            
        } catch (Exception e) {
            System.err.println("Error converting JSON step to Java Step: " + e.getMessage());
            return null;
        }
    }
    
    private String generateElementId(String selector) {
        // Generate a reasonable element ID from the selector
        if (selector.startsWith("#")) {
            return selector.substring(1); // Remove # from ID selector
        } else if (selector.startsWith(".")) {
            return selector.substring(1).replace(".", "_"); // Remove . and replace dots with underscores
        } else if (selector.contains("=")) {
            // Handle css= or xpath= prefixes
            return selector.substring(selector.indexOf("=") + 1).replaceAll("[^a-zA-Z0-9_-]", "_");
        } else {
            // Generate ID from selector
            return selector.replaceAll("[^a-zA-Z0-9_-]", "_");
        }
    }

    private String findSessionByName(String sessionName) throws IOException {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpGet httpGet = new HttpGet(SQL_BACKEND_URL + SESSIONS_ENDPOINT);
            httpGet.setHeader("Accept", "application/json");
            
            try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                if (response.getStatusLine().getStatusCode() == 200) {
                    String responseBody = EntityUtils.toString(response.getEntity());
                    JsonNode rootNode = objectMapper.readTree(responseBody);
                    
                    if (rootNode.has("success") && rootNode.get("success").asBoolean()) {
                        JsonNode dataNode = rootNode.get("data");
                        if (dataNode != null && dataNode.isArray()) {
                            for (JsonNode sessionNode : dataNode) {
                                String name = sessionNode.get("name").asText();
                                if (name.equals(sessionName)) {
                                    return sessionNode.get("id").asText();
                                }
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    private List<JsonNode> getElementsForSession(String sessionId) throws IOException {
        List<JsonNode> elements = new ArrayList<>();
        
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            String url = SQL_BACKEND_URL + ELEMENTS_ENDPOINT + "?session_id=" + 
                        URLEncoder.encode(sessionId, StandardCharsets.UTF_8) + "&limit=100";
            
            HttpGet httpGet = new HttpGet(url);
            httpGet.setHeader("Accept", "application/json");
            
            try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                if (response.getStatusLine().getStatusCode() == 200) {
                    String responseBody = EntityUtils.toString(response.getEntity());
                    JsonNode rootNode = objectMapper.readTree(responseBody);
                    
                    if (rootNode.has("success") && rootNode.get("success").asBoolean()) {
                        JsonNode dataNode = rootNode.get("data");
                        if (dataNode != null && dataNode.isArray()) {
                            for (JsonNode elementNode : dataNode) {
                                elements.add(elementNode);
                            }
                        }
                    }
                }
            }
        }
        
        return elements;
    }

    private List<Step> generateStepsFromElements(List<JsonNode> elements) {
        List<Step> steps = new ArrayList<>();
        
        // First, add an "open" step if we have a page URL
        String pageUrl = null;
        for (JsonNode element : elements) {
            JsonNode pageNode = element.get("page");
            if (pageNode != null && !pageNode.isNull()) {
                pageUrl = pageNode.asText();
                break;
            }
        }
        
        // Convert various page names to actual Swag Labs URL
        if (pageUrl != null) {
            String originalPage = pageUrl;
            String actualUrl = pageUrl;
            if (pageUrl.equals("Home") || pageUrl.equals("Inventory") || pageUrl.contains("saucedemo") || pageUrl.equals("login")) {
                actualUrl = "https://www.saucedemo.com";
                System.out.println("  Converting page '" + originalPage + "' to Swag Labs URL: " + actualUrl);
            }
            steps.add(new Step("page", "open", "", "page", actualUrl));
            System.out.println("  Added open step: " + actualUrl);
        }
        
        // Sort elements by typical interaction order
        List<JsonNode> sortedElements = sortElementsByInteractionOrder(elements);
        
        // Generate steps based on element types
        for (JsonNode element : sortedElements) {
            String elementId = element.get("element_id").asText();
            String tag = element.get("tag").asText().toLowerCase();
            String cssSelector = getElementSelector(element);
            String originalPageValue = element.get("page").asText(); // Store original database value
            String page = getPageFromUrl(originalPageValue); // Transform for step execution
            
            // Generate appropriate action based on element type and attributes
            String action = determineActionForElement(element);
            String data = determineDataForElement(element, action);
            
            if (action != null) {
                Step step = new Step(page, action, cssSelector, elementId, data, originalPageValue);
                steps.add(step);
                System.out.println("Generated step: " + action + " " + elementId + " (" + cssSelector + ") [original page: " + originalPageValue + "]");
            }
        }
        
        return steps;
    }

    private List<JsonNode> sortElementsByInteractionOrder(List<JsonNode> elements) {
        // Sort elements by common interaction patterns
        List<JsonNode> sorted = new ArrayList<>(elements);
        
        sorted.sort((a, b) -> {
            String idA = a.get("element_id").asText().toLowerCase();
            String idB = b.get("element_id").asText().toLowerCase();
            
            // Define interaction order priorities
            int priorityA = getInteractionPriority(idA);
            int priorityB = getInteractionPriority(idB);
            
            return Integer.compare(priorityA, priorityB);
        });
        
        return sorted;
    }

    private int getInteractionPriority(String elementId) {
        // Define typical UI interaction order
        if (elementId.contains("username") || elementId.contains("user") || elementId.contains("email")) return 1;
        if (elementId.contains("password") || elementId.contains("pass")) return 2;
        if (elementId.contains("login") || elementId.contains("signin") || elementId.contains("submit")) return 3;
        
        // After login - basic interaction elements
        if (elementId.contains("inventory") || elementId.contains("products") || elementId.contains("container")) return 4;
        if (elementId.contains("title") || elementId.contains("heading")) return 5;
        
        // Product interaction (add items)
        if (elementId.contains("add") && elementId.contains("backpack")) return 6; // Add backpack first
        if (elementId.contains("add") && !elementId.contains("backpack")) return 7; // Other add buttons
        
        // Navigation to cart
        if (elementId.contains("cart") || elementId.contains("basket")) return 8;
        
        // Cart verification
        if (elementId.contains("item") && (elementId.contains("name") || elementId.contains("desc"))) return 9;
        
        // Skip conditional elements entirely (they get filtered out by shouldSkipElement)
        if (elementId.contains("remove") || elementId.contains("checkout") || elementId.contains("finish")) return 999;
        
        return 100; // Default priority for other elements
    }

    private String determineActionForElement(JsonNode element) {
        String tag = element.get("tag").asText().toLowerCase();
        String elementId = element.get("element_id").asText().toLowerCase();
        JsonNode attributesNode = element.get("attributes");
        
        // Skip conditional elements that require specific preconditions
        if (shouldSkipElement(elementId)) {
            return null; // Skip this element
        }
        
        // Determine action based on element type and purpose
        if (tag.equals("input")) {
            if (attributesNode != null) {
                JsonNode typeNode = attributesNode.get("type");
                if (typeNode != null) {
                    String inputType = typeNode.asText().toLowerCase();
                    if (inputType.equals("submit") || inputType.equals("button")) {
                        return "click";
                    }
                    if (inputType.equals("text") || inputType.equals("password") || inputType.equals("email")) {
                        return "enter_text";
                    }
                }
            }
            // Default for input elements
            if (elementId.contains("button") || elementId.contains("submit") || elementId.contains("login")) {
                return "click";
            } else {
                return "enter_text";
            }
        }
        
        if (tag.equals("button") || tag.equals("a")) {
            return "click";
        }
        
        if (tag.equals("div") || tag.equals("span") || tag.equals("p")) {
            if (elementId.contains("container") || elementId.contains("list") || elementId.contains("item")) {
                return "verify_element";
            } else {
                return "verify_text";
            }
        }
        
        // Default action
        return "verify_element";
    }
    
    private boolean shouldSkipElement(String elementId) {
        // Skip remove buttons - they only exist after adding items
        if (elementId.contains("remove")) {
            System.out.println("  Skipping conditional element: " + elementId + " (remove buttons require items to be added first)");
            return true;
        }
        
        // Skip elements that are recorded but shouldn't be in a basic test flow
        if (elementId.contains("checkout") && !elementId.contains("continue")) {
            System.out.println("  Skipping conditional element: " + elementId + " (checkout requires cart items)");
            return true;
        }
        
        // Skip specific complex elements that require setup
        if (elementId.contains("continue-shopping") || elementId.contains("finish")) {
            System.out.println("  Skipping conditional element: " + elementId + " (requires specific workflow state)");
            return true;
        }
        
        return false;
    }

    private String determineDataForElement(JsonNode element, String action) {
        String elementId = element.get("element_id").asText().toLowerCase();
        
        if (action.equals("enter_text")) {
            // Provide test data based on element purpose
            if (elementId.contains("username") || elementId.contains("user")) {
                return "standard_user";
            }
            if (elementId.contains("password") || elementId.contains("pass")) {
                return "secret_sauce";
            }
            if (elementId.contains("email")) {
                return "test@example.com";
            }
            if (elementId.contains("name")) {
                return "Test User";
            }
            return "test_data";
        }
        
        if (action.equals("verify_text")) {
            // Provide expected text based on element purpose
            if (elementId.contains("title") || elementId.contains("heading")) {
                return "Products";
            }
            if (elementId.contains("item") || elementId.contains("product")) {
                return "Sauce Labs Backpack";
            }
            return "expected_text";
        }
        
        return "";
    }

    private String getElementSelector(JsonNode element) {
        // Prefer CSS selector, fall back to xpath
        JsonNode cssSelectorNode = element.get("css_selector");
        if (cssSelectorNode != null && !cssSelectorNode.isNull()) {
            String cssSelector = cssSelectorNode.asText();
            if (!cssSelector.startsWith("css=")) {
                return "css=" + cssSelector;
            }
            return cssSelector;
        }
        
        JsonNode xpathNode = element.get("xpath");
        if (xpathNode != null && !xpathNode.isNull()) {
            String xpath = xpathNode.asText();
            if (!xpath.startsWith("xpath=")) {
                return "xpath=" + xpath;
            }
            return xpath;
        }
        
        return "css=unknown";
    }

    private String getPageFromUrl(String pageUrl) {
        if (pageUrl == null) return "unknown";
        
        // Handle simple page names first (not URLs)
        if (!pageUrl.contains("://")) {
            // This is a simple page name, not a URL - use it as-is
            return pageUrl.toLowerCase().trim();
        }
        
        // For actual URLs, extract the page identifier
        try {
            java.net.URL url = new java.net.URL(pageUrl);
            String host = url.getHost();
            String path = url.getPath();
            
            // Use the host as the page identifier
            if (host != null && !host.isEmpty()) {
                return host.replaceAll("\\.", "_");
            }
            
            return "unknown";
        } catch (Exception e) {
            // If URL parsing fails, treat it as a simple page name
            return pageUrl.toLowerCase().trim();
        }
    }

    public boolean isAvailable() {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpGet httpGet = new HttpGet(SQL_BACKEND_URL + "/health");
            httpGet.setHeader("Accept", "application/json");
            
            try (CloseableHttpResponse response = httpClient.execute(httpGet)) {
                return response.getStatusLine().getStatusCode() == 200;
            }
        } catch (Exception e) {
            System.out.println("Unified API not available at " + SQL_BACKEND_URL + ": " + e.getMessage());
            return false;
        }
    }
}