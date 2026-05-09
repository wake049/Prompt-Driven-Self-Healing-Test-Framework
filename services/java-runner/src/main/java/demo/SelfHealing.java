package demo;

import io.appium.java_client.AppiumBy;
import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class SelfHealing {
    private WebDriver driver;
    private ElementRepository elementRepository;
    private SqlElementRepository sqlElementRepository;
    private List<HealingLogEntry> healingLog;
    private static final String HEALING_LOG_FILE = "healing_log.json";
    private static final String HEALING_SERVICE_URL = System.getenv("UNIFIED_API_URL") != null ? 
        System.getenv("UNIFIED_API_URL") + "/api/v1/healing/submit" : 
        "http://localhost:8000/api/v1/healing/submit";
    private static final String SELECTOR_GENERATION_URL = System.getenv("UNIFIED_API_URL") != null ? 
        System.getenv("UNIFIED_API_URL") + "/api/v1/selectors/generate" : 
        "http://localhost:8000/api/v1/selectors/generate";
    private boolean useSqlBackend;
    
    // Policy configuration
    private int confidenceThreshold = 85;  // Default 85%
    private int maxRetries = 2;            // Default 2 retries
    private int maxCandidates = 5;         // Default 5 candidates (from multi-outcome handling)
    private boolean useRepositoryFallback = true;  // Default true
    private boolean preferCssOverXpath = true;     // Default prefer CSS

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
    
    public void setPolicyConfig(Map<String, Object> policyConfig) {
        if (policyConfig != null) {
            if (policyConfig.containsKey("confidenceThreshold")) {
                Number thresholdValue = ((Number) policyConfig.get("confidenceThreshold"));
                // Handle both 0-1 scale (0.85) and 0-100 scale (85)
                this.confidenceThreshold = thresholdValue.doubleValue() <= 1.0 ? 
                    (int)(thresholdValue.doubleValue() * 100) : thresholdValue.intValue();
                System.out.println("📋 Policy: Confidence Threshold set to " + this.confidenceThreshold + "%");
            }
            if (policyConfig.containsKey("maxRetries")) {
                this.maxRetries = ((Number) policyConfig.get("maxRetries")).intValue();
                System.out.println("📋 Policy: Max Retries set to " + this.maxRetries);
            }
            if (policyConfig.containsKey("useRepositoryFallback")) {
                this.useRepositoryFallback = (Boolean) policyConfig.get("useRepositoryFallback");
                System.out.println("📋 Policy: Use Repository Fallback = " + this.useRepositoryFallback);
            }
            if (policyConfig.containsKey("preferCssOverXpath")) {
                this.preferCssOverXpath = (Boolean) policyConfig.get("preferCssOverXpath");
                System.out.println("📋 Policy: Prefer CSS over XPath = " + this.preferCssOverXpath);
            }
            if (policyConfig.containsKey("maxCandidates")) {
                this.maxCandidates = ((Number) policyConfig.get("maxCandidates")).intValue();
                System.out.println("📋 Policy: Max Candidates (multi-outcome) set to " + this.maxCandidates);
            }
        }
    }

    public HealingResult attemptHealing(Step step) {
        String originalLocator = step.getLocator();
        String elementId = step.getElementId();
        String page = step.getOriginalPage(); // Use original page value for database lookup
        boolean mobileStep = isMobileStep(step);
        String effectivePolicy = mobileStep ? "mobile" : step.getSelectorPolicy();
        
        System.out.println("🔧 Starting enhanced self-healing for element: " + elementId + " with locator: " + originalLocator);
        
        HealingLogEntry logEntry = new HealingLogEntry();
        logEntry.setTimestamp(LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        logEntry.setElementId(elementId);
        logEntry.setPage(page);
        logEntry.setOriginalLocator(originalLocator);
        logEntry.setAttemptedAlternatives(new ArrayList<>());
        
        // Multi-tier healing strategy
        List<String> alternatives = new ArrayList<>();
        
        // Tier 1: Repository-based alternatives (only if policy allows)
        if (this.useRepositoryFallback) {
            if (useSqlBackend) {
                List<String> repoAlternatives = sqlElementRepository.getAlternatives(elementId, page, effectivePolicy);
                alternatives.addAll(repoAlternatives);
                System.out.println("📚 Tier 1: Found " + repoAlternatives.size() + " repository alternatives (policy: useRepositoryFallback=true)");
            } else {
                List<String> repoAlternatives = elementRepository.getAlternatives(elementId, page);
                alternatives.addAll(repoAlternatives);
                System.out.println("📚 Tier 1: Found " + repoAlternatives.size() + " repository alternatives (policy: useRepositoryFallback=true)");
            }
        } else {
            System.out.println("⏭️ Tier 1: Repository fallback DISABLED by policy (useRepositoryFallback=false)");
        }
        
        // Tier 2: Intelligent selector variations based on original locator (web only)
        if (!mobileStep) {
            List<String> intelligentVariations = generateIntelligentVariations(originalLocator, effectivePolicy);
            alternatives.addAll(intelligentVariations);
            System.out.println(" Tier 2: Generated " + intelligentVariations.size() + " intelligent variations");
        } else {
            System.out.println("⏭️ Tier 2: Skipped web selector variations for mobile step");
        }
        
        // Tier 3: AI-generated alternatives (fallback)
        if (alternatives.size() < 3) { // Only use AI if we don't have enough alternatives
            List<String> aiAlternatives = getAIGeneratedAlternatives(step);
            alternatives.addAll(aiAlternatives);
            System.out.println(" Tier 3: AI generated " + aiAlternatives.size() + " additional alternatives");
        }
        
        // Tier 4: Heuristic-based fallbacks (web only)
        if (!mobileStep) {
            List<String> heuristicAlternatives = generateHeuristicAlternatives(originalLocator, effectivePolicy);
            alternatives.addAll(heuristicAlternatives);
            System.out.println("🔍 Tier 4: Generated " + heuristicAlternatives.size() + " heuristic alternatives");
        } else {
            System.out.println("⏭️ Tier 4: Skipped web heuristic alternatives for mobile step");
        }
        
        if (alternatives.isEmpty()) {
            logEntry.setResult("NO_ALTERNATIVES");
            logEntry.setError("No alternative locators found across all healing tiers");
            healingLog.add(logEntry);
            saveHealingLog();
            
            // Send POST request for healing failure
            sendHealingFailureRequest(step, "No alternative locators found", new ArrayList<>());
            
            return new HealingResult(false, originalLocator, null, 
                "No alternative locators found for element: " + elementId);
        }
        
        System.out.println("🎯 Total healing candidates: " + alternatives.size());

        // Enhanced healing attempt with intelligent validation
        // Apply both maxRetries and maxCandidates policies
        // maxCandidates limits how many alternatives we consider (filter before trying)
        // maxRetries limits how many attempts we make (limit during execution)
        int candidatesLimit = Math.min(alternatives.size(), this.maxCandidates);
        int maxAttempts = Math.min(candidatesLimit, this.maxRetries);
        System.out.println("📋 Policy: Considering " + candidatesLimit + " candidates (maxCandidates=" + this.maxCandidates + ")");
        System.out.println("📋 Policy: Will attempt up to " + maxAttempts + " healing alternatives (maxRetries=" + this.maxRetries + ")");
        
        for (int i = 0; i < maxAttempts; i++) {
            String alternative = alternatives.get(i);
            try {
                System.out.println("🔧 Attempt " + (i+1) + "/" + maxAttempts + ": " + alternative);
                logEntry.getAttemptedAlternatives().add(alternative);
                
                // Enhanced element validation with identity checking
                HealingValidationResult validation = validateHealingCandidate(alternative, step);
                
                if (validation.isValid()) {
                    WebElement element = validation.getElement();
                    
                    // Validate that healed selector aligns with policy preference
                    String healedSelectorType = getSelectorType(alternative);
                    String expectedPolicy = effectivePolicy;
                    
                    // Calculate healing quality score
                    int qualityScore = calculateHealingQuality(originalLocator, alternative, healedSelectorType, expectedPolicy);
                    
                    // CRITICAL: Only accept healing if quality score is acceptable
                    // Use policy-configured confidence threshold
                    if (qualityScore < this.confidenceThreshold) {
                        System.out.println("❌ Healing quality too low: " + qualityScore + "% (minimum from policy: " + this.confidenceThreshold + "%)");
                        System.out.println("   Rejecting to prevent false positive healing");
                        continue; // Try next alternative
                    }
                    
                    // Additional semantic validation
                    if (!performSemanticValidation(originalLocator, alternative, element, step)) {
                        System.out.println("❌ Semantic validation failed - likely wrong element");
                        continue; // Try next alternative
                    }
                    
                    if (!"mobile".equals(expectedPolicy) && !healedSelectorType.equals(expectedPolicy)) {
                        System.out.println("⚠️ Policy mismatch: healed with " + healedSelectorType + " selector, but policy prefers " + expectedPolicy + " (quality: " + qualityScore + "%)");
                        System.out.println("   This may indicate a policy compliance issue or limited selector availability");
                    } else {
                        System.out.println("✅ Policy compliant: healed with " + healedSelectorType + " selector (matches policy: " + expectedPolicy + ", quality: " + qualityScore + "%)");
                    }
                    
                    logEntry.setResult("SUCCESS");
                    logEntry.setHealedLocator(alternative);
                    healingLog.add(logEntry);
                    saveHealingLog();
                    
                    // Record successful healing in SQL backend if available
                    if (useSqlBackend) {
                        sqlElementRepository.saveHealingSuccess(elementId, page, originalLocator, alternative);
                    }
                    
                    // Send healing success to unified API with policy compliance info
                    sendHealingSuccessRequest(step, alternative, logEntry.getAttemptedAlternatives(), healedSelectorType, expectedPolicy);
                    
                    System.out.println("✅ Enhanced self-healing successful! Found CORRECT element with: " + alternative + " (quality: " + qualityScore + "%)");
                    return new HealingResult(true, originalLocator, alternative, null);
                } else {
                    System.out.println("  ✗ Validation failed: " + validation.getFailureReason());
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
        } else if (locator.startsWith("accessibility-id:")) {
            return AppiumBy.accessibilityId(locator.substring(17));
        } else if (locator.startsWith("accessibility-id=")) {
            return AppiumBy.accessibilityId(locator.substring(17));
        } else if (locator.startsWith("resource-id:")) {
            return By.id(locator.substring(12));
        } else if (locator.startsWith("resource-id=")) {
            return By.id(locator.substring(12));
        } else if (locator.startsWith("android-uiautomator=")) {
            return AppiumBy.androidUIAutomator(locator.substring(20));
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
    
    /**
     * Determine the type of selector (css or xpath) for policy validation
     */
    private String getSelectorType(String locator) {
        if (locator.startsWith("accessibility-id:") || locator.startsWith("accessibility-id=")) {
            return "accessibility-id";
        } else if (locator.startsWith("resource-id:") || locator.startsWith("resource-id=")) {
            return "resource-id";
        } else if (locator.startsWith("android-uiautomator=")) {
            return "android-uiautomator";
        } else if (locator.startsWith("xpath=") || locator.startsWith("//") || locator.contains("//*[@") || locator.contains("[@")) {
            return "xpath";
        } else if (locator.startsWith("css=") || locator.startsWith("#") || locator.startsWith(".") || 
                   locator.startsWith("[") || (!locator.startsWith("id=") && !locator.startsWith("name=") && !locator.startsWith("class=") && !locator.startsWith("tag="))) {
            return "css";
        } else {
            // For id=, name=, class=, tag= - these are typically considered CSS-style
            return "css";
        }
    }

    private List<String> getAIGeneratedAlternatives(Step step) {
        List<String> alternatives = new ArrayList<>();
        
        try (CloseableHttpClient httpClient = HttpClientFactory.create()) {
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
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(responseBody);
            JsonNode alternativesNode = root.get("alternatives");
            if (alternativesNode != null && alternativesNode.isArray()) {
                for (JsonNode alt : alternativesNode) {
                    JsonNode selectorNode = alt.get("selector");
                    if (selectorNode != null && selectorNode.isTextual()) {
                        alternatives.add(selectorNode.asText());
                    }
                }
            }
        } catch (Exception e) {
            System.out.println("⚠ Warning: Could not parse AI response: " + e.getMessage());
        }
        
        return alternatives;
    }
    
    /**
     * Generate intelligent selector variations based on the original locator
     */
    private List<String> generateIntelligentVariations(String originalLocator, String selectorPolicy) {
        List<String> variations = new ArrayList<>();
        
        try {
            // Remove any prefix to get the raw selector
            String rawSelector = originalLocator;
            if (originalLocator.startsWith("css=")) {
                rawSelector = originalLocator.substring(4);
            } else if (originalLocator.startsWith("xpath=")) {
                rawSelector = originalLocator.substring(6);
            }
            
            // CSS selector variations
            if (rawSelector.contains("#")) {
                // ID-based variations
                String id = rawSelector.substring(rawSelector.indexOf("#") + 1);
                variations.add("css=#" + id);
                variations.add("css=[id='" + id + "']");
                if ("xpath".equals(selectorPolicy)) {
                    variations.add("xpath=//*[@id=" + escapeXPathValue(id) + "]");
                }
            }
            
            if (rawSelector.contains(".")) {
                // Class-based variations
                String className = rawSelector.substring(rawSelector.indexOf(".") + 1).split("[.\\s]")[0];
                variations.add("css=." + className);
                variations.add("css=[class*='" + className + "']");
                if ("xpath".equals(selectorPolicy)) {
                    variations.add("xpath=//*[contains(@class," + escapeXPathValue(className) + ")]");
                }
            }
            
            // Data-testid variations
            if (rawSelector.contains("data-testid")) {
                String testId = extractAttributeValue(rawSelector, "data-testid");
                if (testId != null) {
                    variations.add("css=[data-testid='" + testId + "']");
                    if ("xpath".equals(selectorPolicy)) {
                        variations.add("xpath=//*[@data-testid=" + escapeXPathValue(testId) + "]");
                    }
                }
            }
            
            // Name attribute variations
            if (rawSelector.contains("name=") || rawSelector.contains("@name")) {
                String name = extractAttributeValue(rawSelector, "name");
                if (name != null) {
                    variations.add("css=[name='" + name + "']");
                    if ("xpath".equals(selectorPolicy)) {
                        variations.add("xpath=//*[@name=" + escapeXPathValue(name) + "]");
                    }
                }
            }
            
            // Remove duplicates and original
            variations.removeIf(v -> v.equals(originalLocator));
            variations = new ArrayList<>(new java.util.LinkedHashSet<>(variations));
            
        } catch (Exception e) {
            System.out.println("⚠️ Error generating intelligent variations: " + e.getMessage());
        }
        
        return variations;
    }
    
    /**
     * Generate heuristic-based alternatives using common patterns
     */
    private List<String> generateHeuristicAlternatives(String originalLocator, String selectorPolicy) {
        List<String> alternatives = new ArrayList<>();
        
        try {
            // Common button selectors
            if (originalLocator.toLowerCase().contains("button") || originalLocator.toLowerCase().contains("btn")) {
                alternatives.add("css=button[type='submit']");
                alternatives.add("css=input[type='submit']");
                alternatives.add("css=.btn-primary");
                alternatives.add("css=.button");
                if ("xpath".equals(selectorPolicy)) {
                    alternatives.add("xpath=//button[@type='submit']");
                    alternatives.add("xpath=//input[@type='submit']");
                }
            }
            
            // Common input field selectors
            if (originalLocator.toLowerCase().contains("input") || originalLocator.toLowerCase().contains("field")) {
                alternatives.add("css=input[type='text']");
                alternatives.add("css=input[type='email']");
                alternatives.add("css=input[type='password']");
                if ("xpath".equals(selectorPolicy)) {
                    alternatives.add("xpath=//input[@type='text']");
                    alternatives.add("xpath=//input[@type='email']");
                }
            }
            
            // Common link selectors
            if (originalLocator.toLowerCase().contains("link") || originalLocator.toLowerCase().contains("href")) {
                alternatives.add("css=a[href]");
                alternatives.add("css=.link");
                if ("xpath".equals(selectorPolicy)) {
                    alternatives.add("xpath=//a[@href]");
                }
            }
            
            // Remove duplicates
            alternatives = new ArrayList<>(new java.util.LinkedHashSet<>(alternatives));
            
        } catch (Exception e) {
            System.out.println("⚠️ Error generating heuristic alternatives: " + e.getMessage());
        }
        
        return alternatives;
    }
    
    /**
     * Enhanced validation for healing candidates
     */
    private HealingValidationResult validateHealingCandidate(String locator, Step step) {
        try {
            WebElement element = findElementByLocator(locator);
            
            if (element == null) {
                return new HealingValidationResult(false, null, "Element not found");
            }
            
            if (!element.isDisplayed()) {
                return new HealingValidationResult(false, element, "Element not displayed");
            }
            
            if (!element.isEnabled()) {
                return new HealingValidationResult(false, element, "Element not enabled");
            }
            
            // CRITICAL: Validate this is the CORRECT element, not just ANY element
            if (!validateElementIdentity(element, step)) {
                return new HealingValidationResult(false, element, "Element found but appears to be wrong element (identity validation failed)");
            }
            
            // Additional action-specific validations
            String action = step.getAction();
            if ("click".equals(action) || "verify_element".equals(action)) {
                // For click actions, element should be clickable
                try {
                    if (element.getSize().getHeight() == 0 || element.getSize().getWidth() == 0) {
                        return new HealingValidationResult(false, element, "Element has zero size");
                    }
                } catch (Exception e) {
                    // Size check failed, but element exists - continue
                }
            }
            
            if ("verify_text".equals(action)) {
                // For text verification, element should have text content
                String text = element.getText();
                if (text == null || text.trim().isEmpty()) {
                    String value = element.getAttribute("value");
                    if (value == null || value.trim().isEmpty()) {
                        return new HealingValidationResult(false, element, "Element has no text content");
                    }
                }
                
                // CRITICAL: For text verification, validate expected text if available
                String expectedText = step.getData();
                if (expectedText != null && !expectedText.trim().isEmpty()) {
                    String actualText = element.getText();
                    String actualValue = element.getAttribute("value");
                    
                    boolean textMatches = (actualText != null && actualText.contains(expectedText)) ||
                                         (actualValue != null && actualValue.contains(expectedText));
                    
                    if (!textMatches) {
                        return new HealingValidationResult(false, element, 
                            String.format("Element found but text doesn't match. Expected: '%s', Found: '%s'", 
                                expectedText, actualText != null ? actualText : actualValue));
                    }
                }
            }
            
            return new HealingValidationResult(true, element, "Valid healing candidate");
            
        } catch (Exception e) {
            return new HealingValidationResult(false, null, "Validation error: " + e.getMessage());
        }
    }
    
    /**
     * Validate that this element is likely the correct element we're looking for
     */
    private boolean validateElementIdentity(WebElement element, Step step) {
        try {
            String originalLocator = step.getLocator();
            String elementId = step.getElementId();
            String action = step.getAction();
            
            // Get element attributes for analysis
            String tagName = element.getTagName().toLowerCase();
            String id = element.getAttribute("id");
            String className = element.getAttribute("class");
            String name = element.getAttribute("name");
            String type = element.getAttribute("type");
            String role = element.getAttribute("role");
            String dataTestId = element.getAttribute("data-testid");
            String text = element.getText();
            String value = element.getAttribute("value");
            
            System.out.println("🔍 Identity validation for: " + tagName + 
                " id='" + id + "' class='" + className + "' name='" + name + "' type='" + type + "'");
            
            // Rule 1: If original locator had specific ID, ensure this element has similar purpose
            if (originalLocator.contains("#") || originalLocator.contains("[@id")) {
                String originalId = extractAttributeValue(originalLocator, "id");
                if (originalId != null && id != null) {
                    // Check if IDs are semantically related
                    if (!areIdentifiersRelated(originalId, id)) {
                        System.out.println("❌ ID mismatch: original='" + originalId + "' vs found='" + id + "'");
                        return false;
                    }
                }
            }
            
            // Rule 2: Validate tag appropriateness for action
            if (!isTagAppropriateForAction(tagName, type, action)) {
                System.out.println("❌ Tag inappropriate: " + tagName + " for action " + action);
                return false;
            }
            
            // Rule 3: If element ID suggests different purpose, reject
            if (elementId != null && id != null) {
                if (!areIdentifiersRelated(elementId, id)) {
                    System.out.println("❌ Purpose mismatch: expected='" + elementId + "' vs found='" + id + "'");
                    return false;
                }
            }
            
            // Rule 4: Check for common mismatches
            if (isSuspiciousMismatch(originalLocator, tagName, id, className, action)) {
                System.out.println("❌ Suspicious mismatch detected");
                return false;
            }
            
            // Rule 5: For specific actions, validate element purpose
            if ("click".equals(action)) {
                if (!isClickableElement(tagName, type, role)) {
                    System.out.println("❌ Element not naturally clickable: " + tagName + " type=" + type);
                    return false;
                }
            }
            
            if ("type".equals(action) || "send_keys".equals(action)) {
                if (!isInputElement(tagName, type)) {
                    System.out.println("❌ Element not suitable for text input: " + tagName + " type=" + type);
                    return false;
                }
            }
            
            System.out.println("✅ Identity validation passed");
            return true;
            
        } catch (Exception e) {
            System.out.println("⚠️ Identity validation error: " + e.getMessage());
            return true; // Default to allowing if validation fails
        }
    }
    
    /**
     * Check if two identifiers are semantically related
     */
    private boolean areIdentifiersRelated(String id1, String id2) {
        if (id1 == null || id2 == null) return true; // Can't compare, allow
        
        String clean1 = id1.toLowerCase().replaceAll("[_-]", "");
        String clean2 = id2.toLowerCase().replaceAll("[_-]", "");
        
        // Same after normalization
        if (clean1.equals(clean2)) return true;
        
        // One contains the other
        if (clean1.contains(clean2) || clean2.contains(clean1)) return true;
        
        // Common patterns
        String[] commonPairs = {
            "login,signin", "logout,signout", "submit,send", "cancel,close",
            "username,user", "password,pass", "email,mail", "button,btn"
        };
        
        for (String pair : commonPairs) {
            String[] parts = pair.split(",");
            if ((clean1.contains(parts[0]) && clean2.contains(parts[1])) ||
                (clean1.contains(parts[1]) && clean2.contains(parts[0]))) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if tag is appropriate for the intended action
     */
    private boolean isTagAppropriateForAction(String tagName, String type, String action) {
        switch (action) {
            case "click":
                return isClickableElement(tagName, type, null);
            case "type":
            case "send_keys":
                return isInputElement(tagName, type);
            case "verify_text":
            case "verify_element":
                return true; // Any element can be verified
            default:
                return true; // Unknown action, allow
        }
    }
    
    /**
     * Check if element is naturally clickable
     */
    private boolean isClickableElement(String tagName, String type, String role) {
        // Naturally clickable elements
        if ("button".equals(tagName) || "a".equals(tagName) || "link".equals(tagName)) {
            return true;
        }
        
        // Input elements that are clickable
        if ("input".equals(tagName)) {
            return "submit".equals(type) || "button".equals(type) || "checkbox".equals(type) || "radio".equals(type);
        }
        
        // Elements with clickable roles
        if ("button".equals(role) || "link".equals(role) || "menuitem".equals(role)) {
            return true;
        }
        
        // Common clickable elements
        return "span".equals(tagName) || "div".equals(tagName) || "li".equals(tagName);
    }
    
    /**
     * Check if element is suitable for text input
     */
    private boolean isInputElement(String tagName, String type) {
        if ("input".equals(tagName)) {
            return "text".equals(type) || "email".equals(type) || "password".equals(type) || 
                   "search".equals(type) || "url".equals(type) || "tel".equals(type) || type == null;
        }
        return "textarea".equals(tagName);
    }
    
    /**
     * Detect suspicious mismatches that indicate wrong element
     */
    private boolean isSuspiciousMismatch(String originalLocator, String tagName, String id, String className, String action) {
        String origLower = originalLocator.toLowerCase();
        
        // Login field found when looking for logout
        if (origLower.contains("logout") && id != null && id.toLowerCase().contains("login")) {
            return true;
        }
        
        // Submit button found when looking for cancel
        if (origLower.contains("cancel") && id != null && id.toLowerCase().contains("submit")) {
            return true;
        }
        
        // Password field found when looking for username
        if (origLower.contains("username") && id != null && id.toLowerCase().contains("password")) {
            return true;
        }
        
        // Looking for button but found input field
        if (origLower.contains("button") && "input".equals(tagName) && 
            !"submit".equals(tagName) && !"button".equals(tagName)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Perform semantic validation to ensure healed element makes sense in context
     */
    private boolean performSemanticValidation(String originalLocator, String healedLocator, WebElement element, Step step) {
        try {
            String action = step.getAction();
            String elementId = step.getElementId();
            String expectedData = step.getData();
            
            // Get element properties
            String tagName = element.getTagName().toLowerCase();
            String id = element.getAttribute("id");
            String className = element.getAttribute("class");
            String text = element.getText();
            String type = element.getAttribute("type");
            String name = element.getAttribute("name");
            
            System.out.println(" Semantic validation: " + tagName + " for action '" + action + "'");
            
            // For text verification, validate the text content makes sense
            if ("verify_text".equals(action) && expectedData != null && !expectedData.trim().isEmpty()) {
                String actualText = text != null ? text : element.getAttribute("value");
                if (actualText != null) {
                    // Check if the text is semantically appropriate
                    if (isTextSemanticallyAppropriate(expectedData, actualText, originalLocator)) {
                        System.out.println("✅ Text content semantically appropriate");
                    } else {
                        System.out.println("❌ Text content semantically inappropriate");
                        return false;
                    }
                }
            }
            
            // For click actions, ensure element purpose aligns
            if ("click".equals(action)) {
                if (!isElementPurposeAppropriate(originalLocator, id, className, text, tagName, type)) {
                    System.out.println("❌ Element purpose doesn't align with original intent");
                    return false;
                }
            }
            
            // Cross-validate element ID with step element ID
            if (elementId != null && id != null) {
                if (!areElementPurposesCompatible(elementId, id)) {
                    System.out.println("❌ Element purposes incompatible: expected '" + elementId + "' vs found '" + id + "'");
                    return false;
                }
            }
            
            // Validate selector evolution makes sense
            if (!isSelectorEvolutionLogical(originalLocator, healedLocator)) {
                System.out.println("❌ Selector evolution seems illogical");
                return false;
            }
            
            System.out.println("✅ Semantic validation passed");
            return true;
            
        } catch (Exception e) {
            System.out.println("⚠️ Semantic validation error: " + e.getMessage());
            return true; // Default to allowing if validation fails
        }
    }
    
    /**
     * Calculate healing quality score (0-100)
     */
    private int calculateHealingQuality(String originalLocator, String healedLocator, String healedSelectorType, String expectedPolicy) {
        int score = 50; // Base score
        
        // Policy compliance bonus
        if ("mobile".equals(expectedPolicy)) {
            // For mobile, allow multiple locator families; avoid web CSS/XPath bias.
            if ("accessibility-id".equals(healedSelectorType) || "resource-id".equals(healedSelectorType) ||
                "android-uiautomator".equals(healedSelectorType) || "xpath".equals(healedSelectorType) ||
                "id".equals(healedSelectorType) || "name".equals(healedSelectorType)) {
                score += 20;
            }
        } else if (healedSelectorType.equals(expectedPolicy)) {
            score += 30;
        } else {
            score -= 20;
        }
        
        // Selector type bonuses
        if (healedLocator.contains("data-testid")) {
            score += 20; // Test IDs are most reliable
        } else if (healedLocator.contains("#") || healedLocator.contains("[@id")) {
            score += 15; // IDs are very reliable
        } else if (healedLocator.contains("name=") || healedLocator.contains("@name")) {
            score += 10; // Names are fairly reliable
        } else if (healedLocator.contains(".") || healedLocator.contains("@class")) {
            score += 5; // Classes are less reliable
        }
        
        // Similarity bonus (if locators are similar)
        if (calculateSimilarity(originalLocator, healedLocator) > 0.7) {
            score += 10;
        }
        
        // Ensure score is within bounds
        return Math.max(0, Math.min(100, score));
    }
    
    /**
     * Calculate similarity between two selectors
     */
    private double calculateSimilarity(String original, String healed) {
        if (original == null || healed == null) return 0.0;
        
        String orig = original.toLowerCase();
        String heal = healed.toLowerCase();
        
        // Simple similarity based on common substrings
        int commonChars = 0;
        int minLength = Math.min(orig.length(), heal.length());
        
        for (int i = 0; i < minLength; i++) {
            if (orig.charAt(i) == heal.charAt(i)) {
                commonChars++;
            }
        }
        
        return (double) commonChars / Math.max(orig.length(), heal.length());
    }
    
    /**
     * Escape a string value for safe use in XPath expressions.
     * Handles values containing single quotes by using concat().
     */
    private static String escapeXPathValue(String value) {
        if (value == null) return "''";
        if (!value.contains("'")) {
            return "'" + value + "'";
        }
        if (!value.contains("\"")) {
            return "\"" + value + "\"";
        }
        // Value contains both quote types — use concat()
        StringBuilder sb = new StringBuilder("concat(");
        String[] parts = value.split("'", -1);
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) sb.append(",\"'\",");
            sb.append("'").append(parts[i]).append("'");
        }
        sb.append(")");
        return sb.toString();
    }

    /**
     * Extract attribute value from selector string
     */
    private String extractAttributeValue(String selector, String attributeName) {
        try {
            // For CSS selectors like [data-testid='value']
            String pattern = attributeName + "\\s*=\\s*['\"]([^'\"]+)['\"]";
            java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
            java.util.regex.Matcher m = p.matcher(selector);
            if (m.find()) {
                return m.group(1);
            }
            
            // For XPath selectors like @data-testid='value'
            pattern = "@" + attributeName + "\\s*=\\s*['\"]([^'\"]+)['\"]";
            p = java.util.regex.Pattern.compile(pattern);
            m = p.matcher(selector);
            if (m.find()) {
                return m.group(1);
            }
        } catch (Exception e) {
            // Ignore parsing errors
        }
        return null;
    }
    
    private void sendHealingSuccessRequest(Step step, String healedLocator, List<String> attemptedAlternatives, String healedSelectorType, String expectedPolicy) {
        try (CloseableHttpClient httpClient = HttpClientFactory.create()) {
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
            
            // Policy compliance information
            boolean isPolicyCompliant = "mobile".equals(expectedPolicy)
                ? ("accessibility-id".equals(healedSelectorType) || "resource-id".equals(healedSelectorType) ||
                   "android-uiautomator".equals(healedSelectorType) || "xpath".equals(healedSelectorType) ||
                   "id".equals(healedSelectorType) || "name".equals(healedSelectorType))
                : healedSelectorType.equals(expectedPolicy);
            
            String jsonPayload = String.format(
                "{\"healing_attempts\":[{" +
                "\"timestamp\":\"%s\"," +
                "\"elementId\":\"%s\"," +
                "\"page\":\"%s\"," +
                "\"originalLocator\":\"%s\"," +
                "\"attemptedAlternatives\":%s," +
                "\"healedLocator\":\"%s\"," +
                "\"result\":\"SUCCESS\"," +
                "\"healedSelectorType\":\"%s\"," +
                "\"expectedPolicy\":\"%s\"," +
                "\"policyCompliant\":%s" +
                "}]}",
                timestamp,
                step.getElementId(),
                step.getOriginalPage(),
                step.getLocator(),
                alternativesJson.toString(),
                healedLocator,
                healedSelectorType,
                expectedPolicy,
                isPolicyCompliant
            );
            
            httpPost.setEntity(new StringEntity(jsonPayload));
            
            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                int statusCode = response.getStatusLine().getStatusCode();
                if (statusCode == 200 || statusCode == 201) {
                    System.out.println("✓ Successfully reported healing success to unified API" + 
                        (isPolicyCompliant ? " (policy compliant)" : " (policy violation: " + healedSelectorType + " vs " + expectedPolicy + ")"));
                } else {
                    System.out.println("✗ Failed to report healing success. Status: " + statusCode);
                }
            }
        } catch (IOException e) {
            System.out.println("⚠ Warning: Could not send healing success request: " + e.getMessage());
        }
    }

    private void sendHealingSuccessRequest(Step step, String healedLocator, List<String> attemptedAlternatives) {
        // Fallback method without policy information for backward compatibility
        String healedSelectorType = getSelectorType(healedLocator);
        String expectedPolicy = isMobileStep(step) ? "mobile" : step.getSelectorPolicy();
        sendHealingSuccessRequest(step, healedLocator, attemptedAlternatives, healedSelectorType, expectedPolicy);
    }

    private boolean isMobileStep(Step step) {
        if (step == null) return false;

        String locator = step.getLocator() != null ? step.getLocator().toLowerCase() : "";
        String action = step.getAction() != null ? step.getAction().toLowerCase() : "";

        // Locator-based detection
        if (locator.startsWith("accessibility-id:") || locator.startsWith("accessibility-id=") ||
            locator.startsWith("resource-id:") || locator.startsWith("resource-id=") ||
            locator.startsWith("android-uiautomator=") || locator.startsWith("-ios class chain") ||
            locator.startsWith("-ios predicate string")) {
            return true;
        }

        // Action-based detection
        return action.equals("tap") || action.equals("appium_tap") ||
               action.equals("long_press") || action.equals("longpress") ||
               action.equals("swipe_up") || action.equals("swipe_down") ||
               action.equals("swipe_left") || action.equals("swipe_right") ||
               action.equals("hide_keyboard") || action.equals("press_back") ||
               action.equals("press_home") || action.equals("set_orientation") ||
               action.equals("switch_to_webview") || action.equals("switch_to_native") ||
               action.equals("launch_app") || action.equals("close_app") ||
               action.equals("background_app") || action.equals("activate_app") ||
               action.equals("terminate_app");
    }

    private void sendHealingFailureRequest(Step step, String error, List<String> attemptedAlternatives) {
        try (CloseableHttpClient httpClient = HttpClientFactory.create()) {
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
    
    /**
     * Helper class for healing validation results
     */
    public static class HealingValidationResult {
        private final boolean valid;
        private final WebElement element;
        private final String failureReason;
        
        public HealingValidationResult(boolean valid, WebElement element, String failureReason) {
            this.valid = valid;
            this.element = element;
            this.failureReason = failureReason;
        }
        
        public boolean isValid() { return valid; }
        public WebElement getElement() { return element; }
        public String getFailureReason() { return failureReason; }
    }
    
    /**
     * Extract expected text from a locator (if it contains text)
     */
    private String extractTextFromLocator(String locator) {
        if (locator == null) return null;
        
        // Look for text() patterns in XPath
        if (locator.contains("text()=")) {
            int start = locator.indexOf("text()='") + 8;
            if (start > 7) {
                int end = locator.indexOf("'", start);
                if (end > start) {
                    return locator.substring(start, end);
                }
            }
            
            start = locator.indexOf("text()=\"") + 8;
            if (start > 7) {
                int end = locator.indexOf("\"", start);
                if (end > start) {
                    return locator.substring(start, end);
                }
            }
        }
        
        // Look for contains(text(), pattern
        if (locator.contains("contains(text(),")) {
            int start = locator.indexOf("contains(text(),'") + 17;
            if (start > 16) {
                int end = locator.indexOf("'", start);
                if (end > start) {
                    return locator.substring(start, end);
                }
            }
            
            start = locator.indexOf("contains(text(),\"") + 17;
            if (start > 16) {
                int end = locator.indexOf("\"", start);
                if (end > start) {
                    return locator.substring(start, end);
                }
            }
        }
        
        return null; // No text found in locator
    }
    
    /**
     * Check if text content is semantically appropriate
     */
    private boolean isTextSemanticallyAppropriate(String expectedText, String actualText, String originalLocator) {
        if (expectedText == null || actualText == null) return true;
        
        String expected = expectedText.toLowerCase().trim();
        String actual = actualText.toLowerCase().trim();
        String locator = originalLocator.toLowerCase();
        
        // Exact match or contains - good
        if (actual.contains(expected) || expected.contains(actual)) {
            return true;
        }
        
        // Check for contradictory text
        String[] contradictions = {
            "login,logout", "signin,signout", "open,close", "start,stop",
            "yes,no", "true,false", "success,error", "valid,invalid"
        };
        
        for (String pair : contradictions) {
            String[] parts = pair.split(",");
            if ((expected.contains(parts[0]) && actual.contains(parts[1])) ||
                (expected.contains(parts[1]) && actual.contains(parts[0]))) {
                return false; // Contradictory text found
            }
        }
        
        return true; // No obvious semantic conflicts
    }
    
    /**
     * Check if element purpose is appropriate for the original intent
     */
    private boolean isElementPurposeAppropriate(String originalLocator, String id, String className, String text, String tagName, String type) {
        String origLower = originalLocator.toLowerCase();
        String idLower = id != null ? id.toLowerCase() : "";
        String classLower = className != null ? className.toLowerCase() : "";
        String textLower = text != null ? text.toLowerCase() : "";
        
        // Login/logout validation
        if (origLower.contains("login") || origLower.contains("signin")) {
            if (idLower.contains("logout") || idLower.contains("signout") ||
                textLower.contains("logout") || textLower.contains("sign out")) {
                return false; // Found logout when looking for login
            }
        }
        
        if (origLower.contains("logout") || origLower.contains("signout")) {
            if (idLower.contains("login") || idLower.contains("signin") ||
                textLower.contains("login") || textLower.contains("sign in")) {
                return false; // Found login when looking for logout
            }
        }
        
        // Submit/cancel validation
        if (origLower.contains("submit") || origLower.contains("save")) {
            if (idLower.contains("cancel") || idLower.contains("close") ||
                textLower.contains("cancel") || textLower.contains("close")) {
                return false; // Found cancel when looking for submit
            }
        }
        
        if (origLower.contains("cancel") || origLower.contains("close")) {
            if (idLower.contains("submit") || idLower.contains("save") ||
                textLower.contains("submit") || textLower.contains("save")) {
                return false; // Found submit when looking for cancel
            }
        }
        
        return true; // No obvious conflicts
    }
    
    /**
     * Check if element purposes are compatible
     */
    private boolean areElementPurposesCompatible(String elementId, String foundId) {
        if (elementId == null || foundId == null) return true;
        
        String expected = elementId.toLowerCase().replaceAll("[_-]", "");
        String found = foundId.toLowerCase().replaceAll("[_-]", "");
        
        // Same or contains - compatible
        if (expected.equals(found) || expected.contains(found) || found.contains(expected)) {
            return true;
        }
        
        // Known incompatible pairs
        String[] incompatiblePairs = {
            "username,password", "email,password", "login,logout", "signin,signout",
            "submit,cancel", "save,delete", "add,remove", "create,destroy"
        };
        
        for (String pair : incompatiblePairs) {
            String[] parts = pair.split(",");
            if ((expected.contains(parts[0]) && found.contains(parts[1])) ||
                (expected.contains(parts[1]) && found.contains(parts[0]))) {
                return false;
            }
        }
        
        return true; // No obvious incompatibility
    }
    
    /**
     * Check if selector evolution is logical
     */
    private boolean isSelectorEvolutionLogical(String original, String healed) {
        // If we went from specific ID to generic tag, that's suspicious
        if (original.contains("#") && !healed.contains("#") && !healed.contains("[@id")) {
            if (healed.equals("css=div") || healed.equals("css=span") || healed.equals("xpath=//div") || healed.equals("xpath=//span")) {
                return false; // Too generic
            }
        }
        
        // If we went from button to input field, check type
        if (original.toLowerCase().contains("button") && healed.toLowerCase().contains("input")) {
            if (!healed.contains("submit") && !healed.contains("button")) {
                return false; // Wrong input type
            }
        }
        
        return true; // Evolution seems reasonable
    }
}