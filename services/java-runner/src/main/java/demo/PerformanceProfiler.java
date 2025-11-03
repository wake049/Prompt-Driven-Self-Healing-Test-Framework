package demo;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.lang.management.ThreadMXBean;
import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.RuntimeMXBean;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Performance profiler for the Self-Healing Test Framework
 * Monitors Memory, CPU, and Threading performance metrics
 */
public class PerformanceProfiler {
    
    private final MemoryMXBean memoryBean;
    private final ThreadMXBean threadBean;
    private final RuntimeMXBean runtimeBean;
    private final List<GarbageCollectorMXBean> gcBeans;
    
    private List<PerformanceSnapshot> snapshots;
    private long startTime;
    private Map<String, Long> stepExecutionTimes;
    private Map<String, Long> memoryUsageByStep;
    
    public PerformanceProfiler() {
        this.memoryBean = ManagementFactory.getMemoryMXBean();
        this.threadBean = ManagementFactory.getThreadMXBean();
        this.runtimeBean = ManagementFactory.getRuntimeMXBean();
        this.gcBeans = ManagementFactory.getGarbageCollectorMXBeans();
        
        this.snapshots = new ArrayList<>();
        this.stepExecutionTimes = new HashMap<>();
        this.memoryUsageByStep = new HashMap<>();
        this.startTime = System.currentTimeMillis();
        
        System.out.println(" Performance Profiler initialized");
        System.out.println("JVM: " + runtimeBean.getVmName() + " " + runtimeBean.getVmVersion());
        System.out.println("Available Processors: " + Runtime.getRuntime().availableProcessors());
    }
    
    /**
     * Capture a performance snapshot at the current moment
     */
    public PerformanceSnapshot captureSnapshot(String label) {
        long timestamp = System.currentTimeMillis();
        
        // Memory usage
        MemoryUsage heapMemory = memoryBean.getHeapMemoryUsage();
        MemoryUsage nonHeapMemory = memoryBean.getNonHeapMemoryUsage();
        
        // Thread information
        int threadCount = threadBean.getThreadCount();
        int peakThreadCount = threadBean.getPeakThreadCount();
        
        // Garbage collection stats
        long totalGcCollections = 0;
        long totalGcTime = 0;
        Map<String, GcStats> gcStatsByCollector = new HashMap<>();
        
        for (GarbageCollectorMXBean gcBean : gcBeans) {
            long collections = gcBean.getCollectionCount();
            long time = gcBean.getCollectionTime();
            totalGcCollections += collections;
            totalGcTime += time;
            
            gcStatsByCollector.put(gcBean.getName(), new GcStats(collections, time));
        }
        
        // Runtime information
        long uptime = runtimeBean.getUptime();
        
        PerformanceSnapshot snapshot = new PerformanceSnapshot(
            label,
            timestamp,
            heapMemory.getUsed(),
            heapMemory.getMax(),
            heapMemory.getCommitted(),
            nonHeapMemory.getUsed(),
            threadCount,
            peakThreadCount,
            totalGcCollections,
            totalGcTime,
            uptime,
            gcStatsByCollector
        );
        
        snapshots.add(snapshot);
        
        // Log critical metrics
        double heapUsagePercent = (double) heapMemory.getUsed() / heapMemory.getMax() * 100;
        System.out.printf(" [%s] Heap: %.1f%% (%d MB / %d MB), Threads: %d, GC: %d collections%n",
            label,
            heapUsagePercent,
            heapMemory.getUsed() / (1024 * 1024),
            heapMemory.getMax() / (1024 * 1024),
            threadCount,
            totalGcCollections
        );
        
        return snapshot;
    }
    
    /**
     * Record execution time for a specific step
     */
    public void recordStepExecution(String stepName, long executionTimeMs, long memoryUsedBytes) {
        stepExecutionTimes.put(stepName, executionTimeMs);
        memoryUsageByStep.put(stepName, memoryUsedBytes);
    }
    
