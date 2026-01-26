import type {
  TechniqueComposition,
  TechniqueCompositionGraphVersion,
  TechniqueOperator,
  TechniqueRelationship,
  TechniqueRelationshipType,
  TechniquePrimitive,
} from '../strategic/techniques.js';
import {
  createTechniqueComposition,
  isBuiltinRelationshipType,
  isCustomRelationshipType,
} from '../strategic/techniques.js';
import {
  DEFAULT_TECHNIQUE_COMPOSITIONS,
  assertCompositionReferences,
} from './technique_compositions.js';
import { getOperatorSemantics } from '../strategic/technique_semantics.js';

export interface CompositionBuildOptions {
  primitives?: TechniquePrimitive[];
  allowMissingPrimitives?: boolean;
  skipValidation?: boolean;
  now: string;
}

export interface AddPrimitiveOptions {
  before?: string;
  after?: string;
  index?: number;
  allowDuplicates?: boolean;
}

export interface MergeOptions {
  mergeOperators?: boolean;
  mergeRelationships?: boolean;
  allowDuplicatePrimitives?: boolean;
}

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_ID_LENGTH = 120;
const MAX_RELATIONSHIP_TEXT_LENGTH = 1000;
const MAX_RELATIONSHIP_WEIGHT_ABS = 1_000_000;
const MAX_PARAMETER_DEPTH = 6;
const MAX_PARAMETER_KEYS = 200;
const MAX_PARAMETER_ARRAY_LENGTH = 200;
const MAX_PARAMETER_STRING_LENGTH = 2000;
const MAX_PARAMETER_NODES = 10000;
const FORBIDDEN_PARAMETER_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertSafeId(value: string, label: string): void {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ID_LENGTH ||
    !SAFE_ID_PATTERN.test(value)
  ) {
    throw new Error(`unverified_by_trace(invalid_${label})`);
  }
}

function normalizeOptionalText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`unverified_by_trace(invalid_${label})`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RELATIONSHIP_TEXT_LENGTH) {
    throw new Error(`unverified_by_trace(invalid_${label})`);
  }
  return trimmed;
}

function normalizeRelationshipWeight(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('unverified_by_trace(invalid_relationship_weight)');
  }
  if (Math.abs(value) > MAX_RELATIONSHIP_WEIGHT_ABS) {
    throw new Error('unverified_by_trace(relationship_weight_excessive)');
  }
  return value;
}

function assertRelationshipType(value: TechniqueRelationshipType): void {
  if (typeof value !== 'string' || (!isBuiltinRelationshipType(value) && !isCustomRelationshipType(value))) {
    const safeType = String(value ?? '').replace(/[^a-zA-Z0-9_:-]/g, '_').slice(0, 120);
    throw new Error(`unverified_by_trace(invalid_relationship_type): ${safeType}`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeParameterValue(
  value: unknown,
  depth: number,
  state?: { active: WeakSet<object>; nodeCount: { current: number } }
): unknown {
  const context = state ?? { active: new WeakSet<object>(), nodeCount: { current: 0 } };
  context.nodeCount.current += 1;
  if (context.nodeCount.current > MAX_PARAMETER_NODES) {
    throw new Error('unverified_by_trace(operator_parameters_nodes_excessive)');
  }
  if (depth > MAX_PARAMETER_DEPTH) {
    throw new Error('unverified_by_trace(operator_parameters_depth_exceeded)');
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error('unverified_by_trace(operator_parameters_invalid_number)');
    }
    return value;
  }
  if (typeof value === 'string') {
    if (value.length > MAX_PARAMETER_STRING_LENGTH) {
      throw new Error('unverified_by_trace(operator_parameters_string_excessive)');
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_PARAMETER_ARRAY_LENGTH) {
      throw new Error('unverified_by_trace(operator_parameters_array_excessive)');
    }
    if (context.active.has(value)) {
      throw new Error('unverified_by_trace(operator_parameters_circular)');
    }
    context.active.add(value);
    const mapped = value.map((entry) => normalizeParameterValue(entry, depth + 1, context));
    context.active.delete(value);
    return mapped;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length > MAX_PARAMETER_KEYS) {
      throw new Error('unverified_by_trace(operator_parameters_keys_excessive)');
    }
    if (context.active.has(value)) {
      throw new Error('unverified_by_trace(operator_parameters_circular)');
    }
    context.active.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      if (FORBIDDEN_PARAMETER_KEYS.has(key.trim())) {
        throw new Error('unverified_by_trace(operator_parameters_forbidden_key)');
      }
      output[key] = normalizeParameterValue(entry, depth + 1, context);
    }
    context.active.delete(value);
    return output;
  }
  throw new Error('unverified_by_trace(operator_parameters_invalid)');
}

