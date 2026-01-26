/**
 * @fileoverview Result type for explicit error handling
 *
 * Replaces thrown exceptions and `.catch(() => {})` patterns with
 * explicit Result<T, E> types for better error handling.
 */

import * as fs from 'fs/promises';

// ============================================================================
// CORE RESULT TYPE
// ============================================================================

export type OkResult<T> = { readonly ok: true; readonly value: T };
export type ErrResult<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = OkResult<T> | ErrResult<E>;

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// ============================================================================
// RESULT HELPERS
// ============================================================================

/**
 * Wrap an async function in a Result
 */
export async function safeAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    return Ok(await fn());
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Wrap a sync function in a Result
 */
export function safeSync<T>(fn: () => T): Result<T, Error> {
  try {
    return Ok(fn());
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Map a Result's success value
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return Ok(fn(result.value));
  }
  return Err((result as ErrResult<E>).error);
}

/**
 * FlatMap a Result
 */
export function flatMapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return Err((result as ErrResult<E>).error);
}

/**
 * Map a Result's error
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (!result.ok) {
    return Err(fn((result as ErrResult<E>).error));
  }
  return Ok(result.value);
}

/**
 * Unwrap a Result, throwing if error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw (result as ErrResult<E>).error;
}

/**
 * Unwrap a Result with a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Check if Result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Check if Result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/**
 * Combine multiple Results into one
 */
export function combineResults<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return Err((result as ErrResult<E>).error);
    }
    values.push(result.value);
  }
  return Ok(values);
}

/**
 * Combine Results, collecting all errors
 */
export function combineResultsAll<T, E>(results: Result<T, E>[]): Result<T[], E[]> {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      errors.push((result as ErrResult<E>).error);
    }
  }

  if (errors.length > 0) {
    return Err(errors);
  }
  return Ok(values);
}

// ============================================================================
// RESULT ERROR HELPERS
// ============================================================================

export function getResultError<T, E>(result: Result<T, E>): E | undefined {
  if (result.ok) return undefined;
  return (result as ErrResult<E>).error;
}

export function getResultErrorMessage<T, E>(result: Result<T, E>): string {
  const error = getResultError(result);
  if (!error) return '';
  if (error instanceof Error) return error.message;
  return String(error);
}

// ============================================================================
// SAFE FILE OPERATIONS (Replace .catch(() => {}))
// ============================================================================

/**
 * Safe file unlink - doesn't throw if file doesn't exist
 */
export async function safeUnlink(path: string): Promise<Result<void, Error>> {
  try {
    await fs.unlink(path);
    return Ok(undefined);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    // ENOENT = file doesn't exist, which is fine for unlink
    if (err.code === 'ENOENT') {
      return Ok(undefined);
    }
    return Err(err);
  }
}

/**
 * Safe file read
 */
export async function safeReadFile(path: string): Promise<Result<string, Error>> {
  return safeAsync(() => fs.readFile(path, 'utf-8'));
}

/**
 * Safe file write
 */
export async function safeWriteFile(path: string, content: string): Promise<Result<void, Error>> {
  return safeAsync(() => fs.writeFile(path, content, 'utf-8'));
}

/**
 * Safe mkdir
 */
export async function safeMkdir(path: string, options?: { recursive?: boolean }): Promise<Result<string | undefined, Error>> {
  return safeAsync(() => fs.mkdir(path, options));
}

/**
 * Safe stat
 */
export async function safeStat(path: string): Promise<Result<import('fs').Stats, Error>> {
  return safeAsync(() => fs.stat(path));
}

/**
 * Safe readdir
 */
export async function safeReaddir(path: string): Promise<Result<string[], Error>> {
  return safeAsync(() => fs.readdir(path));
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string): Result<T, Error> {
  return safeSync(() => JSON.parse(json) as T);
}

/**
 * Safe JSON stringify
 */
export function safeJsonStringify(value: unknown, space?: number): Result<string, Error> {
  return safeSync(() => JSON.stringify(value, null, space));
}

// ============================================================================
// ASYNC RESULT UTILITIES
// ============================================================================

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError?: Error
): Promise<Result<T, Error>> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(timeoutError ?? new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return Ok(result);
  } catch (e) {
    clearTimeout(timeoutId!);
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Retry an operation
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<Result<T, Error>> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | undefined;
  let currentDelay = delayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await safeAsync(fn);

    if (result.ok) {
      return result;
    }

    const error = getResultError(result);
    if (!error) {
      return Err(new Error('Result error missing'));
    }
    lastError = error;

    // Check if we should retry
    if (!shouldRetry(error)) {
      return Err(error);
    }

    // Wait before next attempt (except on last attempt)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= backoffMultiplier;
    }
  }

  return Err(lastError ?? new Error('Max retries exceeded'));
}
