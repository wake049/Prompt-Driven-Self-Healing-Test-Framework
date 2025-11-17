package demo;

import com.fasterxml.jackson.annotation.JsonProperty;

public class Step {
    @JsonProperty("page")
    private String page;
    
    @JsonProperty("action")
    private String action;
    
    @JsonProperty("locator")
    private String locator;
    
    @JsonProperty("elementId")
    private String elementId;
    
    @JsonProperty("data")
    private String data;
    
    @JsonProperty("selectorPolicy")
    private String selectorPolicy;
    
    // Store original page value for healing lookup
    private String originalPage;

    // Default constructor for Jackson
    public Step() {}

    public Step(String page, String action, String locator, String elementId, String data) {
        this.page = page;
        this.action = action;
        this.locator = locator;
        this.elementId = elementId;
        this.data = data;
        this.selectorPolicy = "balanced"; // Default policy
        this.originalPage = page; // Default to same as page
    }
    
    public Step(String page, String action, String locator, String elementId, String data, String originalPage) {
        this.page = page;
        this.action = action;
        this.locator = locator;
        this.elementId = elementId;
        this.data = data;
        this.originalPage = originalPage;
    }

    // Getters and setters
    public String getPage() {
        return page;
    }

    public void setPage(String page) {
        this.page = page;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getLocator() {
        return locator;
    }

    public void setLocator(String locator) {
        this.locator = locator;
    }

    public String getElementId() {
        return elementId;
    }

    public void setElementId(String elementId) {
        this.elementId = elementId;
    }

    public String getData() {
        return data;
    }

    public void setData(String data) {
        this.data = data;
    }
    
    public String getOriginalPage() {
        return originalPage != null ? originalPage : page;
    }
    
    public void setOriginalPage(String originalPage) {
        this.originalPage = originalPage;
    }

    public String getSelectorPolicy() {
        return selectorPolicy != null ? selectorPolicy : "balanced";
    }

    public void setSelectorPolicy(String selectorPolicy) {
        this.selectorPolicy = selectorPolicy;
    }

    @Override
    public String toString() {
        return String.format("Step{page='%s', action='%s', locator='%s', elementId='%s', data='%s'}", 
                           page, action, locator, elementId, data);
    }
}