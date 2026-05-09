package demo;

import io.appium.java_client.AppiumDriver;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.Point;
import org.openqa.selenium.interactions.Pause;
import org.openqa.selenium.interactions.PointerInput;
import org.openqa.selenium.interactions.Sequence;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.w3c.dom.Node;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import java.time.Duration;
import java.util.*;

/**
 * Gathers all visible elements from an Appium session by scrolling through
 * the screen and deduplicating elements across viewports.
 */
public class AppiumElementGatherer {

    // Maximum time (ms) to spend scrolling before we stop
    private static final long SCROLL_TIMEOUT_MS = 180_000;
    // Max consecutive scrolls that produce zero new elements before we stop
    private static final int MAX_EMPTY_SCROLLS = 2;
    // Max total scroll count — prevents infinite-scroll feeds from running forever
    private static final int MAX_SCROLL_COUNT = 10;
    // Max unique elements to collect — stop early once we have enough
    private static final int MAX_ELEMENTS = 500;
    // Pause between scroll and re-scan (ms) to let the UI settle
    private static final long SETTLE_DELAY_MS = 800;

    /**
     * Connect to a device/emulator via Appium, scroll through the screen
     * gathering all UI elements, and return structured element data.
     */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> gatherElements(BrowserType browserType,
                                                      Map<String, Object> appiumConfig) {
        WebDriver driver = null;
        try {
            System.out.println("=== APPIUM ELEMENT GATHER START ===");
            System.out.println("BrowserType: " + browserType);

            Map<String, Object> cfg = new HashMap<>(appiumConfig);
            cfg.putIfAbsent("no_reset", true);

            driver = AppiumDriverFactory.createDriver(browserType, cfg);
            System.out.println("Appium session created for element gathering");

            return scanWithScroll(driver, browserType, appiumConfig);
        } finally {
            if (driver != null) {
                try {
                    driver.quit();
                    System.out.println("Appium gather session closed");
                } catch (Exception e) {
                    System.err.println("Error closing gather session: " + e.getMessage());
                }
            }
            System.out.println("=== APPIUM ELEMENT GATHER END ===");
        }
    }

    // -----------------------------------------------------------------
    // Scroll-and-gather
    // -----------------------------------------------------------------

