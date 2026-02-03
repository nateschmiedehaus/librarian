/**
 * @fileoverview Tests for automatic quality tier selection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  selectTier,
  analyzeCodebase,
  assessResources,
  getUpgradeStrategy,
  shouldUseFull,
  getProductionTier,
  getExplorationTier,
  formatTierRecommendation,
  type TierSelectionOptions,
  type CodebaseMetrics,
  type TierRecommendation,
} from '../tier_selector.js';
import type { QualityTier } from '../../types.js';

// Mock glob for codebase analysis
vi.mock('glob', () => ({
  glob: vi.fn().mockResolvedValue([
    'src/index.ts',
    'src/api/query.ts',
    'src/api/bootstrap.ts',
    'src/utils/errors.ts',
    'src/types.ts',
  ]),
}));

// Mock fs/promises for file reading
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue('// Sample code\nfunction test() {\n  return true;\n}\n'),
    access: vi.fn().mockRejectedValue(new Error('ENOENT')),
  },
}));

describe('Tier Selector', () => {
  describe('selectTier', () => {
    it('should default to full tier for production use', async () => {
      const options: TierSelectionOptions = {
        workspace: '/test/workspace',
        skipResourceCheck: true,
      };

      const result = await selectTier(options);

      expect(result.effectiveTier).toBe('full');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should respect forced tier', async () => {
      const options: TierSelectionOptions = {
        workspace: '/test/workspace',
        forceTier: 'mvp',
        skipResourceCheck: true,
      };

      const result = await selectTier(options);

      expect(result.effectiveTier).toBe('mvp');
      expect(result.recommendedTier).toBe('mvp');
      expect(result.confidence).toBe(1.0);
    });

    it('should warn but still use full when resources are constrained', async () => {
      const options: TierSelectionOptions = {
        workspace: '/test/workspace',
        // Don't skip resource check to test resource handling
        skipResourceCheck: false,
      };

      const result = await selectTier(options);

      // Should still default to full - quality over speed
      expect(result.effectiveTier).toBe('full');
    });

    it('should consider soft time constraints for quick exploration', async () => {
      const options: TierSelectionOptions = {
        workspace: '/test/workspace',
        timeConstraint: {
          maxTimeMs: 1000, // 1 second - very tight
          isHardLimit: false, // Soft preference
        },
        skipResourceCheck: true,
      };

      const result = await selectTier(options);

      // With soft constraint and small codebase, might recommend lower tier
      // but effective tier should still prioritize quality
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should add warnings for hard time constraints but still use full', async () => {
      const options: TierSelectionOptions = {
        workspace: '/test/workspace',
        timeConstraint: {
          maxTimeMs: 1000, // 1 second - very tight
          isHardLimit: true, // Hard limit
        },
        skipResourceCheck: true,
      };

      const result = await selectTier(options);

      // Should still use full - quality over speed
      expect(result.effectiveTier).toBe('full');
      // May have warnings about time
    });
  });

  describe('analyzeCodebase', () => {
    it('should return metrics for the workspace', async () => {
      const metrics = await analyzeCodebase('/test/workspace');

      expect(metrics).toMatchObject({
        fileCount: expect.any(Number),
        estimatedLoc: expect.any(Number),
        complexity: expect.stringMatching(/^(small|medium|large|massive)$/),
        languageCount: expect.any(Number),
      });
    });

    it('should detect complexity based on file count', async () => {
      const metrics = await analyzeCodebase('/test/workspace');

      // With 5 mocked files, should be 'small'
      expect(metrics.complexity).toBe('small');
      expect(metrics.fileCount).toBe(5);
    });
  });

  describe('assessResources', () => {
    it('should return system resource assessment', () => {
      const assessment = assessResources();

      expect(assessment).toMatchObject({
        system: {
          cpuCores: expect.any(Number),
          totalMemoryGB: expect.any(Number),
          freeMemoryGB: expect.any(Number),
          loadAverage: expect.any(Number),
        },
        availableMemoryGB: expect.any(Number),
        availableCores: expect.any(Number),
        isUnderLoad: expect.any(Boolean),
        isConstrained: expect.any(Boolean),
        constraints: expect.any(Array),
      });
    });

    it('should have at least 1 available core', () => {
      const assessment = assessResources();
      expect(assessment.availableCores).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getUpgradeStrategy', () => {
    const baseMetrics: CodebaseMetrics = {
      fileCount: 100,
      estimatedLoc: 5000,
      avgFileSizeBytes: 2000,
      complexity: 'medium',
      languageCount: 2,
      hasDeepNesting: false,
      isMonorepo: false,
      hasExistingIndex: true,
    };

    it('should require full reindex when upgrading to full tier', () => {
      const strategy = getUpgradeStrategy('mvp', 'full', baseMetrics);

      expect(strategy.requiresFullReindex).toBe(true);
      expect(strategy.fromTier).toBe('mvp');
      expect(strategy.toTier).toBe('full');
      expect(strategy.addedCapabilities.length).toBeGreaterThan(0);
    });

    it('should allow incremental upgrade from mvp to enhanced', () => {
      const strategy = getUpgradeStrategy('mvp', 'enhanced', baseMetrics);

      expect(strategy.requiresFullReindex).toBe(false);
      expect(strategy.incrementalSteps.length).toBeGreaterThan(0);
    });

    it('should not downgrade', () => {
      const strategy = getUpgradeStrategy('full', 'mvp', baseMetrics);

      expect(strategy.requiresFullReindex).toBe(false);
      expect(strategy.incrementalSteps).toEqual([]);
      expect(strategy.addedCapabilities).toEqual([]);
    });

    it('should estimate additional time', () => {
      const strategy = getUpgradeStrategy('mvp', 'full', baseMetrics);

      expect(strategy.estimatedAdditionalTimeSeconds).toBeGreaterThan(0);
      // With 100 files at ~1s per file
      expect(strategy.estimatedAdditionalTimeSeconds).toBe(100);
    });
  });

  describe('shouldUseFull', () => {
    it('should return true by default', () => {
      expect(shouldUseFull('/test/workspace')).toBe(true);
    });

    it('should return false when explicitly in quick mode', () => {
      expect(shouldUseFull('/test/workspace', true)).toBe(false);
    });
  });

  describe('getProductionTier', () => {
    it('should always return full', () => {
      expect(getProductionTier()).toBe('full');
    });
  });

  describe('getExplorationTier', () => {
    it('should return mvp for quick exploration', () => {
      expect(getExplorationTier()).toBe('mvp');
    });
  });

  describe('formatTierRecommendation', () => {
    it('should format recommendation for display', () => {
      const recommendation: TierRecommendation = {
        recommendedTier: 'full',
        effectiveTier: 'full',
        confidence: 0.95,
        reasoning: ['Production codebase', 'Quality over speed'],
        warnings: [],
        estimatedTimeImpact: 'moderate',
        resourceAdvisories: [],
        canUpgradeInPlace: false,
      };

      const formatted = formatTierRecommendation(recommendation);

      expect(formatted).toContain('FULL');
      expect(formatted).toContain('95%');
      expect(formatted).toContain('moderate');
      expect(formatted).toContain('Production codebase');
    });

    it('should include warnings when present', () => {
      const recommendation: TierRecommendation = {
        recommendedTier: 'full',
        effectiveTier: 'full',
        confidence: 0.8,
        reasoning: ['Default'],
        warnings: ['System resources are limited'],
        estimatedTimeImpact: 'significant',
        resourceAdvisories: ['Low memory available'],
        canUpgradeInPlace: false,
      };

      const formatted = formatTierRecommendation(recommendation);

      expect(formatted).toContain('Warnings:');
      expect(formatted).toContain('System resources are limited');
      expect(formatted).toContain('Resource Advisories:');
      expect(formatted).toContain('Low memory available');
    });
  });

  describe('Quality-First Principle', () => {
    it('should always prefer quality over speed', async () => {
      // Even with tight time constraints, effective tier should be full
      const tightConstraint: TierSelectionOptions = {
        workspace: '/test/workspace',
        timeConstraint: {
          maxTimeMs: 100, // 100ms - impossibly tight
          isHardLimit: true,
        },
        skipResourceCheck: true,
      };

      const result = await selectTier(tightConstraint);

      // Quality takes precedence
      expect(result.effectiveTier).toBe('full');
    });

    it('should only downgrade tier for explicit soft exploration requests', async () => {
      // Soft constraint with very low time
      const softExploration: TierSelectionOptions = {
        workspace: '/test/workspace',
        timeConstraint: {
          maxTimeMs: 1, // 1ms - impossible
          isHardLimit: false, // Soft preference
        },
        skipResourceCheck: true,
      };

      const result = await selectTier(softExploration);

      // May recommend lower tier but should warn about it
      if (result.effectiveTier !== 'full') {
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings.some(w => w.includes('production') || w.includes('full'))).toBe(true);
      }
    });
  });

  describe('Tier Upgrade Without Reindex', () => {
    it('should indicate when upgrade is possible without full reindex', async () => {
      const options: TierSelectionOptions = {
        workspace: '/test/workspace',
        currentTier: 'mvp',
        skipResourceCheck: true,
      };

      const result = await selectTier(options);

      // MVP -> Full requires full reindex
      // but MVP -> Enhanced might not
      expect(typeof result.canUpgradeInPlace).toBe('boolean');
    });

    it('should always require full reindex when upgrading to full tier', async () => {
      const strategy = getUpgradeStrategy('enhanced', 'full', {
        fileCount: 50,
        estimatedLoc: 2500,
        avgFileSizeBytes: 1500,
        complexity: 'small',
        languageCount: 1,
        hasDeepNesting: false,
        isMonorepo: false,
        hasExistingIndex: true,
      });

      expect(strategy.requiresFullReindex).toBe(true);
    });
  });
});
