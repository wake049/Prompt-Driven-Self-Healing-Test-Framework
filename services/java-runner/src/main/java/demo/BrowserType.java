package demo;

/**
 * Enum representing supported browser types for test execution
 * Part of Multi-Browser Support feature (Phase 2 Enhancement)
 */
public enum BrowserType {
    CHROME("chrome", "Chrome"),
    FIREFOX("firefox", "Firefox"),
    EDGE("edge", "Microsoft Edge"),
    SAFARI("safari", "Safari");
    
    private final String value;
    private final String displayName;
    
    BrowserType(String value, String displayName) {
        this.value = value;
        this.displayName = displayName;
    }
    
    public String getValue() {
        return value;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    /**
     * Parse browser type from string value
     * @param value The browser type string (e.g., "chrome", "firefox")
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
            ". Supported browsers: chrome, firefox, edge, safari");
    }
    
    @Override
    public String toString() {
        return displayName;
    }
}