    /**
     * Scan the current viewport, scroll down, repeat — collecting unique
     * elements until no new ones appear or the timeout fires.
     */
    private static Map<String, Object> scanWithScroll(WebDriver driver,
                                                       BrowserType browserType,
                                                       Map<String, Object> appiumConfig) {
        Map<String, Object> result = new LinkedHashMap<>();

        // --- Page / screen info ---
        result.put("pageInfo", buildPageInfo(driver, browserType, appiumConfig));

        // --- Scroll-and-gather loop ---
        // elementKey -> element map  (dedup across viewports)
        Map<String, Map<String, Object>> allElementsByKey = new LinkedHashMap<>();
        Set<String> firstViewportKeys = new HashSet<>();
        Map<String, Integer> keyViewportCount = new HashMap<>();
        Set<String> allTagNames = new HashSet<>();
        int totalRawScanned = 0;
        int scrollCount = 0;
        int emptyScrolls = 0;
        long overallStart = System.currentTimeMillis();
        // scrollStart is set AFTER the first viewport scan so that
        // session creation + initial scan time don't eat the scroll budget.
        long scrollStart = 0;

        // Screen size for scroll gestures
        Dimension screenSize = null;
        try {
            screenSize = driver.manage().window().getSize();
        } catch (Exception e) {
            System.err.println("Cannot get screen size; single-viewport scan only: " + e.getMessage());
        }
        boolean canScroll = (screenSize != null && driver instanceof AppiumDriver);

        while (true) {
            // Timeout check — only after scroll exploration has started
            if (scrollStart > 0 && (System.currentTimeMillis() - scrollStart) > SCROLL_TIMEOUT_MS) {
                System.out.println("Scroll timeout reached (" + SCROLL_TIMEOUT_MS + " ms). Stopping.");
                break;
            }
            // Cap total scrolls (prevents infinite-scroll feeds running forever)
            if (scrollCount >= MAX_SCROLL_COUNT) {
                System.out.println("Max scroll count reached (" + MAX_SCROLL_COUNT + "). Stopping.");
                break;
            }
            // Cap total elements
            if (allElementsByKey.size() >= MAX_ELEMENTS) {
                System.out.println("Max elements reached (" + MAX_ELEMENTS + "). Stopping.");
                break;
            }

            // --- Scan current viewport via page source XML (1 call vs N*18) ---
            List<Map<String, Object>> parsedElements;
            try {
                long t0 = System.currentTimeMillis();
                String pageSource = driver.getPageSource();
                long t1 = System.currentTimeMillis();
                parsedElements = parsePageSourceXml(pageSource);
                long t2 = System.currentTimeMillis();
                System.out.println("  getPageSource: " + (t1 - t0) + " ms, "
                        + "XML parse: " + (t2 - t1) + " ms, "
                        + parsedElements.size() + " elements");
            } catch (Exception e) {
                System.err.println("Error getting page source: " + e.getMessage());
                break;
            }
            totalRawScanned += parsedElements.size();

            Set<String> thisViewportKeys = new HashSet<>();
            int newCount = 0;

            for (int i = 0; i < parsedElements.size(); i++) {
                try {
                    Map<String, Object> elem = parsedElements.get(i);
                    String key = computeElementKey(elem);
                    allTagNames.add((String) elem.get("tag"));
                    thisViewportKeys.add(key);
                    keyViewportCount.merge(key, 1, Integer::sum);

                    if (!allElementsByKey.containsKey(key)) {
                        allElementsByKey.put(key, elem);
                        newCount++;
                    }
                } catch (Exception ignored) {}
            }

            System.out.println("Viewport " + scrollCount + ": "
                    + thisViewportKeys.size() + " visible, " + newCount
                    + " new  (total unique: " + allElementsByKey.size() + ")");

            // Remember the first viewport for sticky detection
            if (scrollCount == 0) {
                firstViewportKeys.addAll(thisViewportKeys);
            }

            // Stop if nothing new
            if (scrollCount > 0 && newCount == 0) {
                emptyScrolls++;
                if (emptyScrolls >= MAX_EMPTY_SCROLLS) {
                    System.out.println("No new elements after " + emptyScrolls
                            + " consecutive scrolls. Stopping.");
                    break;
                }
            } else {
                emptyScrolls = 0;
            }

            // --- Scroll down ---
            if (!canScroll) break;
            // Start the scroll-timeout clock after the first viewport is done
            if (scrollCount == 0) {
                scrollStart = System.currentTimeMillis();
            }
            try {
                scrollDown(driver, screenSize);
                Thread.sleep(SETTLE_DELAY_MS);
            } catch (Exception e) {
                System.err.println("Scroll failed: " + e.getMessage());
                break;
            }
            scrollCount++;
        }

        // --- Detect sticky elements (header / footer / nav bars) ---
        int totalViewports = scrollCount + 1;
        Set<String> stickyKeys = new HashSet<>();
        if (totalViewports > 1) {
            for (String key : firstViewportKeys) {
                if (keyViewportCount.getOrDefault(key, 0) >= totalViewports) {
                    stickyKeys.add(key);
                }
            }
            if (!stickyKeys.isEmpty()) {
                System.out.println("Detected " + stickyKeys.size()
                        + " sticky element(s) (header/footer/nav).");
            }
        }

        // --- Build final list ---
        List<Map<String, Object>> elements = new ArrayList<>();
        int interactiveCount = 0;
        int idx = 0;
        for (Map.Entry<String, Map<String, Object>> entry : allElementsByKey.entrySet()) {
            Map<String, Object> elem = entry.getValue();
            elem.put("index", idx++);
            elem.put("sticky", stickyKeys.contains(entry.getKey()));
            elements.add(elem);
            if (Boolean.TRUE.equals(elem.get("interactive"))) interactiveCount++;
        }
        result.put("elements", elements);

        // --- Stats ---
        long elapsed = System.currentTimeMillis() - overallStart;
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total_elements", elements.size());
        stats.put("interactive_elements", interactiveCount);
        stats.put("unique_tags", allTagNames.size());
        stats.put("tag_names", new ArrayList<>(allTagNames));
        stats.put("raw_elements_scanned", totalRawScanned);
        stats.put("scroll_count", scrollCount);
        stats.put("sticky_elements", stickyKeys.size());
        stats.put("scroll_timeout_ms", SCROLL_TIMEOUT_MS);
        stats.put("elapsed_ms", elapsed);
        result.put("stats", stats);
        result.put("success", true);

        System.out.println("Gathered " + elements.size() + " unique elements ("
                + interactiveCount + " interactive) across " + totalViewports
                + " viewport(s) in " + elapsed + " ms");

        return result;
    }

