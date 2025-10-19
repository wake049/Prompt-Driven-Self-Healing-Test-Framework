package demo;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import java.util.List;

public class RunSummary {
    @JsonProperty("startTime")
    private String startTime;
    
    @JsonProperty("endTime")
    private String endTime;
    
    @JsonProperty("totalDuration")
    private long totalDuration; // in milliseconds
    
    @JsonProperty("totalSteps")
    private int totalSteps;
    
    @JsonProperty("passedSteps")
    private int passedSteps;
    
    @JsonProperty("failedSteps")
    private int failedSteps;
    
    @JsonProperty("healedSteps")
    private int healedSteps;
    
    @JsonProperty("results")
    private List<StepResult> results;

    // Default constructor for Jackson
    public RunSummary() {}

    public RunSummary(String startTime, String endTime, long totalDuration, 
                     int totalSteps, int passedSteps, int failedSteps, int healedSteps,
                     List<StepResult> results) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.totalDuration = totalDuration;
        this.totalSteps = totalSteps;
        this.passedSteps = passedSteps;
        this.failedSteps = failedSteps;
        this.healedSteps = healedSteps;
        this.results = results;
    }

    // Getters and setters
    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public long getTotalDuration() {
        return totalDuration;
    }

    public void setTotalDuration(long totalDuration) {
        this.totalDuration = totalDuration;
    }

    public int getTotalSteps() {
        return totalSteps;
    }

    public void setTotalSteps(int totalSteps) {
        this.totalSteps = totalSteps;
    }

    public int getPassedSteps() {
        return passedSteps;
    }

    public void setPassedSteps(int passedSteps) {
        this.passedSteps = passedSteps;
    }

    public int getFailedSteps() {
        return failedSteps;
    }

    public void setFailedSteps(int failedSteps) {
        this.failedSteps = failedSteps;
    }

    public int getHealedSteps() {
        return healedSteps;
    }

    public void setHealedSteps(int healedSteps) {
        this.healedSteps = healedSteps;
    }

    public List<StepResult> getResults() {
        return results;
    }

    public void setResults(List<StepResult> results) {
        this.results = results;
    }
}