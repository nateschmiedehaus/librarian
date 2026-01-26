import {
  type TechniqueOperatorType,
  type TechniqueRelationshipType,
  type BuiltinTechniqueOperatorType,
  type BuiltinTechniqueRelationshipType,
  isBuiltinOperatorType,
  isBuiltinRelationshipType,
  isCustomOperatorType,
  isCustomRelationshipType,
} from './techniques.js';
import type { DependencyType } from './work_primitives.js';

export type OperatorRole = 'flow' | 'gate' | 'control';
export type OperatorCompileMode = 'edge' | 'checkpoint';
export type OperatorEdgeStyle = 'sequence' | 'parallel' | 'fanout' | 'fanin' | 'reduce';

interface OperatorSemanticsBase {
  role: OperatorRole;
  description: string;
  minInputs: number;
  maxInputs?: number;
  minOutputs: number;
  maxOutputs?: number;
  requiresRuntimeCondition?: boolean;
  requiredParameters?: string[];
  optionalParameters?: string[];
}

export type OperatorSemantics =
  | (OperatorSemanticsBase & {
      compile: 'edge';
      edgeStyle: OperatorEdgeStyle;
    })
  | (OperatorSemanticsBase & {
      compile: 'checkpoint';
      edgeStyle?: never;
    });

function freezeRegistry<T extends Record<string, Record<string, unknown>>>(value: T): T {
  Object.freeze(value);
  for (const entry of Object.values(value)) {
    Object.freeze(entry);
  }
  return value;
}

function deepFreezeValue<T>(value: T, visited = new WeakSet<object>()): T {
  if (!value || typeof value !== 'object') {
    return value;
  }
  const ref = value as object;
  if (visited.has(ref)) {
    return value;
  }
  visited.add(ref);
  if (Array.isArray(value)) {
    value.forEach((entry) => deepFreezeValue(entry, visited));
    return Object.freeze(value);
  }
  const record = value as Record<string, unknown>;
  Object.values(record).forEach((entry) => deepFreezeValue(entry, visited));
  return Object.freeze(value);
}

