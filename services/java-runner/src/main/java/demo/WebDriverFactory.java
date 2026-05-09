package demo;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.edge.EdgeOptions;
import org.openqa.selenium.safari.SafariDriver;
import org.openqa.selenium.safari.SafariOptions;
import io.github.bonigarcia.wdm.WebDriverManager;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Factory class for creating WebDriver instances with multi-browser support
 * Supports Chrome, Firefox, Edge, and Safari
 * Part of Multi-Browser Support feature (Phase 2 Enhancement)
 */
public class WebDriverFactory {
    
    private static final int DEFAULT_TIMEOUT_SECONDS = 30;
    private static final int DEFAULT_IMPLICIT_WAIT_SECONDS = 10;
    
    /**
     * Create a WebDriver instance for the specified browser type
     * @param browserType The type of browser to create
     * @param headless Whether to run in headless mode
     * @return Configured WebDriver instance
     */
    public static WebDriver createDriver(BrowserType browserType, boolean headless) {
        return createDriver(browserType, headless, null);
    }

    /**
     * Create a WebDriver for an Appium target using a configuration map.
     * Delegates entirely to {@link AppiumDriverFactory}.
     */
    public static WebDriver createDriver(BrowserType browserType, Map<String, Object> appiumConfig) {
        return AppiumDriverFactory.createDriver(browserType, appiumConfig);
    }

