/**
 * @fileoverview Tests for the automatic feedback loop.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FeedbackLoop,
  createFeedbackLoop,
  inferOutcomeFromToolOutput,
  type FeedbackLoopConfig,
  type CompletionSignal,
} from '../feedback_loop.js';

// Mock dependencies
vi.mock('../wave0_integration.js', () => ({
  recordTaskOutcome: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../agent_feedback.js', () => ({
  processAgentFeedback: vi.fn().mockResolvedValue({
    feedbackId: 'test-feedback',
    processedAt: new Date().toISOString(),
    adjustmentsApplied: 0,
    gapsLogged: 0,
    adjustments: [],
    gaps: [],
  }),
  createTaskOutcomeFeedback: vi.fn().mockReturnValue({
    queryId: 'test-query',
    relevanceRatings: [],
    timestamp: new Date().toISOString(),
  }),
}));

vi.mock('../../telemetry/logger.js', () => ({
  logInfo: vi.fn(),
  logWarning: vi.fn(),
}));

// Create mock storage
function createMockStorage() {
  return {
    getContextPack: vi.fn().mockResolvedValue({
      packId: 'test-pack',
      confidence: 0.7,
    }),
    upsertContextPack: vi.fn().mockResolvedValue(undefined),
    recordContextPackAccess: vi.fn().mockResolvedValue(undefined),
    setState: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue(null),
  } as any;
}

describe('FeedbackLoop', () => {
  let feedbackLoop: FeedbackLoop;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    feedbackLoop = createFeedbackLoop({
      workspace: '/test/workspace',
      storage: mockStorage,
      emitEvents: false, // Disable events for testing
    });
  });

  afterEach(() => {
    feedbackLoop.clear();
  });

  describe('startTask', () => {
    it('should return a task ID', () => {
      const taskId = feedbackLoop.startTask('Fix bug', ['pack-1'], 0.8);
      expect(taskId).toMatch(/^task_/);
    });

    it('should track the task', () => {
      const taskId = feedbackLoop.startTask('Fix bug', ['pack-1'], 0.8);
      const task = feedbackLoop.getTask(taskId);

      expect(task).toBeDefined();
      expect(task?.intent).toBe('Fix bug');
      expect(task?.packIds).toEqual(['pack-1']);
      expect(task?.statedConfidence).toBe(0.8);
    });

    it('should clamp confidence to [0, 1]', () => {
      const taskId1 = feedbackLoop.startTask('Test', [], 1.5);
      const taskId2 = feedbackLoop.startTask('Test', [], -0.5);

      expect(feedbackLoop.getTask(taskId1)?.statedConfidence).toBe(1);
      expect(feedbackLoop.getTask(taskId2)?.statedConfidence).toBe(0);
    });
  });

  describe('recordSignal', () => {
    it('should accumulate signals for a task', () => {
      const taskId = feedbackLoop.startTask('Fix bug', ['pack-1'], 0.8);

      feedbackLoop.recordSignal(taskId, 'type_check_pass');
      feedbackLoop.recordSignal(taskId, 'lint_pass');

      const task = feedbackLoop.getTask(taskId);
      expect(task?.signals).toContain('type_check_pass');
      expect(task?.signals).toContain('lint_pass');
    });

    it('should handle unknown task gracefully', () => {
      // Should not throw
      feedbackLoop.recordSignal('unknown-task', 'test_pass');
    });
  });

  describe('recordOutcome', () => {
    it('should record successful outcome', async () => {
      const taskId = feedbackLoop.startTask('Fix bug', ['pack-1', 'pack-2'], 0.8);

      await feedbackLoop.recordOutcome({
        taskId,
        success: true,
        filesModified: ['src/foo.ts'],
      });

      // Task should be removed after completion
      expect(feedbackLoop.getTask(taskId)).toBeUndefined();
    });

    it('should record failed outcome', async () => {
      const taskId = feedbackLoop.startTask('Fix bug', ['pack-1'], 0.8);

      await feedbackLoop.recordOutcome({
        taskId,
        success: false,
        failureReason: 'Tests failed',
        failureType: 'test_failure',
      });

      expect(feedbackLoop.getTask(taskId)).toBeUndefined();
    });

    it('should deduplicate outcomes', async () => {
      const taskId = feedbackLoop.startTask('Fix bug', ['pack-1'], 0.8);

      await feedbackLoop.recordOutcome({ taskId, success: true });
      await feedbackLoop.recordOutcome({ taskId, success: false }); // Should be ignored

      const stats = feedbackLoop.getStats();
      expect(stats.recentOutcomes).toBe(1);
    });

    it('should work without a tracked task', async () => {
      await feedbackLoop.recordOutcome({
        taskId: 'untracked-task',
        success: true,
        packIds: ['pack-1'],
        intent: 'Direct feedback',
      });

      const stats = feedbackLoop.getStats();
      expect(stats.recentOutcomes).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return current statistics', async () => {
      feedbackLoop.startTask('Task 1', ['pack-1'], 0.8);
      feedbackLoop.startTask('Task 2', ['pack-2'], 0.7);

      const stats = feedbackLoop.getStats();
      expect(stats.activeTasks).toBe(2);
      expect(stats.recentOutcomes).toBe(0);
    });

    it('should track success rate', async () => {
      const taskId1 = feedbackLoop.startTask('Task 1', ['pack-1'], 0.8);
      const taskId2 = feedbackLoop.startTask('Task 2', ['pack-2'], 0.7);
      const taskId3 = feedbackLoop.startTask('Task 3', ['pack-3'], 0.6);

      await feedbackLoop.recordOutcome({ taskId: taskId1, success: true });
      await feedbackLoop.recordOutcome({ taskId: taskId2, success: true });
      await feedbackLoop.recordOutcome({ taskId: taskId3, success: false });

      const stats = feedbackLoop.getStats();
      expect(stats.recentOutcomes).toBe(3);
      expect(stats.recentSuccessRate).toBeCloseTo(2 / 3);
    });
  });

  describe('analyzeBias', () => {
    it('should return well-calibrated without data', async () => {
      const bias = await feedbackLoop.analyzeBias();

      expect(bias.direction).toBe('well-calibrated');
      expect(bias.sampleCount).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all tracking state', async () => {
      feedbackLoop.startTask('Task 1', ['pack-1'], 0.8);
      await feedbackLoop.recordOutcome({
        taskId: 'direct-task',
        success: true,
        packIds: [],
      });

      feedbackLoop.clear();

      const stats = feedbackLoop.getStats();
      expect(stats.activeTasks).toBe(0);
      expect(stats.recentOutcomes).toBe(0);
    });
  });
});

describe('inferOutcomeFromToolOutput', () => {
  it('should infer success from passing tests', () => {
    const result = inferOutcomeFromToolOutput({
      testOutput: { exitCode: 0, failureCount: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.signals).toContain('test_pass');
  });

  it('should infer failure from failing tests', () => {
    const result = inferOutcomeFromToolOutput({
      testOutput: { exitCode: 1, failureCount: 3 },
    });

    expect(result.success).toBe(false);
    expect(result.signals).toContain('test_fail');
  });

  it('should infer failure from type errors', () => {
    const result = inferOutcomeFromToolOutput({
      typeCheckOutput: { exitCode: 1, errorCount: 5 },
    });

    expect(result.success).toBe(false);
    expect(result.signals).toContain('type_check_fail');
  });

  it('should combine multiple signals', () => {
    const result = inferOutcomeFromToolOutput({
      testOutput: { exitCode: 0, failureCount: 0 },
      typeCheckOutput: { exitCode: 0, errorCount: 0 },
      lintOutput: { exitCode: 0, errorCount: 0 },
      buildOutput: { exitCode: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.signals).toHaveLength(4);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should weight test failures higher than lint failures', () => {
    // Test fail + lint pass should be failure
    const result1 = inferOutcomeFromToolOutput({
      testOutput: { exitCode: 1, failureCount: 1 },
      lintOutput: { exitCode: 0, errorCount: 0 },
    });

    expect(result1.success).toBe(false);

    // Test pass + lint fail should be success (tests are more important)
    const result2 = inferOutcomeFromToolOutput({
      testOutput: { exitCode: 0, failureCount: 0 },
      lintOutput: { exitCode: 1, errorCount: 5 },
    });

    expect(result2.success).toBe(true);
  });

  it('should return default confidence with no signals', () => {
    const result = inferOutcomeFromToolOutput({});

    // With no signals, confidence is based on no score difference (0.5 base + 0 delta = 0.5 effective)
    // but gets clamped to [0.1, 0.95] in the formula: 0.5 + confidence * 0.4
    // With confidence=0 (no score diff), we get 0.5 + 0*0.4 = 0.5
    // However, the success flag is determined first (successScore > failureScore)
    // With both 0, success defaults to false, and min(0.95, max(0.1, 0.5 + 0.5 * 0.4)) = 0.7
    expect(result.confidence).toBeCloseTo(0.7, 1);
    expect(result.signals).toHaveLength(0);
  });
});

describe('Signal inference in FeedbackLoop', () => {
  it('should auto-infer success from test_pass signal', async () => {
    const mockStorage = createMockStorage();
    const loop = createFeedbackLoop({
      workspace: '/test',
      storage: mockStorage,
      autoInfer: true,
      emitEvents: false,
    });

    const taskId = loop.startTask('Test task', [], 0.8);
    loop.recordSignal(taskId, 'test_pass');

    // Give it a tick to process
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Task should be completed
    expect(loop.getTask(taskId)).toBeUndefined();
  });

  it('should auto-infer failure from test_fail signal', async () => {
    const mockStorage = createMockStorage();
    const loop = createFeedbackLoop({
      workspace: '/test',
      storage: mockStorage,
      autoInfer: true,
      emitEvents: false,
    });

    const taskId = loop.startTask('Test task', [], 0.8);
    loop.recordSignal(taskId, 'test_fail');

    // Give it a tick to process
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Task should be completed
    expect(loop.getTask(taskId)).toBeUndefined();
  });

  it('should not auto-infer from inconclusive signals', () => {
    const mockStorage = createMockStorage();
    const loop = createFeedbackLoop({
      workspace: '/test',
      storage: mockStorage,
      autoInfer: true,
      emitEvents: false,
    });

    const taskId = loop.startTask('Test task', [], 0.8);
    loop.recordSignal(taskId, 'file_saved');

    // Task should still exist
    expect(loop.getTask(taskId)).toBeDefined();
  });
});
