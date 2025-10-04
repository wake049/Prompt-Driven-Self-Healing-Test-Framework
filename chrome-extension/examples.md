# Example Test Scenarios

This file contains example JSON payloads for testing the MCP Test Runner extension.

## 1. Login Flow Test

### Step 1: Add login form elements to repository
```json
{
  "elementId": "username-field",
  "elementData": {
    "tag": "input",
    "text": "",
    "attributes": {
      "type": "email",
      "name": "username",
      "placeholder": "Enter email"
    },
    "selectors": [
      "input[name='username']",
      "input[type='email']",
      "#username",
      "//input[@name='username']"
    ]
  }
}
```

```json
{
  "elementId": "password-field",
  "elementData": {
    "tag": "input",
    "text": "",
    "attributes": {
      "type": "password",
      "name": "password"
    },
    "selectors": [
      "input[name='password']",
      "input[type='password']",
      "#password",
      "//input[@name='password']"
    ]
  }
}
```

```json
{
  "elementId": "login-button",
  "elementData": {
    "tag": "button",
    "text": "Login",
    "attributes": {
      "type": "submit",
      "class": "btn btn-primary"
    },
    "selectors": [
      "button[type='submit']",
      ".btn.btn-primary",
      "button:contains('Login')",
      "//button[text()='Login']"
    ]
  }
}
```

### Step 2: Execute login actions
```json
{
  "action": {
    "type": "ui.type",
    "elementId": "username-field",
    "text": "user@example.com",
    "options": {
      "clear": true
    }
  }
}
```

```json
{
  "action": {
    "type": "ui.type",
    "elementId": "password-field",
    "text": "password123",
    "options": {
      "clear": true
    }
  }
}
```

```json
{
  "action": {
    "type": "ui.click",
    "elementId": "login-button"
  }
}
```

### Step 3: Verify login success
```json
{
  "preset": {
    "name": "Login Success Verification",
    "description": "Verify user is logged in successfully",
    "checks": [
      {
        "type": "exists",
        "elementId": "user-menu",
        "description": "User menu appears after login"
      },
      {
        "type": "text",
        "selector": ".welcome-message",
        "expected": "Welcome",
        "description": "Welcome message is displayed"
      },
      {
        "type": "visible",
        "elementId": "logout-button",
        "description": "Logout button is visible"
      }
    ]
  }
}
```

## 2. Form Validation Test

### Verification preset for form errors
```json
{
  "preset": {
    "name": "Form Validation Check",
    "description": "Check that form validation errors appear",
    "checks": [
      {
        "type": "visible",
        "selector": ".error-message",
        "description": "Error message is visible"
      },
      {
        "type": "text",
        "selector": ".error-message",
        "expected": "required",
        "description": "Error message contains 'required'"
      },
      {
        "type": "attribute",
        "elementId": "username-field",
        "expected": {
          "attribute": "class",
          "value": "invalid"
        },
        "description": "Username field has invalid class"
      }
    ]
  }
}
```

## 3. Shopping Cart Test

### Add product to cart
```json
{
  "action": {
    "type": "ui.click",
    "elementId": "add-to-cart-btn"
  }
}
```

### Verify cart count
```json
{
  "preset": {
    "name": "Cart Count Verification",
    "description": "Verify cart count increases",
    "checks": [
      {
        "type": "text",
        "elementId": "cart-count",
        "expected": "1",
        "description": "Cart shows 1 item"
      },
      {
        "type": "visible",
        "elementId": "cart-badge",
        "description": "Cart badge is visible"
      }
    ]
  }
}
```

## 4. Context Usage Example

### Store user data in context
```json
{
  "key": "currentUser",
  "value": {
    "email": "user@example.com",
    "role": "admin"
  },
  "type": "object"
}
```

### Retrieve and verify context data
```json
{
  "key": "currentUser"
}
```

```json
{
  "actual": {"email": "user@example.com", "role": "admin"},
  "expected": {"email": "user@example.com", "role": "admin"},
  "description": "User data matches expected values"
}
```

## 5. Search Functionality Test

### Search action
```json
{
  "action": {
    "type": "ui.type",
    "elementId": "search-input",
    "text": "test query",
    "options": {
      "clear": true
    }
  }
}
```

```json
{
  "action": {
    "type": "ui.click",
    "elementId": "search-button"
  }
}
```

### Verify search results
```json
{
  "preset": {
    "name": "Search Results Verification",
    "description": "Verify search results are displayed",
    "checks": [
      {
        "type": "count",
        "selector": ".search-result",
        "expected": 5,
        "description": "5 search results are displayed"
      },
      {
        "type": "visible",
        "elementId": "results-container",
        "description": "Results container is visible"
      },
      {
        "type": "text",
        "selector": ".results-count",
        "expected": "5 results",
        "description": "Results count is correct"
      }
    ]
  }
}
```

## 6. Navigation Test

### Click navigation menu
```json
{
  "action": {
    "type": "ui.click",
    "elementId": "nav-products"
  }
}
```

### Verify page navigation
```json
{
  "preset": {
    "name": "Navigation Verification",
    "description": "Verify navigation to products page",
    "checks": [
      {
        "type": "text",
        "selector": "h1",
        "expected": "Products",
        "description": "Page title shows Products"
      },
      {
        "type": "attribute",
        "elementId": "nav-products",
        "expected": {
          "attribute": "class",
          "value": "active"
        },
        "description": "Products nav item is active"
      }
    ]
  }
}
```

## Tips for Using Examples

1. **Recording Elements**: Use the Record button to capture elements visually instead of manually creating element data
2. **Self-Healing**: Include multiple selector types for better reliability
3. **Verification Timing**: Some checks may need to wait for page loads or animations
4. **Context Data**: Use context for sharing data between test steps
5. **Debugging**: Check the browser console for detailed error messages