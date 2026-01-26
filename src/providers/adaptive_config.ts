/**
 * @fileoverview Adaptive Provider Configuration
 *
 * Learns optimal provider settings from observed behavior:
 * 1. Circuit breaker thresholds based on failure rates
 * 2. Timeouts based on observed latencies
 * 3. Rate limits based on rate limit errors
 */

import { ProviderType } from '../core/errors.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ProviderMetrics {
  successCount: number;
  failureCount: number;
  latencies: number[];
  lastSuccess?: number;
  lastFailure?: number;
  recentErrors: Array<{ time: number; reason: string }>;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenRequests: number;
}

export interface RateLimitConfig {
  tokensPerSecond: number;
  bucketSize: number;
}

export interface ProviderConfig {
  circuitBreaker: CircuitBreakerConfig;
  rateLimit: RateLimitConfig;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  retryBackoffMultiplier: number;
}

// ============================================================================
// DEFAULT CONFIGS
// ============================================================================

const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenRequests: 3,
};

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  tokensPerSecond: 10,
  bucketSize: 50,
};

const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER,
  rateLimit: DEFAULT_RATE_LIMIT,
  timeoutMs: 60000,
  maxRetries: 3,
  retryDelayMs: 1000,
  retryBackoffMultiplier: 2,
};

const PROVIDER_BASE_CONFIGS: Record<ProviderType, Partial<ProviderConfig>> = {
  claude: {
    rateLimit: { tokensPerSecond: 10, bucketSize: 50 },
  },
  codex: {
    rateLimit: { tokensPerSecond: 5, bucketSize: 30 },
  },
  local: {
    rateLimit: { tokensPerSecond: 100, bucketSize: 500 },
    circuitBreaker: {
      failureThreshold: 10, // More lenient for local
      resetTimeoutMs: 30000,
      halfOpenRequests: 5,
    },
  },
};

// ============================================================================
// ADAPTIVE PROVIDER CONFIG
// ============================================================================

export class AdaptiveProviderConfig {
  private metrics = new Map<ProviderType, ProviderMetrics>();
  private baseConfig = new Map<ProviderType, ProviderConfig>();
  private adaptedConfig = new Map<ProviderType, ProviderConfig>();

  constructor() {
    // Initialize base configs for all providers
    for (const provider of ['claude', 'codex', 'local'] as ProviderType[]) {
      const base = PROVIDER_BASE_CONFIGS[provider] ?? {};
      this.baseConfig.set(provider, {
        ...DEFAULT_PROVIDER_CONFIG,
        ...base,
        circuitBreaker: { ...DEFAULT_CIRCUIT_BREAKER, ...base.circuitBreaker },
        rateLimit: { ...DEFAULT_RATE_LIMIT, ...base.rateLimit },
      });
    }
  }

  // ============================================================================
  // METRICS RECORDING
  // ============================================================================

  /**
   * Record a successful request
   */
  recordSuccess(providerId: ProviderType, latencyMs: number): void {
    const m = this.getOrCreateMetrics(providerId);
    m.successCount++;
    m.latencies.push(latencyMs);
    m.lastSuccess = Date.now();

    // Keep last 1000 latencies
    if (m.latencies.length > 1000) {
      m.latencies = m.latencies.slice(-1000);
    }

    // Invalidate adapted config
    this.adaptedConfig.delete(providerId);
  }

  /**
   * Record a failed request
   */
  recordFailure(providerId: ProviderType, reason: string): void {
    const m = this.getOrCreateMetrics(providerId);
    m.failureCount++;
    m.lastFailure = Date.now();
    m.recentErrors.push({ time: Date.now(), reason });

    // Keep last 100 errors
    if (m.recentErrors.length > 100) {
      m.recentErrors = m.recentErrors.slice(-100);
    }

    // Invalidate adapted config
    this.adaptedConfig.delete(providerId);
  }

  /**
   * Get or create metrics for a provider
   */
  private getOrCreateMetrics(providerId: ProviderType): ProviderMetrics {
    if (!this.metrics.has(providerId)) {
      this.metrics.set(providerId, {
        successCount: 0,
        failureCount: 0,
        latencies: [],
        recentErrors: [],
      });
    }
    return this.metrics.get(providerId)!;
  }

  // ============================================================================
  // ADAPTIVE CONFIGURATION
  // ============================================================================

  /**
   * Get adapted configuration for a provider
   */
  getAdaptedConfig(providerId: ProviderType): ProviderConfig {
    // Return cached if available
    const cached = this.adaptedConfig.get(providerId);
    if (cached) {
      return cached;
    }

    const base = this.baseConfig.get(providerId) ?? DEFAULT_PROVIDER_CONFIG;
    const metrics = this.metrics.get(providerId);

    // Not enough data to adapt
    if (!metrics || metrics.successCount + metrics.failureCount < 10) {
      return base;
    }

    const adapted = this.computeAdaptedConfig(base, metrics);
    this.adaptedConfig.set(providerId, adapted);
    return adapted;
  }