function normalizeOperatorParameters(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new Error('unverified_by_trace(operator_parameters_invalid)');
  }
  const normalized = normalizeParameterValue(
    value,
    0,
    { active: new WeakSet<object>(), nodeCount: { current: 0 } }
  ) as Record<string, unknown>;
  return deepFreezeValue(normalized);
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

function normalizeRelationshipFields(relationship: TechniqueRelationship): TechniqueRelationship {
  assertSafeId(relationship.fromId, 'relationship_from_id');
  assertSafeId(relationship.toId, 'relationship_to_id');
  assertRelationshipType(relationship.type);
  return {
    ...relationship,
    condition: normalizeOptionalText(relationship.condition, 'relationship_condition'),
    notes: normalizeOptionalText(relationship.notes, 'relationship_notes'),
    weight: normalizeRelationshipWeight(relationship.weight),
  };
}

function cloneComposition(composition: TechniqueComposition): TechniqueComposition {
  return {
    ...composition,
    primitiveIds: [...composition.primitiveIds],
    operators: composition.operators ? composition.operators.map(cloneOperator) : undefined,
    relationships: composition.relationships ? composition.relationships.map(cloneRelationship) : undefined,
  };
}

function cloneOperator(operator: TechniqueOperator): TechniqueOperator {
  let parameters: Record<string, unknown> | undefined;
  try {
    parameters = normalizeOperatorParameters(operator.parameters);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const reason = raw.replace(/[\r\n\t]/g, ' ').slice(0, 200);
    const safeId = operator.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    throw new Error(`unverified_by_trace(operator_parameters_invalid): ${safeId} reason=${reason}`);
  }
  return {
    ...operator,
    inputs: operator.inputs ? [...operator.inputs] : undefined,
    outputs: operator.outputs ? [...operator.outputs] : undefined,
    conditions: operator.conditions ? [...operator.conditions] : undefined,
    parameters,
  };
}

function cloneRelationship(relationship: TechniqueRelationship): TechniqueRelationship {
  return { ...relationship };
}

function ensureOperators(composition: TechniqueComposition): TechniqueOperator[] {
  if (!composition.operators) {
    composition.operators = [];
  }
  return composition.operators;
}

function ensureRelationships(composition: TechniqueComposition): TechniqueRelationship[] {
  if (!composition.relationships) {
    composition.relationships = [];
  }
  return composition.relationships;
}

function resolveInsertIndex(
  primitiveIds: string[],
  options: AddPrimitiveOptions = {}
): number {
  if (typeof options.index === 'number') {
    if (!Number.isFinite(options.index) || options.index < 0) {
      throw new Error('unverified_by_trace(primitive_index_invalid)');
    }
    return Math.min(options.index, primitiveIds.length);
  }
  if (options.before) {
    const index = primitiveIds.indexOf(options.before);
    if (index < 0) {
      throw new Error(`unverified_by_trace(primitive_missing_before): ${options.before}`);
    }
    return index;
  }
  if (options.after) {
    const index = primitiveIds.indexOf(options.after);
    if (index < 0) {
      throw new Error(`unverified_by_trace(primitive_missing_after): ${options.after}`);
    }
    return index + 1;
  }
  return primitiveIds.length;
}

function buildFromId(
  compositionId: string,
  compositions: TechniqueComposition[]
): TechniqueComposition {
  const composition = compositions.find((entry) => entry.id === compositionId);
  if (!composition) {
    throw new Error(`unverified_by_trace(composition_missing): ${compositionId}`);
  }
  return cloneComposition(composition);
}

function buildReferenceSet(composition: TechniqueComposition): Set<string> {
  const operatorIds = new Set((composition.operators ?? []).map((operator) => operator.id));
  return new Set([...composition.primitiveIds, ...operatorIds]);
}

