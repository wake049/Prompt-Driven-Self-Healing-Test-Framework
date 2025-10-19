package demo;

import org.openqa.selenium.By;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.apache.commons.io.FileUtils;

import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class ExecutionService {
    private WebDriver driver;
    private WebDriverWait wait;
    private SelfHealing selfHealing;
    private static final int DEFAULT_TIMEOUT = 10;
    private static final String SCREENSHOTS_DIR = "screenshots";

    public ExecutionService(WebDriver driver, SelfHealing selfHealing) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(DEFAULT_TIMEOUT));
        this.selfHealing = selfHealing;
        
        // Create screenshots directory
        File screenshotsDir = new File(SCREENSHOTS_DIR);
        if (!screenshotsDir.exists()) {
            screenshotsDir.mkdirs();
        }
    }

    public StepResult executeStep(int stepIndex, Step step) {
        long startTime = System.currentTimeMillis();
        StepResult result = new StepResult(stepIndex, step, "FAIL", 0);
        
        try {
            System.out.printf("[%02d] %s %s", stepIndex + 1, step.getAction(), step.getLocator());
            if (step.getData() != null && !step.getData().isEmpty()) {
                System.out.print(" (" + step.getData() + ")");
            }
            System.out.print(" => ");
            
            boolean success = false;
            String actualLocator = step.getLocator();
            
            switch (step.getAction().toLowerCase()) {
                case "open":
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
                    success = performVerifyElement(step, result);
                    if (result.isHealed()) {
                        actualLocator = result.getHealedLocator();
                    }
                    break;
                    
                default:
                    result.setError("Unsupported action: " + step.getAction());
                    success = false;
                    break;
            }
            
            long duration = System.currentTimeMillis() - startTime;
            result.setDuration(duration);
            
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
            return true;
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
                return true;
            } catch (Exception e) {
                result.setError("Failed to enter text: " + e.getMessage());
                return false;
            }
        }
        return false;
    }

    private boolean performClick(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                element.click();
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
                if (actualText.contains(expectedText)) {
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
            int milliseconds = Integer.parseInt(step.getData());
            Thread.sleep(milliseconds);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private WebElement findElementWithHealing(Step step, StepResult result) {
        try {
            // First attempt with original locator
            By byLocator = parseLocator(step.getLocator());
            WebElement element = wait.until(ExpectedConditions.presenceOfElementLocated(byLocator));
            if (element.isDisplayed()) {
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
                    return driver.findElement(healedByLocator);
                } catch (Exception healedException) {
                    result.setError("Healed locator failed: " + healedException.getMessage());
                    return null;
                }
            } else {
                result.setError("Original locator failed and healing unsuccessful: " + healingResult.getError());
                return null;
            }
        }
        return null;
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