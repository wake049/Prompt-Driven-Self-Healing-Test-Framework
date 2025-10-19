package demo;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import io.github.bonigarcia.wdm.WebDriverManager;

public class TestNavigation {
    public static void main(String[] args) {
        WebDriver driver = null;
        
        try {
            System.out.println("=== Testing Navigation ===");
            
            // Setup WebDriver
            WebDriverManager.chromedriver().setup();
            ChromeOptions options = new ChromeOptions();
            options.addArguments("--headless=false");
            options.addArguments("--disable-blink-features=AutomationControlled");
            options.addArguments("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            driver = new ChromeDriver(options);
            
            // Test 1: Navigate to Google
            System.out.println("Test 1: Navigating to Google...");
            driver.get("https://www.google.com");
            System.out.println("Google URL: " + driver.getCurrentUrl());
            System.out.println("Google Title: " + driver.getTitle());
            Thread.sleep(2000);
            
            // Test 2: Navigate to Swag Labs
            System.out.println("\nTest 2: Navigating to Swag Labs...");
            driver.get("https://www.saucedemo.com");
            System.out.println("Swag Labs URL: " + driver.getCurrentUrl());
            System.out.println("Swag Labs Title: " + driver.getTitle());
            Thread.sleep(3000);
            
            System.out.println("\n✓ Navigation tests completed successfully!");
            
        } catch (Exception e) {
            System.err.println("Navigation test failed: " + e.getMessage());
            e.printStackTrace();
        } finally {
            if (driver != null) {
                driver.quit();
            }
        }
    }
}