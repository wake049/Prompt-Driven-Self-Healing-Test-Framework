package demo;

import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

public class SelfHealing {
    private WebDriver driver;
    private ElementRepository elementRepository;
    private SqlElementRepository sqlElementRepository;
    private List<HealingLogEntry> healingLog;
    private static final String HEALING_LOG_FILE = "healing_log.json";
    private static final String HEALING_SERVICE_URL = "http://localhost:8000/api/v1/healing/submit";
    private static final String SELECTOR_GENERATION_URL = "http://localhost:8000/api/v1/selectors/generate";
    private boolean useSqlBackend;

    public SelfHealing(WebDriver driver, ElementRepository elementRepository) {
        this.driver = driver;
        this.elementRepository = elementRepository;
        this.sqlElementRepository = new SqlElementRepository();
        this.healingLog = new ArrayList<>();
        
        // Check if SQL backend is available
        this.useSqlBackend = sqlElementRepository.isAvailable();
        if (useSqlBackend) {
            System.out.println("✓ SQL Backend is available - using database for element alternatives");
        } else {
            System.out.println("⚠ SQL Backend not available - falling back to JSON file repository");
        }
    }

    public HealingResult attemptHealing(Step step) {
        String originalLocator = step.getLocator();
        String elementId = step.getElementId();
        String page = step.getOriginalPage(); // Use original page value for database lookup
        
        System.out.println("Attempting self-healing for element: " + elementId + " with locator: " + originalLocator);
        
        HealingLogEntry logEntry = new HealingLogEntry();
        logEntry.setTimestamp(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        logEntry.setElementId(elementId);
        logEntry.setPage(page);
        logEntry.setOriginalLocator(originalLocator);
        logEntry.setAttemptedAlternatives(new ArrayList<>());
        
        List<String> alternatives;
        
        if (useSqlBackend) {
            alternatives = sqlElementRepository.getAlternatives(elementId, page, step.getSelectorPolicy());
        } else {
            alternatives = elementRepository.getAlternatives(elementId, page);
        }
        
        if (alternatives.isEmpty()) {
            System.out.println("No alternatives found in repository, trying AI-generated alternatives...");
            
            // Try to get AI-generated alternatives
            alternatives = getAIGeneratedAlternatives(step);
            
            if (alternatives.isEmpty()) {
                logEntry.setResult("NO_ALTERNATIVES");
                logEntry.setError("No alternative locators found in repository or AI generation");
                healingLog.add(logEntry);
                saveHealingLog();
                
                // Send POST request for healing failure
                sendHealingFailureRequest(step, "No alternative locators found", new ArrayList<>());
                
                return new HealingResult(false, originalLocator, null, 
                    "No alternative locators found for element: " + elementId);
            } else {
                System.out.println("✓ AI generated " + alternatives.size() + " alternative selectors");
            }
        }

        for (String alternative : alternatives) {
            try {
                System.out.println("Trying alternative locator: " + alternative);
                logEntry.getAttemptedAlternatives().add(alternative);
                
                WebElement element = findElementByLocator(alternative);
                if (element != null && element.isDisplayed()) {
                    logEntry.setResult("SUCCESS");
                    logEntry.setHealedLocator(alternative);
                    healingLog.add(logEntry);
                    saveHealingLog();
                    
                    // Record successful healing in SQL backend if available
                    if (useSqlBackend) {
                        sqlElementRepository.saveHealingSuccess(elementId, page, originalLocator, alternative);
                    }
                    
                    // Send healing success to unified API
                    sendHealingSuccessRequest(step, alternative, logEntry.getAttemptedAlternatives());
                    
                    System.out.println("✓ Self-healing successful! Found element with: " + alternative);
                    return new HealingResult(true, originalLocator, alternative, null);
                }
            } catch (Exception e) {
                System.out.println("  ✗ Alternative failed: " + e.getMessage());
                // Continue to next alternative
            }
        }
        
        // All alternatives failed
        logEntry.setResult("ALL_ALTERNATIVES_FAILED");
        logEntry.setError("All alternative locators failed");
        healingLog.add(logEntry);
        saveHealingLog();
        
        // Send POST request for complete healing failure
        sendHealingFailureRequest(step, "All alternative locators failed", logEntry.getAttemptedAlternatives());
        
        return new HealingResult(false, originalLocator, null, 
            "All " + alternatives.size() + " alternative locators failed");
    }

    private WebElement findElementByLocator(String locator) {
        By byLocator = parseLocator(locator);
        if (byLocator == null) {
            throw new IllegalArgumentException("Invalid locator format: " + locator);
        }
        
        try {
            return driver.findElement(byLocator);
        } catch (NoSuchElementException e) {
            return null;
        }
    }

    private By parseLocator(String locator) {
        if (locator.startsWith("css=")) {
            return By.cssSelector(locator.substring(4));
        } else if (locator.startsWith("xpath=")) {
            return By.xpath(locator.substring(6));
        } else if (locator.startsWith("id=")) {
            return By.id(locator.substring(3));
        } else if (locator.startsWith("name=")) {
            return By.name(locator.substring(5));
        } else if (locator.startsWith("class=")) {
            return By.className(locator.substring(6));
        } else if (locator.startsWith("tag=")) {
            return By.tagName(locator.substring(4));
        } else {
            // Default to CSS selector if no prefix
            return By.cssSelector(locator);
        }
    }

    private List<String> getAIGeneratedAlternatives(Step step) {
        List<String> alternatives = new ArrayList<>();
        
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpPost httpPost = new HttpPost(SELECTOR_GENERATION_URL);
            httpPost.setHeader("Content-Type", "application/json");
            
            // Create request payload for AI selector generation
            String jsonPayload = String.format(
                "{" +
                "\"original_selector\":\"%s\"," +
                "\"element_id\":\"%s\"," +
                "\"page\":\"%s\"," +
                "\"action_type\":\"%s\"" +
                "}",
                step.getLocator(),
                step.getElementId(),
                step.getOriginalPage(),
                "verify_text" // Default action type, could be enhanced to detect actual action
            );
            
            httpPost.setEntity(new StringEntity(jsonPayload));
            
            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                int statusCode = response.getStatusLine().getStatusCode();
                if (statusCode == 200) {
                    // Parse the JSON response to extract alternatives
                    String responseBody = new String(response.getEntity().getContent().readAllBytes());
                    alternatives = parseAlternativesFromResponse(responseBody);
                    System.out.println("✓ AI selector generation succeeded, got " + alternatives.size() + " alternatives");
                } else {
                    System.out.println("✗ AI selector generation failed. Status: " + statusCode);
                }
            }
        } catch (Exception e) {
            System.out.println("⚠ Warning: Could not get AI-generated alternatives: " + e.getMessage());
        }
        
