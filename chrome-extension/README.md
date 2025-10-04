# MCP Test Runner Chrome Extension

A Chrome Extension (Manifest V3) that provides a frontend-only test runner for web applications using MCP-style tools.

## Features

### Core MCP Tools
- **run_action**: Execute UI actions (click, type) on page elements
- **verify.section**: Run verification checks from stored presets
- **context.put/get/expectEqual**: Manage test context and assertions
- **elements.add/get**: Element repository for selector management

### Self-Healing Capabilities
- Priority-based selector fallback system
- Automatic element location recovery
- Intelligent selector generation

### Recording & Element Discovery
- Visual element picker
- Automatic selector generation
- Element ID suggestions
- Node data capture (tag, text, attributes)

## Quick Start

### 1. Installation
1. Clone the repository
2. Run `npm install` in the chrome-extension directory
3. Run `npm run build` to compile TypeScript
4. Load the `dist` folder as an unpacked extension in Chrome

### 2. Basic Usage

#### Recording Elements
1. Click the extension icon to open the popup
2. Click "📍 Record" to start recording
3. Click any element on the webpage to capture it
4. The extension will suggest element IDs and generate selectors
5. Use the auto-filled JSON to add the element to the repository

#### Running Actions
```json
{
  "action": {
    "type": "ui.click",
    "elementId": "login-button"
  }
}
```

```json
{
  "action": {
    "type": "ui.type",
    "elementId": "username-input",
    "text": "testuser@example.com",
    "options": {
      "clear": true
    }
  }
}
```

#### Verification Presets
```json
{
  "preset": {
    "name": "Login Page Verification",
    "description": "Verify login page elements are present",
    "checks": [
      {
        "type": "exists",
        "elementId": "login-button",
        "description": "Login button exists"
      },
      {
        "type": "visible",
        "elementId": "username-input",
        "description": "Username field is visible"
      },
      {
        "type": "text",
        "elementId": "page-title",
        "expected": "Login",
        "description": "Page title contains Login"
      }
    ]
  }
}
```

## Architecture

### Service Worker (`background.ts`)
- Implements MCP tool registry
- Handles tool execution coordination
- Manages persistent storage
- Routes messages between popup and content script

### Content Script (`content.ts`)
- Executes DOM actions and verifications
- Implements element finding with self-healing
- Handles element recording
- Generates intelligent selectors

### Popup UI (`popup.ts`)
- MCP client interface
- Tool listing and execution
- Recording controls
- Results display

## Tool Reference

### run_action
Execute UI actions on web page elements.

**Parameters:**
- `action.type`: "ui.click" | "ui.type"
- `action.elementId`: String ID of target element
- `action.text`: Text to type (for ui.type)
- `action.options`: Optional parameters

**Example:**
```json
{
  "action": {
    "type": "ui.click",
    "elementId": "submit-btn",
    "options": {
      "button": "left",
      "modifiers": ["ctrl"]
    }
  }
}
```

### verify.section
Run multiple verification checks from a preset.

**Parameters:**
- `preset`: Complete verification preset object
- `presetName`: Name of stored preset (alternative)

**Check Types:**
- `exists`: Element exists in DOM
- `visible`: Element is visible
- `text`: Element contains expected text
- `attribute`: Element has expected attribute value
- `count`: Number of matching elements

### context.put/get/expectEqual
Manage test context and perform assertions.

**context.put:**
```json
{
  "key": "userEmail",
  "value": "test@example.com",
  "type": "string"
}
```

**context.get:**
```json
{
  "key": "userEmail"
}
```

**context.expectEqual:**
```json
{
  "actual": "Login",
  "expected": "Login",
  "description": "Page title matches expected"
}
```

### elements.add/get
Manage element repository.

**elements.add:**
```json
{
  "elementId": "login-btn",
  "elementData": {
    "tag": "button",
    "text": "Login",
    "attributes": {
      "id": "login",
      "class": "btn btn-primary"
    },
    "selectors": [
      "#login",
      ".btn.btn-primary",
      "button[type='submit']",
      "//button[@id='login']"
    ]
  }
}
```

## Self-Healing System

The extension implements a robust self-healing system:

1. **Priority Selectors**: Tries selectors in priority order (ID, class, attributes, XPath)
2. **Fallback Methods**: Uses text content and attribute matching as fallbacks
3. **Intelligent Recovery**: Generates multiple selector candidates during recording
4. **Automatic Updates**: Updates selector success rates for future use

## Development

### Building
```bash
npm install
npm run build
```

### Development Mode
```bash
npm run dev  # Watch mode for development
```

### Type Checking
```bash
npm run type-check
```

## Extension Structure
```
chrome-extension/
├── manifest.json          # Extension manifest
├── popup.html            # Popup UI
├── src/
│   ├── background.ts     # Service worker (MCP registry)
│   ├── content.ts        # Content script (DOM actions)
│   ├── popup.ts          # Popup client
│   └── types.ts          # TypeScript types
├── dist/                 # Built files
└── package.json          # Dependencies and scripts
```

## Browser Compatibility
- Chrome 88+ (Manifest V3 support)
- Edge 88+ (Chromium-based)

## Limitations
- Frontend-only (no backend dependencies)
- Chrome extension environment constraints
- Cross-origin iframe limitations
- Some dynamic content may require additional selectors