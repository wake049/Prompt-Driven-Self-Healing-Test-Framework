package demo;

import com.fasterxml.jackson.core.type.TypeReference;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import io.github.bonigarcia.wdm.WebDriverManager;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;

public class Main {
    private static final String STEPS_FILE = "steps.json";
    private static final String RUN_SUMMARY_FILE = "run_summary.json";
    
    public static void main(String[] args) {
        System.out.println("=== Prompt-Driven Self-Healing Test Framework ===");
        System.out.println("Milestone M5 - Execution Service & Self-Healing Engine");
        System.out.println();
        
        WebDriver driver = null;
        SelfHealing selfHealing = null;
        RunSummary summary = null;
        LocalDateTime startTime = LocalDateTime.now();
        
        try {
            // Initialize WebDriver
            System.out.println("Initializing WebDriver...");
            WebDriverManager.chromedriver().setup();
            
            ChromeOptions options = new ChromeOptions();
            // Remove headless mode - browser should open visibly
            // options.addArguments("--headless"); // Commented out for visible browser
            options.addArguments("--no-sandbox");
            options.addArguments("--disable-dev-shm-usage");
            options.addArguments("--disable-blink-features=AutomationControlled");
            options.addArguments("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            options.addArguments("--window-size=1920,1080");
            options.addArguments("--start-maximized");
            
            System.out.println("Chrome options configured for visible browser...");
            
            driver = new ChromeDriver(options);
            driver.manage().window().maximize();
            
            System.out.println("Chrome browser should now be visible...");
            System.out.println("Waiting 3 seconds for browser to fully initialize...");
            Thread.sleep(3000); // Give browser time to open visibly
            
            // Initialize components
            ElementRepository elementRepository = new ElementRepository();
            selfHealing = new SelfHealing(driver, elementRepository);
            ExecutionService executionService = new ExecutionService(driver, selfHealing);
            
            System.out.println("Element repository initialized.");
            
            // Load test steps - try SQL backend first, then fall back to JSON file
            List<Step> steps = new ArrayList<>();
            SqlTestStepRepository sqlStepRepository = new SqlTestStepRepository();
            
            if (sqlStepRepository.isAvailable()) {
                System.out.println("✓ SQL backend is available - attempting to generate test steps...");
                
                // Try the actual session name from your database
                String[] sessionNames = {
                    "Session for Home",  // Your actual session name
                    "Swag Labs Self-Healing Test Session", 
                    "Sample Login Test", 
                    "Login Test Session", 
                    "Test Session"
                };
                
                for (String sessionName : sessionNames) {
                    System.out.println("  Trying session: " + sessionName);
                    steps = sqlStepRepository.generateTestStepsFromElements(sessionName);
                    if (!steps.isEmpty()) {
                        System.out.println("✓ Generated " + steps.size() + " test steps from session: " + sessionName);
                        break;
                    }
                }
                
                if (steps.isEmpty()) {
                    System.out.println("⚠ No test steps generated from SQL backend");
                    System.out.println("  This might be because:");
                    System.out.println("  - Session not found");
                    System.out.println("  - No elements in session");
                    System.out.println("  - Elements don't have required data");
                    System.out.println("  → Falling back to JSON file");
                }
            } else {
                System.out.println("⚠ SQL backend not available - using JSON file mode");
            }
            
            // Fall back to JSON file if SQL backend didn't provide steps
            if (steps.isEmpty()) {
                System.out.println("Loading test steps from " + STEPS_FILE + "...");
                try {
                    steps = JsonUtil.readListFromFile(STEPS_FILE, new TypeReference<List<Step>>() {});
                    System.out.println("✓ Loaded " + steps.size() + " test steps from JSON file");
                } catch (IOException e) {
                    System.err.println("Error loading steps file: " + e.getMessage());
                    System.err.println("Please ensure " + STEPS_FILE + " exists or populate SQL backend with test elements");
                    return;
                }
            }
            
            System.out.println();
            System.out.println("=== Test Execution Started ===");
            // Execute test steps
            List<StepResult> results = new ArrayList<>();
            
            for (int i = 0; i < steps.size(); i++) {
                Step step = steps.get(i);
                StepResult result = executionService.executeStep(i, step);
                results.add(result);
                
                // Add small delay between steps for stability
                try {
                    Thread.sleep(500);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            
            LocalDateTime endTime = LocalDateTime.now();
            long totalDuration = java.time.Duration.between(startTime, endTime).toMillis();
            
            // Generate run summary
            summary = generateRunSummary(startTime, endTime, totalDuration, results);
            
            // Print console summary
            printConsoleSummary(summary);
            
            // Save run summary to file
            try {
                JsonUtil.writeToFile(RUN_SUMMARY_FILE, summary);
                System.out.println("Run summary saved to: " + RUN_SUMMARY_FILE);
            } catch (IOException e) {
                System.err.println("Error saving run summary: " + e.getMessage());
            }
            
            // Print healing log summary
            printHealingLogSummary(selfHealing.getHealingLog());
            
        } catch (Exception e) {
            System.err.println("Fatal error during test execution: " + e.getMessage());
            e.printStackTrace();
        } finally {
            // Submit healing data for review before closing
            if (selfHealing != null && !selfHealing.getHealingLog().isEmpty()) {
                try {
                    submitHealingForReview(selfHealing.getHealingLog(), summary);
                } catch (Exception e) {
                    System.err.println("Failed to submit healing data for review: " + e.getMessage());
                }
            }
            
            if (driver != null) {
                System.out.println();
                System.out.println("Closing WebDriver...");
                driver.quit();
            }
        }
        
        System.out.println();
        System.out.println("=== Test Execution Completed ===");
    }
    
    private static RunSummary generateRunSummary(LocalDateTime startTime, LocalDateTime endTime, 
                                               long totalDuration, List<StepResult> results) {
        DateTimeFormatter formatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        
        int totalSteps = results.size();
        int passedSteps = 0;
        int failedSteps = 0;
        int healedSteps = 0;
        
        for (StepResult result : results) {
            switch (result.getStatus()) {
                case "PASS":
                    passedSteps++;
                    break;
                case "FAIL":
                    failedSteps++;
                    break;
                case "HEALED":
                    healedSteps++;
                    passedSteps++; // Healed steps are also considered passed
                    break;
            }
        }
        
        return new RunSummary(
            startTime.format(formatter),
            endTime.format(formatter),
            totalDuration,
            totalSteps,
            passedSteps,
            failedSteps,
            healedSteps,
            results
        );
    }
    
    private static void printConsoleSummary(RunSummary summary) {
        System.out.println();
        System.out.println("=== Test Run Summary ===");
        System.out.println("Start Time: " + summary.getStartTime());
        System.out.println("End Time: " + summary.getEndTime());
        System.out.println("Total Duration: " + summary.getTotalDuration() + " ms");
        System.out.println("Total Steps: " + summary.getTotalSteps());
        System.out.println("Passed Steps: " + summary.getPassedSteps());
        System.out.println("Failed Steps: " + summary.getFailedSteps());
        System.out.println("Healed Steps: " + summary.getHealedSteps());
        
        double successRate = summary.getTotalSteps() > 0 ? 
            (double) summary.getPassedSteps() / summary.getTotalSteps() * 100 : 0;
        System.out.printf("Success Rate: %.1f%%%n", successRate);
        
        if (summary.getHealedSteps() > 0) {
            double healingRate = (double) summary.getHealedSteps() / summary.getTotalSteps() * 100;
            System.out.printf("Healing Rate: %.1f%%%n", healingRate);
        }
    }
    
    private static void printHealingLogSummary(List<SelfHealing.HealingLogEntry> healingLog) {
        if (healingLog.isEmpty()) {
            System.out.println();
            System.out.println("=== Healing Summary ===");
            System.out.println("No healing attempts were made during this run.");
            return;
        }
        
        System.out.println();
        System.out.println("=== Healing Summary ===");
        System.out.println("Total healing attempts: " + healingLog.size());
        
        long successfulHealing = healingLog.stream()
            .filter(entry -> "SUCCESS".equals(entry.getResult()))
            .count();
        
        long noAlternatives = healingLog.stream()
            .filter(entry -> "NO_ALTERNATIVES".equals(entry.getResult()))
            .count();
        
        long allFailed = healingLog.stream()
            .filter(entry -> "ALL_ALTERNATIVES_FAILED".equals(entry.getResult()))
            .count();
        
        System.out.println("Successful healing: " + successfulHealing);
        System.out.println("No alternatives found: " + noAlternatives);
        System.out.println("All alternatives failed: " + allFailed);
        
        if (successfulHealing > 0) {
            double healingSuccessRate = (double) successfulHealing / healingLog.size() * 100;
            System.out.printf("Healing success rate: %.1f%%%n", healingSuccessRate);
        }
        
        System.out.println("Healing log saved to: healing_log.json");
    }
    
    private static void submitHealingForReview(List<SelfHealing.HealingLogEntry> healingLog, RunSummary summary) {
        System.out.println();
        System.out.println("=== Submitting Healing Data for Review ===");
        
        HealingReviewService reviewService = new HealingReviewService();
        
        // Check if review API is available
        if (!reviewService.isReviewApiAvailable()) {
            System.out.println("⚠ Review API not available - skipping healing data submission");
            return;
        }
        
        // Convert healing log entries to review format
        List<Map<String, Object>> healingAttempts = new ArrayList<>();
        
        for (SelfHealing.HealingLogEntry entry : healingLog) {
            Map<String, Object> attempt = HealingReviewService.createHealingAttempt(
                entry.getElementId(),
                entry.getPage(),
                entry.getOriginalLocator(),
                entry.getAttemptedAlternatives(),
                entry.getHealedLocator(),
                entry.getResult(),
                entry.getError()
            );
            healingAttempts.add(attempt);
        }
        
        // Generate unique identifiers for this test run
        String sessionId = "java_framework_" + System.currentTimeMillis();
        String testRunId = "run_" + java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        
        // Submit to review API
        reviewService.submitHealingData(healingAttempts, sessionId, testRunId);
    }
}