export const OPERATOR_SEMANTICS = freezeRegistry({
  sequence: {
    role: 'flow',
    description: 'Enforce a strict ordering across inputs.',
    compile: 'edge',
    edgeStyle: 'sequence',
    minInputs: 1,
    minOutputs: 0,
  },
  parallel: {
    role: 'flow',
    description: 'Inputs can execute concurrently; outputs wait for all inputs if provided.',
    compile: 'edge',
    edgeStyle: 'parallel',
    minInputs: 2,
    minOutputs: 0,
  },
  conditional: {
    role: 'control',
    description: 'Branching decision based on runtime conditions.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiresRuntimeCondition: true,
  },
  loop: {
    role: 'control',
    description: 'Repeat inputs until stop conditions are met.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiresRuntimeCondition: true,
  },
  gate: {
    role: 'gate',
    description: 'Explicit quality or readiness gate.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
  },
  fallback: {
    role: 'control',
    description: 'Fallback execution when primary path fails.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiresRuntimeCondition: true,
  },
  merge: {
    role: 'flow',
    description: 'Merge multiple inputs into a single output.',
    compile: 'edge',
    edgeStyle: 'fanin',
    minInputs: 2,
    minOutputs: 1,
    maxOutputs: 1,
  },
  fanout: {
    role: 'flow',
    description: 'Split one input into multiple outputs.',
    compile: 'edge',
    edgeStyle: 'fanout',
    minInputs: 1,
    maxInputs: 1,
    minOutputs: 1,
  },
  fanin: {
    role: 'flow',
    description: 'Join multiple inputs into a single output.',
    compile: 'edge',
    edgeStyle: 'fanin',
    minInputs: 2,
    minOutputs: 1,
    maxOutputs: 1,
  },
  retry: {
    role: 'control',
    description: 'Retry inputs until success or limits reached.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiresRuntimeCondition: true,
    optionalParameters: ['maxAttempts', 'retryDelayMs', 'jitterMs'],
  },
  escalate: {
    role: 'gate',
    description: 'Escalate to a human or higher authority.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
  },
  checkpoint: {
    role: 'gate',
    description: 'Explicit verification checkpoint.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
  },
  interrupt: {
    role: 'gate',
    description: 'Interrupt or halt execution safely.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
  },
  timebox: {
    role: 'gate',
    description: 'Constrain execution to a fixed time window.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiresRuntimeCondition: true,
    requiredParameters: ['limitMs'],
    optionalParameters: ['deadlineIso', 'onTimeout'],
  },
  budget_cap: {
    role: 'gate',
    description: 'Enforce a hard budget limit.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiresRuntimeCondition: true,
    requiredParameters: ['budgetLimit'],
    optionalParameters: ['budgetUnit', 'budgetPolicy'],
  },
  throttle: {
    role: 'control',
    description: 'Limit execution rate or throughput.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiresRuntimeCondition: true,
    requiredParameters: ['maxRate'],
    optionalParameters: ['rateWindowMs', 'burstLimit'],
  },
  quorum: {
    role: 'gate',
    description: 'Require a quorum of reviewers or agents.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiredParameters: ['quorumSize'],
    optionalParameters: ['quorumPolicy'],
  },
  consensus: {
    role: 'gate',
    description: 'Require consensus across reviewers or agents.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiredParameters: ['consensusRule'],
    optionalParameters: ['tieBreaker'],
  },
  backoff: {
    role: 'control',
    description: 'Apply backoff scheduling between retries.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiresRuntimeCondition: true,
    requiredParameters: ['baseDelayMs'],
    optionalParameters: ['maxDelayMs', 'multiplier'],
  },
  circuit_breaker: {
    role: 'gate',
    description: 'Fail closed when error thresholds are exceeded.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiresRuntimeCondition: true,
    requiredParameters: ['errorThreshold'],
    optionalParameters: ['windowMs', 'cooldownMs'],
  },
  monitor: {
    role: 'control',
    description: 'Observe signals and track anomalies.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiredParameters: ['signals'],
    optionalParameters: ['samplingRate', 'alertPolicy'],
  },
  persist: {
    role: 'control',
    description: 'Persist state for recovery or reuse.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiredParameters: ['store'],
    optionalParameters: ['format', 'retentionPolicy'],
  },
  replay: {
    role: 'control',
    description: 'Replay prior execution deterministically.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiredParameters: ['replayId'],
    optionalParameters: ['replayWindow'],
  },
  cache: {
    role: 'control',
    description: 'Cache intermediate results for reuse.',
    compile: 'checkpoint',
    minInputs: 1,
    minOutputs: 0,
    requiredParameters: ['cacheKey'],
    optionalParameters: ['ttlMs', 'cachePolicy'],
  },
  reduce: {
    role: 'flow',
    description: 'Aggregate multiple inputs into a reduced output.',
    compile: 'edge',
    edgeStyle: 'reduce',
    minInputs: 2,
    minOutputs: 1,
    maxOutputs: 1,
    requiredParameters: ['reducer'],
    optionalParameters: ['aggregationPolicy'],
  },
} satisfies Record<BuiltinTechniqueOperatorType, OperatorSemantics>);

const OPERATOR_SEMANTICS_REGISTRY: Record<string, OperatorSemantics> = {
  ...OPERATOR_SEMANTICS,
};

export type RelationshipDirection = 'from_to' | 'to_from' | 'bidirectional';

export interface RelationshipSemantics {
  direction: RelationshipDirection;
  dependencyType: DependencyType;
  description: string;
}

