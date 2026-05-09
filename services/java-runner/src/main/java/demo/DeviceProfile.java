package demo;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Represents a mobile/tablet device profile for Chrome DevTools mobile emulation.
 * Used by WebDriverFactory to configure responsive viewport and touch simulation.
 */
public class DeviceProfile {

    private final String name;
    private final String deviceType;   // "mobile" | "tablet"
    private final int width;
    private final int height;
    private final double deviceScaleFactor;
    private final String userAgent;
    private final boolean mobile;
    private final boolean hasTouch;
    private final boolean landscape;

    public DeviceProfile(String name, String deviceType, int width, int height,
                         double deviceScaleFactor, String userAgent,
                         boolean mobile, boolean hasTouch, boolean landscape) {
        this.name = name;
        this.deviceType = deviceType;
        this.width = width;
        this.height = height;
        this.deviceScaleFactor = deviceScaleFactor;
        this.userAgent = userAgent;
        this.mobile = mobile;
        this.hasTouch = hasTouch;
        this.landscape = landscape;
    }

    // -- Getters --

    public String getName()               { return name; }
    public String getDeviceType()         { return deviceType; }
    public int getWidth()                 { return landscape ? height : width; }
    public int getHeight()                { return landscape ? width : height; }
    public double getDeviceScaleFactor()  { return deviceScaleFactor; }
    public String getUserAgent()          { return userAgent; }
    public boolean isMobile()             { return mobile; }
    public boolean hasTouch()             { return hasTouch; }
    public boolean isLandscape()          { return landscape; }

    /**
     * Convert to Chrome DevTools Protocol "deviceMetrics" map used by
     * {@code ChromeOptions.setExperimentalOption("mobileEmulation", ...)}.
     */
    public Map<String, Object> toChromeEmulationMap() {
        Map<String, Object> deviceMetrics = new LinkedHashMap<>();
        deviceMetrics.put("width", getWidth());
        deviceMetrics.put("height", getHeight());
        deviceMetrics.put("pixelRatio", deviceScaleFactor);
        deviceMetrics.put("mobile", mobile);
        deviceMetrics.put("touch", hasTouch);

        Map<String, Object> emulation = new LinkedHashMap<>();
        emulation.put("deviceMetrics", deviceMetrics);
        emulation.put("userAgent", userAgent);
        return emulation;
    }

    @Override
    public String toString() {
        return String.format("%s (%s, %dx%d @%.1fx)", name, deviceType, getWidth(), getHeight(), deviceScaleFactor);
    }

    // -----------------------------------------------------------------------
    // Built-in profiles — mirrors the seed data in migration 020
    // -----------------------------------------------------------------------

    private static final Map<String, DeviceProfile> BUILTIN;

    static {
        Map<String, DeviceProfile> m = new LinkedHashMap<>();

        // Phones
        m.put("iphone_14", new DeviceProfile(
                "iPhone 14", "mobile", 390, 844, 3.0,
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                true, true, false));

        m.put("iphone_14_pro_max", new DeviceProfile(
                "iPhone 14 Pro Max", "mobile", 430, 932, 3.0,
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                true, true, false));

        m.put("iphone_se", new DeviceProfile(
                "iPhone SE", "mobile", 375, 667, 2.0,
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                true, true, false));

        m.put("galaxy_s23", new DeviceProfile(
                "Samsung Galaxy S23", "mobile", 360, 780, 3.0,
                "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
                true, true, false));

        m.put("galaxy_s23_ultra", new DeviceProfile(
                "Samsung Galaxy S23 Ultra", "mobile", 384, 824, 3.0,
                "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
                true, true, false));

        m.put("pixel_7", new DeviceProfile(
                "Google Pixel 7", "mobile", 412, 915, 2.625,
                "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
                true, true, false));

        // Tablets
        m.put("ipad_air", new DeviceProfile(
                "iPad Air", "tablet", 820, 1180, 2.0,
                "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                true, true, false));

        m.put("ipad_pro_12_9", new DeviceProfile(
                "iPad Pro 12.9", "tablet", 1024, 1366, 2.0,
                "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                true, true, false));

        m.put("galaxy_tab_s9", new DeviceProfile(
                "Samsung Galaxy Tab S9", "tablet", 800, 1280, 2.0,
                "Mozilla/5.0 (Linux; Android 14; SM-X710B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                true, true, false));

        BUILTIN = Collections.unmodifiableMap(m);
    }

    /** Lookup a built-in profile by key (e.g. "iphone_14", "galaxy_s23"). */
    public static DeviceProfile getBuiltin(String key) {
        return BUILTIN.get(key.toLowerCase().replace(' ', '_').replace('-', '_'));
    }

    /** All built-in profile keys. */
    public static Map<String, DeviceProfile> allBuiltins() {
        return BUILTIN;
    }

    /**
     * Build a DeviceProfile from a JSON-like map (as received from the API).
     * Expected keys: device_name, width, height, device_scale_factor, user_agent,
     *                is_mobile, has_touch, is_landscape, device_type.
     */
    public static DeviceProfile fromMap(Map<String, Object> map) {
        String deviceName = (String) map.getOrDefault("device_name", "Custom Device");
        String deviceType = (String) map.getOrDefault("device_type", "mobile");
        int w   = ((Number) map.getOrDefault("width", 375)).intValue();
        int h   = ((Number) map.getOrDefault("height", 812)).intValue();
        double sf = ((Number) map.getOrDefault("device_scale_factor", 2.0)).doubleValue();
        String ua = (String) map.getOrDefault("user_agent",
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
        boolean mob   = (Boolean) map.getOrDefault("is_mobile", true);
        boolean touch = (Boolean) map.getOrDefault("has_touch", true);
        boolean land  = (Boolean) map.getOrDefault("is_landscape", false);
        return new DeviceProfile(deviceName, deviceType, w, h, sf, ua, mob, touch, land);
    }
}
