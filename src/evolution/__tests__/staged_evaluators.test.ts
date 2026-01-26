import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { Stage3Tier2Evaluator } from '../staged_evaluators.js';
import type { EvaluationContext, Variant } from '../types.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

const execSyncMock = vi.mocked(execSync);

function buildVariant(): Variant {
  return {
    id: 'variant-1',
    parentId: null,
    emitterId: 'test-emitter',
    createdAt: new Date().toISOString(),
    genotype: {},
    mutationDescription: 'test mutation',
    evaluated: false,
  };
}

function buildContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    workspaceRoot: process.cwd(),
    providerAvailable: true,
    budget: {
      maxTokens: 1000,
      maxEmbeddings: 100,
      maxProviderCalls: 10,
      maxDurationMs: 60000,
    },
    ...overrides,
  };
}

describe('Stage3Tier2Evaluator', () => {
  beforeEach(() => {
    execSyncMock.mockReset();
  });

  it('returns unverified when providers are unavailable', async () => {
    const evaluator = new Stage3Tier2Evaluator();
    const result = await evaluator.run(buildVariant(), buildContext({ providerAvailable: false }));

    expect(result.status).toBe('unverified_by_trace');
    expect(result.reason).toContain('provider_unavailable');
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it('runs the agentic test review when providers are available', async () => {
    execSyncMock.mockReturnValue('ok');
    const evaluator = new Stage3Tier2Evaluator();
    const context = buildContext();
    const result = await evaluator.run(buildVariant(), context);

    expect(result.status).toBe('passed');
    expect(result.metrics?.agentic_test_review_passed).toBe(true);
    expect(execSyncMock).toHaveBeenCalledWith(
      'npm run test:agentic-review 2>&1',
      expect.objectContaining({ cwd: context.workspaceRoot })
    );
  });

  it('returns unverified when providers report unavailability', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('provider_unavailable: timeout');
    });
    const evaluator = new Stage3Tier2Evaluator();
    const result = await evaluator.run(buildVariant(), buildContext());

    expect(result.status).toBe('unverified_by_trace');
    expect(result.reason).toContain('provider_unavailable');
    expect(result.metrics?.provider_blocked).toBe(true);
  });

  it('returns failed for non-provider errors', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('unexpected failure');
    });
    const evaluator = new Stage3Tier2Evaluator();
    const result = await evaluator.run(buildVariant(), buildContext());

    expect(result.status).toBe('failed');
    expect(result.metrics?.agentic_test_review_passed).toBe(false);
  });
});
