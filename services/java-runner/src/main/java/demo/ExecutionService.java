package demo;

import org.openqa.selenium.By;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.Alert;
import org.openqa.selenium.NoAlertPresentException;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.Keys;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.FluentWait;
import org.apache.commons.io.FileUtils;

import java.util.Set;
import java.util.function.Function;

import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
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
    
    // Execution safety policy settings
    private boolean blockDestructiveActions = true;
    private boolean allowTestModeOverride = true;
    private String[] destructiveKeywords = {"delete", "remove", "submit payment", "purge", "clear", "reset"};
    private boolean isTestMode = false;

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
     * Set execution safety policy settings
     */
    public void setSafetyPolicy(boolean blockDestructive, boolean allowTestOverride, String[] keywords) {
        this.blockDestructiveActions = blockDestructive;
        this.allowTestModeOverride = allowTestOverride;
        if (keywords != null && keywords.length > 0) {
            this.destructiveKeywords = keywords;
        }
        System.out.println("🛡️ Execution Safety Policy configured:");
        System.out.println("   Block Destructive Actions: " + blockDestructive);
        System.out.println("   Allow Test Mode Override: " + allowTestOverride);
        System.out.println("   Destructive Keywords: " + String.join(", ", this.destructiveKeywords));
    }
    
    /**
     * Set test mode flag
     */
    public void setTestMode(boolean testMode) {
        this.isTestMode = testMode;
        System.out.println("🧪 Test Mode: " + (testMode ? "ENABLED" : "DISABLED"));
    }
    
    /**
     * Inject initial variables from API test data setup.
     * These variables can be used in test steps with ${variable_name} syntax.
     * 
     * @param variables Map of variable names to values from API test data
     */
    public void injectInitialVariables(Map<String, String> variables) {
        if (variables == null || variables.isEmpty()) {
            return;
        }
        
        this.extractedVariables.putAll(variables);
        System.out.println("📥 Injected " + variables.size() + " initial variables from API test data:");
        for (Map.Entry<String, String> var : variables.entrySet()) {
            System.out.println("   ${" + var.getKey() + "} = " + var.getValue());
        }
    }
    
    /**
     * Validate step against execution safety policy
     * @return null if step is allowed, error message if blocked
     */
    private String validateStepSafety(Step step) {
        if (!blockDestructiveActions) {
            return null; // Safety policy disabled
        }
        
        // Check if test mode override is enabled
        if (isTestMode && allowTestModeOverride) {
            return null; // Test mode override allows all actions
        }
        
        String action = step.getAction().toLowerCase();
        String description = step.getData() != null ? step.getData().toLowerCase() : "";
        String element = step.getLocator() != null ? step.getLocator().toLowerCase() : "";
        String fullText = action + " " + description + " " + element;
        
        // Check if action itself is destructive
        for (String keyword : destructiveKeywords) {
            if (action.contains(keyword.toLowerCase())) {
                return "Action contains destructive keyword: " + keyword;
            }
        }
        
        // Check if description or element contains destructive keywords
        for (String keyword : destructiveKeywords) {
            if (fullText.contains(keyword.toLowerCase())) {
                return "Step contains destructive keyword: " + keyword;
            }
        }
        
        return null; // Step is allowed
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
            // Validate step against execution safety policy
            String blockReason = validateStepSafety(step);
            if (blockReason != null) {
                System.out.println("⛔ Step blocked by safety policy: " + blockReason);
                result.setStatus("BLOCKED");
                result.setError("Blocked by safety policy: " + blockReason);
                result.setDuration(System.currentTimeMillis() - startTime);
                return result;
            }
            
            // Pre-process step: Replace variables in data, locator, etc.
            step = preprocessStepVariables(step);
            
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
                    
                case "verify_date":
                case "verify_date_format":
                    success = performVerifyDateFormat(step, result);
                    break;
                    
                case "extract_list":
                case "extract_all":
                    success = performExtractList(step, result);
                    break;
                    
                case "verify_all":
                case "verify_all_elements":
                    success = performVerifyAllElements(step, result);
                    break;
                    
                case "for_each":
                case "iterate_list":
                    success = performForEach(step, result);
                    break;
                    
                case "count_elements":
                    success = performCountElements(step, result);
                    break;
                    
                // ============== NAVIGATION & PAGE CONTROL ==============
                case "scroll_to_element":
                case "scrolltoelement":
                    success = performScrollToElement(step, result);
                    break;
                    
                case "scroll_to_position":
                case "scrolltoposition":
                    success = performScrollToPosition(step, result);
                    break;
                    
                case "wait_for_page_load":
                case "waitforpageload":
                    success = performWaitForPageLoad(step, result);
                    break;
                    
                case "switch_to_frame":
                case "switchtoframe":
                    success = performSwitchToFrame(step, result);
                    break;
                    
                case "switch_to_parent_frame":
                case "switchtoparentframe":
                    success = performSwitchToParentFrame(step, result);
                    break;
                    
                case "switch_to_window":
                case "switchtowindow":
                    success = performSwitchToWindow(step, result);
                    break;
                    
                case "close_window":
                case "closewindow":
                    success = performCloseWindow(step, result);
                    break;
                    
                case "navigate_back":
                case "navigateback":
                case "back":
                    success = performNavigateBack(step, result);
                    break;
                    
                case "navigate_forward":
                case "navigateforward":
                case "forward":
                    success = performNavigateForward(step, result);
                    break;
                    
                case "refresh_page":
                case "refreshpage":
                case "refresh":
                    success = performRefreshPage(step, result);
                    break;
                    
                // ============== FORM & INPUT ==============
                case "clear_and_type":
                case "clearandtype":
                    success = performClearAndType(step, result);
                    break;
                    
                case "type_slowly":
                case "typeslowly":
                    success = performTypeSlowly(step, result);
                    break;
                    
                case "upload_file":
                case "uploadfile":
                    success = performUploadFile(step, result);
                    break;
                    
                case "select_by_index":
                case "selectbyindex":
                    success = performSelectByIndex(step, result);
                    break;
                    
                case "select_by_value":
                case "selectbyvalue":
                    success = performSelectByValue(step, result);
                    break;
                    
                case "select_by_text":
                case "selectbytext":
                case "select":
                    success = performSelectByText(step, result);
                    break;
                    
                case "check_checkbox":
                case "checkcheckbox":
                case "check":
                    success = performCheckCheckbox(step, result);
                    break;
                    
                case "uncheck_checkbox":
                case "uncheck":
                    success = performUncheckCheckbox(step, result);
                    break;
                    
                case "set_slider":
                case "setslider":
                    success = performSetSlider(step, result);
                    break;
                    
                case "set_date_picker":
                case "setdatepicker":
                    success = performSetDatePicker(step, result);
                    break;
                    
                // ============== VERIFICATION & ASSERTION ==============
                case "assert_text_exact":
                    success = performAssertTextExact(step, result);
                    break;
                    
                case "assert_text_contains":
                case "asserttextcontains":
                    success = performAssertTextContains(step, result);
                    break;
                    
                case "assert_element_count":
                case "assertelementcount":
                    success = performAssertElementCount(step, result);
                    break;
                    
                case "assert_attribute":
                case "assertattribute":
                case "assert_attribute_value":
                    success = performAssertAttribute(step, result);
                    break;
                    
                case "assert_page_title":
                case "assertpagetitle":
                    success = performAssertPageTitle(step, result);
                    break;
                    
                case "assert_url":
                case "asserturl":
                    success = performAssertUrl(step, result);
                    break;
                    
                case "assert_url_contains":
                case "asserturlcontains":
                    success = performAssertUrlContains(step, result);
                    break;
                    
                case "assert_element_enabled":
                case "assertelementenabled":
                    success = performAssertElementEnabled(step, result);
                    break;
                    
                case "assert_element_disabled":
                case "assertelementdisabled":
                    success = performAssertElementDisabled(step, result);
                    break;
                    
                case "assert_checkbox_checked":
                case "assertcheckboxchecked":
                    success = performAssertCheckboxChecked(step, result);
                    break;
                    
                case "assert_checkbox_unchecked":
                case "assertcheckboxunchecked":
                    success = performAssertCheckboxUnchecked(step, result);
                    break;
                    
                case "assert_toast_message":
                case "asserttoastmessage":
                    success = performAssertToastMessage(step, result);
                    break;
                    
                // ============== KEYBOARD & MOUSE ==============
                case "hover":
                case "hover_over_element":
                case "hoveroverelement":
                    success = performHoverOverElement(step, result);
                    break;
                    
                case "right_click":
                case "rightclick":
                case "context_click":
                    success = performRightClick(step, result);
                    break;
                    
                case "double_click":
                case "doubleclick":
                    success = performDoubleClick(step, result);
                    break;
                    
                case "drag_and_drop":
                case "draganddrop":
                    success = performDragAndDrop(step, result);
                    break;
                    
                case "press_key":
                case "presskey":
                    success = performPressKey(step, result);
                    break;
                    
                case "keyboard_shortcut":
                case "keyboardshortcut":
                    success = performKeyboardShortcut(step, result);
                    break;
                    
                // ============== TABLES & DYNAMIC CONTENT ==============
                case "get_table_cell_value":
                case "gettablecellvalue":
                    success = performGetTableCellValue(step, result);
                    break;
                    
                case "assert_table_row_count":
                case "asserttablerowcount":
                    success = performAssertTableRowCount(step, result);
                    break;
                    
                case "click_table_row_by_value":
                case "clicktablerowbyvalue":
                    success = performClickTableRowByValue(step, result);
                    break;
                    
                case "wait_for_table_to_load":
                case "waitfortabletoload":
                    success = performWaitForTableToLoad(step, result);
                    break;
                    
                // ============== ALERTS & MODALS ==============
                case "accept_alert":
                case "acceptalert":
                    success = performAcceptAlert(step, result);
                    break;
                    
                case "dismiss_alert":
                case "dismissalert":
                    success = performDismissAlert(step, result);
                    break;
                    
                case "get_alert_text":
                case "getalerttext":
                    success = performGetAlertText(step, result);
                    break;
                    
                case "wait_for_modal_visible":
                case "waitformodalvisible":
                    success = performWaitForModalVisible(step, result);
                    break;
                    
                case "wait_for_modal_dismissed":
                case "waitformodaldismissed":
                    success = performWaitForModalDismissed(step, result);
                    break;
                    
                // ============== API / NETWORK ==============
                case "wait_for_api_response":
                case "waitforapiresponse":
                    success = performWaitForApiResponse(step, result);
                    break;

                // ============== APPIUM / MOBILE GESTURES ==============
                case "appium_tap":
                case "tap":
                    success = performAppiumTap(step, result);
                    break;

                case "appium_long_press":
                case "long_press":
                case "longpress":
                    success = performAppiumLongPress(step, result);
                    break;

                case "appium_swipe_up":
                case "swipe_up":
                case "swipeup":
                    success = performAppiumSwipeUp(step, result);
                    break;

                case "appium_swipe_down":
                case "swipe_down":
                case "swipedown":
                    success = performAppiumSwipeDown(step, result);
                    break;

                case "appium_swipe_left":
                case "swipe_left":
                case "swipeleft":
                    success = performAppiumSwipeLeft(step, result);
                    break;

                case "appium_swipe_right":
                case "swipe_right":
                case "swiperight":
                    success = performAppiumSwipeRight(step, result);
                    break;

                case "appium_pinch":
                case "pinch":
                    success = performAppiumPinch(step, result);
                    break;

                case "appium_spread":
                case "spread":
                case "zoom_in":
                    success = performAppiumSpread(step, result);
                    break;

                case "appium_hide_keyboard":
                case "hide_keyboard":
                    success = performAppiumHideKeyboard(step, result);
                    break;

                case "appium_press_back":
                case "press_back":
                    success = performAppiumPressBack(step, result);
                    break;

                case "appium_press_home":
                case "press_home":
                    success = performAppiumPressHome(step, result);
                    break;

                case "appium_set_orientation":
                case "set_orientation":
                    success = performAppiumSetOrientation(step, result);
                    break;

                case "appium_switch_to_webview":
                case "switch_to_webview":
                    success = performAppiumSwitchToWebView(step, result);
                    break;

                case "appium_switch_to_native":
                case "switch_to_native":
                    success = performAppiumSwitchToNative(step, result);
                    break;

                case "appium_launch_app":
                case "launch_app":
                    success = performAppiumLaunchApp(step, result);
                    break;

                case "appium_close_app":
                case "close_app":
                    success = performAppiumCloseApp(step, result);
                    break;

                case "appium_background_app":
                case "background_app":
                    success = performAppiumBackgroundApp(step, result);
                    break;

                case "appium_activate_app":
                case "activate_app":
                    success = performAppiumActivateApp(step, result);
                    break;

                case "appium_terminate_app":
                case "terminate_app":
                    success = performAppiumTerminateApp(step, result);
                    break;

                // Aliases for native mobile actions
                case "scroll":
                case "scroll_down":
                    success = performAppiumSwipeUp(step, result);
                    break;

                case "scroll_up":
                    success = performAppiumSwipeDown(step, result);
                    break;

                case "type_text":
                    success = performEnterText(step, result);
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
        // If the step has no locator, we can't apply self-healing
        if (step.getLocator() == null || step.getLocator().trim().isEmpty()) {
            String message = "Step has no locator; self-healing is not applicable";
            System.out.println("  " + message);
            if (result.getError() == null) {
                result.setError(message);
            }
            return null;
        }

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
            
            // Attempt self-healing
            SelfHealing.HealingResult healingResult = selfHealing.attemptHealing(step);
            
            // IMPORTANT: Mark as healed whenever healing was attempted, regardless of success
            // This ensures steps that failed even after healing attempts are tracked for review
            result.setHealed(true);
            result.setOriginalLocator(healingResult.getOriginalLocator());
            
            // Get healing log entry to retrieve attempted alternatives
            List<SelfHealing.HealingLogEntry> healingLog = selfHealing.getHealingLog();
            if (!healingLog.isEmpty()) {
                SelfHealing.HealingLogEntry lastEntry = healingLog.get(healingLog.size() - 1);
                result.setAttemptedAlternatives(lastEntry.getAttemptedAlternatives());
            }
            
            if (healingResult.isSuccessful()) {
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
                // Healing was attempted but failed - still mark as healed for review tracking
                result.setHealedLocator(null);
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
        } else if (locator.startsWith("accessibility-id:")) {
            return io.appium.java_client.AppiumBy.accessibilityId(locator.substring(17));
        } else if (locator.startsWith("accessibility-id=")) {
            return io.appium.java_client.AppiumBy.accessibilityId(locator.substring(17));
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
    
    /**
     * Pre-process a step by replacing variables (${varName}) in all string fields.
     * This allows variables from API test data to be used in step data, locators, etc.
     */
    private Step preprocessStepVariables(Step step) {
        if (extractedVariables.isEmpty()) {
            return step;  // No variables to replace
        }
        
        // Replace variables in step fields
        String data = replaceVariables(step.getData());
        String locator = replaceVariables(step.getLocator());
        
        // Check if any replacements were made
        boolean hasDataChange = !equals(data, step.getData());
        boolean hasLocatorChange = !equals(locator, step.getLocator());
        
        if (hasDataChange || hasLocatorChange) {
            System.out.println("  📥 Variables replaced in step:");
            if (hasDataChange) {
                System.out.println("     data: '" + step.getData() + "' → '" + data + "'");
            }
            if (hasLocatorChange) {
                System.out.println("     locator: '" + step.getLocator() + "' → '" + locator + "'");
            }
            
            // Create new Step with replaced values
            Step processedStep = new Step(
                step.getPage(), 
                step.getAction(), 
                locator, 
                step.getElementId(), 
                data
            );
            processedStep.setSelectorPolicy(step.getSelectorPolicy());
            processedStep.setOriginalPage(step.getOriginalPage());
            return processedStep;
        }
        
        return step;
    }
    
    /**
     * Null-safe string equality check
     */
    private boolean equals(String a, String b) {
        if (a == null) return b == null;
        return a.equals(b);
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
    
    // ============== DATE FORMAT VERIFICATION ==============
    
    /**
     * Verify that an element's text matches a specific date format.
     * Supports common formats like: MM/dd/yyyy, yyyy-MM-dd, dd-MM-yyyy, etc.
     * 
     * Step data should contain the expected format pattern, e.g., "MM/dd/yyyy"
     */
    private boolean performVerifyDateFormat(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                String actualText = element.getText().trim();
                String dateFormat = step.getData();
                
                if (dateFormat == null || dateFormat.trim().isEmpty()) {
                    // Default common formats to try
                    String[] commonFormats = {
                        "MM/dd/yyyy", "yyyy-MM-dd", "dd/MM/yyyy", 
                        "MM-dd-yyyy", "dd-MM-yyyy", "MMM dd, yyyy",
                        "MMMM dd, yyyy", "yyyy/MM/dd"
                    };
                    
                    for (String format : commonFormats) {
                        if (isValidDateFormat(actualText, format)) {
                            System.out.println("   Date '" + actualText + "' matches format: " + format);
                            return true;
                        }
                    }
                    result.setError("Date '" + actualText + "' does not match any common date format");
                    return false;
                } else {
                    // Replace variables in date format
                    dateFormat = replaceVariables(dateFormat);
                    
                    System.out.println("  Verifying date: '" + actualText + "' matches format: '" + dateFormat + "'");
                    
                    if (isValidDateFormat(actualText, dateFormat)) {
                        System.out.println("   Date format verification passed");
                        return true;
                    } else {
                        result.setError("Date '" + actualText + "' does not match expected format '" + dateFormat + "'");
                        return false;
                    }
                }
            } catch (Exception e) {
                result.setError("Failed to verify date format: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Check if a string matches a given date format pattern
     */
    private boolean isValidDateFormat(String dateString, String formatPattern) {
        try {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern(formatPattern);
            // Try parsing as LocalDate first
            try {
                LocalDate.parse(dateString, formatter);
                return true;
            } catch (DateTimeParseException e1) {
                // Try as LocalDateTime
                try {
                    LocalDateTime.parse(dateString, formatter);
                    return true;
                } catch (DateTimeParseException e2) {
                    return false;
                }
            }
        } catch (IllegalArgumentException e) {
            System.out.println("  Warning: Invalid date format pattern: " + formatPattern);
            return false;
        }
    }
    
    // ============== LIST EXTRACTION ==============
    
    /**
     * Extract text from all elements matching a locator and store as a list variable.
     * Variable name comes from step.getData() field.
     * The list is stored as a comma-separated string and also as indexed variables.
     * E.g., "productNames" -> "Item 1, Item 2, Item 3"
     *       "productNames_0" -> "Item 1"
     *       "productNames_1" -> "Item 2"
     *       "productNames_count" -> "3"
     */
    private boolean performExtractList(Step step, StepResult result) {
        try {
            String locatorStr = step.getLocator();
            String variableName = step.getData();
            
            if (variableName == null || variableName.trim().isEmpty()) {
                variableName = "extracted_list_" + System.currentTimeMillis();
            }
            
            // Parse the locator and find all matching elements
            By byLocator = parseLocator(locatorStr);
            List<WebElement> elements = driver.findElements(byLocator);
            
            if (elements.isEmpty()) {
                result.setError("No elements found matching locator: " + locatorStr);
                return false;
            }
            
            // Extract text from all elements
            List<String> extractedValues = new ArrayList<>();
            for (int i = 0; i < elements.size(); i++) {
                String text = elements.get(i).getText().trim();
                extractedValues.add(text);
                
                // Store each item with index
                extractedVariables.put(variableName + "_" + i, text);
            }
            
            // Store count
            extractedVariables.put(variableName + "_count", String.valueOf(elements.size()));
            
            // Store as comma-separated list
            String listValue = String.join(", ", extractedValues);
            extractedVariables.put(variableName, listValue);
            
            System.out.println("  Extracted list '" + variableName + "' with " + elements.size() + " items:");
            for (int i = 0; i < extractedValues.size(); i++) {
                System.out.println("    [" + i + "]: " + extractedValues.get(i));
            }
            
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to extract list: " + e.getMessage());
            return false;
        }
    }
    
    // ============== VERIFY ALL ELEMENTS ==============
    
    /**
     * Verify that ALL elements matching a locator satisfy a condition.
     * 
     * Step data can contain:
     * - A value to check against: "check all prices are $29.99"
     * - A variable reference: "${expectedDescription}"
     * - A condition like "not_empty", "contains:text", "matches:regex"
     */
    private boolean performVerifyAllElements(Step step, StepResult result) {
        try {
            String locatorStr = step.getLocator();
            String condition = replaceVariables(step.getData());
            
            if (condition == null || condition.trim().isEmpty()) {
                condition = "not_empty"; // Default to checking elements are not empty
            }
            
            // Parse the locator and find all matching elements
            By byLocator = parseLocator(locatorStr);
            List<WebElement> elements = driver.findElements(byLocator);
            
            if (elements.isEmpty()) {
                result.setError("No elements found matching locator: " + locatorStr);
                return false;
            }
            
            System.out.println("  Verifying " + elements.size() + " elements against condition: '" + condition + "'");
            
            List<String> failures = new ArrayList<>();
            int passCount = 0;
            
            for (int i = 0; i < elements.size(); i++) {
                String elementText = elements.get(i).getText().trim();
                boolean passed = checkElementCondition(elementText, condition);
                
                if (passed) {
                    passCount++;
                } else {
                    failures.add("[" + i + "]: '" + elementText + "'");
                }
            }
            
            if (failures.isEmpty()) {
                System.out.println("   All " + passCount + " elements passed verification");
                return true;
            } else {
                String failureMsg = "Verification failed for " + failures.size() + " of " + elements.size() + " elements: " + String.join(", ", failures);
                result.setError(failureMsg);
                System.out.println("   " + failureMsg);
                return false;
            }
            
        } catch (Exception e) {
            result.setError("Failed to verify all elements: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Check if element text satisfies a condition.
     * Supported conditions:
     * - "not_empty" - text is not empty
     * - "contains:text" - text contains the specified string
     * - "equals:text" - text exactly equals the specified string
     * - "matches:regex" - text matches the regex pattern
     * - "starts_with:text" - text starts with the specified string
     * - "ends_with:text" - text ends with the specified string
     * - plain text - text contains the specified string (default)
     */
    private boolean checkElementCondition(String elementText, String condition) {
        if (condition.equals("not_empty")) {
            return !elementText.isEmpty();
        } else if (condition.startsWith("contains:")) {
            String expected = condition.substring("contains:".length());
            return elementText.contains(expected);
        } else if (condition.startsWith("equals:")) {
            String expected = condition.substring("equals:".length());
            return elementText.equals(expected);
        } else if (condition.startsWith("matches:")) {
            String regex = condition.substring("matches:".length());
            return Pattern.matches(regex, elementText);
        } else if (condition.startsWith("starts_with:")) {
            String expected = condition.substring("starts_with:".length());
            return elementText.startsWith(expected);
        } else if (condition.startsWith("ends_with:")) {
            String expected = condition.substring("ends_with:".length());
            return elementText.endsWith(expected);
        } else {
            // Default: treat as contains check
            return elementText.contains(condition);
        }
    }
    
    // ============== FOR EACH / ITERATE LIST ==============
    
    /**
     * Iterate through a list of elements or a previously extracted list variable.
     * For now, stores the current iteration index and value for use in subsequent steps.
     * 
     * Step locator: either a CSS/xpath selector or a variable name like ${productNames}
     * Step data: variable name prefix for iteration (e.g., "item" creates item_index, item_value)
     */
    private boolean performForEach(Step step, StepResult result) {
        try {
            String source = step.getLocator();
            String varPrefix = step.getData();
            
            if (varPrefix == null || varPrefix.trim().isEmpty()) {
                varPrefix = "item";
            }
            
            List<String> items = new ArrayList<>();
            
            // Check if source is a variable reference
            if (source != null && source.startsWith("${") && source.endsWith("}")) {
                String varName = source.substring(2, source.length() - 1);
                
                // Check for indexed elements first
                String countKey = varName + "_count";
                if (extractedVariables.containsKey(countKey)) {
                    int count = Integer.parseInt(extractedVariables.get(countKey));
                    for (int i = 0; i < count; i++) {
                        String itemValue = extractedVariables.get(varName + "_" + i);
                        if (itemValue != null) {
                            items.add(itemValue);
                        }
                    }
                } else if (extractedVariables.containsKey(varName)) {
                    // Fallback to comma-separated
                    String listValue = extractedVariables.get(varName);
                    for (String item : listValue.split(",")) {
                        items.add(item.trim());
                    }
                } else {
                    result.setError("Variable '" + varName + "' not found");
                    return false;
                }
            } else {
                // Treat as element locator
                By byLocator = parseLocator(source);
                List<WebElement> elements = driver.findElements(byLocator);
                
                for (WebElement element : elements) {
                    items.add(element.getText().trim());
                }
            }
            
            if (items.isEmpty()) {
                result.setError("No items found to iterate");
                return false;
            }
            
            // Store iteration info
            extractedVariables.put(varPrefix + "_total", String.valueOf(items.size()));
            
            System.out.println("  For-each: iterating over " + items.size() + " items with prefix '" + varPrefix + "'");
            
            // Store each item with index for use in subsequent steps
            for (int i = 0; i < items.size(); i++) {
                extractedVariables.put(varPrefix + "_" + i, items.get(i));
                System.out.println("    " + varPrefix + "_" + i + " = '" + items.get(i) + "'");
            }
            
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to iterate list: " + e.getMessage());
            return false;
        }
    }
    
    // ============== COUNT ELEMENTS ==============
    
    /**
     * Count the number of elements matching a locator and store in a variable.
     */
    private boolean performCountElements(Step step, StepResult result) {
        try {
            String locatorStr = step.getLocator();
            String variableName = step.getData();
            
            if (variableName == null || variableName.trim().isEmpty()) {
                variableName = "element_count";
            }
            
            // Parse the locator and find all matching elements
            By byLocator = parseLocator(locatorStr);
            List<WebElement> elements = driver.findElements(byLocator);
            
            int count = elements.size();
            extractedVariables.put(variableName, String.valueOf(count));
            
            System.out.println("  Counted " + count + " elements matching '" + locatorStr + "', stored in '" + variableName + "'");
            
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to count elements: " + e.getMessage());
            return false;
        }
    }
    
    // ============================================================================
    // NAVIGATION & PAGE CONTROL ACTIONS
    // ============================================================================
    
    /**
     * Scroll to bring an element into view. Critical for lazy-loaded pages.
     */
    private boolean performScrollToElement(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                JavascriptExecutor js = (JavascriptExecutor) driver;
                js.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", element);
                Thread.sleep(300); // Brief pause for smooth scroll to complete
                System.out.println("   Scrolled element into view");
                return true;
            } catch (Exception e) {
                result.setError("Failed to scroll to element: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Scroll to a specific position on the page.
     * Data format: "50%" for percentage, "500" for pixels, "top", "bottom"
     */
    private boolean performScrollToPosition(Step step, StepResult result) {
        try {
            JavascriptExecutor js = (JavascriptExecutor) driver;
            String position = step.getData();
            
            if (position == null || position.trim().isEmpty()) {
                position = "0"; // Default to top
            }
            
            position = position.trim().toLowerCase();
            
            if (position.equals("top")) {
                js.executeScript("window.scrollTo(0, 0);");
            } else if (position.equals("bottom")) {
                js.executeScript("window.scrollTo(0, document.body.scrollHeight);");
            } else if (position.endsWith("%")) {
                int percentage = Integer.parseInt(position.replace("%", ""));
                js.executeScript("window.scrollTo(0, document.body.scrollHeight * " + (percentage / 100.0) + ");");
            } else {
                int pixels = Integer.parseInt(position);
                js.executeScript("window.scrollTo(0, " + pixels + ");");
            }
            
            Thread.sleep(300);
            System.out.println("   Scrolled to position: " + position);
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to scroll to position: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Smart wait for page load - checks document.readyState and network idle.
     */
    private boolean performWaitForPageLoad(Step step, StepResult result) {
        try {
            JavascriptExecutor js = (JavascriptExecutor) driver;
            
            // Get timeout from data or use default
            int timeoutSeconds = 30;
            if (step.getData() != null && !step.getData().trim().isEmpty()) {
                try {
                    timeoutSeconds = Integer.parseInt(step.getData().trim());
                } catch (NumberFormatException e) {
                    // Use default
                }
            }
            
            WebDriverWait pageLoadWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
            
            // Wait for document.readyState to be complete
            pageLoadWait.until(webDriver -> {
                String readyState = (String) js.executeScript("return document.readyState");
                return "complete".equals(readyState);
            });
            
            // Additional wait for any jQuery/AJAX if present
            try {
                pageLoadWait.until(webDriver -> {
                    Boolean jQueryDefined = (Boolean) js.executeScript("return typeof jQuery !== 'undefined'");
                    if (jQueryDefined) {
                        Long activeCount = (Long) js.executeScript("return jQuery.active");
                        return activeCount == 0;
                    }
                    return true;
                });
            } catch (Exception e) {
                // jQuery not present, that's fine
            }
            
            System.out.println("   Page load complete");
            return true;
            
        } catch (Exception e) {
            result.setError("Page load wait timed out: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Switch to an iframe by locator, index, or name.
     */
    private boolean performSwitchToFrame(Step step, StepResult result) {
        try {
            String frameIdentifier = step.getLocator();
            
            if (frameIdentifier == null || frameIdentifier.trim().isEmpty()) {
                // Try using data field
                frameIdentifier = step.getData();
            }
            
            if (frameIdentifier == null || frameIdentifier.trim().isEmpty()) {
                result.setError("No frame identifier provided");
                return false;
            }
            
            // Check if it's a numeric index
            try {
                int frameIndex = Integer.parseInt(frameIdentifier.trim());
                driver.switchTo().frame(frameIndex);
                System.out.println("   Switched to frame by index: " + frameIndex);
                return true;
            } catch (NumberFormatException e) {
                // Not a number, continue
            }
            
            // Try as name/id first
            try {
                driver.switchTo().frame(frameIdentifier);
                System.out.println("   Switched to frame by name/id: " + frameIdentifier);
                return true;
            } catch (Exception e) {
                // Try as locator
            }
            
            // Try as element locator
            WebElement frameElement = findElementWithHealing(step, result);
            if (frameElement != null) {
                driver.switchTo().frame(frameElement);
                System.out.println("   Switched to frame by element locator");
                return true;
            }
            
            result.setError("Could not find frame: " + frameIdentifier);
            return false;
            
        } catch (Exception e) {
            result.setError("Failed to switch to frame: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Switch back to parent frame from an iframe.
     */
    private boolean performSwitchToParentFrame(Step step, StepResult result) {
        try {
            driver.switchTo().parentFrame();
            System.out.println("   Switched to parent frame");
            return true;
        } catch (Exception e) {
            result.setError("Failed to switch to parent frame: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Switch to a specific browser window/tab.
     * Data can be: "new" (most recent), "main" (original), window handle, or index.
     */
    private boolean performSwitchToWindow(Step step, StepResult result) {
        try {
            String windowIdentifier = step.getData();
            Set<String> windowHandles = driver.getWindowHandles();
            String currentHandle = driver.getWindowHandle();
            List<String> handlesList = new ArrayList<>(windowHandles);
            
            if (windowIdentifier == null || windowIdentifier.trim().isEmpty() || windowIdentifier.equalsIgnoreCase("new")) {
                // Switch to the newest window (last in the set)
                String newHandle = handlesList.get(handlesList.size() - 1);
                driver.switchTo().window(newHandle);
                System.out.println("   Switched to newest window");
            } else if (windowIdentifier.equalsIgnoreCase("main") || windowIdentifier.equals("0")) {
                // Switch to the main/original window
                driver.switchTo().window(handlesList.get(0));
                System.out.println("   Switched to main window");
            } else {
                // Try as index
                try {
                    int index = Integer.parseInt(windowIdentifier);
                    if (index < handlesList.size()) {
                        driver.switchTo().window(handlesList.get(index));
                        System.out.println("   Switched to window at index: " + index);
                    } else {
                        result.setError("Window index " + index + " out of range (have " + handlesList.size() + " windows)");
                        return false;
                    }
                } catch (NumberFormatException e) {
                    // Try as handle directly
                    if (windowHandles.contains(windowIdentifier)) {
                        driver.switchTo().window(windowIdentifier);
                        System.out.println("   Switched to window by handle");
                    } else {
                        result.setError("Window not found: " + windowIdentifier);
                        return false;
                    }
                }
            }
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to switch window: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Close current window and switch to another.
     */
    private boolean performCloseWindow(Step step, StepResult result) {
        try {
            Set<String> handlesBefore = driver.getWindowHandles();
            driver.close();
            
            // Switch to another window if available
            Set<String> handlesAfter = driver.getWindowHandles();
            if (!handlesAfter.isEmpty()) {
                driver.switchTo().window(handlesAfter.iterator().next());
                System.out.println("   Closed window and switched to remaining window");
            } else {
                System.out.println("   Closed last window");
            }
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to close window: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Navigate back in browser history.
     */
    private boolean performNavigateBack(Step step, StepResult result) {
        try {
            driver.navigate().back();
            Thread.sleep(500); // Brief wait for navigation
            System.out.println("   Navigated back");
            return true;
        } catch (Exception e) {
            result.setError("Failed to navigate back: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Navigate forward in browser history.
     */
    private boolean performNavigateForward(Step step, StepResult result) {
        try {
            driver.navigate().forward();
            Thread.sleep(500);
            System.out.println("   Navigated forward");
            return true;
        } catch (Exception e) {
            result.setError("Failed to navigate forward: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Refresh the current page.
     */
    private boolean performRefreshPage(Step step, StepResult result) {
        try {
            driver.navigate().refresh();
            Thread.sleep(500);
            System.out.println("   Page refreshed");
            return true;
        } catch (Exception e) {
            result.setError("Failed to refresh page: " + e.getMessage());
            return false;
        }
    }
    
    // ============================================================================
    // FORM & INPUT ACTIONS
    // ============================================================================
    
    /**
     * Clear existing text and type new text. Avoids appending issues.
     */
    private boolean performClearAndType(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                element.clear();
                String textToType = replaceVariables(step.getData());
                element.sendKeys(textToType);
                System.out.println("   Cleared and typed: " + textToType);
                return true;
            } catch (Exception e) {
                result.setError("Failed to clear and type: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Type text slowly, character by character. Helps with autocomplete dropdowns.
     */
    private boolean performTypeSlowly(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                String textToType = replaceVariables(step.getData());
                int delayMs = 100; // Default delay between characters
                
                // Check if delay is specified in locator like "100ms"
                String locator = step.getLocator();
                if (locator != null && locator.contains("delay=")) {
                    try {
                        String delayStr = locator.substring(locator.indexOf("delay=") + 6);
                        delayStr = delayStr.replaceAll("[^0-9]", "");
                        delayMs = Integer.parseInt(delayStr);
                    } catch (Exception e) {
                        // Use default
                    }
                }
                
                for (char c : textToType.toCharArray()) {
                    element.sendKeys(String.valueOf(c));
                    Thread.sleep(delayMs);
                }
                
                System.out.println("   Slowly typed: " + textToType + " (" + delayMs + "ms per char)");
                return true;
            } catch (Exception e) {
                result.setError("Failed to type slowly: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Upload a file using file input element.
     */
    private boolean performUploadFile(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                String filePath = replaceVariables(step.getData());
                element.sendKeys(filePath);
                System.out.println("   Uploaded file: " + filePath);
                return true;
            } catch (Exception e) {
                result.setError("Failed to upload file: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Select dropdown option by index (0-based).
     */
    private boolean performSelectByIndex(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                Select select = new Select(element);
                int index = Integer.parseInt(step.getData().trim());
                select.selectByIndex(index);
                System.out.println("   Selected option by index: " + index);
                return true;
            } catch (Exception e) {
                result.setError("Failed to select by index: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Select dropdown option by value attribute.
     */
    private boolean performSelectByValue(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                Select select = new Select(element);
                String value = replaceVariables(step.getData());
                select.selectByValue(value);
                System.out.println("   Selected option by value: " + value);
                return true;
            } catch (Exception e) {
                result.setError("Failed to select by value: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Select dropdown option by visible text.
     */
    private boolean performSelectByText(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                Select select = new Select(element);
                String text = replaceVariables(step.getData());
                select.selectByVisibleText(text);
                System.out.println("   Selected option by text: " + text);
                return true;
            } catch (Exception e) {
                result.setError("Failed to select by text: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Check a checkbox (ensures it's checked, no-op if already checked).
     */
    private boolean performCheckCheckbox(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                if (!element.isSelected()) {
                    element.click();
                    System.out.println("   Checkbox checked");
                } else {
                    System.out.println("   Checkbox already checked");
                }
                return true;
            } catch (Exception e) {
                result.setError("Failed to check checkbox: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Uncheck a checkbox (ensures it's unchecked, no-op if already unchecked).
     */
    private boolean performUncheckCheckbox(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                if (element.isSelected()) {
                    element.click();
                    System.out.println("   Checkbox unchecked");
                } else {
                    System.out.println("   Checkbox already unchecked");
                }
                return true;
            } catch (Exception e) {
                result.setError("Failed to uncheck checkbox: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Set a slider/range input to a specific value.
     */
    private boolean performSetSlider(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                JavascriptExecutor js = (JavascriptExecutor) driver;
                String value = replaceVariables(step.getData());
                js.executeScript("arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('change'));", element, value);
                System.out.println("   Slider set to: " + value);
                return true;
            } catch (Exception e) {
                result.setError("Failed to set slider: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Set a date picker field. Handles various date input strategies.
     */
    private boolean performSetDatePicker(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                String dateValue = replaceVariables(step.getData());
                JavascriptExecutor js = (JavascriptExecutor) driver;
                
                // First try: Direct value setting for HTML5 date inputs
                String inputType = element.getAttribute("type");
                if ("date".equals(inputType)) {
                    // HTML5 date input expects yyyy-MM-dd format
                    js.executeScript("arguments[0].value = arguments[1];", element, dateValue);
                    js.executeScript("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", element);
                } else {
                    // Regular text input - clear and type
                    element.clear();
                    element.sendKeys(dateValue);
                    element.sendKeys(Keys.TAB); // Tab out to trigger validation
                }
                
                System.out.println("   Date picker set to: " + dateValue);
                return true;
            } catch (Exception e) {
                result.setError("Failed to set date picker: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    // ============================================================================
    // VERIFICATION & ASSERTION ACTIONS
    // ============================================================================
    
    /**
     * Assert exact text match on an element.
     */
    private boolean performAssertTextExact(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                String actualText = element.getText().trim();
                String expectedText = replaceVariables(step.getData());
                
                if (actualText.equals(expectedText)) {
                    System.out.println("   Text exact match passed: '" + actualText + "'");
                    return true;
                } else {
                    result.setError("Exact text mismatch. Expected: '" + expectedText + "', Actual: '" + actualText + "'");
                    return false;
                }
            } catch (Exception e) {
                result.setError("Failed to assert text: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Assert text contains a substring.
     */
    private boolean performAssertTextContains(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                String actualText = element.getText();
                String expectedSubstring = replaceVariables(step.getData());
                
                if (actualText.contains(expectedSubstring)) {
                    System.out.println("   Text contains '" + expectedSubstring + "' - passed");
                    return true;
                } else {
                    result.setError("Text does not contain expected substring. Expected: '" + expectedSubstring + "', Actual: '" + actualText + "'");
                    return false;
                }
            } catch (Exception e) {
                result.setError("Failed to assert text contains: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Assert the count of elements matching a locator.
     */
    private boolean performAssertElementCount(Step step, StepResult result) {
        try {
            By byLocator = parseLocator(step.getLocator());
            List<WebElement> elements = driver.findElements(byLocator);
            int actualCount = elements.size();
            int expectedCount = Integer.parseInt(step.getData().trim());
            
            if (actualCount == expectedCount) {
                System.out.println("   Element count matches: " + actualCount);
                return true;
            } else {
                result.setError("Element count mismatch. Expected: " + expectedCount + ", Actual: " + actualCount);
                return false;
            }
        } catch (Exception e) {
            result.setError("Failed to assert element count: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Assert an element's attribute has a specific value.
     * Data format: "attributeName=expectedValue" or JSON {"attribute": "href", "value": "http://..."}
     */
    private boolean performAssertAttribute(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                String data = step.getData();
                String attributeName;
                String expectedValue;
                
                if (data.contains("=")) {
                    String[] parts = data.split("=", 2);
                    attributeName = parts[0].trim();
                    expectedValue = replaceVariables(parts[1].trim());
                } else {
                    result.setError("Invalid data format. Expected: 'attribute=value'");
                    return false;
                }
                
                String actualValue = element.getAttribute(attributeName);
                
                if (expectedValue.equals(actualValue)) {
                    System.out.println("   Attribute '" + attributeName + "' matches: '" + actualValue + "'");
                    return true;
                } else {
                    result.setError("Attribute mismatch. Attribute: '" + attributeName + "', Expected: '" + expectedValue + "', Actual: '" + actualValue + "'");
                    return false;
                }
            } catch (Exception e) {
                result.setError("Failed to assert attribute: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Assert the page title matches expected value.
     */
    private boolean performAssertPageTitle(Step step, StepResult result) {
        try {
            String actualTitle = driver.getTitle();
            String expectedTitle = replaceVariables(step.getData());
            
            if (actualTitle.equals(expectedTitle)) {
                System.out.println("   Page title matches: '" + actualTitle + "'");
                return true;
            } else {
                result.setError("Page title mismatch. Expected: '" + expectedTitle + "', Actual: '" + actualTitle + "'");
                return false;
            }
        } catch (Exception e) {
            result.setError("Failed to assert page title: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Assert current URL matches exactly.
     */
    private boolean performAssertUrl(Step step, StepResult result) {
        try {
            String actualUrl = driver.getCurrentUrl();
            String expectedUrl = replaceVariables(step.getData());
            
            if (actualUrl.equals(expectedUrl)) {
                System.out.println("   URL matches: '" + actualUrl + "'");
                return true;
            } else {
                result.setError("URL mismatch. Expected: '" + expectedUrl + "', Actual: '" + actualUrl + "'");
                return false;
            }
        } catch (Exception e) {
            result.setError("Failed to assert URL: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Assert current URL contains a substring.
     */
    private boolean performAssertUrlContains(Step step, StepResult result) {
        try {
            String actualUrl = driver.getCurrentUrl();
            String expectedSubstring = replaceVariables(step.getData());
            
            if (actualUrl.contains(expectedSubstring)) {
                System.out.println("   URL contains '" + expectedSubstring + "' - passed");
                return true;
            } else {
                result.setError("URL does not contain expected substring. Expected: '" + expectedSubstring + "', Actual: '" + actualUrl + "'");
                return false;
            }
        } catch (Exception e) {
            result.setError("Failed to assert URL contains: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Assert an element is enabled.
     */
    private boolean performAssertElementEnabled(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                if (element.isEnabled()) {
                    System.out.println("   Element is enabled - passed");
                    return true;
                } else {
                    result.setError("Element is not enabled");
                    return false;
                }
            } catch (Exception e) {
                result.setError("Failed to check if element is enabled: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Assert an element is disabled.
     */
    private boolean performAssertElementDisabled(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                if (!element.isEnabled()) {
                    System.out.println("   Element is disabled - passed");
                    return true;
                } else {
                    result.setError("Element is not disabled (it is enabled)");
                    return false;
                }
            } catch (Exception e) {
                result.setError("Failed to check if element is disabled: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Assert a checkbox is checked.
     */
    private boolean performAssertCheckboxChecked(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                if (element.isSelected()) {
                    System.out.println("   Checkbox is checked - passed");
                    return true;
                } else {
                    result.setError("Checkbox is not checked");
                    return false;
                }
            } catch (Exception e) {
                result.setError("Failed to check checkbox state: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Assert a checkbox is unchecked.
     */
    private boolean performAssertCheckboxUnchecked(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                if (!element.isSelected()) {
                    System.out.println("   Checkbox is unchecked - passed");
                    return true;
                } else {
                    result.setError("Checkbox is checked (expected unchecked)");
                    return false;
                }
            } catch (Exception e) {
                result.setError("Failed to check checkbox state: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Assert a toast/snackbar message appears with expected text.
     * Looks for common toast selectors if locator not specified.
     */
    private boolean performAssertToastMessage(Step step, StepResult result) {
        try {
            String expectedText = replaceVariables(step.getData());
            WebElement toastElement;
            
            // If locator provided, use it; otherwise try common toast selectors
            if (step.getLocator() != null && !step.getLocator().trim().isEmpty()) {
                toastElement = findElementWithHealing(step, result);
            } else {
                // Try common toast/snackbar selectors
                String[] commonSelectors = {
                    ".toast", ".toast-message", ".snackbar", ".notification",
                    "[role='alert']", ".alert", ".Toastify__toast", ".MuiSnackbar-root"
                };
                
                toastElement = null;
                for (String selector : commonSelectors) {
                    try {
                        List<WebElement> elements = driver.findElements(By.cssSelector(selector));
                        for (WebElement el : elements) {
                            if (el.isDisplayed() && el.getText().contains(expectedText)) {
                                toastElement = el;
                                break;
                            }
                        }
                        if (toastElement != null) break;
                    } catch (Exception e) {
                        // Continue trying other selectors
                    }
                }
            }
            
            if (toastElement != null && toastElement.getText().contains(expectedText)) {
                System.out.println("   Toast message found: '" + expectedText + "'");
                return true;
            } else {
                result.setError("Toast message not found or does not contain: '" + expectedText + "'");
                return false;
            }
        } catch (Exception e) {
            result.setError("Failed to assert toast message: " + e.getMessage());
            return false;
        }
    }
    
    // ============================================================================
    // KEYBOARD & MOUSE ACTIONS
    // ============================================================================
    
    /**
     * Hover over an element to reveal hidden menus/tooltips.
     */
    private boolean performHoverOverElement(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                Actions actions = new Actions(driver);
                actions.moveToElement(element).perform();
                Thread.sleep(300); // Brief pause for hover effects
                System.out.println("   Hovered over element");
                return true;
            } catch (Exception e) {
                result.setError("Failed to hover over element: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Right-click (context click) on an element.
     */
    private boolean performRightClick(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                Actions actions = new Actions(driver);
                actions.contextClick(element).perform();
                System.out.println("   Right-clicked on element");
                return true;
            } catch (Exception e) {
                result.setError("Failed to right-click: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Double-click on an element.
     */
    private boolean performDoubleClick(Step step, StepResult result) {
        WebElement element = findElementWithHealing(step, result);
        if (element != null) {
            try {
                Actions actions = new Actions(driver);
                actions.doubleClick(element).perform();
                System.out.println("   Double-clicked on element");
                return true;
            } catch (Exception e) {
                result.setError("Failed to double-click: " + e.getMessage());
                return false;
            }
        }
        return false;
    }
    
    /**
     * Drag an element and drop it on another element.
     * Locator: source element, Data: target element locator
     */
    private boolean performDragAndDrop(Step step, StepResult result) {
        try {
            WebElement sourceElement = findElementWithHealing(step, result);
            if (sourceElement == null) {
                return false;
            }
            
            // Parse target locator from data
            By targetLocator = parseLocator(step.getData());
            WebElement targetElement = wait.until(ExpectedConditions.visibilityOfElementLocated(targetLocator));
            
            Actions actions = new Actions(driver);
            actions.dragAndDrop(sourceElement, targetElement).perform();
            
            System.out.println("   Drag and drop completed");
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to drag and drop: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Press a keyboard key (Enter, Tab, Escape, arrow keys, etc.)
     */
    private boolean performPressKey(Step step, StepResult result) {
        try {
            String keyName = step.getData().toUpperCase().trim();
            Keys key = getKeyFromName(keyName);
            
            if (key == null) {
                result.setError("Unknown key: " + keyName);
                return false;
            }
            
            // If locator provided, send key to that element; otherwise send to active element
            if (step.getLocator() != null && !step.getLocator().trim().isEmpty()) {
                WebElement element = findElementWithHealing(step, result);
                if (element != null) {
                    element.sendKeys(key);
                } else {
                    return false;
                }
            } else {
                Actions actions = new Actions(driver);
                actions.sendKeys(key).perform();
            }
            
            System.out.println("   Pressed key: " + keyName);
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to press key: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Execute a keyboard shortcut (Ctrl+S, Ctrl+Z, etc.)
     * Data format: "CTRL+S", "CTRL+SHIFT+N", etc.
     */
    private boolean performKeyboardShortcut(Step step, StepResult result) {
        try {
            String shortcut = step.getData().toUpperCase().trim();
            String[] parts = shortcut.split("\\+");
            
            Actions actions = new Actions(driver);
            
            // Build the key combination
            for (int i = 0; i < parts.length - 1; i++) {
                Keys modifier = getKeyFromName(parts[i]);
                if (modifier != null) {
                    actions.keyDown(modifier);
                }
            }
            
            // Press the final key
            Keys finalKey = getKeyFromName(parts[parts.length - 1]);
            if (finalKey != null) {
                actions.sendKeys(finalKey);
            } else {
                // It might be a character
                actions.sendKeys(parts[parts.length - 1].toLowerCase());
            }
            
            // Release modifiers
            for (int i = parts.length - 2; i >= 0; i--) {
                Keys modifier = getKeyFromName(parts[i]);
                if (modifier != null) {
                    actions.keyUp(modifier);
                }
            }
            
            actions.perform();
            System.out.println("   Executed keyboard shortcut: " + shortcut);
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to execute keyboard shortcut: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Convert a key name string to Selenium Keys enum.
     */
    private Keys getKeyFromName(String keyName) {
        switch (keyName.toUpperCase()) {
            case "ENTER": case "RETURN": return Keys.ENTER;
            case "TAB": return Keys.TAB;
            case "ESCAPE": case "ESC": return Keys.ESCAPE;
            case "BACKSPACE": return Keys.BACK_SPACE;
            case "DELETE": case "DEL": return Keys.DELETE;
            case "SPACE": return Keys.SPACE;
            case "UP": case "ARROW_UP": return Keys.ARROW_UP;
            case "DOWN": case "ARROW_DOWN": return Keys.ARROW_DOWN;
            case "LEFT": case "ARROW_LEFT": return Keys.ARROW_LEFT;
            case "RIGHT": case "ARROW_RIGHT": return Keys.ARROW_RIGHT;
            case "HOME": return Keys.HOME;
            case "END": return Keys.END;
            case "PAGEUP": case "PAGE_UP": return Keys.PAGE_UP;
            case "PAGEDOWN": case "PAGE_DOWN": return Keys.PAGE_DOWN;
            case "CTRL": case "CONTROL": return Keys.CONTROL;
            case "ALT": return Keys.ALT;
            case "SHIFT": return Keys.SHIFT;
            case "F1": return Keys.F1;
            case "F2": return Keys.F2;
            case "F3": return Keys.F3;
            case "F4": return Keys.F4;
            case "F5": return Keys.F5;
            case "F6": return Keys.F6;
            case "F7": return Keys.F7;
            case "F8": return Keys.F8;
            case "F9": return Keys.F9;
            case "F10": return Keys.F10;
            case "F11": return Keys.F11;
            case "F12": return Keys.F12;
            default: return null;
        }
    }
    
    // ============================================================================
    // TABLES & DYNAMIC CONTENT ACTIONS
    // ============================================================================
    
    /**
     * Get a table cell value by row and column.
     * Data format: "row=1,col=2" (1-indexed) or "row=1,col=Name" (column header)
     */
    private boolean performGetTableCellValue(Step step, StepResult result) {
        try {
            WebElement table = findElementWithHealing(step, result);
            if (table == null) return false;
            
            String data = step.getData();
            int rowIndex = 0;
            int colIndex = 0;
            String colName = null;
            
            // Parse row and col from data
            for (String part : data.split(",")) {
                part = part.trim();
                if (part.startsWith("row=")) {
                    rowIndex = Integer.parseInt(part.substring(4).trim()) - 1; // Convert to 0-indexed
                } else if (part.startsWith("col=")) {
                    String colStr = part.substring(4).trim();
                    try {
                        colIndex = Integer.parseInt(colStr) - 1;
                    } catch (NumberFormatException e) {
                        colName = colStr; // It's a column header name
                    }
                } else if (part.startsWith("variable=")) {
                    // Variable name to store result
                }
            }
            
            // If column name provided, find column index
            if (colName != null) {
                List<WebElement> headers = table.findElements(By.cssSelector("th, thead td"));
                for (int i = 0; i < headers.size(); i++) {
                    if (headers.get(i).getText().trim().equalsIgnoreCase(colName)) {
                        colIndex = i;
                        break;
                    }
                }
            }
            
            // Get the cell
            List<WebElement> rows = table.findElements(By.cssSelector("tbody tr, tr"));
            if (rowIndex < rows.size()) {
                List<WebElement> cells = rows.get(rowIndex).findElements(By.cssSelector("td, th"));
                if (colIndex < cells.size()) {
                    String cellValue = cells.get(colIndex).getText().trim();
                    
                    // Store in variable
                    String variableName = "table_cell_value";
                    if (data.contains("variable=")) {
                        variableName = data.substring(data.indexOf("variable=") + 9).split(",")[0].trim();
                    }
                    extractedVariables.put(variableName, cellValue);
                    
                    System.out.println("   Table cell [" + (rowIndex+1) + "," + (colIndex+1) + "] = '" + cellValue + "'");
                    return true;
                }
            }
            
            result.setError("Cell not found at row " + (rowIndex+1) + ", col " + (colIndex+1));
            return false;
            
        } catch (Exception e) {
            result.setError("Failed to get table cell value: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Assert the number of rows in a table.
     */
    private boolean performAssertTableRowCount(Step step, StepResult result) {
        try {
            WebElement table = findElementWithHealing(step, result);
            if (table == null) return false;
            
            List<WebElement> rows = table.findElements(By.cssSelector("tbody tr"));
            int actualCount = rows.size();
            int expectedCount = Integer.parseInt(step.getData().trim());
            
            if (actualCount == expectedCount) {
                System.out.println("   Table row count matches: " + actualCount);
                return true;
            } else {
                result.setError("Table row count mismatch. Expected: " + expectedCount + ", Actual: " + actualCount);
                return false;
            }
        } catch (Exception e) {
            result.setError("Failed to assert table row count: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Find a table row where a column contains a value, then click on it.
     * Data format: "col=Name,value=John" or "value=John" to search all columns
     */
    private boolean performClickTableRowByValue(Step step, StepResult result) {
        try {
            WebElement table = findElementWithHealing(step, result);
            if (table == null) return false;
            
            String data = step.getData();
            String searchValue = null;
            Integer colIndex = null;
            
            for (String part : data.split(",")) {
                part = part.trim();
                if (part.startsWith("value=")) {
                    searchValue = replaceVariables(part.substring(6).trim());
                } else if (part.startsWith("col=")) {
                    try {
                        colIndex = Integer.parseInt(part.substring(4).trim()) - 1;
                    } catch (NumberFormatException e) {
                        // Find column by header name
                        String colName = part.substring(4).trim();
                        List<WebElement> headers = table.findElements(By.cssSelector("th"));
                        for (int i = 0; i < headers.size(); i++) {
                            if (headers.get(i).getText().trim().equalsIgnoreCase(colName)) {
                                colIndex = i;
                                break;
                            }
                        }
                    }
                }
            }
            
            if (searchValue == null) {
                result.setError("No search value specified in data");
                return false;
            }
            
            // Search rows
            List<WebElement> rows = table.findElements(By.cssSelector("tbody tr"));
            for (WebElement row : rows) {
                List<WebElement> cells = row.findElements(By.cssSelector("td"));
                
                if (colIndex != null && colIndex < cells.size()) {
                    if (cells.get(colIndex).getText().contains(searchValue)) {
                        row.click();
                        System.out.println("   Clicked row containing '" + searchValue + "'");
                        return true;
                    }
                } else {
                    // Search all columns
                    for (WebElement cell : cells) {
                        if (cell.getText().contains(searchValue)) {
                            row.click();
                            System.out.println("   Clicked row containing '" + searchValue + "'");
                            return true;
                        }
                    }
                }
            }
            
            result.setError("No row found containing value: " + searchValue);
            return false;
            
        } catch (Exception e) {
            result.setError("Failed to click table row: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Wait for a table to finish loading (waits for rows to appear).
     */
    private boolean performWaitForTableToLoad(Step step, StepResult result) {
        try {
            int timeoutSeconds = 30;
            if (step.getData() != null && !step.getData().trim().isEmpty()) {
                try {
                    timeoutSeconds = Integer.parseInt(step.getData().trim());
                } catch (NumberFormatException e) {
                    // Use default
                }
            }
            
            WebDriverWait tableWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
            By tableLocator = parseLocator(step.getLocator());
            
            // Wait for table to have at least one row
            tableWait.until(webDriver -> {
                try {
                    WebElement table = webDriver.findElement(tableLocator);
                    List<WebElement> rows = table.findElements(By.cssSelector("tbody tr, tr"));
                    return !rows.isEmpty();
                } catch (Exception e) {
                    return false;
                }
            });
            
            System.out.println("   Table loaded with data");
            return true;
            
        } catch (Exception e) {
            result.setError("Table load wait timed out: " + e.getMessage());
            return false;
        }
    }
    
    // ============================================================================
    // ALERTS & MODALS ACTIONS
    // ============================================================================
    
    /**
     * Accept (click OK) on a JavaScript alert/confirm dialog.
     */
    private boolean performAcceptAlert(Step step, StepResult result) {
        try {
            int timeoutSeconds = 5;
            if (step.getData() != null && !step.getData().trim().isEmpty()) {
                try {
                    timeoutSeconds = Integer.parseInt(step.getData().trim());
                } catch (NumberFormatException e) {
                    // Use default
                }
            }
            
            WebDriverWait alertWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
            Alert alert = alertWait.until(ExpectedConditions.alertIsPresent());
            String alertText = alert.getText();
            alert.accept();
            
            System.out.println("   Accepted alert: '" + alertText + "'");
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to accept alert: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Dismiss (click Cancel) on a JavaScript alert/confirm dialog.
     */
    private boolean performDismissAlert(Step step, StepResult result) {
        try {
            int timeoutSeconds = 5;
            if (step.getData() != null && !step.getData().trim().isEmpty()) {
                try {
                    timeoutSeconds = Integer.parseInt(step.getData().trim());
                } catch (NumberFormatException e) {
                    // Use default
                }
            }
            
            WebDriverWait alertWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
            Alert alert = alertWait.until(ExpectedConditions.alertIsPresent());
            String alertText = alert.getText();
            alert.dismiss();
            
            System.out.println("   Dismissed alert: '" + alertText + "'");
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to dismiss alert: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Get the text from a JavaScript alert and store in a variable.
     */
    private boolean performGetAlertText(Step step, StepResult result) {
        try {
            int timeoutSeconds = 5;
            String variableName = "alert_text";
            
            if (step.getData() != null && !step.getData().trim().isEmpty()) {
                variableName = step.getData().trim();
            }
            
            WebDriverWait alertWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
            Alert alert = alertWait.until(ExpectedConditions.alertIsPresent());
            String alertText = alert.getText();
            
            extractedVariables.put(variableName, alertText);
            System.out.println("   Alert text stored in '" + variableName + "': '" + alertText + "'");
            
            return true;
            
        } catch (Exception e) {
            result.setError("Failed to get alert text: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Wait for a modal dialog to become visible.
     */
    private boolean performWaitForModalVisible(Step step, StepResult result) {
        try {
            int timeoutSeconds = 10;
            if (step.getData() != null && !step.getData().trim().isEmpty()) {
                try {
                    timeoutSeconds = Integer.parseInt(step.getData().trim());
                } catch (NumberFormatException e) {
                    // Use default
                }
            }
            
            WebDriverWait modalWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
            
            // If locator provided, wait for that specific modal
            if (step.getLocator() != null && !step.getLocator().trim().isEmpty()) {
                By modalLocator = parseLocator(step.getLocator());
                modalWait.until(ExpectedConditions.visibilityOfElementLocated(modalLocator));
                System.out.println("   Modal is visible");
            } else {
                // Try common modal selectors
                String[] modalSelectors = {
                    ".modal.show", ".modal.in", "[role='dialog']:not([aria-hidden='true'])",
                    ".MuiDialog-root", ".ant-modal-content", ".modal-content"
                };
                
                boolean found = modalWait.until(webDriver -> {
                    for (String selector : modalSelectors) {
                        try {
                            WebElement modal = webDriver.findElement(By.cssSelector(selector));
                            if (modal.isDisplayed()) {
                                return true;
                            }
                        } catch (Exception e) {
                            // Continue
                        }
                    }
                    return false;
                });
                
                if (found) {
                    System.out.println("   Modal is visible");
                }
            }
            
            return true;
            
        } catch (Exception e) {
            result.setError("Modal did not appear: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Wait for a modal dialog to be dismissed/closed.
     */
    private boolean performWaitForModalDismissed(Step step, StepResult result) {
        try {
            int timeoutSeconds = 10;
            if (step.getData() != null && !step.getData().trim().isEmpty()) {
                try {
                    timeoutSeconds = Integer.parseInt(step.getData().trim());
                } catch (NumberFormatException e) {
                    // Use default
                }
            }
            
            WebDriverWait modalWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
            
            // If locator provided, wait for that specific modal to disappear
            if (step.getLocator() != null && !step.getLocator().trim().isEmpty()) {
                By modalLocator = parseLocator(step.getLocator());
                modalWait.until(ExpectedConditions.invisibilityOfElementLocated(modalLocator));
            } else {
                // Try common modal selectors
                String[] modalSelectors = {
                    ".modal.show", ".modal.in", "[role='dialog']:not([aria-hidden='true'])"
                };
                
                modalWait.until(webDriver -> {
                    for (String selector : modalSelectors) {
                        try {
                            List<WebElement> modals = webDriver.findElements(By.cssSelector(selector));
                            for (WebElement modal : modals) {
                                if (modal.isDisplayed()) {
                                    return false; // Still visible
                                }
                            }
                        } catch (Exception e) {
                            // Continue
                        }
                    }
                    return true; // All modals dismissed
                });
            }
            
            System.out.println("   Modal dismissed");
            return true;
            
        } catch (Exception e) {
            result.setError("Modal did not dismiss: " + e.getMessage());
            return false;
        }
    }
    
    // ============================================================================
    // API / NETWORK ACTIONS
    // ============================================================================
    
    /**
     * Wait for a specific API/network request to complete.
     * Uses JavaScript Performance API to detect network activity.
     * Data can contain: URL pattern to wait for, or timeout in seconds.
     */
    private boolean performWaitForApiResponse(Step step, StepResult result) {
        try {
            JavascriptExecutor js = (JavascriptExecutor) driver;
            
            int timeoutSeconds = 30;
            String urlPattern = null;
            
            String data = step.getData();
            if (data != null && !data.trim().isEmpty()) {
                // Check if it's a number (timeout) or string (URL pattern)
                try {
                    timeoutSeconds = Integer.parseInt(data.trim());
                } catch (NumberFormatException e) {
                    urlPattern = data.trim();
                }
            }
            
            // Also check locator for URL pattern
            if (urlPattern == null && step.getLocator() != null && !step.getLocator().trim().isEmpty()) {
                urlPattern = step.getLocator();
            }
            
            final String finalUrlPattern = urlPattern;
            final long startTime = System.currentTimeMillis();
            final long timeoutMs = timeoutSeconds * 1000L;
            
            // Inject a script to track XHR/fetch requests if not already done
            js.executeScript(
                "if (!window.__apiTracker) {" +
                "  window.__apiTracker = { pending: 0, completed: [], lastActivity: Date.now() };" +
                "  const originalFetch = window.fetch;" +
                "  window.fetch = function(...args) {" +
                "    window.__apiTracker.pending++;" +
                "    window.__apiTracker.lastActivity = Date.now();" +
                "    return originalFetch.apply(this, args).finally(() => {" +
                "      window.__apiTracker.pending--;" +
                "      window.__apiTracker.completed.push(args[0]);" +
                "      window.__apiTracker.lastActivity = Date.now();" +
                "    });" +
                "  };" +
                "  const originalXhrOpen = XMLHttpRequest.prototype.open;" +
                "  XMLHttpRequest.prototype.open = function(...args) {" +
                "    this.__url = args[1];" +
                "    return originalXhrOpen.apply(this, args);" +
                "  };" +
                "  const originalXhrSend = XMLHttpRequest.prototype.send;" +
                "  XMLHttpRequest.prototype.send = function(...args) {" +
                "    window.__apiTracker.pending++;" +
                "    window.__apiTracker.lastActivity = Date.now();" +
                "    this.addEventListener('loadend', () => {" +
                "      window.__apiTracker.pending--;" +
                "      window.__apiTracker.completed.push(this.__url);" +
                "      window.__apiTracker.lastActivity = Date.now();" +
                "    });" +
                "    return originalXhrSend.apply(this, args);" +
                "  };" +
                "}"
            );
            
            // Wait for API activity to complete
            WebDriverWait apiWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
            
            boolean success = apiWait.until(webDriver -> {
                try {
                    Long pending = (Long) js.executeScript("return window.__apiTracker ? window.__apiTracker.pending : 0;");
                    Long lastActivity = (Long) js.executeScript("return window.__apiTracker ? window.__apiTracker.lastActivity : Date.now();");
                    
                    // Check if specific URL pattern matched
                    if (finalUrlPattern != null) {
                        @SuppressWarnings("unchecked")
                        java.util.ArrayList<String> completed = (java.util.ArrayList<String>) js.executeScript(
                            "return window.__apiTracker ? window.__apiTracker.completed : [];"
                        );
                        for (String url : completed) {
                            if (url != null && url.contains(finalUrlPattern)) {
                                return true;
                            }
                        }
                    }
                    
                    // Check if network is idle (no pending requests and no activity for 500ms)
                    long now = System.currentTimeMillis();
                    boolean isIdle = pending == 0 && (now - lastActivity > 500);
                    
                    return isIdle;
                } catch (Exception e) {
                    return false;
                }
            });
            
            if (success) {
                if (finalUrlPattern != null) {
                    System.out.println("   API response received for: " + finalUrlPattern);
                } else {
                    System.out.println("   Network idle - all API requests completed");
                }
                return true;
            }
            
            result.setError("API response wait timed out");
            return false;
            
        } catch (Exception e) {
            result.setError("Failed to wait for API response: " + e.getMessage());
            return false;
        }
    }

    private String captureScreenshot(int stepIndex, Step step) {
        try {
            TakesScreenshot takesScreenshot = (TakesScreenshot) driver;
            File sourceFile = takesScreenshot.getScreenshotAs(OutputType.FILE);
            
            // Enhanced screenshot naming with context
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            
            // Get browser type from capabilities or default to chrome
            String browserType = "chrome"; // Default
            try {
                org.openqa.selenium.Capabilities caps = ((org.openqa.selenium.remote.RemoteWebDriver) driver).getCapabilities();
                browserType = caps.getBrowserName().toLowerCase();
            } catch (Exception e) {
                // Keep default if unable to detect
            }
            
            // Clean step description for filename (remove special chars)
            String stepDesc = step.getData() != null ? 
                step.getData().replaceAll("[^a-zA-Z0-9]", "_").substring(0, Math.min(30, step.getData().length())) : 
                step.getAction();
            
            // Format: browser_step02_action_description_timestamp.png
            // Example: chrome_step02_click_login_button_20260210_143052.png
            String filename = String.format("%s_step%02d_%s_%s_%s.png", 
                browserType,
                stepIndex + 1, 
                step.getAction(),
                stepDesc,
                timestamp);
            
            File destinationFile = new File(SCREENSHOTS_DIR, filename);
            
            FileUtils.copyFile(sourceFile, destinationFile);
            System.out.println("    Screenshot saved: " + destinationFile.getPath());
            
            return destinationFile.getPath();
        } catch (IOException e) {
            System.err.println("    Failed to capture screenshot: " + e.getMessage());
            return null;
        }
    }

    // =======================================================================
    // Appium / Mobile Gesture Action Handlers
    // =======================================================================

    private AppiumActions appiumActions() {
        return new AppiumActions(driver);
    }

    private boolean performAppiumTap(Step step, StepResult result) {
        try {
            WebElement el = findElementWithHealing(step, result);
            if (el == null) return false;
            appiumActions().tap(el);
            result.setDetails("Tapped element");
            return true;
        } catch (Exception e) {
            result.setError("Tap failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumLongPress(Step step, StepResult result) {
        try {
            WebElement el = findElementWithHealing(step, result);
            if (el == null) return false;
            StepParser sp = new StepParser(step);
            int duration = sp.getIntValue("duration", 1500);
            appiumActions().longPress(el, duration);
            result.setDetails("Long-pressed element for " + duration + "ms");
            return true;
        } catch (Exception e) {
            result.setError("Long press failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumSwipeUp(Step step, StepResult result) {
        try {
            StepParser sp = new StepParser(step);
            double fraction = sp.getDoubleValue("fraction", 0.5);
            appiumActions().swipeUp(fraction);
            result.setDetails("Swiped up " + (int)(fraction * 100) + "% of screen");
            return true;
        } catch (Exception e) {
            result.setError("Swipe up failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumSwipeDown(Step step, StepResult result) {
        try {
            StepParser sp = new StepParser(step);
            double fraction = sp.getDoubleValue("fraction", 0.5);
            appiumActions().swipeDown(fraction);
            result.setDetails("Swiped down " + (int)(fraction * 100) + "% of screen");
            return true;
        } catch (Exception e) {
            result.setError("Swipe down failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumSwipeLeft(Step step, StepResult result) {
        try {
            StepParser sp = new StepParser(step);
            double fraction = sp.getDoubleValue("fraction", 0.5);
            appiumActions().swipeLeft(fraction);
            result.setDetails("Swiped left " + (int)(fraction * 100) + "% of screen");
            return true;
        } catch (Exception e) {
            result.setError("Swipe left failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumSwipeRight(Step step, StepResult result) {
        try {
            StepParser sp = new StepParser(step);
            double fraction = sp.getDoubleValue("fraction", 0.5);
            appiumActions().swipeRight(fraction);
            result.setDetails("Swiped right " + (int)(fraction * 100) + "% of screen");
            return true;
        } catch (Exception e) {
            result.setError("Swipe right failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumPinch(Step step, StepResult result) {
        try {
            appiumActions().pinch();
            result.setDetails("Pinch (zoom out) gesture performed");
            return true;
        } catch (Exception e) {
            result.setError("Pinch failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumSpread(Step step, StepResult result) {
        try {
            appiumActions().spread();
            result.setDetails("Spread (zoom in) gesture performed");
            return true;
        } catch (Exception e) {
            result.setError("Spread failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumHideKeyboard(Step step, StepResult result) {
        try {
            appiumActions().hideKeyboard();
            result.setDetails("Keyboard hidden");
            return true;
        } catch (Exception e) {
            result.setError("Hide keyboard failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumPressBack(Step step, StepResult result) {
        try {
            appiumActions().pressBack();
            result.setDetails("Pressed back button");
            return true;
        } catch (Exception e) {
            result.setError("Press back failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumPressHome(Step step, StepResult result) {
        try {
            appiumActions().pressHome();
            result.setDetails("Pressed home button");
            return true;
        } catch (Exception e) {
            result.setError("Press home failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumSetOrientation(Step step, StepResult result) {
        try {
            StepParser sp = new StepParser(step);
            String orientation = sp.getStringValue("value", "LANDSCAPE");
            appiumActions().setOrientation(orientation);
            result.setDetails("Orientation set to " + orientation);
            return true;
        } catch (Exception e) {
            result.setError("Set orientation failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumSwitchToWebView(Step step, StepResult result) {
        try {
            appiumActions().switchToWebView();
            result.setDetails("Switched to WEBVIEW context");
            return true;
        } catch (Exception e) {
            result.setError("Switch to webview failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumSwitchToNative(Step step, StepResult result) {
        try {
            appiumActions().switchToNativeContext();
            result.setDetails("Switched to NATIVE_APP context");
            return true;
        } catch (Exception e) {
            result.setError("Switch to native failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumLaunchApp(Step step, StepResult result) {
        try {
            appiumActions().launchApp();
            result.setDetails("App launched");
            return true;
        } catch (Exception e) {
            result.setError("Launch app failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumCloseApp(Step step, StepResult result) {
        try {
            appiumActions().closeApp();
            result.setDetails("App closed");
            return true;
        } catch (Exception e) {
            result.setError("Close app failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumBackgroundApp(Step step, StepResult result) {
        try {
            StepParser sp = new StepParser(step);
            int seconds = sp.getIntValue("duration", 5);
            appiumActions().backgroundApp(seconds);
            result.setDetails("App backgrounded for " + seconds + "s");
            return true;
        } catch (Exception e) {
            result.setError("Background app failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumActivateApp(Step step, StepResult result) {
        try {
            StepParser sp = new StepParser(step);
            String appId = sp.getStringValue("value", "");
            if (appId.isEmpty()) {
                result.setError("activate_app requires 'value' (app package/bundle ID)");
                return false;
            }
            appiumActions().activateApp(appId);
            result.setDetails("Activated app: " + appId);
            return true;
        } catch (Exception e) {
            result.setError("Activate app failed: " + e.getMessage());
            return false;
        }
    }

    private boolean performAppiumTerminateApp(Step step, StepResult result) {
        try {
            StepParser sp = new StepParser(step);
            String appId = sp.getStringValue("value", "");
            if (appId.isEmpty()) {
                result.setError("terminate_app requires 'value' (app package/bundle ID)");
                return false;
            }
            appiumActions().terminateApp(appId);
            result.setDetails("Terminated app: " + appId);
            return true;
        } catch (Exception e) {
            result.setError("Terminate app failed: " + e.getMessage());
            return false;
        }
    }
}