export const RELATIONSHIP_SEMANTICS = freezeRegistry({
  depends_on: {
    direction: 'from_to',
    dependencyType: 'blocked_by',
    description: 'From depends on To.',
  },
  blocks: {
    direction: 'to_from',
    dependencyType: 'blocked_by',
    description: 'From blocks To from starting.',
  },
  parallel_with: {
    direction: 'bidirectional',
    dependencyType: 'related_to',
    description: 'Parallel execution hint.',
  },
  enables: {
    direction: 'to_from',
    dependencyType: 'blocked_by',
    description: 'From enables To.',
  },
  verifies: {
    direction: 'from_to',
    dependencyType: 'blocked_by',
    description: 'From verifies To after completion.',
  },
  produces: {
    direction: 'to_from',
    dependencyType: 'requires_resource',
    description: 'From produces output consumed by To.',
  },
  consumes: {
    direction: 'from_to',
    dependencyType: 'requires_resource',
    description: 'From consumes output provided by To.',
  },
  refines: {
    direction: 'from_to',
    dependencyType: 'requires_decision',
    description: 'From refines To.',
  },
  supersedes: {
    direction: 'bidirectional',
    dependencyType: 'related_to',
    description: 'From supersedes To.',
  },
  fallback_for: {
    direction: 'from_to',
    dependencyType: 'related_to',
    description: 'From is a fallback for To.',
  },
  validates: {
    direction: 'from_to',
    dependencyType: 'blocked_by',
    description: 'From validates To after completion.',
  },
  reinforces: {
    direction: 'bidirectional',
    dependencyType: 'related_to',
    description: 'Mutually reinforcing steps.',
  },
  conflicts_with: {
    direction: 'bidirectional',
    dependencyType: 'related_to',
    description: 'Conflicting steps.',
  },
  evidence_for: {
    direction: 'from_to',
    dependencyType: 'blocked_by',
    description: 'From provides evidence for To.',
  },
  invalidates: {
    direction: 'to_from',
    dependencyType: 'requires_decision',
    description: 'From invalidates To.',
  },
  derived_from: {
    direction: 'from_to',
    dependencyType: 'related_to',
    description: 'From derived from To.',
  },
  requires_context: {
    direction: 'from_to',
    dependencyType: 'requires_research',
    description: 'From requires context from To.',
  },
  affects: {
    direction: 'bidirectional',
    dependencyType: 'related_to',
    description: 'Mutual impact relationship.',
  },
  causes: {
    direction: 'from_to',
    dependencyType: 'related_to',
    description: 'From causes To.',
  },
  mitigates: {
    direction: 'from_to',
    dependencyType: 'requires_approval',
    description: 'From mitigates risk in To.',
  },
  covers: {
    direction: 'from_to',
    dependencyType: 'related_to',
    description: 'From covers To.',
  },
  duplicate_of: {
    direction: 'bidirectional',
    dependencyType: 'related_to',
    description: 'Duplicate steps.',
  },
  equivalent_to: {
    direction: 'bidirectional',
    dependencyType: 'related_to',
    description: 'Equivalent steps.',
  },
  alternative_to: {
    direction: 'bidirectional',
    dependencyType: 'related_to',
    description: 'Alternative steps.',
  },
} satisfies Record<BuiltinTechniqueRelationshipType, RelationshipSemantics>);

const RELATIONSHIP_SEMANTICS_REGISTRY: Record<string, RelationshipSemantics> = {
  ...RELATIONSHIP_SEMANTICS,
};
let registryLocked = false;

function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST !== undefined;
}

function resetRegistry<T extends Record<string, unknown>>(
  registry: T,
  base: T
): void {
  for (const key of Object.keys(registry)) {
    if (!(key in base)) {
      delete registry[key];
    }
  }
  const mutable = registry as Record<string, unknown>;
  for (const [key, value] of Object.entries(base)) {
    mutable[key] = value;
  }
}

export function lockTechniqueSemanticsRegistry(): void {
  registryLocked = true;
}

export function resetTechniqueSemanticsRegistry(): void {
  if (!isTestEnvironment()) {
    throw new Error('unverified_by_trace(semantics_registry_reset_forbidden)');
  }
  registryLocked = false;
  resetRegistry(OPERATOR_SEMANTICS_REGISTRY, OPERATOR_SEMANTICS);
  resetRegistry(RELATIONSHIP_SEMANTICS_REGISTRY, RELATIONSHIP_SEMANTICS);
}

const RELATIONSHIP_DIRECTIONS = new Set<RelationshipDirection>([
  'from_to',
  'to_from',
  'bidirectional',
]);
const OPERATOR_ROLES = new Set<OperatorRole>(['flow', 'gate', 'control']);
const OPERATOR_COMPILE_MODES = new Set<OperatorCompileMode>(['edge', 'checkpoint']);
const OPERATOR_EDGE_STYLES = new Set<OperatorEdgeStyle>([
  'sequence',
  'parallel',
  'fanout',
  'fanin',
  'reduce',
]);

