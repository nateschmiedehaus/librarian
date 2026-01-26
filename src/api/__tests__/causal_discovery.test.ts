import { describe, it, expect } from 'vitest';
import { CausalDiscoveryEngine } from '../causal_discovery.js';

describe('causal discovery engine', () => {
  it('discovers relationships from test runs with lift', async () => {
    const engine = new CausalDiscoveryEngine();
    const runs = [
      { id: '1', changedFiles: ['auth.ts'], failedTests: ['auth.test.ts'] },
      { id: '2', changedFiles: ['auth.ts'], failedTests: ['auth.test.ts'] },
      { id: '3', changedFiles: ['auth.ts'], failedTests: ['auth.test.ts'] },
      { id: '4', changedFiles: ['auth.ts'], failedTests: ['auth.test.ts'] },
      { id: '5', changedFiles: ['auth.ts'], failedTests: ['auth.test.ts'] },
      { id: '6', changedFiles: ['misc.ts'], failedTests: ['misc.test.ts'] },
      { id: '7', changedFiles: ['misc.ts'], failedTests: ['misc.test.ts'] },
      { id: '8', changedFiles: ['misc.ts'], failedTests: ['misc.test.ts'] },
      { id: '9', changedFiles: ['misc.ts'], failedTests: ['misc.test.ts'] },
      { id: '10', changedFiles: ['misc.ts'], failedTests: ['misc.test.ts'] },
    ];

    const results = await engine.discoverFromTestResults(runs);
    expect(results.some((item) => item.cause === 'auth.ts' && item.effect === 'auth.test.ts')).toBe(true);
  });

  it('returns empty when observations are insufficient', async () => {
    const engine = new CausalDiscoveryEngine();
    const results = await engine.discoverFromTestResults([
      { id: '1', changedFiles: ['config.ts'], failedTests: ['config.test.ts'] },
    ]);

    expect(results.length).toBe(0);
  });
});
