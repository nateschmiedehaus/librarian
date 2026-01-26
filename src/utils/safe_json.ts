/**
 * @fileoverview Safe JSON Parsing
 *
 * Utilities for safely parsing JSON with error handling.
 *
 * @packageDocumentation
 */

import type { Result } from '../core/result.js';
export { getResultError, getResultErrorMessage } from '../core/result.js';

/**
 * Type guard to check if a Result is an error
 */
export function isResultError<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/**
 * Get error from Result safely (casts after checking ok)
 */
export function getError<T>(result: Result<T, Error>): Error | undefined {
  if (!result.ok) {
    return (result as { ok: false; error: Error }).error;
  }
  return undefined;
}

/**
 * Get error message from Result safely
 */
export function getErrorMsg<T>(result: Result<T, Error>): string {
  if (!result.ok) {
    return (result as { ok: false; error: Error }).error.message;
  }
  return '';
}

/**
 * Safely parse JSON, returning a Result with ok/value/error
 * This is used by code that expects the Result pattern
 */
export function safeJsonParse<T = unknown>(text: string): Result<T, Error> {
  try {
    const value = JSON.parse(text) as T;
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Safely parse JSON or throw the underlying parse error.
 */
export function safeJsonParseOrThrow<T = unknown>(text: string): T {
  const result = safeJsonParse<T>(text);
  if (result.ok) {
    return result.value;
  }
  throw (result as { ok: false; error: Error }).error;
}

/**
 * Safely parse JSON, returning the value directly or undefined on error
 * Use this for simple cases where you don't need error details
 */
export function safeJsonParseSimple<T = unknown>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/**
 * Parse JSON with a default value
 */
export function parseJsonWithDefault<T>(text: string, defaultValue: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely stringify JSON
 */
export function safeJsonStringify(value: unknown, indent?: number): string | undefined {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return undefined;
  }
}

/**
 * Parse JSON and validate it's an object
 */
export function parseJsonObject(text: string): Record<string, unknown> | undefined {
  const parsed = safeJsonParse(text);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Parse JSON and validate it's an array
 */
export function parseJsonArray<T = unknown>(text: string): T[] | undefined {
  const parsed = safeJsonParse<T[]>(text);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  return undefined;
}

/**
 * Safely parse JSON, returning null on error
 */
export function safeJsonParseOrNull<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
