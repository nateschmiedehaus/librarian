import { describe, it, expect } from 'vitest';

import { compileLCL } from '../lcl.js';

const NOW = new Date('2025-01-01T00:00:00.000Z').toISOString();

describe('lcl compiler', () => {
  it('builds a composition from a pattern base', () => {
    const composition = compileLCL({
      base: 'pattern',
      baseId: 'pattern_bug_investigation',
    }, { now: NOW });

    expect(composition.primitiveIds).toContain('tp_hypothesis');
    expect(composition.primitiveIds).toContain('tp_bisect');
    expect(composition.id.startsWith('tc_lcl_')).toBe(true);
  });

  it('applies conditionals using context', () => {
    const composition = compileLCL({
      base: 'primitives',
      primitiveIds: ['tp_hypothesis'],
      conditionals: [
        {
          when: 'flags.useBisect == true',
          then: 'add',
          primitiveId: 'tp_bisect',
        },
      ],
    }, {
      now: NOW,
      context: { flags: { useBisect: true } },
    });

    expect(composition.primitiveIds).toContain('tp_bisect');
  });

  it('adds operator specs to the composition', () => {
    const composition = compileLCL({
      base: 'primitives',
      primitiveIds: ['tp_hypothesis', 'tp_bisect'],
      operators: [
        {
          type: 'sequence',
          inputs: ['tp_hypothesis', 'tp_bisect'],
        },
      ],
    }, { now: NOW });

    expect(composition.operators).toBeDefined();
    expect(composition.operators?.[0]?.type).toBe('sequence');
  });

  it('throws for missing pattern ids', () => {
    expect(() => compileLCL({ base: 'pattern', baseId: 'pattern_missing' }, { now: NOW }))
      .toThrow('unverified_by_trace(lcl_pattern_not_found)');
  });
});
