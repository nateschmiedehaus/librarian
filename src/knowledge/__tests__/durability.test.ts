/**
 * @fileoverview Tests for Durability Classification System
 *
 * Comprehensive tests covering:
 * - Basic classification (IMMUTABLE, STABLE, VOLATILE)
 * - Revalidation decisions
 * - Priority assignment
 * - Batch classification
 * - Statistics tracking
 * - Edge cases and boundary conditions
 * - Custom configuration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FileDurability,
  DurabilityConfig,
  classifyDurability,
  isImmutablePath,
  shouldRevalidate,
  getRevalidationPriority,
  getRevalidationDecision,
  createEmptyStats,
  updateStats,
  calculateSkipPercentage,
  classifyBatch,
  DurabilityTracker,
  createDurabilityTracker,
  DEFAULT_DURABILITY_CONFIG,
  REVALIDATION_PRIORITY,
} from '../durability.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a date that is a certain number of hours in the past.
 */
function hoursAgo(hours: number, from?: Date): Date {
  const base = from ?? new Date();
  return new Date(base.getTime() - hours * 60 * 60 * 1000);
}

/**
 * Create a date that is a certain number of minutes in the past.
 */
function minutesAgo(minutes: number, from?: Date): Date {
  const base = from ?? new Date();
  return new Date(base.getTime() - minutes * 60 * 1000);
}

/**
 * Create a date that is a certain number of days in the past.
 */
function daysAgo(days: number, from?: Date): Date {
  return hoursAgo(days * 24, from);
}

// ============================================================================
// BASIC CLASSIFICATION TESTS
// ============================================================================

