package demo;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class ElementRepository {
    private List<ElementAlternative> elements;
    private static final String ELEMENT_REPO_FILE = "element_repository.json";

    public ElementRepository() {
        this.elements = new ArrayList<>();
        loadRepository();
    }

    private void loadRepository() {
        try {
            this.elements = JsonUtil.readListFromFile(ELEMENT_REPO_FILE, 
                new TypeReference<List<ElementAlternative>>() {});
            
        } catch (IOException e) {
            System.err.println("Warning: Could not load element repository: " + e.getMessage());
            System.err.println("Creating empty repository...");
            this.elements = new ArrayList<>();
        }
    }

    public List<String> getAlternatives(String elementId, String page) {
        Optional<ElementAlternative> elementAlternative = elements.stream()
            .filter(ea -> ea.getElementId().equals(elementId) && 
                         (ea.getPage().equals(page) || ea.getPage().equals("*")))
            .findFirst();
        
        if (elementAlternative.isPresent()) {
            List<String> alternatives = new ArrayList<>(elementAlternative.get().getAlternatives());
            
            return alternatives;
        }

        return new ArrayList<>();
    }

    public void addElement(ElementAlternative elementAlternative) {
        // Remove existing element with same ID and page
        elements.removeIf(ea -> ea.getElementId().equals(elementAlternative.getElementId()) && 
                               ea.getPage().equals(elementAlternative.getPage()));
        elements.add(elementAlternative);
    }

    public void saveRepository() {
        try {
            JsonUtil.writeToFile(ELEMENT_REPO_FILE, elements);
            
        } catch (IOException e) {
            System.err.println("Error saving element repository: " + e.getMessage());
        }
    }

    public int size() {
        return elements.size();
    }

    public List<ElementAlternative> getAllElements() {
        return new ArrayList<>(elements);
    }
}