function assertReferencesExist(
  ids: string[],
  referenceSet: Set<string>,
  label: string
): void {
  const missing = ids.filter((id) => !referenceSet.has(id));
  if (missing.length > 0) {
    throw new Error(`unverified_by_trace(${label}_missing): ${missing.join(',')}`);
  }
}

function assertNoDuplicateReferences(ids: string[], label: string): void {
  if (ids.length < 2) return;
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`unverified_by_trace(${label}_duplicate): ${id}`);
    }
    seen.add(id);
  }
}

function isOperatorValid(operator: TechniqueOperator): boolean {
  const inputs = operator.inputs ?? [];
  const outputs = operator.outputs ?? [];
  if (inputs.length === 0 && outputs.length === 0) {
    return false;
  }
  const semantics = getOperatorSemantics(operator.type);
  if (inputs.length < semantics.minInputs || outputs.length < semantics.minOutputs) {
    return false;
  }
  if (typeof semantics.maxInputs === 'number' && inputs.length > semantics.maxInputs) {
    return false;
  }
  if (typeof semantics.maxOutputs === 'number' && outputs.length > semantics.maxOutputs) {
    return false;
  }
  return true;
}

function resolveNow(now?: string): string {
  if (!now) {
    throw new Error('unverified_by_trace(timestamp_required)');
  }
  if (typeof now !== 'string' || Number.isNaN(Date.parse(now))) {
    throw new Error('unverified_by_trace(invalid_timestamp)');
  }
  return now;
}

export class TechniqueCompositionBuilder {
  private composition: TechniqueComposition;

  constructor(input: {
    id: string;
    name: string;
    description: string;
    primitiveIds?: string[];
    operators?: TechniqueOperator[];
    relationships?: TechniqueRelationship[];
    graphVersion?: TechniqueCompositionGraphVersion;
    createdAt?: string;
    updatedAt?: string;
  }) {
    this.composition = createTechniqueComposition({
      id: input.id,
      name: input.name,
      description: input.description,
      primitiveIds: input.primitiveIds ?? [],
      operators: input.operators,
      relationships: input.relationships,
      graphVersion: input.graphVersion,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    });
  }

  static from(
    composition: TechniqueComposition,
    overrides?: Partial<Pick<TechniqueComposition, 'id' | 'name' | 'description' | 'graphVersion'>>
  ): TechniqueCompositionBuilder {
    const base = cloneComposition(composition);
    return new TechniqueCompositionBuilder({
      ...base,
      id: overrides?.id ?? base.id,
      name: overrides?.name ?? base.name,
      description: overrides?.description ?? base.description,
      graphVersion: overrides?.graphVersion ?? base.graphVersion,
      createdAt: base.createdAt,
    });
  }

  static fromId(
    compositionId: string,
    compositions: TechniqueComposition[] = DEFAULT_TECHNIQUE_COMPOSITIONS
  ): TechniqueCompositionBuilder {
    return TechniqueCompositionBuilder.from(buildFromId(compositionId, compositions));
  }

  setName(name: string): TechniqueCompositionBuilder {
    this.composition.name = name;
    return this;
  }

  setDescription(description: string): TechniqueCompositionBuilder {
    this.composition.description = description;
    return this;
  }

  setGraphVersion(graphVersion: TechniqueCompositionGraphVersion): TechniqueCompositionBuilder {
    this.composition.graphVersion = graphVersion;
    return this;
  }

  addPrimitive(primitiveId: string, options: AddPrimitiveOptions = {}): TechniqueCompositionBuilder {
    assertSafeId(primitiveId, 'primitive_id');
    if (!options.allowDuplicates && this.composition.primitiveIds.includes(primitiveId)) {
      return this;
    }
    const index = resolveInsertIndex(this.composition.primitiveIds, options);
    this.composition.primitiveIds.splice(index, 0, primitiveId);
    return this;
  }

  removePrimitive(primitiveId: string): TechniqueCompositionBuilder {
    this.composition.primitiveIds = this.composition.primitiveIds.filter((id) => id !== primitiveId);
    if (this.composition.relationships) {
      this.composition.relationships = this.composition.relationships.filter(
        (relationship) => relationship.fromId !== primitiveId && relationship.toId !== primitiveId
      );
    }
    if (this.composition.operators) {
      const removedOperatorIds = new Set<string>();
      this.composition.operators = this.composition.operators
        .map((operator) => ({
          ...operator,
          inputs: operator.inputs?.filter((id) => id !== primitiveId),
          outputs: operator.outputs?.filter((id) => id !== primitiveId),
        }))
        .filter((operator) => {
          const keep = isOperatorValid(operator);
          if (!keep) {
            removedOperatorIds.add(operator.id);
          }
          return keep;
        });
      if (this.composition.relationships && removedOperatorIds.size > 0) {
        this.composition.relationships = this.composition.relationships.filter(
          (relationship) =>
            !removedOperatorIds.has(relationship.fromId) && !removedOperatorIds.has(relationship.toId)
        );
      }
    }
    return this;
  }

