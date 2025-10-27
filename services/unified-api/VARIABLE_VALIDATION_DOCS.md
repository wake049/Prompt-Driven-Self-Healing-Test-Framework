# Variable Validation Service Documentation

## Overview

The Variable Validation Service has been implemented to prevent the AI from inventing variable names and ensure only variables from active data bindings are used in generated test steps.

## Problem Solved

Previously, the AI would occasionally invent variable names like:
- `calculatedTotal`
- `calculatedResult` 
- `value1`, `value2`
- `totalPrice`
- Other generic names not defined in data bindings

## Solution Components

### 1. VariableValidationService Class

Located in `api/ai_service.py`, this service provides:

#### Key Methods:
- `load_allowed_variables(bindings)` - Loads allowed variable names from active data bindings
- `validate_and_correct_variable(variable_name)` - Validates and corrects individual variable names
- `validate_step_variables(step)` - Validates and corrects all variables in a plan step
- `_create_variable_mappings()` - Creates intelligent mappings from common AI inventions to real variables

#### Validation Strategy:
1. **Exact Match**: If variable exists in allowed set, return as-is
2. **Smart Mapping**: Map known AI inventions to actual variables
3. **Fuzzy Matching**: Find closest allowed variable using substring/keyword matching
4. **Rejection**: Reject completely unknown variables

### 2. Smart Variable Mappings

The service automatically creates mappings for common AI inventions:

```python
# Price variables
'value1' → 'backpackPrice'
'value2' → 'onesiePrice'  
'itemPrice' → 'backpackPrice'
'productPrice' → 'backpackPrice'

# Total variables  
'calculatedTotal' → 'itemSubTotal'
'calculatedResult' → 'itemSubTotal'
'totalValue' → 'itemSubTotal'
'computedTotal' → 'itemSubTotal'
```

### 3. Updated System Prompt

The AI system prompt has been updated to:
- Explicitly list allowed variables when available
- Warn against inventing new variable names
- Remove problematic examples with hardcoded invented names
- Emphasize exact name matching requirements

### 4. Step Validation Integration

Variable validation is integrated into both AI and heuristic plan generation:
- **AI Generation**: Steps are validated after AI response parsing
- **Heuristic Generation**: Steps are validated in fallback scenarios
- **Filtering**: Invalid steps are removed from the final plan

## Usage Examples

### Loading Variables from Bindings

```python
# Active bindings from database
bindings = [
    {
        'rule_name': 'backpack_price',
        'target': '{"variable_name": "backpackPrice", "type": "extract"}'
    },
    {
        'rule_name': 'item_total', 
        'target': '{"variable_name": "itemSubTotal", "type": "calculate"}'
    }
]

# Load into validator
validator.load_allowed_variables(bindings)
# Result: allowed_variables = {'backpackPrice', 'itemSubTotal'}
```

### Variable Correction Examples

```python
# Valid variable (no change)
validator.validate_and_correct_variable('backpackPrice')
# Returns: 'backpackPrice'

# AI invention (corrected via mapping)
validator.validate_and_correct_variable('calculatedTotal')
# Returns: 'itemSubTotal'

# AI invention (corrected via mapping)
validator.validate_and_correct_variable('value1')
# Returns: 'backpackPrice'

# Unknown variable (rejected)
validator.validate_and_correct_variable('unknownVar')
# Returns: None
```

### Step Validation Examples

```python
# Extract step with AI-invented variable
step = PlanStep(
    action='extract_data',
    args={'variable': 'calculatedTotal'}
)

validated = validator.validate_step_variables(step)
# Result: args['variable'] = 'itemSubTotal'

# Calculate step with AI-invented variables
step = PlanStep(
    action='calculate',
    args={
        'formula': 'calculatedTotal = value1 + value2',
        'result_variable': 'calculatedTotal'
    }
)

validated = validator.validate_step_variables(step)
# Result: 
# - formula = 'itemSubTotal = backpackPrice + onesiePrice'
# - result_variable = 'itemSubTotal'
```

## Integration Points

### 1. EnterpriseAIService Initialization
```python
def __init__(self):
    # ...
    self.variable_validator = VariableValidationService()
```

### 2. Binding Loading
```python
if existing_bindings:
    # Load allowed variables into validator
    self.variable_validator.load_allowed_variables(existing_bindings)
```

### 3. AI Plan Generation
```python
# Validate each generated step
for raw_step in raw_steps:
    step = PlanStep(...)
    validated_step = self.variable_validator.validate_step_variables(step)
    if validated_step:
        steps.append(validated_step)
```

### 4. Enhanced Binding Context
```python
if self.variable_validator.allowed_variables:
    allowed_list = sorted(self.variable_validator.allowed_variables)
    binding_context += f"\n\nALLOWED VARIABLES (use ONLY these exact names):"
    for var_name in allowed_list:
        binding_context += f"\n- {var_name}"
```

## Testing

Run the validation test script:

```bash
cd services/unified-api
python test_variable_validation.py
```

This will test:
- Variable loading from bindings
- Variable validation and correction
- Step validation for different action types
- Mapping of common AI inventions

## Benefits

1. **Consistency**: Only predefined variables are used in tests
2. **Reliability**: Invalid steps are filtered out automatically  
3. **Intelligence**: Common AI mistakes are corrected rather than rejected
4. **Maintainability**: Clear separation between allowed and invented variables
5. **Flexibility**: Fuzzy matching helps handle similar but not exact names

## Future Enhancements

- Add more sophisticated fuzzy matching algorithms
- Support for regex-based variable patterns
- Integration with variable type validation (string, number, etc.)
- Real-time variable suggestion for test authors
- Variable usage analytics and reporting