    /**
     * Create a WebDriver instance with optional mobile device emulation.
     * @param browserType The type of browser to create
     * @param headless Whether to run in headless mode
     * @param deviceProfile Optional mobile/tablet device profile for emulation (Chrome-only)
     * @return Configured WebDriver instance
     */
    public static WebDriver createDriver(BrowserType browserType, boolean headless, DeviceProfile deviceProfile) {
        System.out.println("Creating " + browserType.getDisplayName() + " driver (headless: " + headless
                + (deviceProfile != null ? ", device: " + deviceProfile : "") + ")");
        
        WebDriver driver;
        switch (browserType) {
            case CHROME:
                driver = createChromeDriver(headless);
                break;
            case CHROME_MOBILE:
            case CHROME_TABLET:
                driver = createChromeMobileDriver(headless, deviceProfile, browserType);
                break;
            case FIREFOX:
                driver = createFirefoxDriver(headless);
                break;
            case EDGE:
                driver = createEdgeDriver(headless);
                break;
            case SAFARI:
                driver = createSafariDriver(headless);
                break;
            default:
                if (browserType.isAppium()) {
                    throw new IllegalArgumentException(
                        "Appium browser type " + browserType + " requires an appiumConfig map. "
                        + "Use createDriver(BrowserType, Map) instead.");
                }
                throw new IllegalArgumentException("Unsupported browser: " + browserType);
        }
        
        // Configure common timeouts
        driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(DEFAULT_TIMEOUT_SECONDS));
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(DEFAULT_IMPLICIT_WAIT_SECONDS));
        driver.manage().timeouts().scriptTimeout(Duration.ofSeconds(DEFAULT_TIMEOUT_SECONDS));
        
        System.out.println(browserType.getDisplayName() + " driver created successfully");
        return driver;
    }
    
    /**
     * Create Chrome WebDriver with stealth configuration
     */
    private static WebDriver createChromeDriver(boolean headless) {
        WebDriverManager.chromedriver().setup();
        
        ChromeOptions options = new ChromeOptions();
        
        // Headless mode
        if (headless) {
            options.addArguments("--headless=new");
            options.addArguments("--no-gpu");
            options.addArguments("--disable-gpu-sandbox");
            options.addArguments("--disable-software-rasterizer");
        } else {
            options.addArguments("--start-maximized");
        }
        
        // Common arguments for stability and stealth
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--disable-blink-features=AutomationControlled");
        options.addArguments("--window-size=1920,1080");
        options.setExperimentalOption("excludeSwitches", new String[]{"enable-automation"});
        options.setExperimentalOption("useAutomationExtension", false);
        
        // Realistic preferences
        Map<String, Object> prefs = new HashMap<>();
        prefs.put("credentials_enable_service", false);
        prefs.put("profile.password_manager_enabled", false);
        prefs.put("profile.default_content_setting_values.notifications", 2);
        options.setExperimentalOption("prefs", prefs);
        
        // User agent
        String userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        options.addArguments("--user-agent=" + userAgent);
        
        options.setPageLoadStrategy(org.openqa.selenium.PageLoadStrategy.EAGER);
        
        return new ChromeDriver(options);
    }
    
    /**
     * Create Chrome WebDriver with mobile device emulation via Chrome DevTools Protocol.
     * Falls back to a default device profile when none is provided.
     */
    private static WebDriver createChromeMobileDriver(boolean headless, DeviceProfile deviceProfile, BrowserType browserType) {
        WebDriverManager.chromedriver().setup();
        
        // Resolve device profile: explicit > env var > default for the browser type
        if (deviceProfile == null) {
            String envDevice = System.getenv("MOBILE_DEVICE");
            if (envDevice != null && !envDevice.trim().isEmpty()) {
                deviceProfile = DeviceProfile.getBuiltin(envDevice.trim());
            }
        }
        if (deviceProfile == null) {
            deviceProfile = (browserType == BrowserType.CHROME_TABLET)
                    ? DeviceProfile.getBuiltin("ipad_air")
                    : DeviceProfile.getBuiltin("iphone_14");
        }
        
        ChromeOptions options = new ChromeOptions();
        
        // Headless mode
        if (headless) {
            options.addArguments("--headless=new");
            options.addArguments("--no-gpu");
            options.addArguments("--disable-gpu-sandbox");
            options.addArguments("--disable-software-rasterizer");
        }
        
        // Common stability arguments
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--disable-blink-features=AutomationControlled");
        options.setExperimentalOption("excludeSwitches", new String[]{"enable-automation"});
        options.setExperimentalOption("useAutomationExtension", false);
        
        // Mobile emulation via Chrome DevTools
        options.setExperimentalOption("mobileEmulation", deviceProfile.toChromeEmulationMap());
        
        // Set viewport size to match device dimensions
        options.addArguments("--window-size=" + deviceProfile.getWidth() + "," + deviceProfile.getHeight());
        
        options.setPageLoadStrategy(org.openqa.selenium.PageLoadStrategy.EAGER);
        
        System.out.println("Mobile emulation enabled: " + deviceProfile);
        return new ChromeDriver(options);
    }
    
    /**
     * Create Firefox WebDriver
     */
    private static WebDriver createFirefoxDriver(boolean headless) {
        WebDriverManager.firefoxdriver().setup();
        
        FirefoxOptions options = new FirefoxOptions();
        
        if (headless) {
            options.addArguments("--headless");
        }
        
        // Common preferences
        options.addPreference("dom.webdriver.enabled", false);
        options.addPreference("useAutomationExtension", false);
        options.addPreference("dom.disable_beforeunload", true);
        options.addPreference("browser.tabs.remote.autostart", false);
        options.addPreference("browser.tabs.remote.autostart.2", false);
        
        // User agent
        String userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
        options.addPreference("general.useragent.override", userAgent);
        
        return new FirefoxDriver(options);
    }
    
    /**
     * Create Edge WebDriver
     */
    private static WebDriver createEdgeDriver(boolean headless) {
        WebDriverManager.edgedriver().setup();
        
        EdgeOptions options = new EdgeOptions();
        
        if (headless) {
            options.addArguments("--headless=new");
            options.addArguments("--no-gpu");
        } else {
            options.addArguments("--start-maximized");
        }
        
        // Common arguments
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--disable-blink-features=AutomationControlled");
        options.addArguments("--window-size=1920,1080");
        options.setExperimentalOption("excludeSwitches", new String[]{"enable-automation"});
        options.setExperimentalOption("useAutomationExtension", false);
        
        // Realistic preferences
        Map<String, Object> prefs = new HashMap<>();
        prefs.put("credentials_enable_service", false);
        prefs.put("profile.password_manager_enabled", false);
        options.setExperimentalOption("prefs", prefs);
        
        return new EdgeDriver(options);
    }
    
    /**
     * Create Safari WebDriver
     * Note: Safari does not support headless mode natively
     */
    private static WebDriver createSafariDriver(boolean headless) {
        if (headless) {
            throw new UnsupportedOperationException(
                "Safari does not support headless mode. Set headless=false or use Chrome/Firefox.");
        }
        
        SafariOptions options = new SafariOptions();
        options.setAutomaticInspection(false);
        
        return new SafariDriver(options);
    }
    
    /**
     * Get browser type from system property or environment variable
     * @param defaultBrowser Default browser if none specified
     * @return Browser type to use
     */
    public static BrowserType getBrowserType(BrowserType defaultBrowser) {
        String browserValue = System.getProperty("browser", 
                              System.getenv("BROWSER"));
        
        if (browserValue == null || browserValue.trim().isEmpty()) {
            return defaultBrowser;
        }
        
        return BrowserType.fromValue(browserValue);
    }
    
    /**
     * Check if headless mode should be enabled
     * @param defaultHeadless Default headless setting
     * @return Whether to run in headless mode
     */
    public static boolean isHeadless(boolean defaultHeadless) {
        String headlessValue = System.getProperty("headless", 
                               System.getenv("HEADLESS"));
        
        if (headlessValue == null || headlessValue.trim().isEmpty()) {
            return defaultHeadless;
        }
        
        return Boolean.parseBoolean(headlessValue);
    }
}
