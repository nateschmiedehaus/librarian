/**
 * @fileoverview Output Validation Utilities
 *
 * Validates LLM output against expected schemas.
 *
 * @packageDocumentation
 */

import { z, type ZodSchema, type ZodError } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string[];
}

// ============================================================================
// ERRORS
// ============================================================================

export class OutputValidationError extends Error {
  constructor(
    message: string,
    public readonly details: string[] = [],
    public readonly rawOutput?: string,
  ) {
    super(message);
    this.name = 'OutputValidationError';
  }
}

// ============================================================================
// VALIDATORS
// ============================================================================

/**
 * Validate JSON against a Zod schema
 */
export function validateJSON<T>(
  json: unknown,
  schema: ZodSchema<T>,
): ValidationResult<T> {
  try {
    const data = schema.parse(json);
    return { success: true, data };
  } catch (err) {
    const zodError = err as ZodError;
    const details = zodError.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    return {
      success: false,
      error: 'Schema validation failed',
      details,
    };
  }
}

/**
 * Validate string is valid JSON and matches schema
 */
export function validateJSONString<T>(
  text: string,
  schema: ZodSchema<T>,
): ValidationResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      success: false,
      error: 'Invalid JSON',
      details: ['Could not parse as JSON'],
    };
  }
  return validateJSON(parsed, schema);
}

/**
 * Extract JSON from LLM response (handles markdown code blocks)
 */
export function extractJSON(text: string): string {
  // Try to extract from markdown code block
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Try to find raw JSON object/array
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  // Return original
  return text.trim();
}

/**
 * Validate LLM output and extract typed data
 */
export function validateLLMOutput<T>(
  output: string,
  schema: ZodSchema<T>,
): T {
  const extracted = extractJSON(output);
  const result = validateJSONString(extracted, schema);

  if (!result.success || !result.data) {
    throw new OutputValidationError(
      result.error ?? 'Validation failed',
      result.details,
      output,
    );
  }

  return result.data;
}

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const StringArraySchema = z.array(z.string());
export const StringRecordSchema = z.record(z.string());
export const NumberSchema = z.number();
export const BooleanSchema = z.boolean();