  addOperator(operator: TechniqueOperator): TechniqueCompositionBuilder {
    assertSafeId(operator.id, 'operator_id');
    const operators = ensureOperators(this.composition);
    if (operators.some((entry) => entry.id === operator.id)) {
      throw new Error(`unverified_by_trace(operator_duplicate): ${operator.id}`);
    }
    if (this.composition.primitiveIds.includes(operator.id)) {
      throw new Error(`unverified_by_trace(operator_id_collision): ${operator.id}`);
    }
    try {
      getOperatorSemantics(operator.type);
    } catch (error) {
      const safeType = operator.type.replace(/[^a-zA-Z0-9_:-]/g, '_').slice(0, 120);
      throw new Error(`unverified_by_trace(operator_type_unknown): ${safeType}`);
    }
    const referenceSet = buildReferenceSet(this.composition);
    assertReferencesExist(operator.inputs ?? [], referenceSet, 'operator_inputs');
    assertReferencesExist(operator.outputs ?? [], referenceSet, 'operator_outputs');
    assertNoDuplicateReferences(operator.inputs ?? [], 'operator_inputs');
    assertNoDuplicateReferences(operator.outputs ?? [], 'operator_outputs');
    operators.push(cloneOperator(operator));
    return this;
  }

  relate(
    fromId: string,
    type: TechniqueRelationshipType,
    toId: string,
    options?: { condition?: string; weight?: number; notes?: string }
  ): TechniqueCompositionBuilder {
    if (fromId === toId) {
      throw new Error('unverified_by_trace(relationship_self_loop)');
    }
    assertSafeId(fromId, 'relationship_from_id');
    assertSafeId(toId, 'relationship_to_id');
    assertRelationshipType(type);
    const referenceSet = buildReferenceSet(this.composition);
    assertReferencesExist([fromId], referenceSet, 'relationship_from');
    assertReferencesExist([toId], referenceSet, 'relationship_to');
    ensureRelationships(this.composition).push(normalizeRelationshipFields({
      fromId,
      toId,
      type,
      condition: options?.condition,
      weight: options?.weight,
      notes: options?.notes,
    }));
    return this;
  }

  addRelationship(relationship: TechniqueRelationship): TechniqueCompositionBuilder {
    if (relationship.fromId === relationship.toId) {
      throw new Error('unverified_by_trace(relationship_self_loop)');
    }
    assertSafeId(relationship.fromId, 'relationship_from_id');
    assertSafeId(relationship.toId, 'relationship_to_id');
    assertRelationshipType(relationship.type);
    const referenceSet = buildReferenceSet(this.composition);
    assertReferencesExist([relationship.fromId], referenceSet, 'relationship_from');
    assertReferencesExist([relationship.toId], referenceSet, 'relationship_to');
    ensureRelationships(this.composition).push(normalizeRelationshipFields(relationship));
    return this;
  }