    /**
     * Generate comprehensive performance report
     */
    public PerformanceReport generateReport() {
        if (snapshots.isEmpty()) {
            System.out.println(" No performance snapshots captured");
            return null;
        }
        
        PerformanceSnapshot firstSnapshot = snapshots.get(0);
        PerformanceSnapshot lastSnapshot = snapshots.get(snapshots.size() - 1);
        
        // Memory analysis
        long maxHeapUsed = snapshots.stream()
            .mapToLong(s -> s.heapMemoryUsed)
            .max()
            .orElse(0);
            
        long avgHeapUsed = (long) snapshots.stream()
            .mapToLong(s -> s.heapMemoryUsed)
            .average()
            .orElse(0);
            
        // Memory growth analysis
        long memoryGrowth = lastSnapshot.heapMemoryUsed - firstSnapshot.heapMemoryUsed;
        double memoryGrowthRate = (double) memoryGrowth / (lastSnapshot.timestamp - firstSnapshot.timestamp) * 1000; // bytes per second
        
        // Thread analysis
        int maxThreads = snapshots.stream()
            .mapToInt(s -> s.threadCount)
            .max()
            .orElse(0);
            
        // GC analysis
        long totalGcCollections = lastSnapshot.totalGcCollections - firstSnapshot.totalGcCollections;
        long totalGcTime = lastSnapshot.totalGcTime - firstSnapshot.totalGcTime;
        
        // Performance bottlenecks detection
        List<String> performanceIssues = detectPerformanceIssues();
        
        PerformanceReport report = new PerformanceReport(
            System.currentTimeMillis() - startTime,
            snapshots.size(),
            maxHeapUsed,
            avgHeapUsed,
            memoryGrowth,
            memoryGrowthRate,
            maxThreads,
            totalGcCollections,
            totalGcTime,
            performanceIssues,
            new HashMap<>(stepExecutionTimes),
            new HashMap<>(memoryUsageByStep)
        );
        
        return report;
    }
    
    /**
     * Detect potential performance issues
     */
    private List<String> detectPerformanceIssues() {
        List<String> issues = new ArrayList<>();
        
        if (snapshots.size() < 2) return issues;
        
        PerformanceSnapshot latest = snapshots.get(snapshots.size() - 1);
        
        // Check memory usage
        double heapUsagePercent = (double) latest.heapMemoryUsed / latest.heapMemoryMax * 100;
        if (heapUsagePercent > 85) {
            issues.add("🚨 HIGH MEMORY USAGE: Heap usage at " + String.format("%.1f%%", heapUsagePercent));
        }
        
        // Check memory growth rate
        if (snapshots.size() >= 3) {
            PerformanceSnapshot first = snapshots.get(0);
            long memoryGrowth = latest.heapMemoryUsed - first.heapMemoryUsed;
            long timeElapsed = latest.timestamp - first.timestamp;
            double growthRateMBperMin = (memoryGrowth / (1024.0 * 1024.0)) / (timeElapsed / 60000.0);
            
            if (growthRateMBperMin > 10) { // More than 10MB/minute growth
                issues.add("🚨 MEMORY LEAK SUSPECTED: Memory growing at " + String.format("%.2f MB/min", growthRateMBperMin));
            }
        }
        
        // Check thread count
        if (latest.threadCount > 50) {
            issues.add(" HIGH THREAD COUNT: " + latest.threadCount + " threads active");
        }
        
        // Check GC pressure
        if (snapshots.size() >= 2) {
            PerformanceSnapshot previous = snapshots.get(snapshots.size() - 2);
            long gcCollectionsDiff = latest.totalGcCollections - previous.totalGcCollections;
            long timeDiff = latest.timestamp - previous.timestamp;
            
            if (timeDiff > 0 && gcCollectionsDiff > 0) {
                double gcRate = (double) gcCollectionsDiff / (timeDiff / 1000.0); // GC per second
                if (gcRate > 2) { // More than 2 GC per second
                    issues.add(" HIGH GC PRESSURE: " + String.format("%.2f", gcRate) + " GC/sec");
                }
            }
        }
        
        return issues;
    }
    
    /**
     * Force garbage collection and measure impact
     */
    public GcImpactAnalysis forceGcAndMeasure() {
        System.out.println("🗑️ Forcing garbage collection for analysis...");
        
        PerformanceSnapshot beforeGc = captureSnapshot("Before_GC");
        long gcStartTime = System.currentTimeMillis();
        
        System.gc();
        
        // Wait a bit for GC to complete
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        long gcDuration = System.currentTimeMillis() - gcStartTime;
        PerformanceSnapshot afterGc = captureSnapshot("After_GC");
        
        long memoryFreed = beforeGc.heapMemoryUsed - afterGc.heapMemoryUsed;
        double memoryFreedPercent = (double) memoryFreed / beforeGc.heapMemoryUsed * 100;
        
        GcImpactAnalysis analysis = new GcImpactAnalysis(
            gcDuration,
            memoryFreed,
            memoryFreedPercent,
            beforeGc.heapMemoryUsed,
            afterGc.heapMemoryUsed
        );
        
        System.out.printf("🗑️ GC Impact: Freed %d MB (%.1f%%) in %d ms%n",
            memoryFreed / (1024 * 1024),
            memoryFreedPercent,
            gcDuration
        );
        
        return analysis;
    }
    
