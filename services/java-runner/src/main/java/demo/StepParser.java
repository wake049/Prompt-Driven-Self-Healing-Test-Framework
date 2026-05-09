package demo;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;

/**
 * Wraps a {@link Step} with typed accessors for the {@code data} field,
 * which may contain JSON key-value parameters for gestures, durations, etc.
 */
public class StepParser extends Step {

    private Map<String, Object> params;

    public StepParser() {
        super();
    }

    public StepParser(Step step) {
        super(step.getPage(), step.getAction(), step.getLocator(),
              step.getElementId(), step.getData(), step.getOriginalPage());
        setSelectorPolicy(step.getSelectorPolicy());
        parseParams();
    }

    @SuppressWarnings("unchecked")
    private void parseParams() {
        String raw = getData();
        if (raw != null && !raw.isEmpty()) {
            try {
                if (raw.trim().startsWith("{")) {
                    params = new ObjectMapper().readValue(raw, Map.class);
                }
            } catch (Exception ignored) { }
        }
        if (params == null) {
            params = Map.of();
        }
    }

    public String getStringValue(String key, String defaultValue) {
        if (params.containsKey(key)) {
            Object v = params.get(key);
            return v != null ? v.toString() : defaultValue;
        }
        // Fall back to data field itself for simple string values
        if ("value".equals(key) && getData() != null && !getData().trim().startsWith("{")) {
            return getData();
        }
        return defaultValue;
    }

    public int getIntValue(String key, int defaultValue) {
        if (params.containsKey(key)) {
            Object v = params.get(key);
            if (v instanceof Number) return ((Number) v).intValue();
            try { return Integer.parseInt(v.toString()); } catch (Exception e) { return defaultValue; }
        }
        return defaultValue;
    }

    public double getDoubleValue(String key, double defaultValue) {
        if (params.containsKey(key)) {
            Object v = params.get(key);
            if (v instanceof Number) return ((Number) v).doubleValue();
            try { return Double.parseDouble(v.toString()); } catch (Exception e) { return defaultValue; }
        }
        return defaultValue;
    }

    public boolean getBooleanValue(String key, boolean defaultValue) {
        if (params.containsKey(key)) {
            Object v = params.get(key);
            if (v instanceof Boolean) return (Boolean) v;
            return "true".equalsIgnoreCase(String.valueOf(v));
        }
        return defaultValue;
    }
}
