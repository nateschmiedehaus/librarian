/**
 * @fileoverview Error Utilities
 * Re-exports from core/errors.ts plus utility functions.
 */

export * from '../core/errors.js';

/**
 * Extract error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}

/**
 * Extract error stack from any error type
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Wrap an error with additional context
 */
export function wrapError(error: unknown, context: string): Error {
  const message = getErrorMessage(error);
  const wrapped = new Error(`${context}: ${message}`);
  if (error instanceof Error && error.stack) {
    wrapped.stack = error.stack;
  }
  return wrapped;
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503')
    );
  }
  return false;
}

/**
 * Assert a condition, throw if false
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert a value is defined
 */
export function assertDefined<T>(value: T | undefined | null, name: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(`${name} is not defined`);
  }
}

/**
 * Convert error to message string (alias for getErrorMessage)
 */
export const toErrorMessage = getErrorMessage;
