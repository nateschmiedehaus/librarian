import { describe, it, expect } from 'vitest';
import { __testing } from '../query.js';

describe('query stage reporting', () => {
  it('queues issues before start and marks failed when output is empty', () => {
    const tracker = __testing.createStageTracker();
    tracker.issue('semantic_retrieval', { message: 'no intent', severity: 'moderate' });
    const ctx = tracker.start('semantic_retrieval', 1);
    expect(ctx.issues).toHaveLength(1);
    const report = tracker.finish(ctx, { outputCount: 0 });
    expect(report.status).toBe('failed');
    expect(report.issues[0]?.message).toBe('no intent');
  });

  it('marks success when output exists and no issues are recorded', () => {
    const tracker = __testing.createStageTracker();
    const ctx = tracker.start('direct_packs', 2);
    const report = tracker.finish(ctx, { outputCount: 2, filteredCount: 0 });
    expect(report.status).toBe('success');
    expect(report.results.filteredCount).toBe(0);
  });

  it('finalizeMissing creates skipped stages with queued issues', () => {
    const tracker = __testing.createStageTracker();
    tracker.issue('synthesis', { message: 'llm disabled', severity: 'minor' });
    tracker.finalizeMissing(['synthesis']);
    const report = tracker.report().find((stage) => stage.stage === 'synthesis');
    expect(report?.status).toBe('skipped');
    expect(report?.issues.length).toBe(1);
  });

  it('marks partial when output is empty without issues', () => {
    const tracker = __testing.createStageTracker();
    const ctx = tracker.start('graph_expansion', 3);
    const report = tracker.finish(ctx, { outputCount: 0 });
    expect(report.status).toBe('partial');
  });
});
