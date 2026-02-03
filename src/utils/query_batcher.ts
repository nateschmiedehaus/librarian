/**
 * @fileoverview Query Batching and Rate Limiting Utilities
 *
 * Provides concurrency control for async operations to prevent resource contention.
 * Designed to work with any async operation, particularly useful for SQLite which
 * has single-writer limitations even with WAL mode enabled.
 *
 * @packageDocumentation
 */

/**
 * Configuration options for QueryBatcher.
 */
export interface QueryBatcherOptions {
  /** Maximum number of concurrent queries (default: 3) */
  maxConcurrent?: number;
  /** Maximum queue size before rejecting new queries (default: 100) */
  maxQueueSize?: number;
  /** Timeout in milliseconds for each query (default: 30000) */
  queryTimeoutMs?: number;
}

/**
 * Result of a batched query execution.
 */
export interface BatchedQueryResult<T> {
  /** Whether the query succeeded */
  success: boolean;
  /** The result if successful */
  result?: T;
  /** The error if failed */
  error?: Error;
  /** Time spent waiting in queue (ms) */
  queueTimeMs: number;
  /** Time spent executing the query (ms) */
  executionTimeMs: number;
}

/**
 * Statistics about the batcher's current state.
 */
export interface BatcherStats {
  /** Number of queries currently executing */
  activeCount: number;
  /** Number of queries waiting in queue */
  queuedCount: number;
  /** Maximum concurrent queries allowed */
  maxConcurrent: number;
  /** Total queries processed since creation */
  totalProcessed: number;
  /** Total queries that failed */
  totalFailed: number;
  /** Average queue wait time in ms */
  avgQueueTimeMs: number;
  /** Average execution time in ms */
  avgExecutionTimeMs: number;
}

interface QueuedQuery<T> {
  execute: () => Promise<T>;
  resolve: (result: BatchedQueryResult<T>) => void;
  queuedAt: number;
}

/**
 * Manages query execution with configurable concurrency limits.
 *
 * Prevents resource contention (like SQLite lock errors) by limiting
 * how many queries can execute simultaneously. Queries that exceed
 * the concurrency limit are queued and executed when slots become available.
 *
 * @example
 * ```typescript
 * const batcher = new QueryBatcher({ maxConcurrent: 3 });
 *
 * // Execute multiple queries - only 3 will run at once
 * const results = await Promise.all([
 *   batcher.execute(() => db.query('SELECT * FROM users')),
 *   batcher.execute(() => db.query('SELECT * FROM orders')),
 *   batcher.execute(() => db.query('SELECT * FROM products')),
 *   batcher.execute(() => db.query('SELECT * FROM categories')),
 * ]);
 *
 * // Check stats
 * console.log(batcher.stats);
 * ```
 */
export class QueryBatcher {
  private readonly maxConcurrent: number;
  private readonly maxQueueSize: number;
  private readonly queryTimeoutMs: number;

  private activeCount = 0;
  private queue: QueuedQuery<unknown>[] = [];
  private totalProcessed = 0;
  private totalFailed = 0;
  private totalQueueTimeMs = 0;
  private totalExecutionTimeMs = 0;

  constructor(options: QueryBatcherOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.maxQueueSize = options.maxQueueSize ?? 100;
    this.queryTimeoutMs = options.queryTimeoutMs ?? 30000;

    if (this.maxConcurrent < 1) {
      throw new Error('maxConcurrent must be at least 1');
    }
    if (this.maxQueueSize < 0) {
      throw new Error('maxQueueSize cannot be negative');
    }
  }

  /**
   * Execute a query with concurrency control.
   *
   * If the maximum concurrent limit is reached, the query will be queued
   * until a slot becomes available. If the queue is full, the promise
   * will be rejected immediately.
   *
   * @param queryFn - Async function that performs the query
   * @returns Promise resolving to the query result with metadata
   * @throws Error if queue is full (backpressure)
   *
   * @example
   * ```typescript
   * const result = await batcher.execute(async () => {
   *   return await db.query('SELECT * FROM users WHERE id = ?', [userId]);
   * });
   *
   * if (result.success) {
   *   console.log(result.result);
   * } else {
   *   console.error(result.error);
   * }
   * ```
   */
  execute<T>(queryFn: () => Promise<T>): Promise<BatchedQueryResult<T>> {
    // Check backpressure
    if (this.queue.length >= this.maxQueueSize) {
      const error = new Error(
        `Query queue full (${this.queue.length}/${this.maxQueueSize}). ` +
          'Apply backpressure or increase maxQueueSize.'
      );
      return Promise.resolve({
        success: false,
        error,
        queueTimeMs: 0,
        executionTimeMs: 0,
      });
    }

    return new Promise((resolve) => {
      const queuedQuery: QueuedQuery<T> = {
        execute: queryFn,
        resolve: resolve as (result: BatchedQueryResult<unknown>) => void,
        queuedAt: Date.now(),
      };

      this.queue.push(queuedQuery as QueuedQuery<unknown>);
      this.processQueue();
    });
  }

