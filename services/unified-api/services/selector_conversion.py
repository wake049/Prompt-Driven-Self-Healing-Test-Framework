"""
Selector Conversion Service
Converts AI-generated selectors into dual CSS/XPath format for storage in database
"""

import re
from typing import Dict, Tuple, Optional, Any
import logging

logger = logging.getLogger(__name__)

class SelectorConverter:
    """Converts between CSS and XPath selectors for dual storage"""
    
    @staticmethod
    def detect_selector_type(selector: str) -> str:
        """
        Detect if a selector is CSS or XPath
        Returns: 'css', 'xpath', or 'unknown'
        """
        if not selector or not isinstance(selector, str):
            return 'unknown'
        
        selector = selector.strip()
        
        # XPath indicators
        if (selector.startswith('//') or 
            selector.startswith('/html') or 
            '[@' in selector or 
            '/descendant::' in selector or
            '/following::' in selector or
            '/ancestor::' in selector):
            return 'xpath'
        
        # CSS indicators
        if (selector.startswith('#') or 
            selector.startswith('.') or 
            '[' in selector or
            '>' in selector or
            '+' in selector or
            '~' in selector or
            ':' in selector):
            return 'css'
        
        # Simple tag names could be either, default to CSS
        if re.match(r'^[a-zA-Z][a-zA-Z0-9]*$', selector):
            return 'css'
        
        return 'unknown'
    
    @staticmethod
    def css_to_xpath(css_selector: str) -> str:
        """
        Convert CSS selector to XPath (basic conversion)
        """
        if not css_selector:
            return ""
        
        try:
            xpath = css_selector
            
            # ID selector: #id -> //*[@id='id']
            xpath = re.sub(r'#([a-zA-Z][\w-]*)', r"//*[@id='\1']", xpath)
            
            # Class selector: .class -> //*[@class='class'] (simplified)
            xpath = re.sub(r'\.([a-zA-Z][\w-]*)', r"//*[contains(@class,'\1')]", xpath)
            
            # Attribute selector: [attr='value'] -> [@attr='value']
            xpath = re.sub(r'\[([^=]+)=[\'"]([^\'"]*)[\'"]?\]', r"[@\1='\2']", xpath)
            
            # Simple tag names
            if re.match(r'^[a-zA-Z][a-zA-Z0-9]*$', css_selector):
                xpath = f"//{css_selector}"
            
            return xpath
            
        except Exception as e:
            logger.warning(f"Failed to convert CSS '{css_selector}' to XPath: {e}")
            return f"//*[@data-testid='{css_selector}']"  # Fallback
    
    @staticmethod
    def xpath_to_css(xpath_selector: str) -> str:
        """
        Convert XPath selector to CSS (basic conversion)
        """
        if not xpath_selector:
            return ""
        
        try:
            css = xpath_selector
            
            # Simple ID: //*[@id='value'] -> #value
            css = re.sub(r"//\*\[@id=['\"]([^'\"]*)['\"]?\]", r"#\1", css)
            
            # Simple class: //*[contains(@class,'value')] -> .value
            css = re.sub(r"//\*\[contains\(@class,['\"]([^'\"]*)['\"]?\)\]", r".\1", css)
            
            # Simple tag: //tagname -> tagname
            css = re.sub(r"^//([a-zA-Z][a-zA-Z0-9]*)$", r"\1", css)
            
            return css
            
        except Exception as e:
            logger.warning(f"Failed to convert XPath '{xpath_selector}' to CSS: {e}")
            return f"[data-testid='{xpath_selector}']"  # Fallback
    
    @staticmethod
    def create_dual_selectors(original_selector: str) -> Dict[str, str]:
        """
        Create both CSS and XPath versions of a selector
        Returns: {"css_selector": "...", "xpath_selector": "..."}
        """
        if not original_selector:
            return {"css_selector": "", "xpath_selector": ""}
        
        selector_type = SelectorConverter.detect_selector_type(original_selector)
        
        if selector_type == 'css':
            css_selector = original_selector
            xpath_selector = SelectorConverter.css_to_xpath(original_selector)
        elif selector_type == 'xpath':
            xpath_selector = original_selector
            css_selector = SelectorConverter.xpath_to_css(original_selector)
        else:
            # Unknown format, try to use as CSS first
            css_selector = original_selector
            xpath_selector = SelectorConverter.css_to_xpath(original_selector)
        
        return {
            "css_selector": css_selector,
            "xpath_selector": xpath_selector
        }
    
    @staticmethod
    def convert_ai_step_to_dual_selector(step: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert an AI-generated step to include dual selector format
        """
        # Extract selector from various possible fields
        original_selector = None
        if 'args' in step:
            original_selector = step['args'].get('selector') or step['args'].get('target') or step['args'].get('locator')
        elif 'params' in step:
            original_selector = step['params'].get('selector') or step['params'].get('target') or step['params'].get('locator')
        elif 'target' in step:
            original_selector = step['target']
        elif 'selector' in step:
            original_selector = step['selector']
        elif 'locator' in step:
            original_selector = step['locator']
        
        if not original_selector:
            logger.warning(f"No selector found in step: {step}")
            return step
        
        # Create dual selectors
        dual_selectors = SelectorConverter.create_dual_selectors(original_selector)
        
        # Add dual selector information to step
        result_step = step.copy()
        result_step['dual_selectors'] = dual_selectors
        result_step['original_selector'] = original_selector
        
        logger.info(f"Converted selector '{original_selector}' -> CSS: '{dual_selectors['css_selector']}', XPath: '{dual_selectors['xpath_selector']}'")
        
        return result_step

def convert_steps_to_dual_selector_format(steps: list) -> list:
    """
    Convert a list of AI-generated steps to dual selector format
    """
    converted_steps = []
    
    for i, step in enumerate(steps):
        try:
            converted_step = SelectorConverter.convert_ai_step_to_dual_selector(step)
            converted_steps.append(converted_step)
        except Exception as e:
            logger.error(f"Failed to convert step {i}: {e}")
            converted_steps.append(step)  # Keep original if conversion fails
    
    return converted_steps