/**
 * Dynamic Content Detection Utility
 * Identifies selectors that contain dynamic content that may change over time
 */

// Dynamic content patterns that should be flagged for user review
const DYNAMIC_PATTERNS = [
  // Prices in various formats
  { pattern: /\$\d+(\.\d{2})?/, type: 'price', description: 'Price (USD)' },
  { pattern: /£\d+(\.\d{2})?/, type: 'price', description: 'Price (GBP)' },
  { pattern: /€\d+(\.\d{2})?/, type: 'price', description: 'Price (EUR)' },
  { pattern: /\d+\$|\d+€|\d+£/, type: 'price', description: 'Price' },
  
  // Dates and times
  { pattern: /\d{1,2}\/\d{1,2}\/\d{2,4}/, type: 'date', description: 'Date (MM/DD/YYYY)' },
  { pattern: /\d{4}-\d{2}-\d{2}/, type: 'date', description: 'Date (ISO format)' },
  { pattern: /\d{1,2}:\d{2}\s*(AM|PM)?/i, type: 'time', description: 'Time' },
  { pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, type: 'date', description: 'Day of week' },
  { pattern: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i, type: 'date', description: 'Month name' },
  { pattern: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i, type: 'date', description: 'Month abbreviation' },
  
  // Flight/booking numbers and codes
  { pattern: /#\s*\d{3,}/, type: 'booking', description: 'Reference number' },
  { pattern: /\b[A-Z]{2,3}\s*\d{3,}\b/, type: 'booking', description: 'Flight/booking code' },
  { pattern: /\b[A-Z0-9]{6,}\b/, type: 'booking', description: 'Confirmation code' },
  
  // Quantities and counts (be more specific to avoid false positives)
  { pattern: /^\d+$/, type: 'number', description: 'Pure number' },
  { pattern: /\d+(\.\d+)?%/, type: 'percentage', description: 'Percentage' },
  { pattern: /\d{10,}/, type: 'timestamp', description: 'Timestamp' },
  { pattern: /\d+\s*(in stock|available|left)\b/i, type: 'inventory', description: 'Stock level' },
  { pattern: /\d+\s*(reviews?|ratings?|stars?)\b/i, type: 'social', description: 'Review/rating count' },
  { pattern: /\d+\s*(likes?|shares?|views?)\b/i, type: 'social', description: 'Social metrics' },
  
  // Dynamic UI states
  { pattern: /\b(loading|pending|processing)\b/i, type: 'state', description: 'Loading state' },
  { pattern: /\d+\s*(seconds?|minutes?|hours?)\s*(ago|remaining)\b/i, type: 'time', description: 'Relative time' },
  { pattern: /\b(online|offline|active|inactive)\b/i, type: 'status', description: 'Status indicator' },
];

export interface DynamicContentMatch {
  type: string;
  description: string;
  matchedText: string;
  pattern: RegExp;
}

export function detectDynamicContent(text: string): DynamicContentMatch[] {
  if (!text || typeof text !== 'string') return [];
  
  const matches: DynamicContentMatch[] = [];
  const trimmed = text.trim();
  
  DYNAMIC_PATTERNS.forEach(({ pattern, type, description }) => {
    const match = trimmed.match(pattern);
    if (match) {
      matches.push({
        type,
        description,
        matchedText: match[0],
        pattern
      });
    }
  });
  
  return matches;
}

export function isDynamicSelector(selector: string): boolean {
  if (!selector) return false;
  
  // Check if selector contains dynamic content patterns
  const dynamicMatches = detectDynamicContent(selector);
  return dynamicMatches.length > 0;
}

export function getDynamicContentSeverity(matches: DynamicContentMatch[]): 'low' | 'medium' | 'high' {
  if (matches.length === 0) return 'low';
  
  const hasHighRisk = matches.some(m => 
    ['price', 'timestamp', 'booking', 'inventory'].includes(m.type)
  );
  
  const hasMediumRisk = matches.some(m => 
    ['date', 'time', 'social', 'state'].includes(m.type)
  );
  
  if (hasHighRisk) return 'high';
  if (hasMediumRisk) return 'medium';
  return 'low';
}

export function getDynamicContentWarning(matches: DynamicContentMatch[]): string {
  if (matches.length === 0) return '';
  
  const severity = getDynamicContentSeverity(matches);
  const uniqueDescriptions = matches.map(m => m.description).filter((desc, index, arr) => arr.indexOf(desc) === index);
  const types = uniqueDescriptions.join(', ');
  
  switch (severity) {
    case 'high':
      return `⚠️ High Risk: Contains ${types} - likely to change frequently`;
    case 'medium':
      return `⚡ Medium Risk: Contains ${types} - may change over time`;
    case 'low':
      return `ℹ️ Low Risk: Contains ${types} - may occasionally change`;
    default:
      return '';
  }
}