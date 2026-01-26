/**
 * @fileoverview Hallucination Detection
 *
 * Detects potential hallucinations in LLM output.
 *
 * @packageDocumentation
 */

// ============================================================================
// TYPES
// ============================================================================

export interface HallucinationCheck {
  text: string;
  context?: string;
  checkType: 'file_path' | 'function_name' | 'import' | 'general';
}

export interface HallucinationResult {
  isHallucination: boolean;
  confidence: number;
  reason?: string;
  suggestions?: string[];
}

// ============================================================================
// DETECTOR
// ============================================================================

export class HallucinationDetector {
  private knownPaths = new Set<string>();
  private knownFunctions = new Set<string>();
  private knownImports = new Set<string>();

  /**
   * Register known entities for validation
   */
  registerKnown(type: 'path' | 'function' | 'import', values: string[]): void {
    const set = type === 'path' ? this.knownPaths
      : type === 'function' ? this.knownFunctions
      : this.knownImports;

    for (const value of values) {
      set.add(value);
    }
  }

  /**
   * Check if text contains potential hallucinations
   */
  check(input: HallucinationCheck): HallucinationResult {
    const { text, checkType } = input;

    switch (checkType) {
      case 'file_path':
        return this.checkFilePath(text);
      case 'function_name':
        return this.checkFunctionName(text);
      case 'import':
        return this.checkImport(text);
      default:
        return this.checkGeneral(text);
    }
  }

  private checkFilePath(path: string): HallucinationResult {
    // If we have known paths and this isn't one of them
    if (this.knownPaths.size > 0 && !this.knownPaths.has(path)) {
      // Check if it looks suspicious
      if (path.includes('example') || path.includes('placeholder')) {
        return {
          isHallucination: true,
          confidence: 0.8,
          reason: 'Path contains placeholder-like terms',
        };
      }
    }

    return { isHallucination: false, confidence: 0.9 };
  }

  private checkFunctionName(name: string): HallucinationResult {
    if (this.knownFunctions.size > 0 && !this.knownFunctions.has(name)) {
      // Check if it looks made up
      if (name.includes('Example') || name.includes('Sample')) {
        return {
          isHallucination: true,
          confidence: 0.7,
          reason: 'Function name contains example-like terms',
        };
      }
    }

    return { isHallucination: false, confidence: 0.9 };
  }

  private checkImport(importPath: string): HallucinationResult {
    if (this.knownImports.size > 0 && !this.knownImports.has(importPath)) {
      return {
        isHallucination: true,
        confidence: 0.6,
        reason: 'Import not found in known imports',
        suggestions: Array.from(this.knownImports).filter(i =>
          i.includes(importPath.split('/').pop() ?? '')
        ),
      };
    }

    return { isHallucination: false, confidence: 0.9 };
  }

  private checkGeneral(text: string): HallucinationResult {
    // Look for common hallucination patterns
    const suspiciousPatterns = [
      /I think|I believe|probably|might be|could be/i,
      /example\.com|placeholder|todo|fixme/i,
      /\[insert.*here\]|\{.*placeholder.*\}/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text)) {
        return {
          isHallucination: true,
          confidence: 0.5,
          reason: 'Text contains uncertainty or placeholder markers',
        };
      }
    }

    return { isHallucination: false, confidence: 0.9 };
  }

  /**
   * Clear all known entities
   */
  clear(): void {
    this.knownPaths.clear();
    this.knownFunctions.clear();
    this.knownImports.clear();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let detector: HallucinationDetector | undefined;

export function getHallucinationDetector(): HallucinationDetector {
  if (!detector) {
    detector = new HallucinationDetector();
  }
  return detector;
}
