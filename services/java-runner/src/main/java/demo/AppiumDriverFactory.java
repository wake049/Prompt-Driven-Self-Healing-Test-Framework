package demo;

import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.options.UiAutomator2Options;
import io.appium.java_client.ios.IOSDriver;
import io.appium.java_client.ios.options.XCUITestOptions;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.DesiredCapabilities;

import java.net.MalformedURLException;
import java.net.URL;
import java.time.Duration;
import java.util.Map;

/**
 * Factory for creating Appium-based WebDriver instances.
 * Supports Android web/native, iOS web/native, Flutter, Windows and Mac desktop.
 */
public class AppiumDriverFactory {

    private static final Duration NEW_COMMAND_TIMEOUT = Duration.ofSeconds(300);

    /**
     * Create an Appium driver from the provided configuration map.
     * The map mirrors the columns of exec.appium_configs.
     *
     * @param browserType  The Appium BrowserType variant
     * @param appiumConfig Configuration map (from API JSON). Expected keys:
     *                     appium_server_url, platform_name, platform_version,
     *                     device_name, automation_name, app_path, app_package,
     *                     app_activity, bundle_id, browser_name, extra_capabilities
     * @return A live WebDriver session against the Appium server
     */
    @SuppressWarnings("unchecked")
    public static WebDriver createDriver(BrowserType browserType, Map<String, Object> appiumConfig) {
        String serverUrl = stringOr(appiumConfig, "appium_server_url", "http://localhost:4723");

        System.out.println("Creating Appium driver: " + browserType.getDisplayName()
                + " → " + serverUrl);

        try {
            URL url = new URL(serverUrl);

            switch (browserType) {
                case APPIUM_ANDROID_WEB:
                    return createAndroidWebDriver(url, appiumConfig);
                case APPIUM_IOS_WEB:
                    return createIosWebDriver(url, appiumConfig);
                case APPIUM_ANDROID_NATIVE:
                    return createAndroidNativeDriver(url, appiumConfig);
                case APPIUM_IOS_NATIVE:
                    return createIosNativeDriver(url, appiumConfig);
                case APPIUM_FLUTTER:
                    return createFlutterDriver(url, appiumConfig);
                case APPIUM_WINDOWS:
                case APPIUM_MAC:
                    return createDesktopDriver(url, appiumConfig, browserType);
                default:
                    throw new IllegalArgumentException(
                            "BrowserType " + browserType + " is not an Appium type");
            }
        } catch (MalformedURLException e) {
            throw new RuntimeException("Invalid Appium server URL: " + serverUrl, e);
        }
    }

    // -----------------------------------------------------------------------
    // Android
    // -----------------------------------------------------------------------

    private static WebDriver createAndroidWebDriver(URL serverUrl, Map<String, Object> cfg) {
        UiAutomator2Options opts = baseAndroidOptions(cfg);
        opts.withBrowserName(stringOr(cfg, "browser_name", "Chrome"));
        applyExtras(opts, cfg);
        System.out.println("Android Web options: " + opts.toString());
        return new AndroidDriver(serverUrl, opts);
    }

    private static WebDriver createAndroidNativeDriver(URL serverUrl, Map<String, Object> cfg) {
        UiAutomator2Options opts = baseAndroidOptions(cfg);

        String appPath = (String) cfg.get("app_path");
        if (appPath != null && !appPath.isEmpty()) {
            opts.setApp(appPath);
        }

        String appPackage = (String) cfg.get("app_package");
        String appActivity = (String) cfg.get("app_activity");
        if (appPackage != null) opts.setAppPackage(appPackage);
        if (appActivity != null) opts.setAppActivity(appActivity);

        applyExtras(opts, cfg);
        System.out.println("Android Native options: " + opts.toString());
        return new AndroidDriver(serverUrl, opts);
    }

    private static UiAutomator2Options baseAndroidOptions(Map<String, Object> cfg) {
        UiAutomator2Options opts = new UiAutomator2Options();
        opts.setPlatformName(stringOr(cfg, "platform_name", "Android"));
        opts.setDeviceName(stringOr(cfg, "device_name", "Android Emulator"));

        String version = (String) cfg.get("platform_version");
        if (version != null && !version.isEmpty()) {
            opts.setPlatformVersion(version);
        }

        opts.setAutomationName(stringOr(cfg, "automation_name", "UiAutomator2"));
        opts.setNewCommandTimeout(NEW_COMMAND_TIMEOUT);
        opts.setAutoGrantPermissions(true);
        return opts;
    }

    // -----------------------------------------------------------------------
    // iOS
    // -----------------------------------------------------------------------

    private static WebDriver createIosWebDriver(URL serverUrl, Map<String, Object> cfg) {
        XCUITestOptions opts = baseIosOptions(cfg);
        opts.withBrowserName(stringOr(cfg, "browser_name", "Safari"));
        applyExtras(opts, cfg);
        System.out.println("iOS Web options: " + opts.toString());
        return new IOSDriver(serverUrl, opts);
    }

    private static WebDriver createIosNativeDriver(URL serverUrl, Map<String, Object> cfg) {
        XCUITestOptions opts = baseIosOptions(cfg);

        String appPath = (String) cfg.get("app_path");
        if (appPath != null && !appPath.isEmpty()) {
            opts.setApp(appPath);
        }

        String bundleId = (String) cfg.get("bundle_id");
        if (bundleId != null && !bundleId.isEmpty()) {
            opts.setBundleId(bundleId);
        }

        applyExtras(opts, cfg);
        System.out.println("iOS Native options: " + opts.toString());
        return new IOSDriver(serverUrl, opts);
    }

