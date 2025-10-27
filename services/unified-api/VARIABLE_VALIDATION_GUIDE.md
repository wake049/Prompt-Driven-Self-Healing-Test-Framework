# Variable Validation Service Guide

## Overview

The Variable Validation Service prevents the AI from inventing variable names and ensures that only variables from active data bindings are used in test steps. This addresses the issue where the AI would create names like `calculatedTotal`, `value1`, `value2`, etc., instead of using the predefined binding variables.

## Features

### 1. **Allowed Variable Loading**
- Automatically extracts variable names from active data bindings
- Loads them into a validation service during plan generation
- Creates a whitelist of acceptable variable names

### 2. **Variable Name Mapping**
- Maps common AI-invented names to actual binding variables
- Examples:
  - `calculatedTotal` → `itemSubTotal`
  - `value1` → `backpackPrice`
  - `value2` → `onesiePrice`
  - `calculatedResult` → `itemSubTotal`

### 3. **Fuzzy Matching**
- Attempts to match unknown variables to similar allowed variables
- Uses substring and keyword matching (price, total, subtotal, etc.)
- Example: `totalPrice` → `backpackPrice`

### 4. **Step Validation**
- Validates all generated plan steps before execution
- Corrects variable names in:
  - `extract_data` steps (`variable` parameter)
  - `calculate` steps (`result_variable` and formula variables)
  - `assert_text` steps (`${variable}` references in text)

### 5. **Rejection of Invalid Variables**
- Completely unknown variables are rejected
- Steps with invalid variables are removed from the plan
- Comprehensive logging of all corrections and rejections

## Implementation Details

### Core Components

#### VariableValidationService
```python
class VariableValidationService:
    def load_allowed_variables(self, bindings: List[Dict[str, Any]]) -> None
    def validate_and_correct_variable(self, variable_name: str) -> str
    def validate_step_variables(self, step: PlanStep) -> PlanStep
```

#### Integration Points
1. **Binding Loading**: Variables loaded when data bindings are processed
2. **AI Prompt**: System prompt updated to emphasize allowed variables
3. **Step Generation**: All generated steps validated before return
4. **Heuristic Fallback**: Validation also applied to heuristic-generated steps

### System Prompt Updates

The AI system prompt now includes:
- Explicit list of allowed variables
- Strict warnings against inventing names
- Removal of problematic examples with `calculatedTotal`, `value1`, etc.
- Clear instructions to use only predefined variables

### Validation Flow

```
1. Load Data Bindings
   ↓
2. Extract Allowed Variables → [backpackPrice, onesiePrice, itemSubTotal]
   ↓
3. Create Variable Mappings → {calculatedTotal: itemSubTotal, value1: backpackPrice, ...}
   ↓
4. Generate AI Plan
   ↓
5. Validate Each Step:
   - extract_data: Check 'variable' parameter
   - calculate: Check 'result_variable' and formula
   - assert_text: Check ${variable} references
   ↓
6. Apply Corrections or Reject Steps
   ↓
7. Return Validated Plan
```

## Configuration

### Automatic Variable Mapping
The service automatically creates mappings for common AI inventions:

**Price Variables:**
- `value1`, `value2` → First/second price variables
- `price1`, `price2` → First/second price variables  
- `itemPrice`, `productPrice` → First price variable

**Total Variables:**
- `calculatedTotal`, `calculatedResult` → First total variable
- `totalValue`, `computedTotal` → First total variable
- `sumTotal`, `finalTotal` → First total variable

### Fuzzy Matching Rules
1. **Exact substring matching** (case-insensitive)
2. **Common word matching** for: price, total, subtotal, cost, value, amount
3. **Priority**: Exact matches > Fuzzy matches > Rejection

## Usage Examples

### Before (AI inventing variables)
```json
{
  "action": "extract_data",
  "args": {"variable": "calculatedTotal"}  //  Invented name
}
```

### After (Corrected to binding variable)
```json
{
  "action": "extract_data", 
  "args": {"variable": "itemSubTotal"}     //  Actual binding
}
```

### Formula Correction
```json
// Before
{"formula": "calculatedTotal = value1 + value2"}

// After  
{"formula": "itemSubTotal = backpackPrice + onesiePrice"}
```

### Text Assertion Correction
```json
// Before
{"text": "Total: ${calculatedTotal}"}

// After
{"text": "Total: ${itemSubTotal}"}
```

## Error Handling

### Invalid Variable Rejection
- Unknown variables with no mapping are rejected
- Steps containing invalid variables are removed
- Clear logging explains why variables were rejected

### Graceful Degradation
- If no bindings are loaded, validation is skipped
- Heuristic plans are also validated
- System continues to function without bindings

## Benefits

1. **Consistency**: Only predefined variables are used
2. **Reliability**: Test steps use actual binding variables
3. **Maintainability**: Clear mapping between AI output and data bindings
4. **Debugging**: Comprehensive logging of all variable corrections
5. **Flexibility**: Supports fuzzy matching for reasonable variations

## Monitoring

The service provides detailed logging:
- `🔐` Variable loading messages
- `` Variable correction messages  
- `` Variable rejection messages
- `🚫` Step removal messages
- `` Validation success messages

## Testing

Use `test_variable_validation.py` to verify the service:
```bash
python test_variable_validation.py
```

This tests:
- Variable loading from bindings
- Individual variable validation
- Step-level validation and correction
- All mapping and fuzzy matching logic