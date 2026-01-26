import { createTechniquePackage, type TechniquePackage } from '../strategic/technique_packages.js';
import type { TechniqueComposition, TechniquePrimitive } from '../strategic/techniques.js';
import { DEFAULT_TECHNIQUE_PRIMITIVES } from './technique_library.js';
import { DEFAULT_TECHNIQUE_COMPOSITIONS } from './technique_compositions.js';

export const DEFAULT_TECHNIQUE_PACKAGES: TechniquePackage[] = [
  createTechniquePackage({
    id: 'tpkg_core_reasoning',
    name: 'Core reasoning',
    description: 'Foundational problem framing and reasoning techniques.',
    primitiveIds: [
      'tp_clarify_goal',
      'tp_list_constraints',
      'tp_decompose',
      'tp_hypothesis',
      'tp_verify_plan',
    ],
    categories: ['framing', 'analysis', 'planning'],
    domains: ['analysis', 'planning'],
    tags: ['core'],
  }),
  createTechniquePackage({
    id: 'tpkg_quality_safety',
    name: 'Quality and safety',
    description: 'Quality assurance, safety, and security guardrails.',
    primitiveIds: [
      'tp_threat_model',
      'tp_security_abuse_cases',
      'tp_prompt_injection_scan',
      'tp_secret_scan',
      'tp_slop_prevention',
      'tp_assurance_case',
      'tp_requirement_traceability',
      'tp_edge_case_catalog',
    ],
    categories: ['quality', 'security'],
    domains: ['quality', 'security', 'safety'],
    tags: ['quality', 'safety'],
  }),
  createTechniquePackage({
    id: 'tpkg_evidence_compliance',
    name: 'Evidence and compliance',
    description: 'Evidence packaging, compliance checks, and policy enforcement.',
    primitiveIds: [
      'tp_evidence_pack',
      'tp_artifact_envelope',
      'tp_artifact_versioning',
      'tp_stage_compliance',
      'tp_gating_rules',
      'tp_policy_enforcement',
      'tp_provider_probe',
    ],
    categories: ['evidence', 'compliance', 'governance'],
    domains: ['evidence', 'compliance', 'policy'],
    tags: ['governance'],
  }),
  createTechniquePackage({
    id: 'tpkg_coordination',
    name: 'Coordination',
    description: 'Multi-agent coordination and arbitration primitives.',
    primitiveIds: [
      'tp_blackboard_coordination',
      'tp_contract_net_leasing',
      'tp_arbitration',
      'tp_worktree_isolation',
      'tp_ownership_matrix',
      'tp_communication_cadence',
    ],
    categories: ['coordination'],
    domains: ['coordination', 'operations'],
    tags: ['multi-agent'],
  }),
  createTechniquePackage({
    id: 'tpkg_resilience_ops',
    name: 'Resilience operations',
    description: 'Resilience, SLO, and operational stability primitives.',
    primitiveIds: [
      'tp_slo_definition',
      'tp_slo_monitoring',
      'tp_self_healing',
      'tp_resilience_engine',
      'tp_graceful_degradation',
    ],
    categories: ['operations', 'recovery'],
    domains: ['operations', 'resilience'],
    tags: ['operations'],
  }),
  createTechniquePackage({
    id: 'tpkg_economics',
    name: 'Economics',
    description: 'Cost, reputation, and incentive primitives.',
    primitiveIds: [
      'tp_task_economics',
      'tp_token_ledger',
      'tp_reputation_update',
      'tp_cost_estimation',
      'tp_vcg_auction',
      'tp_execution_budgeting',
    ],
    categories: ['optimization', 'governance'],
    domains: ['economics', 'optimization'],
    tags: ['economics'],
  }),
  createTechniquePackage({
    id: 'tpkg_evolution',
    name: 'Evolution and meta-learning',
    description: 'Meta-learning, evolution, and adaptive systems primitives.',
    primitiveIds: [
      'tp_semantic_dedup',
      'tp_hebbian_learning',
      'tp_homeostasis_loop',
      'tp_thermodynamic_pressure',
      'tp_novelty_search',
      'tp_evolution_tournament',
      'tp_diversity_enforcer',
      'tp_fitness_gap_proposer',
    ],
    categories: ['meta'],
    domains: ['meta', 'optimization'],
    tags: ['meta'],
  }),
  createTechniquePackage({
    id: 'tpkg_research_intelligence',
    name: 'Research intelligence',
    description: 'Research synthesis, provenance, and knowledge graph primitives.',
    primitiveIds: [
      'tp_research_synthesis',
      'tp_research_evidence_pack',
      'tp_source_extraction',
      'tp_web_research_evidence',
      'tp_knowledge_graph',
      'tp_real_world_grounding',
    ],
    categories: ['research', 'analysis'],
    domains: ['research', 'evidence'],
    tags: ['research'],
  }),
];

const PACKAGE_ID_PATTERN = /^tpkg_[a-z][a-z0-9_]*$/;
const DEFAULT_TECHNIQUE_PACKAGES_BY_ID = new Map(
  DEFAULT_TECHNIQUE_PACKAGES.map((pkg) => [pkg.id, pkg])
);

function assertPackageQueryId(value: string): string {
  if (!PACKAGE_ID_PATTERN.test(value)) {
    throw new Error(`unverified_by_trace(invalid_package_id_query): ${value}`);
  }
  return value;
}

export function listTechniquePackages(): TechniquePackage[] {
  return [...DEFAULT_TECHNIQUE_PACKAGES];
}

export function getTechniquePackage(id: string): TechniquePackage | null {
  assertPackageQueryId(id);
  return DEFAULT_TECHNIQUE_PACKAGES_BY_ID.get(id) ?? null;
}

export function compileTechniquePackageBundle(
  pkg: TechniquePackage,
  options?: { primitives?: TechniquePrimitive[]; compositions?: TechniqueComposition[] }
): {
  package: TechniquePackage;
  primitives: TechniquePrimitive[];
  compositions: TechniqueComposition[];
  missingPrimitiveIds: string[];
  missingCompositionIds: string[];
} {
  const primitives = options?.primitives ?? DEFAULT_TECHNIQUE_PRIMITIVES;
  const compositions = options?.compositions ?? DEFAULT_TECHNIQUE_COMPOSITIONS;
  const primitiveById = new Map(primitives.map((primitive) => [primitive.id, primitive]));
  const compositionById = new Map(compositions.map((composition) => [composition.id, composition]));
  const selectedPrimitives = pkg.primitiveIds
    .map((id) => primitiveById.get(id))
    .filter((primitive): primitive is TechniquePrimitive => Boolean(primitive));
  const selectedCompositions = pkg.compositionIds
    .map((id) => compositionById.get(id))
    .filter((composition): composition is TechniqueComposition => Boolean(composition));
  const missingPrimitiveIds = pkg.primitiveIds.filter((id) => !primitiveById.has(id));
  const missingCompositionIds = pkg.compositionIds.filter((id) => !compositionById.has(id));

  return {
    package: pkg,
    primitives: selectedPrimitives,
    compositions: selectedCompositions,
    missingPrimitiveIds,
    missingCompositionIds,
  };
}

export function compileTechniquePackageBundleById(
  packageId: string,
  options?: { primitives?: TechniquePrimitive[]; compositions?: TechniqueComposition[] }
): ReturnType<typeof compileTechniquePackageBundle> | null {
  const pkg = getTechniquePackage(packageId);
  if (!pkg) {
    return null;
  }
  return compileTechniquePackageBundle(pkg, options);
}
