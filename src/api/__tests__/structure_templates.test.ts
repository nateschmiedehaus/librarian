import { describe, it, expect } from 'vitest';

import { applyTemplate } from '../structure_templates.js';

describe('structure templates', () => {
  it('builds a pipeline template', () => {
    const operators = applyTemplate('pipeline', ['tp_hypothesis', 'tp_bisect']);
    expect(operators[0].type).toBe('sequence');
    expect(operators[0].outputs).toEqual(['tp_bisect']);
  });

  it('builds a gated template', () => {
    const operators = applyTemplate('gated', 'tp_hypothesis', ['tp_bisect']);
    expect(operators[0].type).toBe('gate');
    expect(operators[0].inputs).toEqual(['tp_hypothesis', 'tp_bisect']);
  });

  it('throws on invalid primitive lists', () => {
    expect(() => applyTemplate('pipeline', [])).toThrow('unverified_by_trace(structure_template_invalid_primitives)');
  });
});
