"""
🔒 Server-Side Anonymization Utilities
Handles de-anonymization and placeholder mapping restoration.

Note: The actual anonymization happens CLIENT-SIDE in the browser.
This module handles:
1. Storing/retrieving placeholder mappings (optional)
2. De-anonymizing AI responses if needed
3. Validating anonymized content
"""

import re
import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger("anonymization_service")


class PlaceholderType(str, Enum):
    """Types of placeholders used in anonymization"""
    COMPANY = "COMPANY"
    PERSON = "PERSON"
    AMOUNT = "AMOUNT"
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    URL = "URL"
    DATE = "DATE"
    ADDRESS = "ADDRESS"
    PROJECT = "PROJECT"
    CREDENTIAL = "CREDENTIAL"
    ID_NUMBER = "ID_NUMBER"


@dataclass
class PlaceholderMapping:
    """Mapping between placeholder and original value"""
    placeholder: str
    original: str
    type: PlaceholderType
    count: int = 1
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "placeholder": self.placeholder,
            "original": self.original,
            "type": self.type.value if isinstance(self.type, PlaceholderType) else self.type,
            "count": self.count
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PlaceholderMapping":
        return cls(
            placeholder=data["placeholder"],
            original=data["original"],
            type=PlaceholderType(data["type"]) if isinstance(data["type"], str) else data["type"],
            count=data.get("count", 1)
        )


class AnonymizationService:
    """
    Server-side service for handling anonymized documents.
    
    The actual anonymization happens in the browser (client-side).
    This service handles:
    - De-anonymizing AI responses
    - Validating that content is properly anonymized
    - Detecting if content contains unredacted sensitive data
    """
    
    # Patterns that suggest content might not be properly anonymized
    SENSITIVE_PATTERNS = {
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phone": r'\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b',
        "ssn": r'\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b',
        "credit_card": r'\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b',
        "aws_key": r'\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b',
    }
    
    # Pattern to detect our placeholders
    PLACEHOLDER_PATTERN = r'\[([A-Z_]+)_([A-Z])\]'
    
    def __init__(self):
        self.placeholder_regex = re.compile(self.PLACEHOLDER_PATTERN)
    
    def deanonymize(
        self, 
        anonymized_text: str, 
        mappings: List[Dict[str, Any]]
    ) -> str:
        """
        Restore original values in text using placeholder mappings.
        
        Args:
            anonymized_text: Text with placeholders like [COMPANY_A]
            mappings: List of placeholder-to-original mappings
            
        Returns:
            Text with original values restored
        """
        result = anonymized_text
        
        # Convert to PlaceholderMapping objects and sort by length
        mapping_objs = [PlaceholderMapping.from_dict(m) for m in mappings]
        sorted_mappings = sorted(
            mapping_objs, 
            key=lambda m: len(m.placeholder), 
            reverse=True
        )
        
        for mapping in sorted_mappings:
            # Escape special regex characters in placeholder
            escaped = re.escape(mapping.placeholder)
            result = re.sub(escaped, mapping.original, result)
        
        return result
    
    def deanonymize_scenarios(
        self,
        scenarios: List[Dict[str, Any]],
        mappings: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Restore original values in all text fields of generated scenarios.
        
        Args:
            scenarios: List of AI-generated test scenarios
            mappings: Placeholder mappings from client
            
        Returns:
            Scenarios with original values restored in relevant fields
        """
        result = []
        
        for scenario in scenarios:
            restored = scenario.copy()
            
            # Restore text in relevant fields
            text_fields = ['title', 'intent', 'steps', 'description']
            for field in text_fields:
                if field in restored and restored[field]:
                    restored[field] = self.deanonymize(restored[field], mappings)
            
            # Handle tags if they contain placeholders
            if 'tags' in restored and restored['tags']:
                restored['tags'] = [
                    self.deanonymize(tag, mappings) 
                    for tag in restored['tags']
                ]
            
            result.append(restored)
        
        return result
    
    def validate_anonymization(
        self, 
        text: str,
        strict: bool = False
    ) -> Dict[str, Any]:
        """
        Check if text appears to be properly anonymized.
        
        Args:
            text: Text to validate
            strict: If True, fail on any potential sensitive data
            
        Returns:
            Validation result with detected issues
        """
        issues = []
        
        # Check for common sensitive patterns
        for pattern_name, pattern in self.SENSITIVE_PATTERNS.items():
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                issues.append({
                    "type": pattern_name,
                    "count": len(matches),
                    "message": f"Found {len(matches)} potential {pattern_name} pattern(s)"
                })
        
        # Count placeholders found
        placeholders = self.placeholder_regex.findall(text)
        placeholder_count = len(placeholders)
        
        is_valid = len(issues) == 0 if strict else True
        
        return {
            "is_valid": is_valid,
            "placeholder_count": placeholder_count,
            "issues": issues,
            "message": "Content appears properly anonymized" if is_valid else "Potential sensitive data detected"
        }
    
    def extract_placeholders(self, text: str) -> List[str]:
        """
        Extract all placeholders from anonymized text.
        
        Args:
            text: Anonymized text
            
        Returns:
            List of placeholder strings found
        """
        matches = self.placeholder_regex.findall(text)
        return [f"[{m[0]}_{m[1]}]" for m in matches]
    
    def get_anonymization_summary(
        self, 
        mappings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate a summary of what was anonymized.
        
        Args:
            mappings: List of placeholder mappings
            
        Returns:
            Summary statistics
        """
        by_type: Dict[str, int] = {}
        total_redactions = 0
        
        for mapping in mappings:
            type_name = mapping.get("type", "UNKNOWN")
            count = mapping.get("count", 1)
            by_type[type_name] = by_type.get(type_name, 0) + count
            total_redactions += count
        
        return {
            "total_redactions": total_redactions,
            "by_type": by_type,
            "unique_values": len(mappings)
        }


# Singleton instance
anonymization_service = AnonymizationService()


def deanonymize_text(text: str, mappings: List[Dict[str, Any]]) -> str:
    """Convenience function for de-anonymizing text"""
    return anonymization_service.deanonymize(text, mappings)


def deanonymize_scenarios(
    scenarios: List[Dict[str, Any]], 
    mappings: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Convenience function for de-anonymizing scenarios"""
    return anonymization_service.deanonymize_scenarios(scenarios, mappings)


def validate_anonymization(text: str, strict: bool = False) -> Dict[str, Any]:
    """Convenience function for validating anonymization"""
    return anonymization_service.validate_anonymization(text, strict)
