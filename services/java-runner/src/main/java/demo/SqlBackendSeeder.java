package demo;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;

import java.io.IOException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SqlBackendSeeder {
    private static final String SQL_BACKEND_URL = System.getenv("UNIFIED_API_URL") != null ? 
        System.getenv("UNIFIED_API_URL") : 
        "https://testhelix.com";
    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static void main(String[] args) {
        System.out.println("=== SQL Backend Element Seeder ===");
        System.out.println("Populating SQL backend with sample element alternatives...");
        
        SqlBackendSeeder seeder = new SqlBackendSeeder();
        
        try {
            // Create a test session first
            String sessionId = seeder.createTestSession();
            System.out.println("Created test session: " + sessionId);
            
            // Add sample elements
            seeder.addSampleElements(sessionId);
            
            System.out.println("✓ Successfully populated SQL backend with sample elements");
            System.out.println("You can now run the test framework with SQL backend integration");
            
        } catch (Exception e) {
            System.err.println("Error seeding SQL backend: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private String createTestSession() throws IOException {
        Map<String, Object> session = new HashMap<>();
        session.put("name", "Swag Labs Self-Healing Test Session");
        session.put("page", "https://www.saucedemo.com");
        session.put("description", "Test session for self-healing framework with Swag Labs elements");

        String response = makePostRequest("/api/sessions", session);
        
        // Parse response to get session ID
        Map<String, Object> responseMap = objectMapper.readValue(response, Map.class);
        Map<String, Object> data = (Map<String, Object>) responseMap.get("data");
        return (String) data.get("id");
    }

    private void addSampleElements(String sessionId) throws IOException {
        // Username field alternatives
        addElement(sessionId, "username_field", "input", "saucedemo", 
            "#user-name", "//input[@data-test='username']",
            Arrays.asList(
                "css=input[data-test='username']",
                "xpath=//input[@placeholder='Username']",
                "css=input[placeholder='Username']",
                "name=user-name",
                "css=.form_input:first-child"
            ));

        // Password field alternatives
        addElement(sessionId, "password_field", "input", "saucedemo",
            "#password", "//input[@data-test='password']",
            Arrays.asList(
                "css=input[data-test='password']",
                "xpath=//input[@placeholder='Password']",
                "css=input[placeholder='Password']",
                "name=password",
                "css=.form_input:nth-child(2)"
            ));

        // Login button alternatives
        addElement(sessionId, "login_button", "input", "saucedemo",
            "#login-button", "//input[@data-test='login-button']",
            Arrays.asList(
                "css=input[data-test='login-button']",
                "xpath=//input[@value='Login']",
                "css=input[value='Login']",
                "css=.btn_action",
                "xpath=//form//input[@type='submit']"
            ));

        // Inventory container alternatives
        addElement(sessionId, "inventory_container", "div", "saucedemo",
            ".inventory_container", "//div[@class='inventory_container']",
            Arrays.asList(
                "css=#inventory_container",
                "css=.inventory_list",
                "xpath=//div[contains(@class,'inventory_container')]",
                "css=[data-test='inventory-container']"
            ));

        // Page title alternatives
        addElement(sessionId, "page_title", "span", "saucedemo",
            ".title", "//span[@class='title']",
            Arrays.asList(
                "css=.header_secondary_container .title",
                "xpath=//span[@class='title']",
                "css=span.title",
                "css=[data-test='title']",
                "xpath=//div[contains(@class,'header_secondary_container')]//span"
            ));

        // Add to cart button alternatives
        addElement(sessionId, "add_backpack_button", "button", "saucedemo",
            "#add-to-cart-sauce-labs-backpack", "//button[@data-test='add-to-cart-sauce-labs-backpack']",
            Arrays.asList(
                "css=button[data-test='add-to-cart-sauce-labs-backpack']",
                "xpath=//button[text()='Add to cart' and contains(@id,'sauce-labs-backpack')]",
                "css=.inventory_item:first-child .btn_primary",
                "xpath=//div[@class='inventory_item'][1]//button"
            ));

        // Shopping cart link alternatives
        addElement(sessionId, "cart_link", "a", "saucedemo",
            ".shopping_cart_link", "//a[@class='shopping_cart_link']",
            Arrays.asList(
                "css=a.shopping_cart_link",
                "css=[data-test='shopping-cart-link']",
                "xpath=//a[@class='shopping_cart_link']",
                "css=.shopping_cart_container a",
                "xpath=//div[@id='shopping_cart_container']//a"
            ));

        // Cart item alternatives
        addElement(sessionId, "cart_item", "div", "saucedemo",
            ".cart_item", "//div[@class='cart_item']",
            Arrays.asList(
                "css=.cart_item_label",
                "css=[data-test='inventory-item']",
                "xpath=//div[@class='cart_item']",
                "css=.inventory_item_name"
            ));

        // Item name alternatives
        addElement(sessionId, "item_name", "div", "saucedemo",
            ".inventory_item_name", "//div[@class='inventory_item_name']",
            Arrays.asList(
                "css=.inventory_item_name a",
                "css=[data-test='inventory-item-name']",
                "xpath=//div[@class='inventory_item_name']",
                "css=.cart_item .inventory_item_name"
            ));

        System.out.println("✓ Added 9 element definitions with alternative locators");
    }

    private void addElement(String sessionId, String elementId, String tag, String page,
                           String cssSelector, String xpath, List<String> alternatives) throws IOException {
        Map<String, Object> element = new HashMap<>();
        element.put("session_id", sessionId);
        element.put("element_id", elementId);
        element.put("tag", tag);
        element.put("page", "https://www.saucedemo.com");
        element.put("css_selector", cssSelector);
        element.put("xpath", xpath);
        element.put("selectors", alternatives);
        
        // Add attributes that help with action determination
        Map<String, Object> attributes = new HashMap<>();
        if (tag.equals("input")) {
            if (elementId.contains("username") || elementId.contains("user")) {
                attributes.put("type", "text");
                attributes.put("placeholder", "Username");
            } else if (elementId.contains("password")) {
                attributes.put("type", "password");
                attributes.put("placeholder", "Password");
            } else if (elementId.contains("button") || elementId.contains("login")) {
                attributes.put("type", "submit");
                attributes.put("value", "Login");
            }
        } else if (tag.equals("button")) {
            attributes.put("type", "button");
            if (elementId.contains("add")) {
                attributes.put("text", "Add to cart");
            }
        }
        
        element.put("attributes", attributes);
        element.put("position_x", 0);
        element.put("position_y", 0);

        makePostRequest("/api/elements", element);
        System.out.println("  Added element: " + elementId + " with " + alternatives.size() + " alternatives");
    }

    private String makePostRequest(String endpoint, Object data) throws IOException {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            HttpPost httpPost = new HttpPost(SQL_BACKEND_URL + endpoint);
            httpPost.setHeader("Content-Type", "application/json");
            
            String json = objectMapper.writeValueAsString(data);
            httpPost.setEntity(new StringEntity(json));
            
            try (CloseableHttpResponse response = httpClient.execute(httpPost)) {
                int statusCode = response.getStatusLine().getStatusCode();
                String responseBody = org.apache.http.util.EntityUtils.toString(response.getEntity());
                
                if (statusCode >= 200 && statusCode < 300) {
                    return responseBody;
                } else {
                    throw new IOException("HTTP " + statusCode + ": " + responseBody);
                }
            }
        }
    }
}