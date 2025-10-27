# Self-Healing Test Framework - Milestone M5

## Overview
This is a complete implementation of the Prompt-Driven Self-Healing Test Automation Framework for Milestone M5. The framework can execute test steps with automatic healing capabilities, with two modes of operation:

1. **SQL-Driven Mode**: Dynamically generates test steps from elements stored in the SQL backend (PostgreSQL)
2. **JSON Mode**: Executes predefined test steps from JSON files (fallback mode)

The SQL-driven approach integrates with your Chrome extension element capture workflow, allowing for truly dynamic test generation based on recorded UI elements.

## Features Implemented
 **SQL-Driven Test Generation**: Dynamically creates test steps from SQL backend elements
 **Chrome Extension Integration**: Uses elements captured by chrome extension
 **Execution Service**: Runs test steps sequentially with Selenium WebDriver
 **Self-Healing Engine**: Automatically retries failed locators using SQL backend alternatives
 **Dual Repository Support**: SQL backend (primary) + JSON file (fallback)
 **Intelligent Action Detection**: Determines appropriate actions based on element types
 **Comprehensive Logging**: Healing attempts logged to `healing_log.json`
 **Run Summary**: Test results saved to `run_summary.json`
 **Console Output**: Real-time step execution feedback
 **Screenshot Capture**: Screenshots taken on step failures
 **POST Notifications**: Healing failures reported to review service
 **Multiple Locator Types**: Support for css=, xpath=, id=, name=, class=, tag= prefixes

## SQL-Driven Workflow

### 1. Element Capture (Chrome Extension)
```
User interacts with web page → Chrome extension captures elements → SQL Backend stores elements
```

### 2. Test Generation (Java Framework)
```
Java Framework → Queries SQL Backend → Generates test steps based on element types → Executes with Selenium
```

### 3. Self-Healing (SQL Backend Integration)
```
Locator fails → Framework queries SQL Backend for alternatives → Retries with alternative locators
```

## File Structure
```
java-runner/
├── pom.xml                        # Maven dependencies and configuration
├── steps.json                     # Fallback test steps (when SQL backend unavailable)
├── element_repository.json        # Fallback element alternatives
├── src/main/java/demo/
│   ├── Main.java                  # Main orchestrator class
│   ├── ExecutionService.java      # Step execution with Selenium
│   ├── SelfHealing.java           # Healing engine with SQL backend integration
│   ├── SqlElementRepository.java  # SQL backend element queries
│   ├── SqlTestStepRepository.java # SQL-driven test step generation
│   ├── SqlBackendSeeder.java      # Populates SQL backend with sample data
│   ├── ElementRepository.java     # JSON fallback repository
│   ├── JsonUtil.java              # JSON file operations
│   ├── Step.java                  # Step data model
│   ├── StepResult.java            # Result data model
│   ├── ElementAlternative.java    # Alternative locator model
│   └── RunSummary.java            # Summary data model
├── healing_log.json               # Generated healing log
├── run_summary.json               # Generated run summary
└── screenshots/                   # Generated failure screenshots
```

## Supported Actions
- `open`: Navigate to URL
- `enter_text`/`type`: Enter text into input fields
- `click`: Click elements
- `verify_text`/`assert_text`: Verify element contains text
- `verify_element`/`assert_element`: Verify element exists and is visible
- `wait`: Wait for specified milliseconds

## Supported Locator Prefixes
- `css=` - CSS selectors (default if no prefix)
- `xpath=` - XPath expressions
- `id=` - Element ID
- `name=` - Element name attribute
- `class=` - Element class name
- `tag=` - Element tag name

## How to Run

### Prerequisites
- Java 11 or higher
- Maven 3.6 or higher
- Chrome browser installed
- SQL Backend running (optional, for SQL-driven mode)

### Option 1: SQL-Driven Execution (Recommended)

1. **Start SQL Backend** (in separate terminal):
   ```cmd
   cd services\sql-backend
   npm install
   npm start
   ```

2. **Populate SQL Backend with sample elements** (simulates chrome extension):
   ```cmd
   cd services\java-runner
   mvn compile
   mvn exec:java -Dexec.mainClass=demo.SqlBackendSeeder
   ```

3. **Run the framework** (will generate steps from SQL backend):
   ```cmd
   mvn exec:java -Dexec.mainClass=demo.Main
   ```

### Option 2: Automated SQL-Driven Demo
Run the complete SQL-driven workflow with one command:
```cmd
demo-sql-driven-testing.bat
```

### Option 3: JSON Fallback Mode
If SQL backend is not available, the framework automatically falls back to JSON files:
```cmd
cd services\java-runner
mvn exec:java -Dexec.mainClass=demo.Main
```

### Expected Output
```
=== Prompt-Driven Self-Healing Test Framework ===
Milestone M5 - Execution Service & Self-Healing Engine

Initializing WebDriver...
Loading test steps from steps.json...
Loaded 10 test steps

=== Test Execution Started ===
[01] open https://www.saucedemo.com => PASS (1200 ms)
[02] enter_text css=#user-name (standard_user) => PASS (400 ms)
[03] enter_text css=#password (secret_sauce) => PASS (350 ms)
[04] click css=#login-button => PASS (800 ms)
[05] verify_element css=.inventory_container => PASS (200 ms)
[06] verify_text css=.title (Products) => PASS (150 ms)
[07] click css=#add-to-cart-sauce-labs-backpack => PASS (300 ms)
[08] click css=.shopping_cart_link => PASS (250 ms)
[09] verify_element css=.cart_item => PASS (200 ms)
[10] verify_text css=.inventory_item_name (Sauce Labs Backpack) => PASS (150 ms)

=== Test Run Summary ===
Start Time: 2025-10-13T15:30:15.123
End Time: 2025-10-13T15:30:19.456
Total Duration: 4333 ms
Total Steps: 10
Passed Steps: 10
Failed Steps: 0
Healed Steps: 0
Success Rate: 100.0%

=== Healing Summary ===
No healing attempts were made during this run.

Closing WebDriver...

=== Test Execution Completed ===
```

## Self-Healing Demonstration
To see the self-healing in action, you can intentionally break a locator in `steps.json`. For example, change:
```json
"locator": "css=#user-name"
```
to:
```json
"locator": "css=#broken-locator"
```

The framework will attempt to heal using alternatives from `element_repository.json` and show output like:
```
[02] enter_text css=#broken-locator (standard_user) => (original failed, attempting healing) HEALED (650 ms)
```

## Generated Files
- **`healing_log.json`**: Detailed log of all healing attempts
- **`run_summary.json`**: Complete test run summary with results
- **`screenshots/`**: Screenshots captured on step failures

## Integration with Review Service
When healing fails completely, the framework sends a POST request to `http://localhost:8001/review/create` with failure details for manual review.

## Customization
- **Add new test steps**: Edit `steps.json`
- **Add element alternatives**: Edit `element_repository.json`
- **Modify browser settings**: Update ChromeOptions in `Main.java`
- **Change timeouts**: Modify DEFAULT_TIMEOUT in `ExecutionService.java`