/**
 * @fileoverview Tests for the auto-wired feedback loop.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  createAutoWiredFeedbackLoop,
  initAutoWiredFeedbackLoop,
  type WirableFileWatcher,
  type AutoWiredFeedbackLoopHandle,
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

// Import after mock to get the mocked functions
import { logInfo, logWarning } from '../../telemetry/logger.js';

// Cast to mocks for type safety in tests
const mockLogInfo = logInfo as Mock;
const mockLogWarning = logWarning as Mock;

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

// Create mock file watcher
function createMockWatcher(): WirableFileWatcher & {
  handlers: Set<(event: { type: string; path: string }) => void | Promise<void>>;
  simulateChange(type: string, path: string): void;
} {
  const handlers = new Set<(event: { type: string; path: string }) => void | Promise<void>>();

  return {
    handlers,
    onFileChange(handler: (event: { type: string; path: string }) => void | Promise<void>): () => void {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    simulateChange(type: string, path: string): void {
      for (const handler of handlers) {
        handler({ type, path });
      }
    },
  };
}

describe('createAutoWiredFeedbackLoop', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;
  let mockWatcher: ReturnType<typeof createMockWatcher>;
  let handle: AutoWiredFeedbackLoopHandle;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockWatcher = createMockWatcher();
    mockLogInfo.mockClear();
    mockLogWarning.mockClear();
  });

  afterEach(() => {
    if (handle) {
      handle.disconnect();
    }
  });

  it('should create a feedback loop and connect to watcher', () => {
    handle = createAutoWiredFeedbackLoop(
      {
        workspace: '/test/workspace',
        storage: mockStorage,
        emitEvents: false,
      },
      mockWatcher
    );

    expect(handle.loop).toBeDefined();
    expect(handle.connected).toBe(true);
    expect(mockWatcher.handlers.size).toBe(1);
  });

  it('should disconnect from watcher when disconnect is called', () => {
    handle = createAutoWiredFeedbackLoop(
      {
        workspace: '/test/workspace',
        storage: mockStorage,
        emitEvents: false,
      },
      mockWatcher
    );

    expect(mockWatcher.handlers.size).toBe(1);
    expect(handle.connected).toBe(true);

    handle.disconnect();

    expect(mockWatcher.handlers.size).toBe(0);
    expect(handle.connected).toBe(false);
  });

  it('should receive file change events', () => {
    handle = createAutoWiredFeedbackLoop(
      {
        workspace: '/test/workspace',
        storage: mockStorage,
        emitEvents: false,
      },
      mockWatcher
    );

    mockWatcher.simulateChange('modified', '/test/workspace/src/foo.ts');

    expect(mockLogInfo).toHaveBeenCalledWith(
      '[feedback_loop] File watcher signal received',
      expect.objectContaining({
        type: 'modified',
        path: '/test/workspace/src/foo.ts',
      })
    );
  });

  it('should not process events after disconnect', () => {
    handle = createAutoWiredFeedbackLoop(
      {
        workspace: '/test/workspace',
        storage: mockStorage,
        emitEvents: false,
      },
      mockWatcher
    );

    // Trigger one event first to verify it works
    mockWatcher.simulateChange('modified', '/test/workspace/src/before.ts');
    expect(mockLogInfo).toHaveBeenCalled();

    handle.disconnect();

    // Clear previous calls
    mockLogInfo.mockClear();

    // After disconnect, no more events should be logged
    // Note: handlers are removed, so simulateChange won't call anything
    expect(mockWatcher.handlers.size).toBe(0);
  });

  it('should allow task tracking through the loop', async () => {
    handle = createAutoWiredFeedbackLoop(
      {
        workspace: '/test/workspace',
        storage: mockStorage,
        emitEvents: false,
      },
      mockWatcher
    );

    const taskId = handle.loop.startTask('Fix bug', ['pack-1'], 0.8);
    expect(taskId).toMatch(/^task_/);

    const task = handle.loop.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.intent).toBe('Fix bug');

    await handle.loop.recordOutcome({
      taskId,
      success: true,
    });

    expect(handle.loop.getTask(taskId)).toBeUndefined();
  });

  it('should report stats correctly', () => {
    handle = createAutoWiredFeedbackLoop(
      {
        workspace: '/test/workspace',
        storage: mockStorage,
        emitEvents: false,
      },
      mockWatcher
    );

    handle.loop.startTask('Task 1', ['pack-1'], 0.8);
    handle.loop.startTask('Task 2', ['pack-2'], 0.7);

    const stats = handle.loop.getStats();
    expect(stats.activeTasks).toBe(2);
    expect(stats.recentOutcomes).toBe(0);
  });
});

describe('initAutoWiredFeedbackLoop', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;
  let mockWatcher: ReturnType<typeof createMockWatcher>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockWatcher = createMockWatcher();
  });

  it('should initialize global feedback loop', async () => {
    const handle = initAutoWiredFeedbackLoop(
      {
        workspace: '/test/workspace',
        storage: mockStorage,
        emitEvents: false,
      },
      mockWatcher
    );

    try {
      // Import and check global access
      const { getFeedbackLoop } = await import('../feedback_loop.js');
      const globalLoop = getFeedbackLoop();

      expect(globalLoop).toBe(handle.loop);
    } finally {
      handle.disconnect();
    }
  });
});

describe('Auto-wired feedback loop with active tasks', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;
  let mockWatcher: ReturnType<typeof createMockWatcher>;
  let handle: AutoWiredFeedbackLoopHandle;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockWatcher = createMockWatcher();
    mockLogInfo.mockClear();
    handle = createAutoWiredFeedbackLoop(
      {
        workspace: '/test/workspace',
        storage: mockStorage,
        emitEvents: false,
      },
      mockWatcher
    );
  });

  afterEach(() => {
    handle.disconnect();
    handle.loop.clear();
  });

  it('should track file changes when tasks are active', () => {
    // Start a task
    const taskId = handle.loop.startTask('Fix authentication', ['auth-pack'], 0.75);

    // Clear the logInfo calls from startTask
    mockLogInfo.mockClear();

    // Simulate file changes
    mockWatcher.simulateChange('modified', '/test/workspace/src/auth.ts');

    // Verify the signal was received
    expect(mockLogInfo).toHaveBeenCalledWith(
      '[feedback_loop] File watcher signal received',
      expect.objectContaining({
        type: 'modified',
        path: '/test/workspace/src/auth.ts',
      })
    );

    // Task should still be active (file changes alone don't complete tasks)
    expect(handle.loop.getTask(taskId)).toBeDefined();
  });

  it('should handle multiple concurrent tasks', async () => {
    const taskId1 = handle.loop.startTask('Task 1', ['pack-1'], 0.8);
    const taskId2 = handle.loop.startTask('Task 2', ['pack-2'], 0.7);

    expect(handle.loop.getStats().activeTasks).toBe(2);

    // Complete first task
    await handle.loop.recordOutcome({ taskId: taskId1, success: true });
    expect(handle.loop.getStats().activeTasks).toBe(1);

    // Complete second task
    await handle.loop.recordOutcome({ taskId: taskId2, success: false });
    expect(handle.loop.getStats().activeTasks).toBe(0);
    expect(handle.loop.getStats().recentOutcomes).toBe(2);
  });
});
