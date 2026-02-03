/**
 * @fileoverview Async Utilities
 *
 * Shared async helper functions used across the codebase.
 *
 * @packageDocumentation
 */

/**
 * Options for withTimeout function.
 */
export interface WithTimeoutOptions {
  /** Context string for error messages */
  context?: string;
  /** Custom error code to attach to timeout errors */
  errorCode?: string;
}

/**
 * Error thrown when a promise times out.
 */
export class TimeoutError extends Error {
  readonly code?: string;
  readonly timeoutMs: number;

  constructor(timeoutMs: number, context?: string, errorCode?: string) {
    const message = context
      ? `Timeout after ${timeoutMs}ms: ${context}`
      : `Operation timed out after ${timeoutMs}ms`;
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.code = errorCode;
  }
}

/**
 * Wrap a promise with a timeout.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds (if <= 0 or undefined, returns promise as-is)
 * @param options - Optional configuration for error messages
 * @returns The result of the promise if it resolves before timeout
 * @throws TimeoutError if the promise does not resolve within timeoutMs
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withTimeout(fetchData(), 5000);
 *
 * // With context for better error messages
 * const result = await withTimeout(fetchData(), 5000, { context: 'fetching user data' });
 *
 * // With error code
 * const result = await withTimeout(llmCall(), 30000, { errorCode: 'ETIMEDOUT' });
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs?: number,
  options?: WithTimeoutOptions
): Promise<T> {
  // If no valid timeout, return the promise directly
  if (!timeoutMs || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new TimeoutError(timeoutMs, options?.context, options?.errorCode));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
