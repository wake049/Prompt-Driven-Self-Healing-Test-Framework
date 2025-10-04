# MCP Test Data Integration Guide

## Overview
Your React frontend can now display test data recorded by the Chrome Extension! Here's how it works:

## 🎯 **What You Get**

### **1. MCP Test Viewer Component**
- **Location**: `/mcp-tests` route in your React app
- **Features**: 
  - View recorded elements from Chrome Extension
  - See test execution history
  - Display element selectors and attributes
  - Show success/failure status of tests

### **2. Data Flow**
```
Chrome Extension → Records Elements → Frontend Display
                ↓
               MCP API → Stores Data → Frontend Queries
```

## 🛠️ **How to Use**

### **Step 1: Record Elements**
1. Open your website in Chrome
2. Open the MCP Test Runner extension
3. Enter page context (e.g., "login", "dashboard")
4. Click "📍 Record" 
5. Click on elements to record them
6. Click "⏹️ Stop" when done

### **Step 2: View on Frontend**
1. Open your React app: `http://localhost:3000`
2. Navigate to "🛠️ MCP Tests" tab
3. Click "📥 Import from Extension" to load data
4. View recorded elements and test executions

### **Step 3: API Integration**
The extension can also send data directly to your API:
- Elements get stored with selectors and metadata
- Test executions are logged with results
- Page context is tracked for organization

## 📋 **Data Structure**

### **Recorded Element**
```json
{
  "id": "login-button",
  "tag": "button", 
  "text": "Login",
  "attributes": { "id": "login-btn", "class": "btn btn-primary" },
  "xpath": "//button[@id='login-btn']",
  "cssSelector": "#login-btn",
  "position": { "x": 200, "y": 300 },
  "selectors": ["#login-btn", ".btn.btn-primary"],
  "page": "login",
  "timestamp": 1703123456789
}
```

### **Test Execution**
```json
{
  "id": "exec-123",
  "toolName": "ui.click",
  "parameters": { "elementId": "login-button" },
  "result": {
    "success": true,
    "data": { "message": "Click executed successfully" }
  },
  "timestamp": 1703123456789,
  "page": "login"
}
```

## 🔧 **Technical Details**

### **Component Features**
- **Real-time Data**: Loads from localStorage and Chrome Extension
- **Visual Feedback**: Color-coded success/error states
- **Responsive Design**: Works on desktop and mobile
- **Export/Import**: Save test sessions for later review

### **API Endpoints** (Optional)
Your backend can implement these endpoints to store data persistently:
- `POST /api/v1/mcp/sessions` - Save test session
- `GET /api/v1/mcp/sessions` - List all sessions
- `POST /api/v1/mcp/elements` - Save recorded element
- `GET /api/v1/mcp/elements` - Get elements by page
- `POST /api/v1/mcp/executions` - Save test execution

### **Chrome Extension Integration**
The extension provides these message types:
- `GET_ALL_TEST_DATA` - Get all recorded data
- `EXPORT_TO_WEBSITE` - Send data to your API
- `GET_RECORDING_DATA` - Get latest recordings

## 🚀 **Next Steps**

1. **Test the Integration**: Record some elements and view them on your frontend
2. **Customize the UI**: Modify the MCPTestViewer component styling
3. **Add API Persistence**: Implement the backend endpoints for data storage
4. **Extend Functionality**: Add test replay, element validation, etc.

## 💡 **Tips**

- **Keep Extension Open**: Keep the popup open while recording to see real-time feedback
- **Page Context**: Always set the page context for better organization
- **Multiple Sessions**: Each import creates a new test session
- **Local Storage**: Data persists between browser sessions

The integration is now ready! Start recording elements and see them appear on your frontend. 🎉