function assertOperatorSemanticsShape(type: string, semantics: OperatorSemantics): void {
  if (!OPERATOR_ROLES.has(semantics.role)) {
    throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
  }
  if (typeof semantics.description !== 'string' || semantics.description.length === 0) {
    throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
  }
  if (!OPERATOR_COMPILE_MODES.has(semantics.compile)) {
    throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
  }
  if (semantics.compile === 'edge' && !OPERATOR_EDGE_STYLES.has(semantics.edgeStyle)) {
    throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
  }
  if (semantics.compile === 'checkpoint' && 'edgeStyle' in semantics && semantics.edgeStyle !== undefined) {
    throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
  }
  if (!Number.isFinite(semantics.minInputs) || semantics.minInputs < 0) {
    throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
  }
  if (!Number.isFinite(semantics.minOutputs) || semantics.minOutputs < 0) {
    throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
  }
  if (semantics.maxInputs !== undefined && semantics.maxInputs < semantics.minInputs) {
    throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
  }
  if (semantics.maxOutputs !== undefined && semantics.maxOutputs < semantics.minOutputs) {
    throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
  }
  if (semantics.requiredParameters) {
    if (!Array.isArray(semantics.requiredParameters) || semantics.requiredParameters.length === 0) {
      throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
    }
    if (semantics.requiredParameters.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
      throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
    }
  }
  if (semantics.optionalParameters) {
    if (!Array.isArray(semantics.optionalParameters)) {
      throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
    }
    if (semantics.optionalParameters.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
      throw new Error(`unverified_by_trace(operator_semantics_invalid): ${type}`);
    }
  }
}

function assertRelationshipSemanticsShape(type: string, semantics: RelationshipSemantics): void {
  if (!RELATIONSHIP_DIRECTIONS.has(semantics.direction)) {
    throw new Error(`unverified_by_trace(relationship_semantics_invalid): ${type}`);
  }
  if (typeof semantics.description !== 'string' || semantics.description.length === 0) {
    throw new Error(`unverified_by_trace(relationship_semantics_invalid): ${type}`);
  }
}

export function registerOperatorSemantics(
  type: TechniqueOperatorType,
  semantics: OperatorSemantics,
  options?: { override?: boolean }
): void {
  if (registryLocked) {
    throw new Error('unverified_by_trace(semantics_registry_locked)');
  }
  const allowOverride = options?.override ?? false;
  if (isBuiltinOperatorType(type)) {
    throw new Error(`unverified_by_trace(operator_semantics_override_forbidden): ${type}`);
  }
  if (!isCustomOperatorType(type)) {
    throw new Error(`unverified_by_trace(operator_type_invalid): ${type}`);
  }
  if (OPERATOR_SEMANTICS_REGISTRY[type] && !allowOverride) {
    throw new Error(`unverified_by_trace(operator_semantics_exists): ${type}`);
  }
  assertOperatorSemanticsShape(type, semantics);
  OPERATOR_SEMANTICS_REGISTRY[type] = deepFreezeValue({ ...semantics });
}

export function registerRelationshipSemantics(
  type: TechniqueRelationshipType,
  semantics: RelationshipSemantics,
  options?: { override?: boolean }
): void {
  if (registryLocked) {
    throw new Error('unverified_by_trace(semantics_registry_locked)');
  }
  const allowOverride = options?.override ?? false;
  if (isBuiltinRelationshipType(type)) {
    throw new Error(`unverified_by_trace(relationship_semantics_override_forbidden): ${type}`);
  }
  if (!isCustomRelationshipType(type)) {
    throw new Error(`unverified_by_trace(relationship_type_invalid): ${type}`);
  }
  if (RELATIONSHIP_SEMANTICS_REGISTRY[type] && !allowOverride) {
    throw new Error(`unverified_by_trace(relationship_semantics_exists): ${type}`);
  }
  assertRelationshipSemanticsShape(type, semantics);
  RELATIONSHIP_SEMANTICS_REGISTRY[type] = deepFreezeValue({ ...semantics });
}

export function getOperatorSemantics(type: TechniqueOperatorType): OperatorSemantics {
  if (!isBuiltinOperatorType(type) && !isCustomOperatorType(type)) {
    throw new Error(`unverified_by_trace(operator_semantics_missing): ${type}`);
  }
  const semantics = OPERATOR_SEMANTICS_REGISTRY[type];
  if (!semantics) {
    throw new Error(`unverified_by_trace(operator_semantics_missing): ${type}`);
  }
  return semantics;
}

export function getRelationshipSemantics(type: TechniqueRelationshipType): RelationshipSemantics {
  if (!isBuiltinRelationshipType(type) && !isCustomRelationshipType(type)) {
    throw new Error(`unverified_by_trace(relationship_semantics_missing): ${type}`);
  }
  const semantics = RELATIONSHIP_SEMANTICS_REGISTRY[type];
  if (!semantics) {
    throw new Error(`unverified_by_trace(relationship_semantics_missing): ${type}`);
  }
  return semantics;
}
