package demo;

import io.appium.java_client.AppiumBy;
import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.nativekey.AndroidKey;
import io.appium.java_client.android.nativekey.KeyEvent;
import io.appium.java_client.ios.IOSDriver;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.Point;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Pause;
import org.openqa.selenium.interactions.PointerInput;
import org.openqa.selenium.interactions.Sequence;

import java.time.Duration;
import java.util.Arrays;
import java.util.Collections;
import java.util.Map;
import java.util.Set;

/**
 * Appium-specific mobile and desktop actions that extend beyond standard
 * Selenium WebDriver operations.  These are invoked from
 * {@link ExecutionService#executeStep} for action types prefixed with
 * "appium_" or mobile-specific gestures.
 */
public class AppiumActions {

    private final WebDriver driver;

    public AppiumActions(WebDriver driver) {
        this.driver = driver;
    }

    // -----------------------------------------------------------------------
    // Gesture helpers
    // -----------------------------------------------------------------------

    /**
     * Perform a tap at the centre of the given element.
     */
    public void tap(WebElement element) {
        Point loc = element.getLocation();
        Dimension size = element.getSize();
        int cx = loc.getX() + size.getWidth() / 2;
        int cy = loc.getY() + size.getHeight() / 2;
        tapAt(cx, cy);
    }