  /**
   * Execute a query and return the result directly.
   *
   * This is a convenience method that unwraps the BatchedQueryResult.
   * Throws if the query fails.
   *
   * @param queryFn - Async function that performs the query
   * @returns Promise resolving to the query result
   * @throws Error if the query fails
   */
  async executeUnwrapped<T>(queryFn: () => Promise<T>): Promise<T> {
    const result = await this.execute(queryFn);
    if (!result.success) {
      throw result.error ?? new Error('Query failed without error');
    }
    return result.result as T;
  }

  /**
   * Get current batcher statistics.
   */
  get stats(): BatcherStats {
    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      avgQueueTimeMs:
        this.totalProcessed > 0 ? this.totalQueueTimeMs / this.totalProcessed : 0,
      avgExecutionTimeMs:
        this.totalProcessed > 0 ? this.totalExecutionTimeMs / this.totalProcessed : 0,
    };
  }

  /**
   * Check if the batcher can accept more queries without queueing.
   */
  get hasCapacity(): boolean {
    return this.activeCount < this.maxConcurrent;
  }

  /**
   * Check if the queue is full (would reject new queries).
   */
  get isQueueFull(): boolean {
    return this.queue.length >= this.maxQueueSize;
  }

  /**
   * Wait for all currently queued and active queries to complete.
   *
   * @example
   * ```typescript
   * // Queue several queries
   * batcher.execute(() => longQuery1());
   * batcher.execute(() => longQuery2());
   *
   * // Wait for them all to finish
   * await batcher.drain();
   * ```
   */
  async drain(): Promise<void> {
    while (this.activeCount > 0 || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  private processQueue(): void {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const query = this.queue.shift();
      if (!query) break;

      this.activeCount++;
      this.runQuery(query);
    }
  }

  private async runQuery<T>(query: QueuedQuery<T>): Promise<void> {
    const queueTimeMs = Date.now() - query.queuedAt;
    const executionStart = Date.now();

    try {
      const result = await this.withTimeout(query.execute(), this.queryTimeoutMs);
      const executionTimeMs = Date.now() - executionStart;

      this.totalProcessed++;
      this.totalQueueTimeMs += queueTimeMs;
      this.totalExecutionTimeMs += executionTimeMs;

      query.resolve({
        success: true,
        result,
        queueTimeMs,
        executionTimeMs,
      });
    } catch (error) {
      const executionTimeMs = Date.now() - executionStart;

      this.totalProcessed++;
      this.totalFailed++;
      this.totalQueueTimeMs += queueTimeMs;
      this.totalExecutionTimeMs += executionTimeMs;

      query.resolve({
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        queueTimeMs,
        executionTimeMs,
      });
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    if (timeoutMs <= 0) return promise;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Query timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }
}

/**
 * Configuration options for RateLimiter.
 */
export interface RateLimiterOptions {
  /** Maximum number of operations per interval */
  maxOperations: number;
  /** Time interval in milliseconds (default: 1000 = 1 second) */
  intervalMs?: number;
  /** Whether to use sliding window (true) or token bucket (false) algorithm (default: true) */
  useSlidingWindow?: boolean;
}

/**
 * Rate limiter statistics.
 */
export interface RateLimiterStats {
  /** Number of available slots in current window */
  availableSlots: number;
  /** Maximum operations per interval */
  maxOperations: number;
  /** Interval length in milliseconds */
  intervalMs: number;
  /** Total operations processed */
  totalOperations: number;
  /** Total time spent waiting for slots in ms */
  totalWaitTimeMs: number;
}

/**
 * Controls the rate of operations using either sliding window or token bucket algorithm.
 *
 * Sliding window (default): Tracks exact timestamps of recent operations.
 * More accurate but uses more memory for high-volume operations.
 *
 * Token bucket: Refills tokens at a steady rate. More memory efficient
 * but allows short bursts up to the bucket size.
 *
 * @example
 * ```typescript
 * // Allow 10 queries per second using sliding window
 * const limiter = new RateLimiter({ maxOperations: 10, intervalMs: 1000 });
 *
 * for (const query of queries) {
 *   await limiter.acquire(); // Waits if rate limit exceeded
 *   await executeQuery(query);
 * }
 * ```
 */
export class RateLimiter {
  private readonly maxOperations: number;
  private readonly intervalMs: number;
  private readonly useSlidingWindow: boolean;

  // Sliding window state
  private timestamps: number[] = [];

  // Token bucket state
  private tokens: number;
  private lastRefill: number;

  // Stats
  private totalOperations = 0;
  private totalWaitTimeMs = 0;

  constructor(options: RateLimiterOptions) {
    this.maxOperations = options.maxOperations;
    this.intervalMs = options.intervalMs ?? 1000;
    this.useSlidingWindow = options.useSlidingWindow ?? true;

    if (this.maxOperations < 1) {
      throw new Error('maxOperations must be at least 1');
    }
    if (this.intervalMs < 1) {
      throw new Error('intervalMs must be at least 1');
    }

    // Token bucket initialization
    this.tokens = this.maxOperations;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a slot for an operation.
   *
   * If no slot is available, waits until one becomes available.
   * Use this before performing rate-limited operations.
   *
   * @returns Promise that resolves when a slot is available
   *
   * @example
   * ```typescript
   * // Rate limit API calls to 5 per second
   * const limiter = new RateLimiter({ maxOperations: 5 });
   *
   * async function rateLimitedFetch(url: string) {
   *   await limiter.acquire();
   *   return fetch(url);
   * }
   * ```
   */
  async acquire(): Promise<void> {
    const waitStart = Date.now();

    if (this.useSlidingWindow) {
      await this.acquireSlidingWindow();
    } else {
      await this.acquireTokenBucket();
    }

    const waitTime = Date.now() - waitStart;
    this.totalWaitTimeMs += waitTime;
    this.totalOperations++;
  }

  /**
   * Try to acquire a slot without waiting.
   *
   * @returns true if a slot was acquired, false if rate limit exceeded
   *
   * @example
   * ```typescript
   * if (limiter.tryAcquire()) {
   *   await executeQuery();
   * } else {
   *   console.log('Rate limited, try again later');
   * }
   * ```
   */
  tryAcquire(): boolean {
    if (this.useSlidingWindow) {
      return this.tryAcquireSlidingWindow();
    } else {
      return this.tryAcquireTokenBucket();
    }
  }

  /**
   * Get current rate limiter statistics.
   */
  get stats(): RateLimiterStats {
    return {
      availableSlots: this.getAvailableSlots(),
      maxOperations: this.maxOperations,
      intervalMs: this.intervalMs,
      totalOperations: this.totalOperations,
      totalWaitTimeMs: this.totalWaitTimeMs,
    };
  }

  /**
   * Check how many slots are currently available.
   */
  getAvailableSlots(): number {
    if (this.useSlidingWindow) {
      this.cleanupOldTimestamps();
      return Math.max(0, this.maxOperations - this.timestamps.length);
    } else {
      this.refillTokens();
      return Math.floor(this.tokens);
    }
  }

  /**
   * Reset the rate limiter to its initial state.
   */
  reset(): void {
    this.timestamps = [];
    this.tokens = this.maxOperations;
    this.lastRefill = Date.now();
    this.totalOperations = 0;
    this.totalWaitTimeMs = 0;
  }

  // Sliding window implementation
  private async acquireSlidingWindow(): Promise<void> {
    while (!this.tryAcquireSlidingWindow()) {
      // Calculate wait time until oldest timestamp expires
      const oldestTimestamp = this.timestamps[0];
      if (oldestTimestamp !== undefined) {
        const waitTime = Math.max(1, oldestTimestamp + this.intervalMs - Date.now());
        await this.sleep(Math.min(waitTime, 100)); // Check frequently, max 100ms
      } else {
        await this.sleep(10);
      }
    }
  }

  private tryAcquireSlidingWindow(): boolean {
    this.cleanupOldTimestamps();

    if (this.timestamps.length < this.maxOperations) {
      this.timestamps.push(Date.now());
      return true;
    }

    return false;
  }

  private cleanupOldTimestamps(): void {
    const cutoff = Date.now() - this.intervalMs;
    while (this.timestamps.length > 0 && this.timestamps[0]! < cutoff) {
      this.timestamps.shift();
    }
  }

  // Token bucket implementation
  private async acquireTokenBucket(): Promise<void> {
    while (!this.tryAcquireTokenBucket()) {
      // Calculate wait time for next token
      const tokensNeeded = 1 - this.tokens;
      const msPerToken = this.intervalMs / this.maxOperations;
      const waitTime = Math.max(1, Math.ceil(tokensNeeded * msPerToken));
      await this.sleep(Math.min(waitTime, 100)); // Check frequently, max 100ms
    }
  }

  private tryAcquireTokenBucket(): boolean {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / this.intervalMs) * this.maxOperations;

    this.tokens = Math.min(this.maxOperations, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Combines QueryBatcher and RateLimiter for comprehensive query control.
 *
 * Use this when you need both concurrency limiting (to prevent lock contention)
 * and rate limiting (to respect API limits or prevent overload).
 *
 * @example
 * ```typescript
 * const controller = new QueryController({
 *   batcher: { maxConcurrent: 5 },
 *   rateLimiter: { maxOperations: 20, intervalMs: 1000 },
 * });
 *
 * // Queries are rate limited AND concurrency limited
 * const result = await controller.execute(() => db.query('...'));
 * ```
 */
export class QueryController {
  private readonly batcher: QueryBatcher;
  private readonly rateLimiter: RateLimiter | null;

  constructor(options: {
    batcher?: QueryBatcherOptions;
    rateLimiter?: RateLimiterOptions;
  } = {}) {
    this.batcher = new QueryBatcher(options.batcher);
    this.rateLimiter = options.rateLimiter
      ? new RateLimiter(options.rateLimiter)
      : null;
  }

  /**
   * Execute a query with both rate limiting and concurrency control.
   *
   * @param queryFn - Async function that performs the query
   * @returns Promise resolving to the query result with metadata
   */
  async execute<T>(queryFn: () => Promise<T>): Promise<BatchedQueryResult<T>> {
    if (this.rateLimiter) {
      await this.rateLimiter.acquire();
    }
    return this.batcher.execute(queryFn);
  }

  /**
   * Execute a query and return the result directly.
   *
   * @param queryFn - Async function that performs the query
   * @returns Promise resolving to the query result
   * @throws Error if the query fails
   */
  async executeUnwrapped<T>(queryFn: () => Promise<T>): Promise<T> {
    if (this.rateLimiter) {
      await this.rateLimiter.acquire();
    }
    return this.batcher.executeUnwrapped(queryFn);
  }

  /**
   * Get statistics from both batcher and rate limiter.
   */
  get stats(): { batcher: BatcherStats; rateLimiter: RateLimiterStats | null } {
    return {
      batcher: this.batcher.stats,
      rateLimiter: this.rateLimiter?.stats ?? null,
    };
  }

  /**
   * Wait for all queued queries to complete.
   */
  async drain(): Promise<void> {
    return this.batcher.drain();
  }
}

// Default instances for convenient usage
let defaultBatcher: QueryBatcher | null = null;
let defaultRateLimiter: RateLimiter | null = null;

/**
 * Get the default QueryBatcher instance.
 *
 * Creates one with default settings if it doesn't exist.
 * Use for simple cases where you don't need custom configuration.
 *
 * @example
 * ```typescript
 * const batcher = getDefaultBatcher();
 * await batcher.execute(() => someQuery());
 * ```
 */
export function getDefaultBatcher(): QueryBatcher {
  if (!defaultBatcher) {
    defaultBatcher = new QueryBatcher({ maxConcurrent: 3 });
  }
  return defaultBatcher;
}

/**
 * Get the default RateLimiter instance.
 *
 * Creates one with default settings (10 ops/sec) if it doesn't exist.
 *
 * @example
 * ```typescript
 * const limiter = getDefaultRateLimiter();
 * await limiter.acquire();
 * await someOperation();
 * ```
 */
export function getDefaultRateLimiter(): RateLimiter {
  if (!defaultRateLimiter) {
    defaultRateLimiter = new RateLimiter({ maxOperations: 10, intervalMs: 1000 });
  }
  return defaultRateLimiter;
}

/**
 * Reset default instances. Useful for testing.
 */
export function resetDefaults(): void {
  defaultBatcher = null;
  defaultRateLimiter = null;
}