    private static XCUITestOptions baseIosOptions(Map<String, Object> cfg) {
        XCUITestOptions opts = new XCUITestOptions();
        opts.setPlatformName(stringOr(cfg, "platform_name", "iOS"));
        opts.setDeviceName(stringOr(cfg, "device_name", "iPhone 15 Simulator"));

        String version = (String) cfg.get("platform_version");
        if (version != null && !version.isEmpty()) {
            opts.setPlatformVersion(version);
        }

        opts.setAutomationName(stringOr(cfg, "automation_name", "XCUITest"));
        opts.setNewCommandTimeout(NEW_COMMAND_TIMEOUT);
        return opts;
    }

    // -----------------------------------------------------------------------
    // Flutter (runs on Android via UiAutomator2 + Flutter driver)
    // -----------------------------------------------------------------------

    private static WebDriver createFlutterDriver(URL serverUrl, Map<String, Object> cfg) {
        // Flutter integration uses UiAutomator2/XCUITest under the hood with an
        // additional "flutter" automation name recognised by the appium-flutter-driver
        // server plugin.  The java-client creates an AndroidDriver or IOSDriver
        // depending on the platform.
        String platform = stringOr(cfg, "platform_name", "Android");

        if (platform.equalsIgnoreCase("iOS")) {
            XCUITestOptions opts = baseIosOptions(cfg);
            opts.setAutomationName("Flutter");
            String app = (String) cfg.get("app_path");
            if (app != null) opts.setApp(app);
            String bundle = (String) cfg.get("bundle_id");
            if (bundle != null) opts.setBundleId(bundle);
            applyExtras(opts, cfg);
            return new IOSDriver(serverUrl, opts);
        } else {
            UiAutomator2Options opts = baseAndroidOptions(cfg);
            opts.setAutomationName("Flutter");
            String app = (String) cfg.get("app_path");
            if (app != null) opts.setApp(app);
            String pkg = (String) cfg.get("app_package");
            String act = (String) cfg.get("app_activity");
            if (pkg != null) opts.setAppPackage(pkg);
            if (act != null) opts.setAppActivity(act);
            applyExtras(opts, cfg);
            return new AndroidDriver(serverUrl, opts);
        }
    }

    // -----------------------------------------------------------------------
    // Desktop (Windows / Mac)
    // -----------------------------------------------------------------------

    private static WebDriver createDesktopDriver(URL serverUrl, Map<String, Object> cfg,
                                                  BrowserType browserType) {
        DesiredCapabilities caps = new DesiredCapabilities();

        if (browserType == BrowserType.APPIUM_WINDOWS) {
            caps.setCapability("platformName", stringOr(cfg, "platform_name", "Windows"));
            caps.setCapability("appium:automationName",
                    stringOr(cfg, "automation_name", "Windows"));
            String app = (String) cfg.get("app_path");
            if (app != null && !app.isEmpty()) {
                caps.setCapability("appium:app", app);
            } else {
                // Default to desktop root for Windows
                caps.setCapability("appium:app", "Root");
            }
        } else {
            // Mac
            caps.setCapability("platformName", stringOr(cfg, "platform_name", "Mac"));
            caps.setCapability("appium:automationName",
                    stringOr(cfg, "automation_name", "Mac2"));
            String app = (String) cfg.get("app_path");
            if (app != null && !app.isEmpty()) {
                caps.setCapability("appium:app", app);
            }
        }

        String device = (String) cfg.get("device_name");
        if (device != null) {
            caps.setCapability("appium:deviceName", device);
        }

        caps.setCapability("appium:newCommandTimeout", NEW_COMMAND_TIMEOUT.getSeconds());

        // Apply extra capabilities
        @SuppressWarnings("unchecked")
        Map<String, Object> extras = (Map<String, Object>) cfg.get("extra_capabilities");
        if (extras != null) {
            extras.forEach(caps::setCapability);
        }

        System.out.println("Desktop (" + browserType.getDisplayName() + ") caps: " + caps);
        return new AppiumDriver(serverUrl, caps);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private static String stringOr(Map<String, Object> map, String key, String fallback) {
        Object v = map.get(key);
        if (v instanceof String && !((String) v).isEmpty()) {
            return (String) v;
        }
        return fallback;
    }

    @SuppressWarnings("unchecked")
    private static void applyExtras(DesiredCapabilities opts, Map<String, Object> cfg) {
        // No-op for DesiredCapabilities (handled in createDesktopDriver directly)
    }

    @SuppressWarnings("unchecked")
    private static void applyExtras(UiAutomator2Options opts, Map<String, Object> cfg) {
        Map<String, Object> extras = (Map<String, Object>) cfg.get("extra_capabilities");
        if (extras != null) {
            extras.forEach((k, v) -> {
                if (v instanceof String) {
                    opts.setCapability(k, (String) v);
                } else if (v instanceof Boolean) {
                    opts.setCapability(k, (Boolean) v);
                } else if (v instanceof Number) {
                    opts.setCapability(k, ((Number) v).intValue());
                }
            });
        }
    }

    @SuppressWarnings("unchecked")
    private static void applyExtras(XCUITestOptions opts, Map<String, Object> cfg) {
        Map<String, Object> extras = (Map<String, Object>) cfg.get("extra_capabilities");
        if (extras != null) {
            extras.forEach((k, v) -> {
                if (v instanceof String) {
                    opts.setCapability(k, (String) v);
                } else if (v instanceof Boolean) {
                    opts.setCapability(k, (Boolean) v);
                } else if (v instanceof Number) {
                    opts.setCapability(k, ((Number) v).intValue());
                }
            });
        }
    }
}
