import { describe, expect, it } from 'vitest';
import {
  negotiateCapabilities,
  negotiateCapabilityContract,
  requireCapabilities,
  type Capability,
  type CapabilityContract,
} from '../api/capability_contracts.js';

describe('capability contracts', () => {
  it('reports satisfied when all required capabilities are available', () => {
    const required: Capability[] = ['llm:chat', 'storage:sqlite'];
    const available: Capability[] = ['storage:sqlite', 'llm:chat', 'tool:filesystem'];

    expect(negotiateCapabilities(required, available)).toEqual({
      satisfied: true,
      missing: [],
      degraded: null,
    });
  });

  it('reports missing required capabilities deterministically', () => {
    const required: Capability[] = ['llm:chat', 'llm:embedding', 'storage:sqlite'];
    const available: Capability[] = ['llm:chat', 'tool:filesystem', 'storage:sqlite'];

    expect(negotiateCapabilities(required, available)).toEqual({
      satisfied: false,
      missing: ['llm:embedding'],
      degraded: 'missing_required_capabilities',
    });
  });

  it('supports optional capabilities with degraded mode disclosure', () => {
    const contract: CapabilityContract = {
      required: ['storage:sqlite'],
      optional: ['tool:git', 'tool:mcp'],
      degradedMode: 'reduced_verification_surface',
    };

    const available: Capability[] = ['storage:sqlite', 'tool:git'];

    expect(negotiateCapabilityContract(contract, available)).toEqual({
      satisfied: true,
      missing: ['tool:mcp'],
      degraded: 'reduced_verification_surface',
    });
  });

  it('throws unverified_by_trace when required capabilities are missing', () => {
    expect(() => requireCapabilities(['llm:embedding'], ['llm:chat'], 'needs semantic retrieval')).toThrow(
      'unverified_by_trace(capability_missing):'
    );
  });
});

