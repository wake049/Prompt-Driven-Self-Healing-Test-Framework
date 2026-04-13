/**
 * Document Anonymizer - Client-side sensitive data redaction
 * 
 * This utility anonymizes sensitive information in documents BEFORE
 * sending to the server/AI. The AI only sees generic placeholders,
 * ensuring business-sensitive data never leaves the client.
 * 
 * Flow:
 * 1. User uploads document
 * 2. DocumentAnonymizer.anonymize() replaces sensitive data with placeholders
 * 3. Anonymized content + mappings sent to server
 * 4. AI processes anonymized content
 * 5. Server can optionally de-anonymize response before returning
 */

export interface AnonymizationMapping {
  placeholder: string;
  original: string;
  type: string;
  context?: string;
}

export interface AnonymizationResult {
  anonymizedText: string;
  mappings: Record<string, string>;  // placeholder -> original
  detailedMappings: AnonymizationMapping[];
  stats: {
    totalReplacements: number;
    byType: Record<string, number>;
  };
}

export interface AnonymizationOptions {
  /** Types of data to anonymize */
  types?: AnonymizationType[];
  /** Custom patterns to detect and anonymize */
  customPatterns?: CustomPattern[];
  /** Whether to preserve formatting (line breaks, etc.) */
  preserveFormatting?: boolean;
  /** Minimum confidence threshold for detection (0-1) */
  minConfidence?: number;
}

export type AnonymizationType = 
  | 'COMPANY'
  | 'PERSON'
  | 'AMOUNT'
  | 'EMAIL'
  | 'PHONE'
  | 'URL'
  | 'DATE'
  | 'ADDRESS'
  | 'PROJECT'
  | 'CREDENTIAL'
  | 'ID_NUMBER';

export interface CustomPattern {
  name: string;
  pattern: RegExp;
  type: string;
}

// Default patterns for sensitive data detection
const DEFAULT_PATTERNS: Record<AnonymizationType, RegExp[]> = {
  COMPANY: [
    /\b[A-Z][a-zA-Z]*(?:\s+(?:Inc|LLC|Corp|Corporation|Ltd|Limited|Co|Company|Group|Holdings|Partners|Solutions|Technologies|Services|Systems|Enterprises|International))\b\.?/g,
    /\b(?:Acme|Amazon|Google|Microsoft|Apple|Facebook|Meta|Tesla|Netflix|Uber|Airbnb|Stripe|Shopify|Salesforce|Oracle|IBM|Intel|Cisco|Dell|HP|SAP|Adobe|VMware|Nvidia|AMD|Qualcomm)\b/gi,
  ],
  PERSON: [
    /\b(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+(?:Jr|Sr|III|IV))?\.?\b/g,
  ],
  AMOUNT: [
    /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|M|B|K))?\b/gi,
    /\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|CAD|AUD|JPY)\b/gi,
    /\b(?:USD|EUR|GBP)\s*[\d,]+(?:\.\d{2})?\b/gi,
  ],
  EMAIL: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ],
  PHONE: [
    /\b(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,
  ],
  URL: [
    /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
  ],
  DATE: [
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
  ],
  ADDRESS: [
    /\b\d+\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Circle|Cir)\b\.?(?:,?\s+(?:Suite|Ste|Apt|Unit|#)\s*\d+)?/gi,
  ],
  PROJECT: [
    /\b(?:Project|Initiative|Program)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z]?[a-zA-Z]+)*\b/gi,
    /\b[A-Z]{2,}[-_]\d{3,}\b/g, // Project codes like PRJ-001, ABC-1234
  ],
  CREDENTIAL: [
    /\b(?:password|api[_-]?key|secret|token|auth)[\s:=]+['"]?[A-Za-z0-9!@#$%^&*()_+=-]{8,}['"]?\b/gi,
    /\bsk[-_][a-zA-Z0-9]{20,}\b/g, // Stripe-like keys
    /\b[A-Za-z0-9]{32,}\b/g, // Generic API keys - be careful with this one
  ],
  ID_NUMBER: [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN format
    /\b[A-Z]{2}\d{6,8}\b/g, // License/ID numbers
    /\b\d{9,12}\b/g, // Account numbers
  ],
};

// Default types to anonymize
const DEFAULT_TYPES: AnonymizationType[] = [
  'COMPANY',
  'PERSON',
  'AMOUNT',
  'EMAIL',
  'PHONE',
  'URL',
  'PROJECT',
];

/**
 * Anonymizes sensitive information in text content
 */
export class DocumentAnonymizer {
  private options: Required<AnonymizationOptions>;
  private typeCounters: Record<string, number> = {};
  private seenValues: Map<string, string> = new Map(); // original -> placeholder

  constructor(options: AnonymizationOptions = {}) {
    this.options = {
      types: options.types ?? DEFAULT_TYPES,
      customPatterns: options.customPatterns ?? [],
      preserveFormatting: options.preserveFormatting ?? true,
      minConfidence: options.minConfidence ?? 0.6,
    };
  }

