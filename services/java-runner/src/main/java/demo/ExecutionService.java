package demo;

import org.openqa.selenium.By;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.Alert;
import org.openqa.selenium.NoAlertPresentException;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.apache.commons.io.FileUtils;

import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

public class ExecutionService {
    private WebDriver driver;
    private WebDriverWait wait;
    private SelfHealing selfHealing;
    private static final int DEFAULT_TIMEOUT = 10;
    private static final String SCREENSHOTS_DIR = "screenshots";
    
    // Variables storage for data extraction
    private Map<String, String> extractedVariables;
    
    // Performance monitoring
    private PerformanceProfiler profiler;

    public ExecutionService(WebDriver driver, SelfHealing selfHealing) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(DEFAULT_TIMEOUT));
        this.selfHealing = selfHealing;
        this.extractedVariables = new HashMap<>();
        this.profiler = new PerformanceProfiler();
        
        // Create screenshots directory
        File screenshotsDir = new File(SCREENSHOTS_DIR);
        if (!screenshotsDir.exists()) {
            screenshotsDir.mkdirs();
        }
        
        // Capture initial performance snapshot
        profiler.captureSnapshot("ExecutionService_Initialized");
    }

    /**
     * Handle any alerts that might be present on the page
     * This is especially useful for auto-dismissing password change prompts
     */
    private void handleAnyAlert() {
        try {
            Alert alert = driver.switchTo().alert();
            String alertText = alert.getText();
            System.out.println("🔔 Alert detected: " + alertText);
            
            // Auto-dismiss common alerts like password change prompts
            if (alertText.toLowerCase().contains("password") || 
                alertText.toLowerCase().contains("change") ||
                alertText.toLowerCase().contains("update") ||
                alertText.toLowerCase().contains("security")) {
                System.out.println("🔀 Auto-dismissing password/security alert");
                alert.dismiss(); // or alert.accept() depending on your needs
            } else {
                System.out.println("🔀 Auto-accepting alert");
                alert.accept();
            }
        } catch (NoAlertPresentException e) {
            // No alert present, continue normally
        } catch (Exception e) {
            System.out.println("⚠ Warning: Could not handle alert: " + e.getMessage());
        }
    }

    public StepResult executeStep(int stepIndex, Step step) {
        long startTime = System.currentTimeMillis();
        StepResult result = new StepResult(stepIndex, step, "FAIL", 0);
        
        // Capture performance snapshot before step execution
        String stepLabel = String.format("Step_%02d_%s", stepIndex + 1, step.getAction());
        PerformanceProfiler.PerformanceSnapshot preStepSnapshot = profiler.captureSnapshot(stepLabel + "_Start");
        
        try {
            // Handle any alerts before executing the step
            handleAnyAlert();
            
            System.out.printf("[%02d] %s %s", stepIndex + 1, step.getAction(), step.getLocator());
            if (step.getData() != null && !step.getData().isEmpty()) {
                System.out.print(" (" + step.getData() + ")");
            }
            System.out.print(" => ");
            
            boolean success = false;
            String actualLocator = step.getLocator();
            
            switch (step.getAction().toLowerCase()) {
                case "open":
                case "open_url":
                    String urlToOpen = step.getData() != null ? step.getData() : step.getLocator();
                    System.out.println("  DEBUG: step.getData()='" + step.getData() + "', step.getLocator()='" + step.getLocator() + "', urlToOpen='" + urlToOpen + "'");
                    success = performOpen(urlToOpen);
                    break;
                    
                case "enter_text":
                case "type":
                    success = performEnterText(step, result);
                    if (result.isHealed()) {
                        actualLocator = result.getHealedLocator();
                    }
                    break;
                    
                case "click":
                    success = performClick(step, result);
                    if (result.isHealed()) {
                        actualLocator = result.getHealedLocator();
                    }
                    break;
                    
                case "wait":
                case "wait_for":
                    success = performWait(step);
                    break;
                    
                case "verify_text":
                case "assert_text":
                    success = performVerifyText(step, result);
                    if (result.isHealed()) {
                        actualLocator = result.getHealedLocator();
                    }
                    break;
                    
                case "verify_element":
                case "assert_element":
                case "assert_visible":
                    success = performVerifyElement(step, result);
                    if (result.isHealed()) {
                        actualLocator = result.getHealedLocator();
                    }
                    break;
                    
                case "screenshot":
                    success = performScreenshot(stepIndex, step, result);
                    break;
                    
                case "extract_data":
                    success = performExtractData(step, result);
                    if (result.isHealed()) {
                        actualLocator = result.getHealedLocator();
                    }
                    break;
                    
                case "calculate":
                    success = performCalculate(step, result);
                    break;
                    
                default:
                    result.setError("Unsupported action: " + step.getAction());
                    success = false;
                    break;
            }
            
            long duration = System.currentTimeMillis() - startTime;
            result.setDuration(duration);
            
            // Capture performance snapshot after step execution
            PerformanceProfiler.PerformanceSnapshot postStepSnapshot = profiler.captureSnapshot(stepLabel + "_End");
            
            // Record performance metrics for this step
            long memoryUsed = postStepSnapshot.heapMemoryUsed;
            profiler.recordStepExecution(stepLabel, duration, memoryUsed);
            
            if (success) {
                result.setStatus(result.isHealed() ? "HEALED" : "PASS");
                System.out.printf("%s (%d ms)%n", result.getStatus(), duration);
            } else {
                result.setStatus("FAIL");
                System.out.printf("FAIL (%d ms)%n", duration);
                if (result.getError() != null) {
                    System.out.println("    Error: " + result.getError());
                }
                
                // Capture screenshot on failure
                String screenshotPath = captureScreenshot(stepIndex, step);
                result.setScreenshotPath(screenshotPath);
            }
            
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            result.setDuration(duration);
            result.setStatus("FAIL");
            result.setError(e.getMessage());
            System.out.printf("FAIL (%d ms)%n", duration);
            System.out.println("    Error: " + e.getMessage());
            
            // Capture performance snapshot even on failure
            PerformanceProfiler.PerformanceSnapshot errorSnapshot = profiler.captureSnapshot(stepLabel + "_Error");
            profiler.recordStepExecution(stepLabel + "_ERROR", duration, errorSnapshot.heapMemoryUsed);
            
            // Capture screenshot on exception
            String screenshotPath = captureScreenshot(stepIndex, step);
            result.setScreenshotPath(screenshotPath);
        }
        
        return result;
    }

    private boolean performOpen(String url) {
        try {
            System.out.println("  Attempting to navigate to: " + url);
            driver.get(url);
            String currentUrl = driver.getCurrentUrl();
            System.out.println("  Successfully navigated to: " + currentUrl);
            
            // Handle any alerts that might appear after page load
            Thread.sleep(1000); // Give page time to load and trigger any alerts
            handleAnyAlert();
            
            return true;
        } catch (org.openqa.selenium.TimeoutException te) {
            System.out.println("  Page load timed out; proceeding with DOM. " + te.getMessage());
            // Still check for alerts even on timeout
            handleAnyAlert();
            return true; // Continue with available DOM content
        } catch (Exception e) {
            System.out.println("  Navigation failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performEnterText(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                element.clear();
                element.sendKeys(step.getData());
                
                // Handle any alerts that might appear after entering text (e.g., password warnings)
                Thread.sleep(200); // Brief pause to allow alert to appear
                handleAnyAlert();
                
                return true;
            } catch (Exception e) {
                result.setError("Failed to enter text: " + e.getMessage());
                return false;
            }
        }
        return false;
    }

    private boolean performClick(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result, true); // Use clickable wait
        if (element != null) {
            try {
                element.click();
                
                // Handle any alerts that might appear after clicking
                Thread.sleep(500); // Brief pause to allow alert to appear
                handleAnyAlert();
                
                return true;
            } catch (Exception e) {
                result.setError("Failed to click element: " + e.getMessage());
                return false;
            }
        }
        return false;
    }

    private boolean performVerifyText(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                String actualText = element.getText();
                String expectedText = step.getData();
                String originalExpectedText = expectedText; // Keep original for logging
                
                // Replace variables in expected text
                expectedText = replaceVariables(expectedText);
                
                // Log what we're verifying
                if (!originalExpectedText.equals(expectedText)) {
                    System.out.println("  Verifying text: '" + originalExpectedText + "' -> '" + expectedText + "' against actual: '" + actualText + "'");
                } else {
                    System.out.println("  Verifying text: '" + expectedText + "' against actual: '" + actualText + "'");
                }
                
                if (actualText.contains(expectedText)) {
                    System.out.println("   Text verification passed");
                    return true;
                } else {
                    result.setError("Text verification failed. Expected: '" + expectedText + 
                                  "', Actual: '" + actualText + "'");
                    return false;
                }
            } catch (Exception e) {
                result.setError("Failed to verify text: " + e.getMessage());
                return false;
            }
        }
        return false;
    }

    private boolean performVerifyElement(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                return element.isDisplayed();
            } catch (Exception e) {
                result.setError("Element verification failed: " + e.getMessage());
                return false;
            }
        }
        return false;
    }

    private boolean performWait(Step step) {
        try {
            String data = step.getData();
            int milliseconds;
            
            // If no data provided (like from wait_for action), use default wait time
            if (data == null || data.trim().isEmpty()) {
                milliseconds = 5000; // Default 5 second wait for wait_for actions
                System.out.println("  Using default wait time: 5000ms");
            } else {
                milliseconds = Integer.parseInt(data);
                System.out.println("  Using specified wait time: " + milliseconds + "ms");
            }
            
            Thread.sleep(milliseconds);
            return true;
        } catch (Exception e) {
            System.out.println("  Wait failed: " + e.getMessage());
            return false;
        }
    }

    private WebElement waitVisible(By by) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(by));
    }
    
    private WebElement waitClickable(By by) {
        return wait.until(ExpectedConditions.elementToBeClickable(by));
    }

    private WebElement findElementWithHealing(Step step, StepResult result) {
        return findElementWithHealing(step, result, false);
    }
    
    private WebElement findElementWithHealing(Step step, StepResult result, boolean needClickable) {
        // Check if step has element_index parameter for multiple similar elements
        Integer elementIndex = null;
        
        // Debug: Print the step data for debugging
        System.out.println("  DEBUG: step.getData() = '" + step.getData() + "'");
        
        // Try to parse element_index from the data field or other sources
        if (step.getData() != null && step.getData().contains("element_index")) {
            try {
                // Simple parsing for element_index parameter
                String data = step.getData();
                if (data.contains("\"element_index\":")) {
                    int start = data.indexOf("\"element_index\":") + "\"element_index\":".length();
                    int end = data.indexOf(",", start);
                    if (end == -1) end = data.indexOf("}", start);
                    if (end == -1) end = data.length();
                    
                    String indexStr = data.substring(start, end).trim().replace("\"", "");
                    elementIndex = Integer.parseInt(indexStr);
                    System.out.println("  DEBUG: Parsed element_index = " + elementIndex);
                }
            } catch (Exception e) {
                System.out.println("  Warning: Could not parse element_index from data: " + step.getData());
            }
        }
        
        try {
            // First attempt with original locator
            By byLocator = parseLocator(step.getLocator());
            
            if (elementIndex != null) {
                // Find multiple elements and select by index
                List<WebElement> elements = driver.findElements(byLocator);
                if (!elements.isEmpty() && elementIndex < elements.size()) {
                    WebElement element = elements.get(elementIndex);
                    if (needClickable) {
                        // Wait for the specific indexed element to be clickable
                        wait.until(ExpectedConditions.elementToBeClickable(element));
                    }
                    System.out.println("  Found element by index " + elementIndex + " from " + elements.size() + " matching elements");
                    return element;
                } else {
                    throw new NoSuchElementException("Element index " + elementIndex + " not found (found " + elements.size() + " elements)");
                }
            } else {
                // Original behavior for single element
                WebElement element = needClickable ? waitClickable(byLocator) : waitVisible(byLocator);
                return element;
            }
        } catch (Exception e) {
            System.out.print("(original failed, attempting healing) ");
            
            // Attempt self-healing
            SelfHealing.HealingResult healingResult = selfHealing.attemptHealing(step);
            
            if (healingResult.isSuccessful()) {
                result.setHealed(true);
                result.setOriginalLocator(healingResult.getOriginalLocator());
                result.setHealedLocator(healingResult.getHealedLocator());
                
                try {
                    By healedByLocator = parseLocator(healingResult.getHealedLocator());
                    
                    if (elementIndex != null) {
                        // Try with index on healed locator too
                        List<WebElement> elements = driver.findElements(healedByLocator);
                        if (!elements.isEmpty() && elementIndex < elements.size()) {
                            WebElement element = elements.get(elementIndex);
                            if (needClickable) {
                                wait.until(ExpectedConditions.elementToBeClickable(element));
                            }
                            return element;
                        } else {
                            throw new NoSuchElementException("Healed element index " + elementIndex + " not found");
                        }
                    } else {
                        return needClickable ? waitClickable(healedByLocator) : waitVisible(healedByLocator);
                    }
                } catch (Exception healedException) {
                    result.setError("Healed locator failed: " + healedException.getMessage());
                    return null;
                }
            } else {
                result.setError("Original locator failed and healing unsuccessful: " + healingResult.getError());
                return null;
            }
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

    private boolean performScreenshot(int stepIndex, Step step, StepResult result) {
        try {
            String screenshotPath = captureScreenshot(stepIndex, step);
            if (screenshotPath != null) {
                result.setScreenshotPath(screenshotPath);
                return true;
            } else {
                result.setError("Failed to capture screenshot");
                return false;
            }
        } catch (Exception e) {
            result.setError("Screenshot failed: " + e.getMessage());
            return false;
        }
    }
    
    private boolean performExtractData(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                String extractedText = element.getText().trim();
                
                // Get variable name from step data, parsing JSON if needed
                String variableName = step.getData();
                
                // Try to parse data as JSON to extract variable name and other params
                if (variableName != null && variableName.startsWith("{")) {
                    try {
                        // Simple JSON parsing for variable name
                        if (variableName.contains("\"variable\":")) {
                            int start = variableName.indexOf("\"variable\":") + "\"variable\":".length();
                            int end = variableName.indexOf(",", start);
                            if (end == -1) end = variableName.indexOf("}", start);
                            if (end == -1) end = variableName.length();
                            
                            String varStr = variableName.substring(start, end).trim().replace("\"", "");
                            variableName = varStr;
                        }
                    } catch (Exception e) {
                        System.out.println("  Warning: Could not parse JSON data field: " + step.getData());
                        // Fall back to using the original data field
                    }
                }
                
                // If no data field, try to extract from step JSON or use default
                if (variableName == null || variableName.trim().isEmpty()) {
                    // Check if this is from AI with variable field (like backpackPrice, onesiePrice)
                    // For now, generate a meaningful name based on position/content
                    if (extractedText.contains("$")) {
                        // This is likely a price extraction
                        long timestamp = System.currentTimeMillis();
                        variableName = "price_" + timestamp;
                    } else {
                        variableName = "extracted_" + System.currentTimeMillis();
                    }
                }
                
                // Extract price value if it looks like a price
                String extractedValue = extractedText;
                if (extractedText.contains("$") || extractedText.matches(".*\\d+\\.\\d{2}.*")) {
                    // Extract numeric value from price text like "$29.99"
                    String pricePattern = "\\d+[.,]?\\d*";
                    Pattern pattern = Pattern.compile(pricePattern);
                    Matcher matcher = pattern.matcher(extractedText);
                    if (matcher.find()) {
                        extractedValue = matcher.group().replace(",", ".");
                    }
                }
                
                // Store the extracted value
                extractedVariables.put(variableName, extractedValue);
                
                System.out.println("  Extracted data: " + variableName + " = '" + extractedValue + "' (from '" + extractedText + "')");
                return true;
            } catch (Exception e) {
                result.setError("Failed to extract data: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    public Map<String, String> getExtractedVariables() {
        return new HashMap<>(extractedVariables);
    }
    
    /**
     * Get the performance profiler for detailed analysis
     */
    public PerformanceProfiler getPerformanceProfiler() {
        return profiler;
    }
    
    /**
     * Generate and print comprehensive performance report
     */
    public void printPerformanceReport() {
        System.out.println();
        System.out.println(" Generating Performance Report...");
        profiler.printDetailedReport();
    }
    
    /**
     * Perform garbage collection analysis
     */
    public void performGcAnalysis() {
        profiler.forceGcAndMeasure();
    }
    
    private String replaceVariables(String text) {
        if (text == null) return null;
        
        String result = text;
        
        // First, replace individual variables
        for (Map.Entry<String, String> variable : extractedVariables.entrySet()) {
            String placeholder = "${" + variable.getKey() + "}";
            result = result.replace(placeholder, variable.getValue());
        }
        
        // Handle calculation expressions like ${itemTotal} = ${backpack_price} + ${onesie_price}
        if (result.contains("${") && (result.contains("+") || result.contains("itemTotal"))) {
            result = calculateVariableExpression(result);
        }
        
        return result;
    }
    
    private String calculateVariableExpression(String expression) {
        try {
            // Look for patterns like ${itemTotal} or expressions with +
            if (expression.contains("itemTotal")) {
                // Calculate sum of all price variables
                double total = 0.0;
                for (Map.Entry<String, String> variable : extractedVariables.entrySet()) {
                    if (variable.getKey().contains("price")) {
                        try {
                            double value = Double.parseDouble(variable.getValue());
                            total += value;
                        } catch (NumberFormatException e) {
                            // Skip non-numeric values
                        }
                    }
                }
                
                // Replace ${itemTotal} with calculated total
                String totalStr = String.format("%.2f", total);
                expression = expression.replace("${itemTotal}", totalStr);
                System.out.println("  Calculated itemTotal: " + totalStr + " (from " + extractedVariables.size() + " price variables)");
            }
            
            return expression;
        } catch (Exception e) {
            System.out.println("  Warning: Failed to calculate expression: " + e.getMessage());
            return expression;
        }
    }

    private boolean performCalculate(Step step, StepResult result) {
        try {
            System.out.println("🧮 Performing calculation step...");
            
            // Get the variable name from the step data and formula from locator
            String variableName = step.getData();
            String formula = step.getLocator(); // Formula should be in the locator field
            
            if (variableName == null || variableName.trim().isEmpty()) {
                result.setError("Calculate step requires a variable name in the 'data' field");
                return false;
            }
            
            if (formula == null || formula.trim().isEmpty()) {
                result.setError("Calculate step requires a formula in the 'locator' field");
                return false;
            }
            
            System.out.println("    Variable: " + variableName);
            System.out.println("    Formula: " + formula);
            
            // Parse and evaluate the formula
            double calculatedValue = evaluateFormula(formula);
            
            // Store the calculated value in variables
            extractedVariables.put(variableName, String.valueOf(calculatedValue));
            
            System.out.println("     Calculated " + variableName + " = " + calculatedValue);
            result.setStatus("PASS");
            
            return true;
            
        } catch (Exception e) {
            System.err.println("     Calculate failed: " + e.getMessage());
            result.setError("Calculate failed: " + e.getMessage());
            return false;
        }
    }
    
    private double evaluateFormula(String formula) throws Exception {
        // Replace variable references with their values
        String processedFormula = formula;
        for (Map.Entry<String, String> entry : extractedVariables.entrySet()) {
            String variableName = entry.getKey();
            String variableValue = entry.getValue();
            
            // Replace ${variableName} patterns
            processedFormula = processedFormula.replace("${" + variableName + "}", variableValue);
            // Also replace direct variable names
            processedFormula = processedFormula.replace(variableName, variableValue);
        }
        
        System.out.println("    Formula after variable substitution: " + processedFormula);
        
        // Simple math evaluation for basic operations
        return evaluateSimpleMath(processedFormula);
    }
    
    private double evaluateSimpleMath(String expression) throws Exception {
        // Remove all whitespace
        expression = expression.replaceAll("\\s+", "");
        
        // Handle simple addition and subtraction for now
        if (expression.contains("+")) {
            String[] parts = expression.split("\\+");
            double sum = 0;
            for (String part : parts) {
                sum += parseNumber(part.trim());
            }
            return sum;
        } else if (expression.contains("-")) {
            String[] parts = expression.split("-");
            if (parts.length == 2) {
                return parseNumber(parts[0].trim()) - parseNumber(parts[1].trim());
            }
        } else if (expression.contains("*")) {
            String[] parts = expression.split("\\*");
            if (parts.length == 2) {
                return parseNumber(parts[0].trim()) * parseNumber(parts[1].trim());
            }
        } else if (expression.contains("/")) {
            String[] parts = expression.split("/");
            if (parts.length == 2) {
                double divisor = parseNumber(parts[1].trim());
                if (divisor == 0) {
                    throw new Exception("Division by zero");
                }
                return parseNumber(parts[0].trim()) / divisor;
            }
        }
        
        // If no operators, just parse as number
        return parseNumber(expression);
    }
    
    private double parseNumber(String numberStr) throws Exception {
        try {
            // Remove currency symbols and commas
            String cleanNumber = numberStr.replaceAll("[^0-9.-]", "");
            return Double.parseDouble(cleanNumber);
        } catch (NumberFormatException e) {
            throw new Exception("Could not parse number: " + numberStr);
        }
    }

    private String captureScreenshot(int stepIndex, Step step) {
        try {
            TakesScreenshot takesScreenshot = (TakesScreenshot) driver;
            File sourceFile = takesScreenshot.getScreenshotAs(OutputType.FILE);
            
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String filename = String.format("step_%02d_%s_%s.png", stepIndex + 1, step.getAction(), timestamp);
            File destinationFile = new File(SCREENSHOTS_DIR, filename);
            
            FileUtils.copyFile(sourceFile, destinationFile);
            System.out.println("    Screenshot saved: " + destinationFile.getPath());
            
            return destinationFile.getPath();
        } catch (IOException e) {
            System.err.println("    Failed to capture screenshot: " + e.getMessage());
            return null;
        }
    }
}