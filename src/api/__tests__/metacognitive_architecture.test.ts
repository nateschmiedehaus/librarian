import { describe, it, expect } from 'vitest';
import { MetacognitiveMonitor } from '../metacognitive_architecture.js';

describe('metacognitive architecture', () => {
  it('detects diminishing returns impasse', () => {
    const monitor = new MetacognitiveMonitor();
    const state = monitor.monitor({
      currentStrategyId: 'deductive',
      strategyStartTime: new Date().toISOString(),
      progressIndicators: [
        {
          metric: 'conclusions_derived',
          value: 0.1,
          expectedValue: 0.5,
          trend: 'declining',
        },
      ],
    });

    expect(state.impasses[0]?.type).toBe('diminishing_returns');
  });

  it('selects alternative strategy based on impasse', () => {
    const monitor = new MetacognitiveMonitor();
    const impasse = {
      type: 'diminishing_returns' as const,
      detectedAt: new Date().toISOString(),
      evidence: 'low progress',
      suggestedRecovery: [],
    };

    const next = monitor.selectAlternativeStrategy(
      { id: 'deductive', name: 'Deductive', applicableWhen: [], progressMetric: 'x', expectedProgressRate: 0.5 },
      impasse
    );

    expect(next.id).toBe('analogical');
  });
});