  /**
   * Compute adapted configuration based on metrics
   */
  private computeAdaptedConfig(base: ProviderConfig, metrics: ProviderMetrics): ProviderConfig {
    // Calculate failure rate
    const totalRequests = metrics.successCount + metrics.failureCount;
    const failureRate = metrics.failureCount / totalRequests;

    // Adapt circuit breaker threshold
    let circuitBreakerThreshold = base.circuitBreaker.failureThreshold;
    if (failureRate > 0.3) {
      // High failure rate - be more aggressive
      circuitBreakerThreshold = Math.max(3, circuitBreakerThreshold - 2);
    } else if (failureRate < 0.05) {
      // Very reliable - be more lenient
      circuitBreakerThreshold = Math.min(10, circuitBreakerThreshold + 2);
    }

    // Adapt timeout based on observed latencies
    const p95Latency = this.percentile(metrics.latencies, 95);
    const adaptedTimeout = base.timeoutMs > 0
      ? Math.max(base.timeoutMs, Math.min(p95Latency * 1.5, 120000))
      : 0;

    // Adapt rate limit based on recent rate limit errors
    const rateLimitErrors = metrics.recentErrors
      .filter(e => e.reason === 'rate_limit' && Date.now() - e.time < 300000)
      .length;

    let tokensPerSecond = base.rateLimit.tokensPerSecond;
    if (rateLimitErrors > 3) {
      // Reduce rate significantly
      tokensPerSecond = Math.max(1, tokensPerSecond * 0.5);
    } else if (rateLimitErrors > 1) {
      // Reduce rate moderately
      tokensPerSecond = Math.max(1, tokensPerSecond * 0.7);
    }

    // Adapt retry settings based on success patterns
    let maxRetries = base.maxRetries;
    let retryDelayMs = base.retryDelayMs;

    if (failureRate > 0.2 && maxRetries > 0) {
      // High failure - more retries, longer delays
      maxRetries = Math.min(5, maxRetries + 1);
      retryDelayMs = Math.min(5000, retryDelayMs * 1.5);
    }

    return {
      circuitBreaker: {
        ...base.circuitBreaker,
        failureThreshold: circuitBreakerThreshold,
      },
      rateLimit: {
        ...base.rateLimit,
        tokensPerSecond,
      },
      timeoutMs: adaptedTimeout,
      maxRetries,
      retryDelayMs,
      retryBackoffMultiplier: base.retryBackoffMultiplier,
    };
  }

  /**
   * Calculate percentile of latencies
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor((p / 100) * sorted.length);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get provider statistics
   */
  getStats(providerId: ProviderType): {
    totalRequests: number;
    successRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    recentErrors: number;
    adaptedConfig: ProviderConfig;
  } {
    const metrics = this.metrics.get(providerId);
    const config = this.getAdaptedConfig(providerId);

    if (!metrics) {
      return {
        totalRequests: 0,
        successRate: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        recentErrors: 0,
        adaptedConfig: config,
      };
    }

    const total = metrics.successCount + metrics.failureCount;
    const avgLatency = metrics.latencies.length > 0
      ? metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length
      : 0;

    return {
      totalRequests: total,
      successRate: total > 0 ? metrics.successCount / total : 0,
      avgLatencyMs: avgLatency,
      p95LatencyMs: this.percentile(metrics.latencies, 95),
      recentErrors: metrics.recentErrors.filter(e => Date.now() - e.time < 300000).length,
      adaptedConfig: config,
    };
  }

  /**
   * Get all provider statistics
   */
  getAllStats(): Record<ProviderType, ReturnType<typeof this.getStats>> {
    const stats: Record<string, ReturnType<typeof this.getStats>> = {};
    for (const provider of ['claude', 'codex', 'local'] as ProviderType[]) {
      stats[provider] = this.getStats(provider);
    }
    return stats as Record<ProviderType, ReturnType<typeof this.getStats>>;
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  /**
   * Export state for persistence
   */
  toJSON(): Record<ProviderType, ProviderMetrics> {
    const result: Record<string, ProviderMetrics> = {};
    for (const [provider, metrics] of this.metrics) {
      result[provider] = {
        ...metrics,
        // Keep only recent data
        latencies: metrics.latencies.slice(-100),
        recentErrors: metrics.recentErrors.slice(-50),
      };
    }
    return result as Record<ProviderType, ProviderMetrics>;
  }

  /**
   * Import state
   */
  fromJSON(data: Record<string, ProviderMetrics>): void {
    for (const [provider, metrics] of Object.entries(data)) {
      this.metrics.set(provider as ProviderType, metrics);
    }
  }

  /**
   * Reset metrics for a provider
   */
  reset(providerId: ProviderType): void {
    this.metrics.delete(providerId);
    this.adaptedConfig.delete(providerId);
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    this.metrics.clear();
    this.adaptedConfig.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const adaptiveProviderConfig = new AdaptiveProviderConfig();
