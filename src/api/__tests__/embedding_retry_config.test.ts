import { describe, it, expect } from 'vitest';
import { __testing } from '../embeddings.js';

describe('embedding retry config', () => {
  it('resolves retry config with clamped values and merged non-retryable errors', () => {
    const resolved = __testing.resolveEmbeddingRetryConfig({
      maxRetries: -2,
      initialDelayMs: -5,
      maxDelayMs: 10,
      backoffMultiplier: 0,
      jitterFactor: 2,
      nonRetryableErrors: ['custom_error'],
    });

    expect(resolved.maxRetries).toBe(0);
    expect(resolved.initialDelayMs).toBe(0);
    expect(resolved.maxDelayMs).toBe(10);
    expect(resolved.backoffMultiplier).toBe(1);
    expect(resolved.jitterFactor).toBe(1);
    expect(resolved.nonRetryableErrors).toContain('provider_unavailable');
    expect(resolved.nonRetryableErrors).toContain('custom_error');
  });

  it('computes exponential backoff delays with optional jitter', () => {
    const config = {
      ...__testing.DEFAULT_EMBEDDING_RETRY_CONFIG,
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      backoffMultiplier: 2,
      jitterFactor: 0.2,
    };

    expect(__testing.computeRetryDelayMs(1, config, () => 0.5)).toBe(1000);
    expect(__testing.computeRetryDelayMs(2, config, () => 0.5)).toBe(2000);
    expect(__testing.computeRetryDelayMs(3, config, () => 0.5)).toBe(4000);

    const withJitter = __testing.computeRetryDelayMs(1, config, () => 1);
    expect(withJitter).toBe(1100);
  });

  it('flags non-retryable errors by message pattern', () => {
    const config = __testing.resolveEmbeddingRetryConfig();
    const retryable = __testing.isNonRetryableEmbeddingError(
      new Error('temporary failure'),
      config
    );
    const nonRetryable = __testing.isNonRetryableEmbeddingError(
      new Error('unverified_by_trace(provider_unavailable): missing'),
      config
    );

    expect(retryable).toBe(false);
    expect(nonRetryable).toBe(true);
  });
});

describe('embedding normalization', () => {
  it('normalizes embeddings outside tolerance', () => {
    const config = __testing.resolveEmbeddingNormalizationConfig({
      normTolerance: 1e-6,
      autoNormalize: true,
    });
    const embedding = new Float32Array([3, 4]);
    const normalized = __testing.normalizeEmbeddingIfNeeded(embedding, config);

    expect(normalized).not.toBe(embedding);
    expect(__testing.computeEmbeddingNorm(normalized)).toBeCloseTo(1, 6);
  });

  it('returns original embedding when validation disabled', () => {
    const config = __testing.resolveEmbeddingNormalizationConfig({
      validateNormalization: false,
    });
    const embedding = new Float32Array([3, 4]);
    const normalized = __testing.normalizeEmbeddingIfNeeded(embedding, config);

    expect(normalized).toBe(embedding);
  });

  it('returns original embedding when already normalized', () => {
    const config = __testing.resolveEmbeddingNormalizationConfig({
      normTolerance: 1e-3,
    });
    const embedding = new Float32Array([1, 0]);
    const normalized = __testing.normalizeEmbeddingIfNeeded(embedding, config);

    expect(normalized).toBe(embedding);
  });

  it('throws when normalization is required but disabled', () => {
    const config = __testing.resolveEmbeddingNormalizationConfig({
      autoNormalize: false,
    });
    const embedding = new Float32Array([3, 4]);

    expect(() => __testing.normalizeEmbeddingIfNeeded(embedding, config)).toThrow(
      'embedding_not_normalized'
    );
  });

  it('throws on zero-norm embeddings', () => {
    const config = __testing.resolveEmbeddingNormalizationConfig();
    const embedding = new Float32Array([0, 0]);

    expect(() => __testing.normalizeEmbeddingIfNeeded(embedding, config)).toThrow(
      'embedding_zero_norm'
    );
  });

  it('throws on non-finite norms', () => {
    const config = __testing.resolveEmbeddingNormalizationConfig();
    const embedding = new Float32Array([Number.NaN]);

    expect(() => __testing.normalizeEmbeddingIfNeeded(embedding, config)).toThrow(
      'embedding_non_finite'
    );
  });

  it('throws on infinite norms', () => {
    const config = __testing.resolveEmbeddingNormalizationConfig();
    const embedding = new Float32Array([Number.POSITIVE_INFINITY]);

    expect(() => __testing.normalizeEmbeddingIfNeeded(embedding, config)).toThrow(
      'embedding_non_finite'
    );
  });

  it('throws on mixed non-finite values', () => {
    const config = __testing.resolveEmbeddingNormalizationConfig();
    const embedding = new Float32Array([1, Number.NaN, 2]);

    expect(() => __testing.normalizeEmbeddingIfNeeded(embedding, config)).toThrow(
      'embedding_non_finite'
    );
  });

  it('clamps negative normTolerance to zero', () => {
    const config = __testing.resolveEmbeddingNormalizationConfig({ normTolerance: -1 });
    expect(config.normTolerance).toBe(0);
  });

  it('resolves partial normalization overrides', () => {
    const config = __testing.resolveEmbeddingNormalizationConfig({ autoNormalize: false });

    expect(config.autoNormalize).toBe(false);
    expect(config.validateNormalization).toBe(true);
  });

  it('normalizes embeddings with explicit norm', () => {
    const embedding = new Float32Array([3, 4]);
    const normalized = __testing.normalizeEmbeddingWithNorm(embedding, 5);

    expect(normalized[0]).toBeCloseTo(0.6, 6);
    expect(normalized[1]).toBeCloseTo(0.8, 6);
  });

  it('throws on invalid norm during explicit normalization', () => {
    const embedding = new Float32Array([1, 2]);

    expect(() => __testing.normalizeEmbeddingWithNorm(embedding, 0)).toThrow(
      'embedding_invalid_norm'
    );
  });
});

describe('embedding norm stability', () => {
  it('handles large magnitudes without overflow', () => {
    const value = 1e38;
    const embedding = new Float32Array([value, value]);
    const expected = Math.hypot(value, value);
    const norm = __testing.computeEmbeddingNorm(embedding);

    expect(norm / expected).toBeCloseTo(1, 6);
  });

  it('handles small magnitudes without underflow', () => {
    const value = 1e-38;
    const embedding = new Float32Array([value, value]);
    const expected = Math.hypot(value, value);
    const norm = __testing.computeEmbeddingNorm(embedding);

    expect(norm / expected).toBeCloseTo(1, 6);
  });

  it('handles mixed magnitude values', () => {
    const big = 1e30;
    const small = 1e-30;
    const embedding = new Float32Array([big, small]);
    const norm = __testing.computeEmbeddingNorm(embedding);

    expect(norm / big).toBeCloseTo(1, 6);
  });
});
