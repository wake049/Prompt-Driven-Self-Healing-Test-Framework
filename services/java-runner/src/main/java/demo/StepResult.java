package demo;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.ArrayList;

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
    
    @JsonProperty("attemptedAlternatives")
    private List<String> attemptedAlternatives;

    @JsonProperty("details")
    private String details;

    // Default constructor for Jackson
    public StepResult() {
        this.attemptedAlternatives = new ArrayList<>();
    }

    public StepResult(int stepIndex, Step step, String status, long duration) {
        this.stepIndex = stepIndex;
        this.step = step;
        this.status = status;
        this.duration = duration;
        this.healed = false;
        this.attemptedAlternatives = new ArrayList<>();
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
    
    public List<String> getAttemptedAlternatives() {
        return attemptedAlternatives;
    }
    
    public void setAttemptedAlternatives(List<String> attemptedAlternatives) {
        this.attemptedAlternatives = attemptedAlternatives;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    @Override
    public String toString() {
        return String.format("StepResult{stepIndex=%d, status='%s', duration=%dms, healed=%s}", 
                           stepIndex, status, duration, healed);
    }
}