  merge(
    other: TechniqueCompositionBuilder | TechniqueComposition,
    options: MergeOptions = {}
  ): TechniqueCompositionBuilder {
    const source = other instanceof TechniqueCompositionBuilder ? other.snapshot() : cloneComposition(other);
    const allowDuplicates = options.allowDuplicatePrimitives ?? false;
    const base = cloneComposition(this.composition);
    const nextPrimitiveIds = [...base.primitiveIds];
    const seenPrimitiveIds = new Set(nextPrimitiveIds);
    for (const primitiveId of source.primitiveIds) {
      assertSafeId(primitiveId, 'primitive_id');
      if (allowDuplicates || !seenPrimitiveIds.has(primitiveId)) {
        nextPrimitiveIds.push(primitiveId);
        seenPrimitiveIds.add(primitiveId);
      }
    }

    const existingOperators = base.operators ?? [];
    const pendingOperators = options.mergeOperators && source.operators
      ? source.operators.map(cloneOperator)
      : [];
    const nextOperators = [...existingOperators];
    const operatorIds = new Set(nextOperators.map((operator) => operator.id));
    if (pendingOperators.length > 0) {
      for (const operator of pendingOperators) {
        assertSafeId(operator.id, 'operator_id');
        if (operatorIds.has(operator.id)) {
          throw new Error(`unverified_by_trace(operator_duplicate): ${operator.id}`);
        }
        if (nextPrimitiveIds.includes(operator.id)) {
          throw new Error(`unverified_by_trace(operator_id_collision): ${operator.id}`);
        }
        operatorIds.add(operator.id);
      }
    }

    const referenceSet = new Set([...nextPrimitiveIds, ...operatorIds]);
    for (const operator of pendingOperators) {
      try {
        getOperatorSemantics(operator.type);
      } catch (error) {
        const safeType = operator.type.replace(/[^a-zA-Z0-9_:-]/g, '_').slice(0, 120);
        throw new Error(`unverified_by_trace(operator_type_unknown): ${safeType}`);
      }
      assertReferencesExist(operator.inputs ?? [], referenceSet, 'operator_inputs');
      assertReferencesExist(operator.outputs ?? [], referenceSet, 'operator_outputs');
      assertNoDuplicateReferences(operator.inputs ?? [], 'operator_inputs');
      assertNoDuplicateReferences(operator.outputs ?? [], 'operator_outputs');
    }
    nextOperators.push(...pendingOperators);

    const existingRelationships = base.relationships ?? [];
    const nextRelationships = [...existingRelationships];
    if (options.mergeRelationships && source.relationships) {
      const seen = new Set(nextRelationships.map(
        (relationship) => `${relationship.fromId}|${relationship.type}|${relationship.toId}`
      ));
      for (const relationship of source.relationships) {
        const normalized = normalizeRelationshipFields(relationship);
        const key = `${normalized.fromId}|${normalized.type}|${normalized.toId}`;
        if (seen.has(key)) {
          continue;
        }
        nextRelationships.push(normalized);
        seen.add(key);
      }
    }

    if (options.mergeOperators || options.mergeRelationships) {
      for (const operator of nextOperators) {
        try {
          getOperatorSemantics(operator.type);
        } catch (error) {
          const safeType = operator.type.replace(/[^a-zA-Z0-9_:-]/g, '_').slice(0, 120);
          throw new Error(`unverified_by_trace(operator_type_unknown): ${safeType}`);
        }
        assertReferencesExist(operator.inputs ?? [], referenceSet, 'operator_inputs');
        assertReferencesExist(operator.outputs ?? [], referenceSet, 'operator_outputs');
        assertNoDuplicateReferences(operator.inputs ?? [], 'operator_inputs');
        assertNoDuplicateReferences(operator.outputs ?? [], 'operator_outputs');
      }
      for (const relationship of nextRelationships) {
        assertReferencesExist([relationship.fromId], referenceSet, 'relationship_from');
        assertReferencesExist([relationship.toId], referenceSet, 'relationship_to');
      }
    }

    const merged: TechniqueComposition = {
      ...base,
      primitiveIds: nextPrimitiveIds,
      operators: nextOperators.length > 0 ? nextOperators : undefined,
      relationships: nextRelationships.length > 0 ? nextRelationships : undefined,
    };
    this.composition = merged;
    return this;
  }

  snapshot(): TechniqueComposition {
    return cloneComposition(this.composition);
  }

  build(options: CompositionBuildOptions): TechniqueComposition {
    const now = resolveNow(options.now);
    const built: TechniqueComposition = {
      ...this.composition,
      primitiveIds: [...this.composition.primitiveIds],
      operators: this.composition.operators ? this.composition.operators.map(cloneOperator) : undefined,
      relationships: this.composition.relationships ? this.composition.relationships.map(cloneRelationship) : undefined,
      updatedAt: now,
      createdAt: this.composition.createdAt || now,
    };

    if (!options.primitives && !options.skipValidation) {
      throw new Error('unverified_by_trace(primitives_required)');
    }
    if (options.primitives) {
      assertCompositionReferences(
        { compositions: [built], primitives: options.primitives },
        { allowMissingPrimitives: options.allowMissingPrimitives }
      );
    }

    return built;
  }
}
