/**
 * @fileoverview Marked JSON Extraction
 *
 * Extracts JSON from LLM responses that use special markers.
 *
 * @packageDocumentation
 */

import { safeJsonParseSimple } from './safe_json.js';

// ============================================================================
// TYPES
// ============================================================================

export interface MarkedJsonResult<T> {
  success: boolean;
  data?: T;
  raw?: string;
  error?: string;
  // Also include these for compatibility with direct-access patterns
  functions?: unknown[];
  module?: unknown;
}

export interface ExtractMarkedJsonOptions<T> {
  text: string;
  beginMarker: string;
  endMarker: string;
  validate?: (value: unknown) => value is T;
}

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * Extract JSON from text with markers like <json>...</json>
 *
 * Supports two calling conventions:
 * 1. extractMarkedJson(text, marker) - returns MarkedJsonResult<T>
 * 2. extractMarkedJson({ text, beginMarker, endMarker, validate }) - returns T | null
 */
export function extractMarkedJson<T = unknown>(options: ExtractMarkedJsonOptions<T>): T | null;
export function extractMarkedJson<T = unknown>(text: string, marker?: string): MarkedJsonResult<T>;
export function extractMarkedJson<T = unknown>(
  textOrOptions: string | ExtractMarkedJsonOptions<T>,
  marker = 'json',
): MarkedJsonResult<T> | T | null {
  // Handle object-based calling convention
  if (typeof textOrOptions === 'object' && textOrOptions !== null) {
    const { text, beginMarker, endMarker, validate } = textOrOptions;
    const markerRegex = new RegExp(
      `${escapeRegex(beginMarker)}([\\s\\S]*?)${escapeRegex(endMarker)}`,
      'i'
    );
    const match = text.match(markerRegex);
    if (!match) return null;

    const raw = match[1].trim();
    const data = safeJsonParseSimple<T>(raw);
    if (data === undefined) return null;
    if (validate && !validate(data)) return null;

    return data;
  }

  const text = textOrOptions as string;

  // Try <marker>...</marker> format
  const markerRegex = new RegExp(`<${marker}>([\\s\\S]*?)</${marker}>`, 'i');
  const markerMatch = text.match(markerRegex);

  if (markerMatch) {
    const raw = markerMatch[1].trim();
    const data = safeJsonParseSimple<T>(raw);
    if (data !== undefined) {
      return { success: true, data, raw };
    }
    return { success: false, raw, error: 'Invalid JSON inside markers' };
  }

  // Try ```json...``` format
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    const raw = codeBlockMatch[1].trim();
    const data = safeJsonParseSimple<T>(raw);
    if (data !== undefined) {
      return { success: true, data, raw };
    }
    return { success: false, raw, error: 'Invalid JSON in code block' };
  }

  // Try to find raw JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    const raw = objectMatch[0];
    const data = safeJsonParseSimple<T>(raw);
    if (data !== undefined) {
      return { success: true, data, raw };
    }
  }

  // Try to find raw JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const raw = arrayMatch[0];
    const data = safeJsonParseSimple<T>(raw);
    if (data !== undefined) {
      return { success: true, data, raw };
    }
  }

  return { success: false, error: 'No JSON found in text' };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create marked JSON string
 */
export function createMarkedJson(data: unknown, marker = 'json'): string {
  return `<${marker}>\n${JSON.stringify(data, null, 2)}\n</${marker}>`;
}

/**
 * Wrap JSON in markdown code block
 */
export function wrapJsonCodeBlock(data: unknown): string {
  return '```json\n' + JSON.stringify(data, null, 2) + '\n```';
}
