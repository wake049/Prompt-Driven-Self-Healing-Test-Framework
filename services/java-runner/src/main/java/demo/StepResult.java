package demo;

import com.fasterxml.jackson.annotation.JsonProperty;

public class StepResult {
    @JsonProperty("stepIndex")
    private int stepIndex;
    
    @JsonProperty("step")
    private Step step;
    
    @JsonProperty("status")
    private String status; // PASS, FAIL, HEALED
    
    @JsonProperty("duration")
    private long duration; // in milliseconds
    
    @JsonProperty("error")
    private String error;
    
    @JsonProperty("healed")
    private boolean healed;
    
    @JsonProperty("originalLocator")
    private String originalLocator;
    
    @JsonProperty("healedLocator")
    private String healedLocator;
    
    @JsonProperty("screenshotPath")
    private String screenshotPath;

    // Default constructor for Jackson
    public StepResult() {}

    public StepResult(int stepIndex, Step step, String status, long duration) {
        this.stepIndex = stepIndex;
        this.step = step;
        this.status = status;
        this.duration = duration;
        this.healed = false;
    }

    // Getters and setters
    public int getStepIndex() {
        return stepIndex;
    }

    public void setStepIndex(int stepIndex) {
        this.stepIndex = stepIndex;
    }

    public Step getStep() {
        return step;
    }

    public void setStep(Step step) {
        this.step = step;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public long getDuration() {
        return duration;
    }

    public void setDuration(long duration) {
        this.duration = duration;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public boolean isHealed() {
        return healed;
    }

    public void setHealed(boolean healed) {
        this.healed = healed;
    }

    public String getOriginalLocator() {
        return originalLocator;
    }

    public void setOriginalLocator(String originalLocator) {
        this.originalLocator = originalLocator;
    }

    public String getHealedLocator() {
        return healedLocator;
    }

    public void setHealedLocator(String healedLocator) {
        this.healedLocator = healedLocator;
    }

    public String getScreenshotPath() {
        return screenshotPath;
    }

    public void setScreenshotPath(String screenshotPath) {
        this.screenshotPath = screenshotPath;
    }

    @Override
    public String toString() {
        return String.format("StepResult{stepIndex=%d, status='%s', duration=%dms, healed=%s}", 
                           stepIndex, status, duration, healed);
    }
}