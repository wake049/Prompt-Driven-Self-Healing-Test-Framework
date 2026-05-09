package demo;

/**
 * Enum representing supported browser types for test execution.
 * Includes both desktop browsers and mobile-emulation targets.
 * Part of Multi-Browser Support feature (Phase 2 Enhancement)
 */
public enum BrowserType {
    CHROME("chrome", "Chrome", false),
    FIREFOX("firefox", "Firefox", false),
    EDGE("edge", "Microsoft Edge", false),
    SAFARI("safari", "Safari", false),
    CHROME_MOBILE("chrome-mobile", "Chrome Mobile", true),
    CHROME_TABLET("chrome-tablet", "Chrome Tablet", true),

    // Appium targets
    APPIUM_ANDROID_WEB("appium-android-web", "Android Web (Appium)", false),
    APPIUM_IOS_WEB("appium-ios-web", "iOS Web (Appium)", false),
    APPIUM_ANDROID_NATIVE("appium-android-native", "Android Native (Appium)", false),
    APPIUM_IOS_NATIVE("appium-ios-native", "iOS Native (Appium)", false),
    APPIUM_FLUTTER("appium-flutter", "Flutter App (Appium)", false),
    APPIUM_WINDOWS("appium-windows", "Windows Desktop (Appium)", false),
    APPIUM_MAC("appium-mac", "Mac Desktop (Appium)", false);
    
    private final String value;
    private final String displayName;
    private final boolean mobileEmulation;
    
    BrowserType(String value, String displayName, boolean mobileEmulation) {
        this.value = value;
        this.displayName = displayName;
        this.mobileEmulation = mobileEmulation;
    }
    
    public String getValue() {
        return value;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    /** True when this type uses Chrome DevTools mobile emulation. */
    public boolean isMobileEmulation() {
        return mobileEmulation;
    }

    /** True when this type requires an Appium server connection. */
    public boolean isAppium() {
        return value.startsWith("appium-");
    }

    /** True when this Appium type targets a native app (not a browser). */
    public boolean isNativeApp() {
        return value.contains("-native") || value.equals("appium-flutter")
                || value.equals("appium-windows") || value.equals("appium-mac");
    }
    
    /**
     * Parse browser type from string value
     * @param value The browser type string (e.g., "chrome", "firefox", "appium-android-web")
     * @return The corresponding BrowserType enum
     * @throws IllegalArgumentException if browser type is not supported
     */
    public static BrowserType fromValue(String value) {
        if (value == null || value.trim().isEmpty()) {
            return CHROME; // Default to Chrome
        }
        
        for (BrowserType type : values()) {
            if (type.value.equalsIgnoreCase(value.trim())) {
                return type;
            }
        }
        
        throw new IllegalArgumentException("Unsupported browser type: " + value + 
            ". Supported browsers: chrome, firefox, edge, safari, chrome-mobile, chrome-tablet, "
            + "appium-android-web, appium-ios-web, appium-android-native, appium-ios-native, "
            + "appium-flutter, appium-windows, appium-mac");
    }
    
    @Override
    public String toString() {
        return displayName;
    }
}