    /**
     * Print detailed performance report to console
     */
    public void printDetailedReport() {
        PerformanceReport report = generateReport();
        if (report == null) return;

        System.out.println("=" .repeat(80));
        System.out.println(" PERFORMANCE PROFILER REPORT");
        System.out.println("=" .repeat(80));
        System.out.println("Generated: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        // Overview
        System.out.println(" EXECUTION OVERVIEW");
        System.out.println("-".repeat(40));
        System.out.printf("Total Execution Time: %,d ms (%.2f seconds)%n", report.totalExecutionTime, report.totalExecutionTime / 1000.0);
        System.out.printf("Performance Snapshots: %d%n", report.snapshotCount);

        // Memory Analysis
        System.out.println(" MEMORY ANALYSIS");
        System.out.println("-".repeat(40));
        System.out.printf("Peak Heap Usage: %,d MB%n", report.maxHeapUsed / (1024 * 1024));
        System.out.printf("Average Heap Usage: %,d MB%n", report.avgHeapUsed / (1024 * 1024));
        System.out.printf("Memory Growth: %,d MB%n", report.memoryGrowth / (1024 * 1024));
        System.out.printf("Memory Growth Rate: %.2f KB/sec%n", report.memoryGrowthRate / 1024);

        // Threading Analysis
        System.out.println("🧵 THREADING ANALYSIS");
        System.out.println("-".repeat(40));
        System.out.printf("Peak Thread Count: %d%n", report.maxThreads);

        // Garbage Collection Analysis
        System.out.println("🗑️ GARBAGE COLLECTION ANALYSIS");
        System.out.println("-".repeat(40));
        System.out.printf("Total GC Collections: %d%n", report.totalGcCollections);
        System.out.printf("Total GC Time: %,d ms%n", report.totalGcTime);
        if (report.totalGcCollections > 0) {
            System.out.printf("Average GC Time: %.2f ms%n", (double) report.totalGcTime / report.totalGcCollections);
        }

        // Performance Issues
        if (!report.performanceIssues.isEmpty()) {
            System.out.println(" PERFORMANCE ISSUES DETECTED");
            System.out.println("-".repeat(40));
            for (String issue : report.performanceIssues) {
                System.out.println(issue);
            }
            
        }
        
        // Step Performance Analysis
        if (!report.stepExecutionTimes.isEmpty()) {
            System.out.println("⏱️ STEP EXECUTION ANALYSIS");
            System.out.println("-".repeat(40));
            
            // Find slowest steps
            List<Map.Entry<String, Long>> sortedSteps = report.stepExecutionTimes.entrySet()
                .stream()
                .sorted((e1, e2) -> Long.compare(e2.getValue(), e1.getValue()))
                .toList();
                
            System.out.println("Slowest Steps:");
            for (int i = 0; i < Math.min(5, sortedSteps.size()); i++) {
                Map.Entry<String, Long> entry = sortedSteps.get(i);
                System.out.printf("  %d. %s: %,d ms%n", i + 1, entry.getKey(), entry.getValue());
            }
            
        }
        
        // Memory Usage by Step
        if (!report.memoryUsageByStep.isEmpty()) {
            System.out.println(" MEMORY USAGE BY STEP");
            System.out.println("-".repeat(40));
            
            List<Map.Entry<String, Long>> sortedMemorySteps = report.memoryUsageByStep.entrySet()
                .stream()
                .sorted((e1, e2) -> Long.compare(e2.getValue(), e1.getValue()))
                .toList();
                
            System.out.println("Highest Memory Usage Steps:");
            for (int i = 0; i < Math.min(5, sortedMemorySteps.size()); i++) {
                Map.Entry<String, Long> entry = sortedMemorySteps.get(i);
                System.out.printf("  %d. %s: %,d MB%n", i + 1, entry.getKey(), entry.getValue() / (1024 * 1024));
            }
            
        }
        
        // Recommendations
        System.out.println(" PERFORMANCE RECOMMENDATIONS");
        System.out.println("-".repeat(40));
        generateRecommendations(report);
        
        System.out.println("=" .repeat(80));
    }
    
    private void generateRecommendations(PerformanceReport report) {
        List<String> recommendations = new ArrayList<>();
        
        // Memory recommendations
        double peakHeapUsageMB = report.maxHeapUsed / (1024.0 * 1024.0);
        if (peakHeapUsageMB > 512) {
            recommendations.add("Consider increasing JVM heap size (-Xmx) for peak usage of " + String.format("%.0f MB", peakHeapUsageMB));
        }
        
        if (report.memoryGrowthRate > 1024) { // More than 1KB/sec growth
            recommendations.add("Monitor for memory leaks - memory growing at " + String.format("%.2f KB/sec", report.memoryGrowthRate / 1024));
        }
        
        // Threading recommendations
        if (report.maxThreads > 30) {
            recommendations.add("High thread count (" + report.maxThreads + ") - consider thread pooling");
        }
        
        // GC recommendations
        if (report.totalGcTime > report.totalExecutionTime * 0.05) { // More than 5% time in GC
            double gcPercentage = (double) report.totalGcTime / report.totalExecutionTime * 100;
            recommendations.add("High GC overhead (" + String.format("%.1f%%", gcPercentage) + ") - consider tuning GC parameters");
        }
        
        // Selenium-specific recommendations
        recommendations.add("Use WebDriverWait with explicit conditions instead of Thread.sleep()");
        recommendations.add("Close browser instances properly to free resources");
        recommendations.add("Consider running tests in headless mode for better performance");
        recommendations.add("Implement element caching to reduce DOM queries");
        
        if (recommendations.isEmpty()) {
            System.out.println(" No major performance issues detected. System is performing well!");
        } else {
            for (int i = 0; i < recommendations.size(); i++) {
                System.out.printf("%d. %s%n", i + 1, recommendations.get(i));
            }
        }
    }
    
    // Data classes
    public static class PerformanceSnapshot {
        public final String label;
        public final long timestamp;
        public final long heapMemoryUsed;
        public final long heapMemoryMax;
        public final long heapMemoryCommitted;
        public final long nonHeapMemoryUsed;
        public final int threadCount;
        public final int peakThreadCount;
        public final long totalGcCollections;
        public final long totalGcTime;
        public final long uptime;
        public final Map<String, GcStats> gcStatsByCollector;
        
        public PerformanceSnapshot(String label, long timestamp, long heapMemoryUsed, long heapMemoryMax,
                                 long heapMemoryCommitted, long nonHeapMemoryUsed, int threadCount,
                                 int peakThreadCount, long totalGcCollections, long totalGcTime,
                                 long uptime, Map<String, GcStats> gcStatsByCollector) {
            this.label = label;
            this.timestamp = timestamp;
            this.heapMemoryUsed = heapMemoryUsed;
            this.heapMemoryMax = heapMemoryMax;
            this.heapMemoryCommitted = heapMemoryCommitted;
            this.nonHeapMemoryUsed = nonHeapMemoryUsed;
            this.threadCount = threadCount;
            this.peakThreadCount = peakThreadCount;
            this.totalGcCollections = totalGcCollections;
            this.totalGcTime = totalGcTime;
            this.uptime = uptime;
            this.gcStatsByCollector = gcStatsByCollector;
        }
    }
    
    public static class GcStats {
        public final long collections;
        public final long time;
        
        public GcStats(long collections, long time) {
            this.collections = collections;
            this.time = time;
        }
    }
    
    public static class PerformanceReport {
        public final long totalExecutionTime;
        public final int snapshotCount;
        public final long maxHeapUsed;
        public final long avgHeapUsed;
        public final long memoryGrowth;
        public final double memoryGrowthRate;
        public final int maxThreads;
        public final long totalGcCollections;
        public final long totalGcTime;
        public final List<String> performanceIssues;
        public final Map<String, Long> stepExecutionTimes;
        public final Map<String, Long> memoryUsageByStep;
        
        public PerformanceReport(long totalExecutionTime, int snapshotCount, long maxHeapUsed,
                               long avgHeapUsed, long memoryGrowth, double memoryGrowthRate,
                               int maxThreads, long totalGcCollections, long totalGcTime,
                               List<String> performanceIssues, Map<String, Long> stepExecutionTimes,
                               Map<String, Long> memoryUsageByStep) {
            this.totalExecutionTime = totalExecutionTime;
            this.snapshotCount = snapshotCount;
            this.maxHeapUsed = maxHeapUsed;
            this.avgHeapUsed = avgHeapUsed;
            this.memoryGrowth = memoryGrowth;
            this.memoryGrowthRate = memoryGrowthRate;
            this.maxThreads = maxThreads;
            this.totalGcCollections = totalGcCollections;
            this.totalGcTime = totalGcTime;
            this.performanceIssues = performanceIssues;
            this.stepExecutionTimes = stepExecutionTimes;
            this.memoryUsageByStep = memoryUsageByStep;
        }
    }
    
    public static class GcImpactAnalysis {
        public final long gcDuration;
        public final long memoryFreed;
        public final double memoryFreedPercent;
        public final long memoryBeforeGc;
        public final long memoryAfterGc;
        
        public GcImpactAnalysis(long gcDuration, long memoryFreed, double memoryFreedPercent,
                              long memoryBeforeGc, long memoryAfterGc) {
            this.gcDuration = gcDuration;
            this.memoryFreed = memoryFreed;
            this.memoryFreedPercent = memoryFreedPercent;
            this.memoryBeforeGc = memoryBeforeGc;
            this.memoryAfterGc = memoryAfterGc;
        }
    }
}