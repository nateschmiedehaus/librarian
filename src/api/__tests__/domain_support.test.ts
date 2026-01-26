import { describe, it, expect } from 'vitest';
import {
  decomposeToAspects,
  constructDomainSupport,
  validateDomainComposition,
  resolveDomainPrimitives,
  type DomainDescription,
  type FundamentalAspect,
} from '../domain_support.js';
import { DEFAULT_TECHNIQUE_PRIMITIVES } from '../technique_library.js';
import { createTechniqueComposition } from '../../strategic/techniques.js';

describe('domain support', () => {
  it('uses explicit aspects when provided', () => {
    const domain: DomainDescription = {
      id: 'custom_domain',
      name: 'Custom Domain',
      aspects: { data: true, time: true },
    };
    const result = decomposeToAspects(domain);
    expect(result.aspects).toEqual(['data', 'time']);
    expect(result.method).toBe('heuristic');
  });

  it('infers aspects from keywords', () => {
    const domain: DomainDescription = {
      id: 'realtime_dashboard',
      name: 'Realtime dashboard',
      description: 'Live metrics and realtime updates for engagement.',
    };
    const result = decomposeToAspects(domain);
    expect(result.aspects).toEqual(expect.arrayContaining(['time', 'value']));
  });

  it('constructs a composition from inferred aspects', () => {
    const domain: DomainDescription = {
      id: 'search_system',
      name: 'Search System',
      description: 'Ranking and indexing for search latency.',
    };
    const plan = constructDomainSupport(domain);
    expect(plan.composition.id).toBe('tc_search_system');
    const expected = resolveDomainPrimitives(plan.aspects);
    expect(plan.composition.primitiveIds).toEqual(expected);
  });

  it('validates compositions against required aspects', () => {
    const domain: DomainDescription = {
      id: 'policy_domain',
      name: 'Policy Domain',
      description: 'Policy and compliance checks for data flows.',
    };
    const composition = createTechniqueComposition({
      id: 'tc_policy_domain',
      name: 'Policy Domain Analysis',
      description: 'Policy-only slice.',
      primitiveIds: ['tp_data_lineage'],
    });
    const available = DEFAULT_TECHNIQUE_PRIMITIVES.map((primitive) => primitive.id);
    const validation = validateDomainComposition(domain, composition, available);
    expect(validation.valid).toBe(false);
    expect(validation.missingAspects).toEqual(expect.arrayContaining(['logic']));
  });

  it('supports hypothetical domains with explicit aspect decompositions', () => {
    const cases: Array<{ id: string; name: string; aspects: FundamentalAspect[] }> = [
      { id: 'quantum_computing_ide', name: 'Quantum Computing IDE', aspects: ['data', 'state', 'time', 'logic', 'agency'] },
      { id: 'brain_computer_interface', name: 'Brain-Computer Interface', aspects: ['data', 'time', 'space', 'media', 'value'] },
      { id: 'autonomous_vehicle_fleet', name: 'Autonomous Vehicle Fleet', aspects: ['state', 'time', 'space', 'logic', 'value'] },
      { id: 'gene_editing_platform', name: 'Gene Editing Platform', aspects: ['data', 'state', 'logic', 'value'] },
      { id: 'climate_simulation', name: 'Climate Simulation', aspects: ['data', 'time', 'space', 'structure'] },
      { id: 'digital_twin_system', name: 'Digital Twin System', aspects: ['data', 'state', 'time', 'space', 'structure'] },
      { id: 'metaverse_platform', name: 'Metaverse Platform', aspects: ['state', 'space', 'media', 'structure', 'value'] },
      { id: 'cryptocurrency_exchange', name: 'Cryptocurrency Exchange', aspects: ['state', 'time', 'logic', 'value'] },
      { id: 'ai_training_pipeline', name: 'AI Training Pipeline', aspects: ['data', 'time', 'logic', 'value'] },
      { id: 'space_mission_control', name: 'Space Mission Control', aspects: ['state', 'time', 'space', 'logic', 'agency'] },
    ];

    for (const domainCase of cases) {
      const aspects = domainCase.aspects.reduce<Record<string, boolean>>((acc, aspect) => {
        acc[aspect] = true;
        return acc;
      }, {});
      const plan = constructDomainSupport({
        id: domainCase.id,
        name: domainCase.name,
        aspects,
      });
      expect(plan.aspects).toEqual(expect.arrayContaining(domainCase.aspects as string[]));
      expect(plan.composition.id).toBe(`tc_${domainCase.id}`);
      expect(plan.composition.primitiveIds).toEqual(resolveDomainPrimitives(plan.aspects));
    }
  });
});