describe('classifyDurability', () => {
  const now = new Date('2024-06-15T12:00:00Z');

  describe('IMMUTABLE classification', () => {
    it('classifies node_modules as IMMUTABLE', () => {
      const result = classifyDurability(
        'node_modules/lodash/index.js',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies nested node_modules as IMMUTABLE', () => {
      const result = classifyDurability(
        'packages/core/node_modules/@types/node/index.d.ts',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies .git directory as IMMUTABLE', () => {
      const result = classifyDurability(
        '.git/objects/pack/pack-abc123.idx',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies vendor directory as IMMUTABLE', () => {
      const result = classifyDurability(
        'vendor/github.com/pkg/errors/errors.go',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies dist directory as IMMUTABLE', () => {
      const result = classifyDurability(
        'dist/index.js',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies build directory as IMMUTABLE', () => {
      const result = classifyDurability(
        'build/static/js/main.chunk.js',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies package-lock.json as IMMUTABLE', () => {
      const result = classifyDurability(
        'package-lock.json',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies yarn.lock as IMMUTABLE', () => {
      const result = classifyDurability(
        'yarn.lock',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies pnpm-lock.yaml as IMMUTABLE', () => {
      const result = classifyDurability(
        'pnpm-lock.yaml',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies Cargo.lock as IMMUTABLE', () => {
      const result = classifyDurability(
        'Cargo.lock',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies go.sum as IMMUTABLE', () => {
      const result = classifyDurability(
        'go.sum',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies Python venv as IMMUTABLE', () => {
      const result = classifyDurability(
        '.venv/lib/python3.11/site-packages/requests/api.py',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies __pycache__ as IMMUTABLE', () => {
      const result = classifyDurability(
        'src/__pycache__/main.cpython-311.pyc',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies coverage directory as IMMUTABLE', () => {
      const result = classifyDurability(
        'coverage/lcov.info',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('classifies .next directory as IMMUTABLE', () => {
      const result = classifyDurability(
        '.next/cache/webpack/server-development.pack',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });
  });

  describe('VOLATILE classification', () => {
    it('classifies recently edited source file as VOLATILE', () => {
      const result = classifyDurability(
        'src/index.ts',
        minutesAgo(5, now), // 5 minutes ago
        undefined,
        now
      );
      expect(result).toBe(FileDurability.VOLATILE);
    });

    it('classifies file modified just now as VOLATILE', () => {
      const result = classifyDurability(
        'src/components/Button.tsx',
        now,
        undefined,
        now
      );
      expect(result).toBe(FileDurability.VOLATILE);
    });

    it('classifies file modified 29 minutes ago as VOLATILE', () => {
      const result = classifyDurability(
        'src/utils/helpers.ts',
        minutesAgo(29, now),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.VOLATILE);
    });

    it('classifies file modified 1 hour ago as VOLATILE (between thresholds)', () => {
      const result = classifyDurability(
        'src/api/client.ts',
        hoursAgo(1, now),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.VOLATILE);
    });

    it('classifies file modified 12 hours ago as VOLATILE (between thresholds)', () => {
      const result = classifyDurability(
        'src/services/auth.ts',
        hoursAgo(12, now),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.VOLATILE);
    });
  });

  describe('STABLE classification', () => {
    it('classifies file unchanged for 24+ hours as STABLE', () => {
      const result = classifyDurability(
        'src/constants.ts',
        hoursAgo(25, now), // 25 hours ago
        undefined,
        now
      );
      expect(result).toBe(FileDurability.STABLE);
    });

    it('classifies file unchanged for exactly 24 hours as STABLE', () => {
      const result = classifyDurability(
        'src/types.ts',
        hoursAgo(24, now),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.STABLE);
    });

    it('classifies file unchanged for days as STABLE', () => {
      const result = classifyDurability(
        'src/config.ts',
        daysAgo(7, now), // 7 days ago
        undefined,
        now
      );
      expect(result).toBe(FileDurability.STABLE);
    });

    it('classifies file unchanged for weeks as STABLE', () => {
      const result = classifyDurability(
        'src/legacy/oldModule.ts',
        daysAgo(30, now), // 30 days ago
        undefined,
        now
      );
      expect(result).toBe(FileDurability.STABLE);
    });
  });

  describe('boundary conditions', () => {
    it('classifies file at exactly 30 minutes as STABLE-ish (boundary)', () => {
      // Exactly 30 minutes is >= threshold, so it should NOT be volatile
      // But it's also < 24 hours, so it defaults to VOLATILE
      const result = classifyDurability(
        'src/boundary.ts',
        minutesAgo(30, now),
        undefined,
        now
      );
      // At exactly 30 minutes, it's no longer "recently modified" (< 30 min)
      // but also not stable yet (< 24 hours), so defaults to VOLATILE
      expect(result).toBe(FileDurability.VOLATILE);
    });

    it('classifies file at 31 minutes as VOLATILE (between thresholds)', () => {
      const result = classifyDurability(
        'src/boundary2.ts',
        minutesAgo(31, now),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.VOLATILE);
    });

    it('classifies file at 23 hours 59 minutes as VOLATILE', () => {
      const result = classifyDurability(
        'src/almostStable.ts',
        hoursAgo(23.98, now), // Just under 24 hours
        undefined,
        now
      );
      expect(result).toBe(FileDurability.VOLATILE);
    });

    it('classifies file at 24 hours 1 minute as STABLE', () => {
      const result = classifyDurability(
        'src/justStable.ts',
        hoursAgo(24.02, now), // Just over 24 hours
        undefined,
        now
      );
      expect(result).toBe(FileDurability.STABLE);
    });
  });

  describe('path normalization', () => {
    it('handles Windows-style paths', () => {
      const result = classifyDurability(
        'node_modules\\lodash\\index.js',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('handles mixed path separators', () => {
      const result = classifyDurability(
        'packages/core\\node_modules/pkg/index.js',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });

    it('handles absolute paths', () => {
      const result = classifyDurability(
        '/home/user/project/node_modules/lodash/index.js',
        new Date(),
        undefined,
        now
      );
      expect(result).toBe(FileDurability.IMMUTABLE);
    });
  });
});

// ============================================================================
// IMMUTABLE PATH DETECTION TESTS
// ============================================================================

describe('isImmutablePath', () => {
  it('returns true for node_modules paths', () => {
    expect(isImmutablePath('node_modules/lodash/index.js', DEFAULT_DURABILITY_CONFIG.immutablePatterns)).toBe(true);
  });

  it('returns false for source files', () => {
    expect(isImmutablePath('src/index.ts', DEFAULT_DURABILITY_CONFIG.immutablePatterns)).toBe(false);
  });

  it('returns true for lock files', () => {
    expect(isImmutablePath('package-lock.json', DEFAULT_DURABILITY_CONFIG.immutablePatterns)).toBe(true);
    expect(isImmutablePath('yarn.lock', DEFAULT_DURABILITY_CONFIG.immutablePatterns)).toBe(true);
  });

  it('returns false for package.json (not a lock file)', () => {
    expect(isImmutablePath('package.json', DEFAULT_DURABILITY_CONFIG.immutablePatterns)).toBe(false);
  });

  it('handles empty patterns array', () => {
    expect(isImmutablePath('node_modules/lodash/index.js', [])).toBe(false);
  });
});

// ============================================================================
// REVALIDATION TESTS
// ============================================================================

describe('shouldRevalidate', () => {
  const now = new Date('2024-06-15T12:00:00Z');

  it('returns false for IMMUTABLE files (never validated)', () => {
    const result = shouldRevalidate(FileDurability.IMMUTABLE, null, now);
    expect(result).toBe(false);
  });

  it('returns false for IMMUTABLE files (recently validated)', () => {
    const result = shouldRevalidate(FileDurability.IMMUTABLE, minutesAgo(1, now), now);
    expect(result).toBe(false);
  });

  it('returns true for VOLATILE files never validated', () => {
    const result = shouldRevalidate(FileDurability.VOLATILE, null, now);
    expect(result).toBe(true);
  });

  it('returns true for VOLATILE files validated more than 5 minutes ago', () => {
    const result = shouldRevalidate(FileDurability.VOLATILE, minutesAgo(6, now), now);
    expect(result).toBe(true);
  });

  it('returns false for VOLATILE files validated within 5 minutes', () => {
    const result = shouldRevalidate(FileDurability.VOLATILE, minutesAgo(4, now), now);
    expect(result).toBe(false);
  });

  it('returns true for STABLE files never validated', () => {
    const result = shouldRevalidate(FileDurability.STABLE, null, now);
    expect(result).toBe(true);
  });

  it('returns true for STABLE files validated more than 1 hour ago', () => {
    const result = shouldRevalidate(FileDurability.STABLE, hoursAgo(2, now), now);
    expect(result).toBe(true);
  });

  it('returns false for STABLE files validated within 1 hour', () => {
    const result = shouldRevalidate(FileDurability.STABLE, minutesAgo(30, now), now);
    expect(result).toBe(false);
  });

  describe('boundary conditions', () => {
    it('VOLATILE at exactly 5 minutes returns false', () => {
      const result = shouldRevalidate(FileDurability.VOLATILE, minutesAgo(5, now), now);
      expect(result).toBe(false);
    });

    it('STABLE at exactly 1 hour returns false', () => {
      const result = shouldRevalidate(FileDurability.STABLE, hoursAgo(1, now), now);
      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// PRIORITY TESTS
// ============================================================================

describe('getRevalidationPriority', () => {
  it('returns 0 for IMMUTABLE files', () => {
    expect(getRevalidationPriority(FileDurability.IMMUTABLE)).toBe(REVALIDATION_PRIORITY.IMMUTABLE);
    expect(getRevalidationPriority(FileDurability.IMMUTABLE)).toBe(0);
  });

  it('returns 1 for STABLE files', () => {
    expect(getRevalidationPriority(FileDurability.STABLE)).toBe(REVALIDATION_PRIORITY.STABLE);
    expect(getRevalidationPriority(FileDurability.STABLE)).toBe(1);
  });

  it('returns 10 for VOLATILE files', () => {
    expect(getRevalidationPriority(FileDurability.VOLATILE)).toBe(REVALIDATION_PRIORITY.VOLATILE);
    expect(getRevalidationPriority(FileDurability.VOLATILE)).toBe(10);
  });

  it('VOLATILE priority is higher than STABLE', () => {
    expect(getRevalidationPriority(FileDurability.VOLATILE))
      .toBeGreaterThan(getRevalidationPriority(FileDurability.STABLE));
  });

  it('STABLE priority is higher than IMMUTABLE', () => {
    expect(getRevalidationPriority(FileDurability.STABLE))
      .toBeGreaterThan(getRevalidationPriority(FileDurability.IMMUTABLE));
  });
});

// ============================================================================
// REVALIDATION DECISION TESTS
// ============================================================================

describe('getRevalidationDecision', () => {
  const now = new Date('2024-06-15T12:00:00Z');

  it('returns correct decision for IMMUTABLE file', () => {
    const decision = getRevalidationDecision(
      'node_modules/lodash/index.js',
      new Date(),
      null,
      undefined,
      now
    );

    expect(decision.shouldRevalidate).toBe(false);
    expect(decision.priority).toBe(0);
    expect(decision.reason).toContain('immutable');
  });

  it('returns correct decision for never-validated VOLATILE file', () => {
    const decision = getRevalidationDecision(
      'src/index.ts',
      minutesAgo(5, now),
      null,
      undefined,
      now
    );

    expect(decision.shouldRevalidate).toBe(true);
    expect(decision.priority).toBe(10);
    expect(decision.reason).toContain('never been validated');
  });

  it('returns correct decision for recently validated STABLE file', () => {
    const decision = getRevalidationDecision(
      'src/constants.ts',
      hoursAgo(48, now), // Modified 2 days ago
      minutesAgo(30, now), // Validated 30 minutes ago
      undefined,
      now
    );

    expect(decision.shouldRevalidate).toBe(false);
    expect(decision.priority).toBe(1);
    expect(decision.reason).toContain('recently validated');
  });
});

// ============================================================================
// STATISTICS TESTS
// ============================================================================

describe('statistics functions', () => {
  describe('createEmptyStats', () => {
    it('creates stats with all counts at zero', () => {
      const stats = createEmptyStats();

      expect(stats.byDurability[FileDurability.IMMUTABLE]).toBe(0);
      expect(stats.byDurability[FileDurability.STABLE]).toBe(0);
      expect(stats.byDurability[FileDurability.VOLATILE]).toBe(0);
      expect(stats.skippedImmutable).toBe(0);
      expect(stats.batchedStable).toBe(0);
      expect(stats.prioritizedVolatile).toBe(0);
    });
  });

  describe('updateStats', () => {
    it('increments IMMUTABLE count and skipped count', () => {
      const stats = createEmptyStats();
      updateStats(stats, FileDurability.IMMUTABLE, false);

      expect(stats.byDurability[FileDurability.IMMUTABLE]).toBe(1);
      expect(stats.skippedImmutable).toBe(1);
    });

    it('increments STABLE count and batched count when not revalidated', () => {
      const stats = createEmptyStats();
      updateStats(stats, FileDurability.STABLE, false);

      expect(stats.byDurability[FileDurability.STABLE]).toBe(1);
      expect(stats.batchedStable).toBe(1);
    });

    it('increments VOLATILE count and prioritized count when revalidated', () => {
      const stats = createEmptyStats();
      updateStats(stats, FileDurability.VOLATILE, true);

      expect(stats.byDurability[FileDurability.VOLATILE]).toBe(1);
      expect(stats.prioritizedVolatile).toBe(1);
    });

    it('does not increment batched when STABLE is revalidated', () => {
      const stats = createEmptyStats();
      updateStats(stats, FileDurability.STABLE, true);

      expect(stats.byDurability[FileDurability.STABLE]).toBe(1);
      expect(stats.batchedStable).toBe(0);
    });
  });

  describe('calculateSkipPercentage', () => {
    it('returns 0 for empty stats', () => {
      const stats = createEmptyStats();
      expect(calculateSkipPercentage(stats)).toBe(0);
    });

    it('returns 100 when all files are immutable', () => {
      const stats = createEmptyStats();
      stats.byDurability[FileDurability.IMMUTABLE] = 10;
      stats.skippedImmutable = 10;
      expect(calculateSkipPercentage(stats)).toBe(100);
    });

    it('returns 70 for 70% skip rate', () => {
      const stats = createEmptyStats();
      stats.byDurability[FileDurability.IMMUTABLE] = 50;
      stats.byDurability[FileDurability.STABLE] = 20;
      stats.byDurability[FileDurability.VOLATILE] = 30;
      stats.skippedImmutable = 50;
      stats.batchedStable = 20;

      expect(calculateSkipPercentage(stats)).toBe(70);
    });

    it('returns 0 when all files are volatile', () => {
      const stats = createEmptyStats();
      stats.byDurability[FileDurability.VOLATILE] = 10;
      stats.prioritizedVolatile = 10;
      expect(calculateSkipPercentage(stats)).toBe(0);
    });
  });
});

// ============================================================================
// BATCH CLASSIFICATION TESTS
// ============================================================================

describe('classifyBatch', () => {
  const now = new Date('2024-06-15T12:00:00Z');

  it('sorts files into correct buckets', () => {
    const files = [
      { path: 'node_modules/lodash/index.js', lastModified: new Date(), lastValidated: null },
      { path: 'src/index.ts', lastModified: minutesAgo(5, now), lastValidated: null },
      { path: 'src/constants.ts', lastModified: hoursAgo(48, now), lastValidated: minutesAgo(30, now) },
    ];

    const result = classifyBatch(files, undefined, now);

    expect(result.skip).toContain('node_modules/lodash/index.js');
    expect(result.priority).toContain('src/index.ts');
    expect(result.batch).toContain('src/constants.ts');
  });

  it('returns correct statistics', () => {
    const files = [
      { path: 'node_modules/a/index.js', lastModified: new Date(), lastValidated: null },
      { path: 'node_modules/b/index.js', lastModified: new Date(), lastValidated: null },
      { path: 'src/a.ts', lastModified: minutesAgo(5, now), lastValidated: null },
      { path: 'src/b.ts', lastModified: hoursAgo(48, now), lastValidated: minutesAgo(30, now) },
    ];

    const result = classifyBatch(files, undefined, now);

    expect(result.stats.byDurability[FileDurability.IMMUTABLE]).toBe(2);
    expect(result.stats.byDurability[FileDurability.VOLATILE]).toBe(1);
    expect(result.stats.byDurability[FileDurability.STABLE]).toBe(1);
    expect(result.stats.skippedImmutable).toBe(2);
  });

  it('handles empty input', () => {
    const result = classifyBatch([], undefined, now);

    expect(result.skip).toHaveLength(0);
    expect(result.batch).toHaveLength(0);
    expect(result.priority).toHaveLength(0);
  });

  it('puts stable files needing revalidation in priority', () => {
    const files = [
      { path: 'src/old.ts', lastModified: hoursAgo(48, now), lastValidated: hoursAgo(2, now) },
    ];

    const result = classifyBatch(files, undefined, now);

    // Stable file that was validated >1 hour ago should be in priority
    expect(result.priority).toContain('src/old.ts');
    expect(result.batch).not.toContain('src/old.ts');
  });
});

// ============================================================================
// DURABILITY TRACKER TESTS
// ============================================================================

describe('DurabilityTracker', () => {
  let tracker: DurabilityTracker;
  const now = new Date('2024-06-15T12:00:00Z');

  beforeEach(() => {
    tracker = createDurabilityTracker();
  });

  describe('classify', () => {
    it('returns correct decision and tracks classification', () => {
      const decision = tracker.classify(
        'src/index.ts',
        minutesAgo(5, now),
        null,
        now
      );

      expect(decision.shouldRevalidate).toBe(true);
      expect(decision.priority).toBe(10);
      expect(tracker.getDurability('src/index.ts')).toBe(FileDurability.VOLATILE);
    });

    it('updates statistics', () => {
      tracker.classify('node_modules/lodash/index.js', new Date(), null, now);
      tracker.classify('src/index.ts', minutesAgo(5, now), null, now);

      const stats = tracker.getStats();
      expect(stats.byDurability[FileDurability.IMMUTABLE]).toBe(1);
      expect(stats.byDurability[FileDurability.VOLATILE]).toBe(1);
    });
  });

  describe('markValidated', () => {
    it('marks a file as validated', () => {
      tracker.markValidated('src/index.ts', now);

      // The file should be tracked
      // (Note: markValidated doesn't classify, it just records validation time)
    });
  });

  describe('getStats', () => {
    it('returns a copy of statistics', () => {
      tracker.classify('src/index.ts', minutesAgo(5, now), null, now);

      const stats1 = tracker.getStats();
      const stats2 = tracker.getStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      tracker.classify('src/index.ts', minutesAgo(5, now), null, now);
      tracker.reset();

      expect(tracker.getDurability('src/index.ts')).toBeUndefined();
      expect(tracker.getStats().byDurability[FileDurability.VOLATILE]).toBe(0);
    });
  });

  describe('getFilesByDurability', () => {
    it('returns files of specific durability', () => {
      tracker.classify('node_modules/a/index.js', new Date(), null, now);
      tracker.classify('node_modules/b/index.js', new Date(), null, now);
      tracker.classify('src/index.ts', minutesAgo(5, now), null, now);

      const immutableFiles = tracker.getFilesByDurability(FileDurability.IMMUTABLE);
      expect(immutableFiles).toHaveLength(2);
      expect(immutableFiles).toContain('node_modules/a/index.js');
      expect(immutableFiles).toContain('node_modules/b/index.js');

      const volatileFiles = tracker.getFilesByDurability(FileDurability.VOLATILE);
      expect(volatileFiles).toHaveLength(1);
      expect(volatileFiles).toContain('src/index.ts');
    });
  });

  describe('updateConfig', () => {
    it('merges new config with existing', () => {
      tracker.updateConfig({ stableThresholdHours: 48 });

      const config = tracker.getConfig();
      expect(config.stableThresholdHours).toBe(48);
      // Other defaults should remain
      expect(config.volatileThresholdMinutes).toBe(DEFAULT_DURABILITY_CONFIG.volatileThresholdMinutes);
    });
  });

  describe('getConfig', () => {
    it('returns a copy of config', () => {
      const config1 = tracker.getConfig();
      const config2 = tracker.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});

// ============================================================================
// CUSTOM CONFIGURATION TESTS
// ============================================================================

describe('custom configuration', () => {
  const now = new Date('2024-06-15T12:00:00Z');

  it('respects custom immutable patterns', () => {
    const config: DurabilityConfig = {
      ...DEFAULT_DURABILITY_CONFIG,
      immutablePatterns: ['**/custom_vendor/**', '**/generated/**'],
    };

    // Custom pattern should match
    expect(classifyDurability('custom_vendor/lib.js', new Date(), config, now))
      .toBe(FileDurability.IMMUTABLE);

    // node_modules should NOT match (not in custom patterns)
    expect(classifyDurability('node_modules/lodash/index.js', minutesAgo(5, now), config, now))
      .toBe(FileDurability.VOLATILE);
  });

  it('respects custom stable threshold', () => {
    const config: DurabilityConfig = {
      ...DEFAULT_DURABILITY_CONFIG,
      stableThresholdHours: 12, // Lower threshold
    };

    // 13 hours should be stable with 12-hour threshold
    expect(classifyDurability('src/index.ts', hoursAgo(13, now), config, now))
      .toBe(FileDurability.STABLE);

    // 13 hours would NOT be stable with default 24-hour threshold
    expect(classifyDurability('src/index.ts', hoursAgo(13, now), undefined, now))
      .toBe(FileDurability.VOLATILE);
  });

  it('respects custom volatile threshold', () => {
    const config: DurabilityConfig = {
      ...DEFAULT_DURABILITY_CONFIG,
      volatileThresholdMinutes: 60, // Higher threshold
    };

    // 45 minutes should still be volatile with 60-minute threshold
    expect(classifyDurability('src/index.ts', minutesAgo(45, now), config, now))
      .toBe(FileDurability.VOLATILE);

    // 45 minutes would NOT be volatile with default 30-minute threshold
    // (but would still be volatile since it's between thresholds)
    expect(classifyDurability('src/index.ts', minutesAgo(45, now), undefined, now))
      .toBe(FileDurability.VOLATILE);
  });

  it('works with DurabilityTracker', () => {
    const config: DurabilityConfig = {
      immutablePatterns: ['**/libs/**'],
      stableThresholdHours: 12,
      volatileThresholdMinutes: 60,
    };

    const tracker = createDurabilityTracker(config);

    // Should use custom patterns
    tracker.classify('libs/core.js', new Date(), null, now);
    expect(tracker.getDurability('libs/core.js')).toBe(FileDurability.IMMUTABLE);
  });
});

// ============================================================================
// PERFORMANCE CHARACTERISTICS TESTS
// ============================================================================

describe('performance characteristics', () => {
  it('classification is fast (< 1ms per file)', () => {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      classifyDurability(`src/file${i}.ts`, new Date(), undefined, new Date());
    }

    const elapsed = performance.now() - start;
    const perFile = elapsed / iterations;

    // Should be well under 1ms per file
    expect(perFile).toBeLessThan(1);
  });

  it('batch classification handles large sets efficiently', () => {
    const files = Array.from({ length: 10000 }, (_, i) => ({
      path: `src/file${i}.ts`,
      lastModified: new Date(),
      lastValidated: null as Date | null,
    }));

    const start = performance.now();
    const result = classifyBatch(files);
    const elapsed = performance.now() - start;

    // Should complete in reasonable time (< 2s for 10k files, accounting for system load)
    // In ideal conditions this should be < 100ms, but we allow more headroom for CI/memory pressure
    expect(elapsed).toBeLessThan(2000);
    expect(result.priority.length + result.skip.length + result.batch.length).toBe(10000);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('edge cases', () => {
  const now = new Date('2024-06-15T12:00:00Z');

  it('handles future modification dates', () => {
    const futureDate = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour in future

    // Future dates should be treated as volatile (most recent possible)
    const result = classifyDurability('src/index.ts', futureDate, undefined, now);
    expect(result).toBe(FileDurability.VOLATILE);
  });

  it('handles very old modification dates', () => {
    const veryOld = new Date('1970-01-01T00:00:00Z');

    const result = classifyDurability('src/ancient.ts', veryOld, undefined, now);
    expect(result).toBe(FileDurability.STABLE);
  });

  it('handles empty path', () => {
    const result = classifyDurability('', new Date(), undefined, now);
    // Empty path should not match immutable patterns, so it's based on time
    expect(result).toBe(FileDurability.VOLATILE);
  });

  it('handles paths with special characters', () => {
    const result = classifyDurability(
      'src/components/[id]/page.tsx',
      minutesAgo(5, now),
      undefined,
      now
    );
    expect(result).toBe(FileDurability.VOLATILE);
  });

  it('handles paths with unicode characters', () => {
    const result = classifyDurability(
      'src/i18n/translations/日本語.json',
      minutesAgo(5, now),
      undefined,
      now
    );
    expect(result).toBe(FileDurability.VOLATILE);
  });

  it('handles very long paths', () => {
    const longPath = 'src/' + 'deeply/nested/'.repeat(50) + 'file.ts';
    const result = classifyDurability(longPath, minutesAgo(5, now), undefined, now);
    expect(result).toBe(FileDurability.VOLATILE);
  });
});

// ============================================================================
// INTEGRATION WITH EXISTING PATTERNS
// ============================================================================

describe('integration patterns', () => {
  it('default config covers common immutable directories', () => {
    const commonImmutablePaths = [
      'node_modules/express/index.js',
      '.git/HEAD',
      'vendor/autoload.php',
      'dist/bundle.js',
      'build/app.js',
      'coverage/lcov.info',
      '.venv/bin/python',
      '__pycache__/module.pyc',
    ];

    for (const path of commonImmutablePaths) {
      expect(classifyDurability(path, new Date())).toBe(FileDurability.IMMUTABLE);
    }
  });

  it('default config does not mark source files as immutable', () => {
    const sourcePaths = [
      'src/index.ts',
      'lib/utils.js',
      'app/main.py',
      'pkg/server.go',
      'tests/test_app.py',
    ];

    for (const path of sourcePaths) {
      const result = classifyDurability(path, new Date());
      expect(result).not.toBe(FileDurability.IMMUTABLE);
    }
  });
});
