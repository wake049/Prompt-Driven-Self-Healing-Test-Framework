package demo;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.*;

@RestController
public class HealthController {
    
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> simpleHealth() {
        System.out.println("=== ROOT HEALTH CHECK REQUEST - /health ===");
        System.out.println("Timestamp: " + new Date());
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "java-runner");
        response.put("timestamp", new Date());
        response.put("ready", true);
        response.put("endpoint", "/health");
        
        System.out.println("Root health check response: " + response);
        System.out.println("=== ROOT HEALTH CHECK COMPLETE ===");
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/")
    public ResponseEntity<String> root() {
        System.out.println("=== ROOT ENDPOINT REQUEST - / ===");
        System.out.println("Timestamp: " + new Date());
        
        String response = "Java Runner Service - OK - " + new Date();
        System.out.println("Root response: " + response);
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> readiness() {
        System.out.println("=== READINESS CHECK REQUEST - /ready ===");
        System.out.println("Timestamp: " + new Date());
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "READY");
        response.put("service", "java-runner");
        response.put("timestamp", new Date());
        
        System.out.println("Readiness check response: " + response);
        
        return ResponseEntity.ok(response);
    }
}