    // -----------------------------------------------------------------
    // XML Page Source Parser — parses ALL elements in one shot
    // -----------------------------------------------------------------

    /**
     * Parse the Appium page source XML into element maps.
     * This replaces findElements + N*18 individual attribute calls
     * with a single getPageSource() call + local XML parsing.
     */
    private static List<Map<String, Object>> parsePageSourceXml(String xml) throws Exception {
        Document doc = DocumentBuilderFactory.newInstance()
                .newDocumentBuilder()
                .parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        doc.getDocumentElement().normalize();

        NodeList nodes = doc.getElementsByTagName("*");
        List<Map<String, Object>> elements = new ArrayList<>();

        for (int i = 0; i < nodes.getLength(); i++) {
            Node node = nodes.item(i);
            if (node.getNodeType() != Node.ELEMENT_NODE) continue;
            Element el = (Element) node;

            // Skip the root hierarchy node
            String tagName = el.getTagName();
            if ("hierarchy".equalsIgnoreCase(tagName)) continue;

            // Parse bounds for position/size
            String boundsStr = el.getAttribute("bounds");
            int x = 0, y = 0, width = 0, height = 0;
            if (boundsStr != null && !boundsStr.isEmpty()) {
                // Format: [x1,y1][x2,y2]
                try {
                    String[] parts = boundsStr.replace("][", ",").replace("[", "").replace("]", "").split(",");
                    if (parts.length == 4) {
                        int x1 = Integer.parseInt(parts[0]);
                        int y1 = Integer.parseInt(parts[1]);
                        int x2 = Integer.parseInt(parts[2]);
                        int y2 = Integer.parseInt(parts[3]);
                        x = x1; y = y1;
                        width = x2 - x1;
                        height = y2 - y1;
                    }
                } catch (NumberFormatException ignored) {}
            }

            // Skip zero-size elements (not displayed)
            if (width == 0 && height == 0) continue;

            Map<String, Object> elem = new LinkedHashMap<>();
            elem.put("tag", tagName);

            String text = el.getAttribute("text");
            if (text == null) text = "";
            if (text.length() > 200) text = text.substring(0, 200) + "...";
            elem.put("text", text);

            elem.put("x", x);
            elem.put("y", y);
            elem.put("width", width);
            elem.put("height", height);

            boolean enabled = "true".equalsIgnoreCase(el.getAttribute("enabled"));
            elem.put("enabled", enabled);
            elem.put("displayed", true);

            // --- Attributes ---
            Map<String, String> attributes = new LinkedHashMap<>();
            for (String attr : XML_ATTRIBUTES) {
                String val = el.getAttribute(attr);
                if (val != null && !val.isEmpty() && !"null".equalsIgnoreCase(val)) {
                    attributes.put(attr, val);
                }
            }
            elem.put("attributes", attributes);

            // --- Selectors ---
            Map<String, String> selectors = buildSelectors(attributes, tagName, i);
            elem.put("selectors", selectors);

            elem.put("interactive", isInteractive(tagName, attributes));

            elements.add(elem);
        }
        return elements;
    }

    /**
     * Attributes to extract from XML elements — these are the actual XML
     * attribute names in Appium's page source (not Selenium getAttribute names).
     */
    private static final String[] XML_ATTRIBUTES = {
        "resource-id", "content-desc", "text", "class", "package",
        "checkable", "checked", "clickable", "focusable", "focused",
        "scrollable", "long-clickable", "selected", "bounds",
        "password", "enabled", "index",
    };

    // -----------------------------------------------------------------
    // Page info
    // -----------------------------------------------------------------