        return alternatives;
    }
    
    private List<String> parseAlternativesFromResponse(String responseBody) {
        List<String> alternatives = new ArrayList<>();
        
        try {
            // Simple JSON parsing - extract selector values from alternatives array
            // This is a basic implementation - could be enhanced with proper JSON parsing library
            String[] lines = responseBody.split("\"selector\":");
            for (int i = 1; i < lines.length; i++) {
                String line = lines[i];
                int startQuote = line.indexOf("\"");
                int endQuote = line.indexOf("\"", startQuote + 1);
                if (startQuote != -1 && endQuote != -1) {
                    String selector = line.substring(startQuote + 1, endQuote);
                    alternatives.add(selector);
                }
            }
        } catch (Exception e) {
            System.out.println("⚠ Warning: Could not parse AI response: " + e.getMessage());
        }
        
        return alternatives;
    }

    private void sendHealingSuccessRequest(Step step, String healedLocator, List<String> attemptedAlternatives) {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpPost httpPost = new HttpPost(HEALING_SERVICE_URL);
            httpPost.setHeader("Content-Type", "application/json");
            
            // Create healing submission for success
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            
            // Build attempted alternatives JSON array
            StringBuilder alternativesJson = new StringBuilder("[");
            for (int i = 0; i < attemptedAlternatives.size(); i++) {
                if (i > 0) alternativesJson.append(",");
                alternativesJson.append("\"").append(attemptedAlternatives.get(i)).append("\"");
            }
            alternativesJson.append("]");
            
            String jsonPayload = String.format(
                "{\"healing_attempts\":[{" +
                "\"timestamp\":\"%s\"," +
                "\"elementId\":\"%s\"," +
                "\"page\":\"%s\"," +
                "\"originalLocator\":\"%s\"," +
                "\"attemptedAlternatives\":%s," +
                "\"healedLocator\":\"%s\"," +
                "\"result\":\"SUCCESS\"" +
                "}]}",
                timestamp,
                step.getElementId(),
                step.getOriginalPage(),
                step.getLocator(),
                alternativesJson.toString(),
                healedLocator
            );
            
            httpPost.setEntity(new StringEntity(jsonPayload));
            
            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                int statusCode = response.getStatusLine().getStatusCode();
                if (statusCode == 200 || statusCode == 201) {
                    System.out.println("✓ Successfully reported healing success to unified API");
                } else {
                    System.out.println("✗ Failed to report healing success. Status: " + statusCode);
                }
            }
        } catch (IOException e) {
            System.out.println("⚠ Warning: Could not send healing success request: " + e.getMessage());
        }
    }

    private void sendHealingFailureRequest(Step step, String error, List<String> attemptedAlternatives) {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpPost httpPost = new HttpPost(HEALING_SERVICE_URL);
            httpPost.setHeader("Content-Type", "application/json");
            
            // Create healing submission in the format expected by the unified API
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            
            // Build attempted alternatives JSON array
            StringBuilder alternativesJson = new StringBuilder("[");
            for (int i = 0; i < attemptedAlternatives.size(); i++) {
                if (i > 0) alternativesJson.append(",");
                alternativesJson.append("\"").append(attemptedAlternatives.get(i)).append("\"");
            }
            alternativesJson.append("]");
            
            String jsonPayload = String.format(
                "{\"healing_attempts\":[{" +
                "\"timestamp\":\"%s\"," +
                "\"elementId\":\"%s\"," +
                "\"page\":\"%s\"," +
                "\"originalLocator\":\"%s\"," +
                "\"attemptedAlternatives\":%s," +
                "\"result\":\"FAILED\"," +
                "\"error\":\"%s\"" +
                "}]}",
                timestamp,
                step.getElementId(),
                step.getOriginalPage(),
                step.getLocator(),
                alternativesJson.toString(),
                error
            );
            
            httpPost.setEntity(new StringEntity(jsonPayload));
            
            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                int statusCode = response.getStatusLine().getStatusCode();
                if (statusCode == 200 || statusCode == 201) {
                    System.out.println("✓ Successfully reported healing failure to unified API");
                } else {
                    System.out.println("✗ Failed to report healing failure. Status: " + statusCode);
                }
            }
        } catch (IOException e) {
            System.out.println("⚠ Warning: Could not send healing failure request: " + e.getMessage());
        }
    }

    private void saveHealingLog() {
        try {
            JsonUtil.writeToFile(HEALING_LOG_FILE, healingLog);
        } catch (IOException e) {
            System.err.println("Error saving healing log: " + e.getMessage());
        }
    }

    public List<HealingLogEntry> getHealingLog() {
        return new ArrayList<>(healingLog);
    }

    // Inner classes for healing result and log entry
    public static class HealingResult {
        private final boolean successful;
        private final String originalLocator;
        private final String healedLocator;
        private final String error;

        public HealingResult(boolean successful, String originalLocator, String healedLocator, String error) {
            this.successful = successful;
            this.originalLocator = originalLocator;
            this.healedLocator = healedLocator;
            this.error = error;
        }

        public boolean isSuccessful() { return successful; }
        public String getOriginalLocator() { return originalLocator; }
        public String getHealedLocator() { return healedLocator; }
        public String getError() { return error; }
    }

    public static class HealingLogEntry {
        private String timestamp;
        private String elementId;
        private String page;
        private String originalLocator;
        private List<String> attemptedAlternatives;
        private String healedLocator;
        private String result; // SUCCESS, NO_ALTERNATIVES, ALL_ALTERNATIVES_FAILED
        private String error;

        // Getters and setters
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
        
        public String getElementId() { return elementId; }
        public void setElementId(String elementId) { this.elementId = elementId; }
        
        public String getPage() { return page; }
        public void setPage(String page) { this.page = page; }
        
        public String getOriginalLocator() { return originalLocator; }
        public void setOriginalLocator(String originalLocator) { this.originalLocator = originalLocator; }
        
        public List<String> getAttemptedAlternatives() { return attemptedAlternatives; }
        public void setAttemptedAlternatives(List<String> attemptedAlternatives) { this.attemptedAlternatives = attemptedAlternatives; }
        
        public String getHealedLocator() { return healedLocator; }
        public void setHealedLocator(String healedLocator) { this.healedLocator = healedLocator; }
        
        public String getResult() { return result; }
        public void setResult(String result) { this.result = result; }
        
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
    }
}