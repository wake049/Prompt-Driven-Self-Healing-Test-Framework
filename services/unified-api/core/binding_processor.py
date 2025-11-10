"""
Binding Processor Service
Handles dynamic value extraction and formula calculation for test bindings
"""

import re

from typing import Any, Dict, List, Optional, Union
from schemas.enterprise import DataBinding, TestBindings, BindingContext

class BindingProcessor:
    """Service for processing data bindings and variable resolution"""
    
    def __init__(self):
        self.context = BindingContext()
    
    def extract_price_from_text(self, text: str) -> float:
        """Extract price value from text containing currency"""
        # Remove currency symbols and extract number
        clean_text = re.sub(r'[^\d.,]', '', text)
        price_pattern = r'\d+[.,]?\d*'
        match = re.search(price_pattern, clean_text)
        if match:
            price_str = match.group().replace(',', '.')
            return float(price_str)
        return 0.0
    
    def extract_number_from_text(self, text: str) -> Union[int, float]:
        """Extract numeric value from text"""
        # Find first number in the text
        number_pattern = r'-?\d+\.?\d*'
        match = re.search(number_pattern, text)
        if match:
            num_str = match.group()
            return float(num_str) if '.' in num_str else int(num_str)
        return 0
    
    def extract_value_from_element(self, binding: DataBinding, element_text: str, element_attrs: Dict[str, str] = None) -> Any:
        """Extract value from element based on binding configuration"""
        element_attrs = element_attrs or {}
        
        try:
            if binding.extract_type == "text":
                value = element_text.strip()
            elif binding.extract_type == "price":
                value = self.extract_price_from_text(element_text)
            elif binding.extract_type == "number":
                value = self.extract_number_from_text(element_text)
            elif binding.extract_type == "attribute":
                if not binding.attribute:
                    raise ValueError("Attribute name required for attribute extraction")
                value = element_attrs.get(binding.attribute, "")
            else:
                raise ValueError(f"Unknown extract_type: {binding.extract_type}")
            
            # Apply regex pattern if specified
            if binding.regex_pattern and isinstance(value, str):
                pattern_match = re.search(binding.regex_pattern, value)
                if pattern_match:
                    value = pattern_match.group(1) if pattern_match.groups() else pattern_match.group(0)
                else:return value
            
        except Exception as e:
            if binding.fallback_value is not None:return binding.fallback_value
            raise
    
    def evaluate_formula(self, formula: str) -> Union[int, float]:
        """Safely evaluate a mathematical formula with variable substitution"""
        try:
            # Resolve variables in the formula
            resolved_formula = self.context.resolve_template(formula)
            
            # Basic safety check - only allow numbers, operators, and whitespace
            if not re.match(r'^[\d\s+\-*/.()]+$', resolved_formula):
                raise ValueError(f"Formula contains invalid characters: {resolved_formula}")
            
            # Evaluate the formula
            result = eval(resolved_formula)
            
            if isinstance(result, (int, float)):
                return result
            else:
                raise ValueError(f"Formula evaluation resulted in non-numeric value: {result}")
                
        except Exception as e:
            raise
    
    def process_binding(self, binding: DataBinding, dom_data: Dict[str, Any] = None) -> Any:
        """Process a single binding and return its value"""
        try:
            if binding.type == "constant":
                return binding.value
            
            elif binding.type == "extract":
                if not binding.selector:
                    raise ValueError("Selector required for extract binding")
                
                # In a real implementation, this would query the DOM
                # For now, we'll simulate with provided dom_data
                if dom_data and binding.selector in dom_data:
                    element_data = dom_data[binding.selector]
                    element_text = element_data.get("text", "")
                    element_attrs = element_data.get("attributes", {})
                    return self.extract_value_from_element(binding, element_text, element_attrs)
                else:
                    raise ValueError(f"Element not found for selector: {binding.selector}")
            
            elif binding.type == "formula":
                if not binding.formula:
                    raise ValueError("Formula required for formula binding")
                return self.evaluate_formula(binding.formula)
            
            else:
                raise ValueError(f"Unknown binding type: {binding.type}")
                
        except Exception as e:
            if binding.fallback_value is not None:return binding.fallback_value
            raise
    
    def process_bindings(self, bindings: TestBindings, dom_data: Dict[str, Any] = None) -> BindingContext:
        """Process all bindings and return resolved context"""
        # Reset context
        self.context = BindingContext()
        
        # Sort bindings so that extract/constant bindings come before formulas
        sorted_bindings = sorted(bindings.bindings, key=lambda b: 0 if b.type in ["extract", "constant"] else 1)
        
        for binding in sorted_bindings:
            try:
                value = self.process_binding(binding, dom_data)
                self.context.set_variable(binding.name, value)
            except Exception as e:
                # Set None value to avoid template resolution errors
                self.context.set_variable(binding.name, None)
        
        return self.context
    
    def resolve_action_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve variable placeholders in action parameters"""
        resolved_params = {}
        
        for key, value in params.items():
            if isinstance(value, str) and "${" in value:
                try:
                    resolved_params[key] = self.context.resolve_template(value)
                except Exception as e:
                    resolved_params[key] = value  # Keep original if resolution fails
            else:
                resolved_params[key] = value
        
        return resolved_params

def create_price_verification_bindings(item_selectors: List[str], total_selector: str) -> TestBindings:
    """Helper function to create bindings for price verification"""
    bindings = TestBindings()
    
    # Add extract bindings for each item price
    for i, selector in enumerate(item_selectors):
        binding = DataBinding(
            name=f"item_{i+1}_price",
            type="extract",
            selector=selector,
            extract_type="price"
        )
        bindings.add_binding(binding)
    
    # Add formula binding to calculate total
    item_vars = [f"${{item_{i+1}_price}}" for i in range(len(item_selectors))]
    formula = " + ".join(item_vars)
    
    total_binding = DataBinding(
        name="calculated_total",
        type="formula",
        formula=formula
    )
    bindings.add_binding(total_binding)
    
    # Add extract binding for actual total
    actual_total_binding = DataBinding(
        name="actual_total",
        type="extract",
        selector=total_selector,
        extract_type="price"
    )
    bindings.add_binding(actual_total_binding)
    
    return bindings

def create_cart_verification_bindings() -> TestBindings:
    """Create complete cart verification bindings for SauceDemo"""
    bindings = TestBindings()
    
    # Extract individual item prices
    bindings.add_binding(DataBinding(
        name="backpack_price",
        type="extract",
        selector=".cart_item:nth-child(1) .inventory_item_price",
        extract_type="price",
        fallback_value=29.99
    ))
    
    bindings.add_binding(DataBinding(
        name="onesie_price", 
        type="extract",
        selector=".cart_item:nth-child(2) .inventory_item_price",
        extract_type="price",
        fallback_value=7.99
    ))
    
    # Calculate subtotal
    bindings.add_binding(DataBinding(
        name="calculated_subtotal",
        type="formula",
        formula="${backpack_price} + ${onesie_price}"
    ))
    
    # Extract actual values from page
    bindings.add_binding(DataBinding(
        name="actual_subtotal",
        type="extract",
        selector=".summary_subtotal_label",
        extract_type="price"
    ))
    
    bindings.add_binding(DataBinding(
        name="tax_amount",
        type="extract", 
        selector=".summary_tax_label",
        extract_type="price"
    ))
    
    # Calculate final total
    bindings.add_binding(DataBinding(
        name="calculated_total",
        type="formula",
        formula="${calculated_subtotal} + ${tax_amount}"
    ))
    
    bindings.add_binding(DataBinding(
        name="actual_total",
        type="extract",
        selector=".summary_total_label", 
        extract_type="price"
    ))
    
    return bindings