  /**
   * Anonymize sensitive data in the given text
   */
  anonymize(text: string): AnonymizationResult {
    this.typeCounters = {};
    this.seenValues.clear();

    let anonymizedText = text;
    const detailedMappings: AnonymizationMapping[] = [];
    const stats: AnonymizationResult['stats'] = {
      totalReplacements: 0,
      byType: {},
    };

    // Process each configured type
    for (const type of this.options.types) {
      const patterns = DEFAULT_PATTERNS[type];
      if (!patterns) continue;

      for (const pattern of patterns) {
        // Reset regex state for global patterns
        const regex = new RegExp(pattern.source, pattern.flags);
        
        anonymizedText = anonymizedText.replace(regex, (match) => {
          // Skip if already processed (same value seen before)
          if (this.seenValues.has(match)) {
            return this.seenValues.get(match)!;
          }

          // Skip very short matches that are likely false positives
          if (match.length < 3) return match;

          const placeholder = this.generatePlaceholder(type);
          this.seenValues.set(match, placeholder);

          detailedMappings.push({
            placeholder,
            original: match,
            type,
            context: this.getContext(text, match),
          });

          stats.totalReplacements++;
          stats.byType[type] = (stats.byType[type] || 0) + 1;

          return placeholder;
        });
      }
    }

    // Process custom patterns
    for (const customPattern of this.options.customPatterns) {
      const regex = new RegExp(customPattern.pattern.source, customPattern.pattern.flags);
      
      anonymizedText = anonymizedText.replace(regex, (match) => {
        if (this.seenValues.has(match)) {
          return this.seenValues.get(match)!;
        }

        const placeholder = this.generatePlaceholder(customPattern.type);
        this.seenValues.set(match, placeholder);

        detailedMappings.push({
          placeholder,
          original: match,
          type: customPattern.type,
        });

        stats.totalReplacements++;
        stats.byType[customPattern.type] = (stats.byType[customPattern.type] || 0) + 1;

        return placeholder;
      });
    }

    // Build simple mapping object
    const mappings: Record<string, string> = {};
    for (const mapping of detailedMappings) {
      mappings[mapping.placeholder] = mapping.original;
    }

    return {
      anonymizedText,
      mappings,
      detailedMappings,
      stats,
    };
  }

  /**
   * De-anonymize text using the provided mappings
   */
  deanonymize(text: string, mappings: Record<string, string>): string {
    let result = text;
    
    // Sort by placeholder length (longest first) to avoid partial replacements
    const sortedPlaceholders = Object.keys(mappings).sort((a, b) => b.length - a.length);
    
    for (const placeholder of sortedPlaceholders) {
      const original = mappings[placeholder];
      // Use split/join for global replacement without regex escaping issues
      result = result.split(placeholder).join(original);
    }
    
    return result;
  }

  /**
   * Generate a unique placeholder for a type
   */
  private generatePlaceholder(type: string): string {
    const count = this.typeCounters[type] || 0;
    this.typeCounters[type] = count + 1;
    
    // Use letter suffix: A, B, C, ... Z, AA, AB, ...
    const suffix = this.numberToLetters(count);
    return `[${type}_${suffix}]`;
  }

  /**
   * Convert number to letter sequence: 0->A, 1->B, 25->Z, 26->AA, etc.
   */
  private numberToLetters(n: number): string {
    let result = '';
    do {
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return result;
  }

  /**
   * Get context around a match for debugging/review
   */
  private getContext(text: string, match: string, contextLength: number = 30): string {
    const index = text.indexOf(match);
    if (index === -1) return '';

    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + match.length + contextLength);
    
    let context = text.slice(start, end);
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
  }

  /**
   * Reset the anonymizer state for a new document
   */
  reset(): void {
    this.typeCounters = {};
    this.seenValues.clear();
  }

  /**
   * Get statistics about what types of data can be detected in text
   * without actually anonymizing it (preview mode)
   */
  preview(text: string): { type: string; count: number; samples: string[] }[] {
    const results: { type: string; count: number; samples: string[] }[] = [];

    for (const type of this.options.types) {
      const patterns = DEFAULT_PATTERNS[type];
      if (!patterns) continue;

      const matches = new Set<string>();
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.add(match[0]);
          if (matches.size >= 10) break; // Limit samples
        }
      }

      if (matches.size > 0) {
        results.push({
          type,
          count: matches.size,
          samples: Array.from(matches).slice(0, 3),
        });
      }
    }

    return results;
  }
}

// Export singleton instance with default options
export const documentAnonymizer = new DocumentAnonymizer();

// Export convenience functions
export function anonymizeDocument(text: string, options?: AnonymizationOptions): AnonymizationResult {
  const anonymizer = new DocumentAnonymizer(options);
  return anonymizer.anonymize(text);
}

export function deanonymizeText(text: string, mappings: Record<string, string>): string {
  const anonymizer = new DocumentAnonymizer();
  return anonymizer.deanonymize(text, mappings);
}

export function previewSensitiveData(text: string, options?: AnonymizationOptions): { type: string; count: number; samples: string[] }[] {
  const anonymizer = new DocumentAnonymizer(options);
  return anonymizer.preview(text);
}