    /**
     * Tap at absolute screen coordinates.
     */
    public void tapAt(int x, int y) {
        PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
        Sequence tap = new Sequence(finger, 0);
        tap.addAction(finger.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), x, y));
        tap.addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        tap.addAction(new Pause(finger, Duration.ofMillis(50)));
        tap.addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));
        ((AppiumDriver) driver).perform(Collections.singletonList(tap));
    }

    /**
     * Long-press (tap and hold) on an element.
     */
    public void longPress(WebElement element, int durationMs) {
        Point loc = element.getLocation();
        Dimension size = element.getSize();
        int cx = loc.getX() + size.getWidth() / 2;
        int cy = loc.getY() + size.getHeight() / 2;

        PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
        Sequence lp = new Sequence(finger, 0);
        lp.addAction(finger.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), cx, cy));
        lp.addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        lp.addAction(new Pause(finger, Duration.ofMillis(durationMs)));
        lp.addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));
        ((AppiumDriver) driver).perform(Collections.singletonList(lp));
    }

    /**
     * Swipe from one point to another.
     */
    public void swipe(int startX, int startY, int endX, int endY, int durationMs) {
        PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
        Sequence swipe = new Sequence(finger, 0);
        swipe.addAction(finger.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), startX, startY));
        swipe.addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        swipe.addAction(finger.createPointerMove(Duration.ofMillis(durationMs), PointerInput.Origin.viewport(), endX, endY));
        swipe.addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));
        ((AppiumDriver) driver).perform(Collections.singletonList(swipe));
    }

    /**
     * Swipe up (scroll down) by a fraction of the screen.
     */
    public void swipeUp(double fraction) {
        Dimension size = driver.manage().window().getSize();
        int startX = size.getWidth() / 2;
        int startY = (int) (size.getHeight() * (0.5 + fraction / 2));
        int endY = (int) (size.getHeight() * (0.5 - fraction / 2));
        swipe(startX, startY, startX, endY, 600);
    }

    /**
     * Swipe down (scroll up) by a fraction of the screen.
     */
    public void swipeDown(double fraction) {
        Dimension size = driver.manage().window().getSize();
        int startX = size.getWidth() / 2;
        int startY = (int) (size.getHeight() * (0.5 - fraction / 2));
        int endY = (int) (size.getHeight() * (0.5 + fraction / 2));
        swipe(startX, startY, startX, endY, 600);
    }

    /**
     * Swipe left (e.g. for carousels or page navigation).
     */
    public void swipeLeft(double fraction) {
        Dimension size = driver.manage().window().getSize();
        int startY = size.getHeight() / 2;
        int startX = (int) (size.getWidth() * (0.5 + fraction / 2));
        int endX = (int) (size.getWidth() * (0.5 - fraction / 2));
        swipe(startX, startY, endX, startY, 600);
    }

    /**
     * Swipe right.
     */
    public void swipeRight(double fraction) {
        Dimension size = driver.manage().window().getSize();
        int startY = size.getHeight() / 2;
        int startX = (int) (size.getWidth() * (0.5 - fraction / 2));
        int endX = (int) (size.getWidth() * (0.5 + fraction / 2));
        swipe(startX, startY, endX, startY, 600);
    }

    /**
     * Pinch gesture (zoom out) at the centre of the screen.
     */
    public void pinch() {
        Dimension size = driver.manage().window().getSize();
        int cx = size.getWidth() / 2;
        int cy = size.getHeight() / 2;
        int offset = Math.min(cx, cy) / 3;

        PointerInput f1 = new PointerInput(PointerInput.Kind.TOUCH, "finger1");
        PointerInput f2 = new PointerInput(PointerInput.Kind.TOUCH, "finger2");

        Sequence s1 = new Sequence(f1, 0);
        s1.addAction(f1.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), cx - offset, cy));
        s1.addAction(f1.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        s1.addAction(f1.createPointerMove(Duration.ofMillis(500), PointerInput.Origin.viewport(), cx, cy));
        s1.addAction(f1.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));

        Sequence s2 = new Sequence(f2, 0);
        s2.addAction(f2.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), cx + offset, cy));
        s2.addAction(f2.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        s2.addAction(f2.createPointerMove(Duration.ofMillis(500), PointerInput.Origin.viewport(), cx, cy));
        s2.addAction(f2.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));

        ((AppiumDriver) driver).perform(Arrays.asList(s1, s2));
    }

    /**
     * Spread gesture (zoom in) at the centre of the screen.
     */
    public void spread() {
        Dimension size = driver.manage().window().getSize();
        int cx = size.getWidth() / 2;
        int cy = size.getHeight() / 2;
        int offset = Math.min(cx, cy) / 3;

        PointerInput f1 = new PointerInput(PointerInput.Kind.TOUCH, "finger1");
        PointerInput f2 = new PointerInput(PointerInput.Kind.TOUCH, "finger2");

        Sequence s1 = new Sequence(f1, 0);
        s1.addAction(f1.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), cx, cy));
        s1.addAction(f1.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        s1.addAction(f1.createPointerMove(Duration.ofMillis(500), PointerInput.Origin.viewport(), cx - offset, cy));
        s1.addAction(f1.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));

        Sequence s2 = new Sequence(f2, 0);
        s2.addAction(f2.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), cx, cy));
        s2.addAction(f2.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        s2.addAction(f2.createPointerMove(Duration.ofMillis(500), PointerInput.Origin.viewport(), cx + offset, cy));
        s2.addAction(f2.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));

        ((AppiumDriver) driver).perform(Arrays.asList(s1, s2));
    }

    // -----------------------------------------------------------------------
    // App lifecycle
    // -----------------------------------------------------------------------

    /**
     * Launch the app configured in capabilities (native only).
     */
    public void launchApp() {
        if (driver instanceof AndroidDriver) {
            ((AndroidDriver) driver).activateApp(
                    ((AndroidDriver) driver).getCapabilities()
                            .getCapability("appPackage").toString());
        } else if (driver instanceof IOSDriver) {
            ((IOSDriver) driver).activateApp(
                    ((IOSDriver) driver).getCapabilities()
                            .getCapability("bundleId").toString());
        }
    }

    /**
     * Close/background the app.
     */
    public void closeApp() {
        if (driver instanceof AndroidDriver) {
            ((AndroidDriver) driver).terminateApp(
                    ((AndroidDriver) driver).getCapabilities()
                            .getCapability("appPackage").toString());
        } else if (driver instanceof IOSDriver) {
            ((IOSDriver) driver).terminateApp(
                    ((IOSDriver) driver).getCapabilities()
                            .getCapability("bundleId").toString());
        }
    }

    /**
     * Put the app into the background for the given number of seconds.
     */
    public void backgroundApp(int seconds) {
        if (driver instanceof io.appium.java_client.InteractsWithApps) {
            ((io.appium.java_client.InteractsWithApps) driver).runAppInBackground(Duration.ofSeconds(seconds));
        }
    }

    /**
     * Activate (bring to foreground) a specific app by package/bundleId.
     */
    public void activateApp(String appId) {
        if (driver instanceof io.appium.java_client.InteractsWithApps) {
            ((io.appium.java_client.InteractsWithApps) driver).activateApp(appId);
        }
    }

    /**
     * Terminate a running app.
     */
    public void terminateApp(String appId) {
        if (driver instanceof io.appium.java_client.InteractsWithApps) {
            ((io.appium.java_client.InteractsWithApps) driver).terminateApp(appId);
        }
    }

    /**
     * Check if an app is installed.
     */
    public boolean isAppInstalled(String appId) {
        if (driver instanceof io.appium.java_client.InteractsWithApps) {
            return ((io.appium.java_client.InteractsWithApps) driver).isAppInstalled(appId);
        }
        return false;
    }

    // -----------------------------------------------------------------------
    // Context switching (native ↔ webview)
    // -----------------------------------------------------------------------

    /**
     * Switch to a webview context (for hybrid apps).
     */
    public void switchToWebView() {
        if (driver instanceof io.appium.java_client.remote.SupportsContextSwitching) {
            io.appium.java_client.remote.SupportsContextSwitching cs = (io.appium.java_client.remote.SupportsContextSwitching) driver;
            Set<String> contexts = cs.getContextHandles();
            for (String ctx : contexts) {
                if (ctx.contains("WEBVIEW")) {
                    cs.context(ctx);
                    System.out.println("Switched to webview context: " + ctx);
                    return;
                }
            }
            System.out.println("No WEBVIEW context found. Available: " + contexts);
        }
    }

    /**
     * Switch back to native context.
     */
    public void switchToNativeContext() {
        if (driver instanceof io.appium.java_client.remote.SupportsContextSwitching) {
            ((io.appium.java_client.remote.SupportsContextSwitching) driver).context("NATIVE_APP");
            System.out.println("Switched to NATIVE_APP context");
        }
    }

    /**
     * Switch to a specific named context.
     */
    public void switchToContext(String name) {
        if (driver instanceof io.appium.java_client.remote.SupportsContextSwitching) {
            ((io.appium.java_client.remote.SupportsContextSwitching) driver).context(name);
            System.out.println("Switched to context: " + name);
        }
    }

    // -----------------------------------------------------------------------
    // Device controls
    // -----------------------------------------------------------------------

    /**
     * Set the device orientation (LANDSCAPE / PORTRAIT).
     */
    public void setOrientation(String orientation) {
        if (driver instanceof AndroidDriver) {
            ((AndroidDriver) driver).rotate(
                    org.openqa.selenium.ScreenOrientation.valueOf(orientation.toUpperCase()));
        } else if (driver instanceof IOSDriver) {
            ((IOSDriver) driver).rotate(
                    org.openqa.selenium.ScreenOrientation.valueOf(orientation.toUpperCase()));
        }
    }

    /**
     * Hide the on-screen keyboard.
     */
    public void hideKeyboard() {
        if (driver instanceof io.appium.java_client.HidesKeyboard) {
            ((io.appium.java_client.HidesKeyboard) driver).hideKeyboard();
        }
    }

    /**
     * Press the Android back button.
     */
    public void pressBack() {
        if (driver instanceof AndroidDriver) {
            ((AndroidDriver) driver).pressKey(new KeyEvent(AndroidKey.BACK));
        } else {
            driver.navigate().back();
        }
    }

    /**
     * Press the Android home button.
     */
    public void pressHome() {
        if (driver instanceof AndroidDriver) {
            ((AndroidDriver) driver).pressKey(new KeyEvent(AndroidKey.HOME));
        }
    }

    // -----------------------------------------------------------------------
    // Appium-specific locator helpers
    // -----------------------------------------------------------------------

    /**
     * Find an element using Appium's accessibility ID locator.
     */
    public WebElement findByAccessibilityId(String id) {
        return driver.findElement(AppiumBy.accessibilityId(id));
    }

    /**
     * Find an element using Android UIAutomator selector string.
     */
    public WebElement findByAndroidUIAutomator(String uiSelector) {
        return driver.findElement(AppiumBy.androidUIAutomator(uiSelector));
    }

    /**
     * Find an element using iOS class chain.
     */
    public WebElement findByIOSClassChain(String classChain) {
        return driver.findElement(AppiumBy.iOSClassChain(classChain));
    }

    /**
     * Find an element using iOS predicate string.
     */
    public WebElement findByIOSPredicate(String predicate) {
        return driver.findElement(AppiumBy.iOSNsPredicateString(predicate));
    }

    // -----------------------------------------------------------------------
    // Utility
    // -----------------------------------------------------------------------

    /**
     * Check whether the current driver is an Appium driver.
     */
    public static boolean isAppiumDriver(WebDriver driver) {
        return driver instanceof AppiumDriver;
    }
}