    private static Map<String, Object> buildPageInfo(WebDriver driver,
                                                      BrowserType browserType,
                                                      Map<String, Object> appiumConfig) {
        Map<String, Object> pageInfo = new LinkedHashMap<>();
        pageInfo.put("platform", browserType.getDisplayName());
        pageInfo.put("config_type", stringOr(appiumConfig, "config_type", browserType.getValue()));

        if (driver instanceof AppiumDriver) {
            AppiumDriver ad = (AppiumDriver) driver;
            try {
                org.openqa.selenium.Capabilities caps = ad.getCapabilities();
                if (caps != null) {
                    Object dn = caps.getCapability("deviceName");
                    Object pv = caps.getCapability("platformVersion");
                    pageInfo.put("device_name", dn != null ? dn.toString() : "");
                    pageInfo.put("platform_version", pv != null ? pv.toString() : "");
                }
            } catch (Exception ignored) {}

            try {
                if (ad instanceof io.appium.java_client.remote.SupportsContextSwitching) {
                    String context = ((io.appium.java_client.remote.SupportsContextSwitching) ad).getContext();
                    pageInfo.put("context", context);
                    if (context != null && context.startsWith("WEBVIEW")) {
                        pageInfo.put("url", driver.getCurrentUrl());
                        pageInfo.put("page_title", driver.getTitle());
                    }
                }
            } catch (Exception ignored) {}
        }

        try {
            String ps = driver.getPageSource();
            pageInfo.put("page_source_length", ps.length());
        } catch (Exception e) {
            System.err.println("Could not get page source: " + e.getMessage());
        }

        return pageInfo;
    }

    // -----------------------------------------------------------------
    // Scroll helper  (W3C Actions — works on Android & iOS)
    // -----------------------------------------------------------------

