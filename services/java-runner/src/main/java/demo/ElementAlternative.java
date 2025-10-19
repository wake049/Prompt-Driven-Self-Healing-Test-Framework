package demo;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class ElementAlternative {
    @JsonProperty("elementId")
    private String elementId;
    
    @JsonProperty("page")
    private String page;
    
    @JsonProperty("alternatives")
    private List<String> alternatives;

    // Default constructor for Jackson
    public ElementAlternative() {}

    public ElementAlternative(String elementId, String page, List<String> alternatives) {
        this.elementId = elementId;
        this.page = page;
        this.alternatives = alternatives;
    }

    // Getters and setters
    public String getElementId() {
        return elementId;
    }

    public void setElementId(String elementId) {
        this.elementId = elementId;
    }

    public String getPage() {
        return page;
    }

    public void setPage(String page) {
        this.page = page;
    }

    public List<String> getAlternatives() {
        return alternatives;
    }

    public void setAlternatives(List<String> alternatives) {
        this.alternatives = alternatives;
    }

    @Override
    public String toString() {
        return String.format("ElementAlternative{elementId='%s', page='%s', alternatives=%s}", 
                           elementId, page, alternatives);
    }
}