    /**
     * Swipe from 75% to 25% of screen height (a ~50% scroll).
     */
    private static void scrollDown(WebDriver driver, Dimension screenSize) {
        int cx = screenSize.getWidth() / 2;
        int startY = (int) (screenSize.getHeight() * 0.75);
        int endY   = (int) (screenSize.getHeight() * 0.25);

        PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
        Sequence swipe = new Sequence(finger, 0);
        swipe.addAction(finger.createPointerMove(Duration.ZERO,
                PointerInput.Origin.viewport(), cx, startY));
        swipe.addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
        swipe.addAction(new Pause(finger, Duration.ofMillis(200)));
        swipe.addAction(finger.createPointerMove(Duration.ofMillis(400),
                PointerInput.Origin.viewport(), cx, endY));
        swipe.addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));

        ((AppiumDriver) driver).perform(Collections.singletonList(swipe));
    }

    // -----------------------------------------------------------------
    // Element building
    // -----------------------------------------------------------------

    /**
     * Build a structured map for one WebElement.
     */
    private static Map<String, Object> buildElementMap(WebElement el, int rawIdx) {
        Map<String, Object> elem = new LinkedHashMap<>();

        String tagName = safeGet(() -> el.getTagName(), "unknown");
        elem.put("tag", tagName);

        String text = safeGet(() -> el.getText(), "");
        if (text.length() > 200) text = text.substring(0, 200) + "...";
        elem.put("text", text);

        try {
            Point loc = el.getLocation();
            Dimension size = el.getSize();
            elem.put("x", loc.getX());
            elem.put("y", loc.getY());
            elem.put("width", size.getWidth());
            elem.put("height", size.getHeight());
        } catch (Exception ignored) {}

        elem.put("enabled", safeGet(() -> el.isEnabled(), false));
        elem.put("displayed", true);

        // --- Attributes ---
        Map<String, String> attributes = new LinkedHashMap<>();
        for (String attr : COMMON_ATTRIBUTES) {
            String val = safeGetAttr(el, attr);
            if (val != null && !val.isEmpty() && !"null".equalsIgnoreCase(val)) {
                attributes.put(attr, val);
            }
        }
        elem.put("attributes", attributes);

        // --- Selectors ---
        Map<String, String> selectors = buildSelectors(attributes, tagName, rawIdx);
        elem.put("selectors", selectors);

        elem.put("interactive", isInteractive(tagName, attributes));

        return elem;
    }

    /**
     * Build best-available selectors from the element's attributes.
     * Priority: accessibility_id (content-desc) > resource-id > name > class/xpath fallback.
     */
    private static Map<String, String> buildSelectors(Map<String, String> attributes,
                                                       String tagName, int rawIdx) {
        Map<String, String> selectors = new LinkedHashMap<>();

        String contentDesc = attributes.get("content-desc");
        String resourceId  = attributes.get("resource-id");
        String accessId    = attributes.get("accessibility-id");
        String name        = attributes.get("name");

        if (contentDesc != null && !contentDesc.isEmpty()) {
            selectors.put("accessibility_id", contentDesc);
            selectors.put("xpath", "//*[@content-desc='" + contentDesc + "']");
        }
        if (accessId != null && !accessId.isEmpty() && !selectors.containsKey("accessibility_id")) {
            selectors.put("accessibility_id", accessId);
            selectors.put("xpath", "//*[@content-desc='" + accessId + "']");
        }
        if (resourceId != null && !resourceId.isEmpty()) {
            selectors.put("id", resourceId);
            if (!selectors.containsKey("xpath")) {
                selectors.put("xpath", "//*[@resource-id='" + resourceId + "']");
            }
        }
        if (name != null && !name.isEmpty()) {
            selectors.put("name", name);
        }
        // Fallback
        if (selectors.isEmpty() && tagName != null) {
            String className = attributes.get("class");
            if (className != null && !className.isEmpty()) {
                selectors.put("class_name", className);
            }
            selectors.put("xpath", "//" + tagName + "[" + (rawIdx + 1) + "]");
        }
        return selectors;
    }

    // -----------------------------------------------------------------
    // Deduplication key
    // -----------------------------------------------------------------

    /**
     * Compute a stable key for deduplication across scroll viewports.
     * Uses: accessibility_id > resource-id > text+class > tag+text.
     */
    @SuppressWarnings("unchecked")
    private static String computeElementKey(Map<String, Object> elem) {
        Map<String, String> selectors  = (Map<String, String>) elem.get("selectors");
        Map<String, String> attributes = (Map<String, String>) elem.get("attributes");
        String text = elem.get("text") != null ? elem.get("text").toString() : "";
        String tag  = elem.get("tag")  != null ? elem.get("tag").toString()  : "unknown";
        String cls  = attributes != null ? attributes.getOrDefault("class", "") : "";

        // Best: accessibility id
        if (selectors != null && selectors.containsKey("accessibility_id")) {
            return "a11y:" + selectors.get("accessibility_id");
        }
        // Resource id
        if (selectors != null && selectors.containsKey("id")) {
            return "id:" + selectors.get("id");
        }
        // Text + class (reliable for most native widgets)
        if (!text.isEmpty() && !cls.isEmpty()) {
            return "tc:" + cls + ":" + text;
        }
        // content-desc from attributes (sometimes only there)
        String cd = attributes != null ? attributes.getOrDefault("content-desc", "") : "";
        if (!cd.isEmpty()) {
            return "desc:" + tag + ":" + cd;
        }
        // Tag + text
        if (!text.isEmpty()) {
            return "txt:" + tag + ":" + text;
        }
        // Last resort: tag + class + bounds
        String bounds = attributes != null ? attributes.getOrDefault("bounds", "") : "";
        return "pos:" + tag + ":" + cls + ":" + bounds;
    }

    // -----------------------------------------------------------------
    // Constants & helpers
    // -----------------------------------------------------------------

    private static final String[] COMMON_ATTRIBUTES = {
        "resource-id", "content-desc", "accessibility-id", "name",
        "text", "class", "package", "checkable", "checked", "clickable",
        "focusable", "focused", "scrollable", "long-clickable", "selected",
        "bounds", "type", "value", "label", "hint", "id",
        "data-testid", "data-test", "role", "aria-label", "placeholder"
    };

    private static boolean isInteractive(String tag, Map<String, String> attrs) {
        String t = tag.toLowerCase();
        if (t.contains("button") || t.contains("edittext") || t.contains("edit")
                || t.contains("input") || t.contains("checkbox") || t.contains("switch")
                || t.contains("radio") || t.contains("spinner") || t.contains("picker")
                || t.contains("slider") || t.contains("toggle") || t.contains("select")
                || t.contains("textarea") || t.contains("link")) {
            return true;
        }
        if ("true".equalsIgnoreCase(attrs.get("clickable"))) return true;
        String role = attrs.get("role");
        if (role != null && Set.of("button","link","textbox","checkbox","switch","tab").contains(role)) {
            return true;
        }
        return false;
    }

    @FunctionalInterface
    private interface SafeSupplier<T> { T get() throws Exception; }

    private static <T> T safeGet(SafeSupplier<T> fn, T fallback) {
        try { return fn.get(); } catch (Exception e) { return fallback; }
    }

    private static String safeGetAttr(WebElement el, String attr) {
        try { return el.getAttribute(attr); } catch (Exception e) { return null; }
    }

    private static String stringOr(Map<String, Object> m, String key, String fb) {
        Object v = m.get(key);
        return v != null ? v.toString() : fb;
    }
}
