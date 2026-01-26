import type { CompositionPattern } from './pattern_catalog.js';
import type { TechniqueComposition, TechniqueOperator, TechniqueOperatorType } from '../strategic/techniques.js';
import { COMPOSITION_PATTERN_CATALOG } from './pattern_catalog.js';
import { DEFAULT_TECHNIQUE_PRIMITIVES, DEFAULT_TECHNIQUE_PRIMITIVES_BY_ID } from './technique_library.js';
import { DEFAULT_TECHNIQUE_COMPOSITIONS_BY_ID } from './technique_compositions.js';
import { TechniqueCompositionBuilder } from './technique_composition_builder.js';
import { loadPresets, savePresets } from './preset_storage.js';

const MAX_CONDITION_LENGTH = 512;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_ID_LENGTH = 120;
const MAX_OPERATOR_ID_LENGTH = 120;

export interface LCLExpression {
  base: 'pattern' | 'composition' | 'primitives';
  baseId?: string;
  primitiveIds?: string[];
  overrides?: Partial<Pick<CompositionPattern, 'corePrimitives' | 'optionalPrimitives'>>;
  conditionals?: LCLConditional[];
  operators?: LCLOperatorSpec[];
  name?: string;
  description?: string;
}

export interface LCLConditional {
  when: string;
  then: 'add' | 'remove' | 'replace';
  primitiveId: string;
}

export interface LCLOperatorSpec {
  type: TechniqueOperatorType;
  inputs: string[];
  outputs?: string[];
  parameters?: Record<string, unknown>;
}

export interface LCLCompileOptions {
  context?: Record<string, unknown>;
  now?: string;
  evaluateCondition?: (condition: string, context?: Record<string, unknown>) => boolean;
}

function assertSafeId(value: string, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`unverified_by_trace(invalid_${label}): must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ID_LENGTH || !SAFE_ID_PATTERN.test(trimmed)) {
    throw new Error(`unverified_by_trace(invalid_${label}): ${trimmed}`);
  }
  return trimmed;
}

function assertPrimitiveExists(primitiveId: string): void {
  if (!DEFAULT_TECHNIQUE_PRIMITIVES_BY_ID.has(primitiveId)) {
    throw new Error(`unverified_by_trace(lcl_primitive_not_found): ${primitiveId}`);
  }
}

function normalizePrimitiveIds(ids: unknown, label: string): string[] {
  if (!Array.isArray(ids)) {
    throw new Error(`unverified_by_trace(invalid_${label}): expected array`);
  }
  const out: string[] = [];
  for (const entry of ids) {
    if (typeof entry !== 'string') {
      throw new Error(`unverified_by_trace(invalid_${label}): must be string`);
    }
    const value = assertSafeId(entry, label);
    assertPrimitiveExists(value);
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

function normalizeReferenceIds(ids: unknown, label: string): string[] {
  if (!Array.isArray(ids)) {
    throw new Error(`unverified_by_trace(invalid_${label}): expected array`);
  }
  const out: string[] = [];
  for (const entry of ids) {
    if (typeof entry !== 'string') {
      throw new Error(`unverified_by_trace(invalid_${label}): must be string`);
    }
    const value = assertSafeId(entry, label);
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

function normalizeOptionalPrimitiveIds(overrides?: Partial<Pick<CompositionPattern, 'optionalPrimitives'>>): string[] {
  if (!overrides?.optionalPrimitives) return [];
  const ids: string[] = [];
  for (const item of overrides.optionalPrimitives) {
    if (typeof item.primitiveId !== 'string') {
      throw new Error('unverified_by_trace(invalid_optional_primitive_id)');
    }
    const primitiveId = assertSafeId(item.primitiveId, 'optional_primitive_id');
    assertPrimitiveExists(primitiveId);
    if (!ids.includes(primitiveId)) ids.push(primitiveId);
  }
  return ids;
}

function resolvePattern(patternId: string): CompositionPattern {
  const match = COMPOSITION_PATTERN_CATALOG.find((pattern) => pattern.id === patternId);
  if (!match) {
    throw new Error(`unverified_by_trace(lcl_pattern_not_found): ${patternId}`);
  }
  return match;
}

function resolveCompositionPrimitiveIds(compositionId: string): string[] {
  const composition = DEFAULT_TECHNIQUE_COMPOSITIONS_BY_ID.get(compositionId);
  if (!composition) {
    throw new Error(`unverified_by_trace(lcl_composition_not_found): ${compositionId}`);
  }
  return [...composition.primitiveIds];
}

function resolveBasePrimitives(expr: LCLExpression): string[] {
  if (expr.base === 'pattern') {
    if (!expr.baseId) {
      throw new Error('unverified_by_trace(lcl_base_missing): pattern baseId required');
    }
    const pattern = resolvePattern(assertSafeId(expr.baseId, 'pattern_id'));
    const overrideIds = expr.overrides?.corePrimitives;
    if (overrideIds && Array.isArray(overrideIds)) {
      return normalizePrimitiveIds(overrideIds, 'override_core_primitives');
    }
    const base = pattern.corePrimitives.map((id) => String(id));
    const primitiveIds = normalizePrimitiveIds(base, 'pattern_core_primitives');
    const optionalIds = normalizeOptionalPrimitiveIds(expr.overrides);
    return [...primitiveIds, ...optionalIds.filter((id) => !primitiveIds.includes(id))];
  }

  if (expr.base === 'composition') {
    if (!expr.baseId) {
      throw new Error('unverified_by_trace(lcl_base_missing): composition baseId required');
    }
    const overrideIds = expr.overrides?.corePrimitives;
    if (overrideIds && Array.isArray(overrideIds)) {
      return normalizePrimitiveIds(overrideIds, 'override_core_primitives');
    }
    return normalizePrimitiveIds(resolveCompositionPrimitiveIds(assertSafeId(expr.baseId, 'composition_id')),
      'composition_primitives');
  }

  if (expr.base === 'primitives') {
    if (!expr.primitiveIds) {
      throw new Error('unverified_by_trace(lcl_base_missing): primitiveIds required');
    }
    return normalizePrimitiveIds(expr.primitiveIds, 'primitive_ids');
  }

  throw new Error('unverified_by_trace(lcl_base_invalid)');
}

function buildCompositionName(expr: LCLExpression): string {
  if (expr.name && expr.name.trim().length > 0) {
    return expr.name.trim();
  }
  if (expr.base === 'pattern' && expr.baseId) {
    return `lcl_${expr.baseId}`;
  }
  if (expr.base === 'composition' && expr.baseId) {
    return `lcl_${expr.baseId}`;
  }
  return 'lcl_composition';
}

function buildCompositionDescription(expr: LCLExpression): string {
  if (expr.description && expr.description.trim().length > 0) {
    return expr.description.trim();
  }
  if (expr.base === 'pattern' && expr.baseId) {
    return `LCL composition derived from ${expr.baseId}`;
  }
  if (expr.base === 'composition' && expr.baseId) {
    return `LCL composition derived from ${expr.baseId}`;
  }
  return 'LCL composition derived from primitives';
}

function createCompositionId(): string {
  const nonce = Math.random().toString(36).slice(2, 8);
  const id = `tc_lcl_${Date.now()}_${nonce}`;
  return id.length > MAX_ID_LENGTH ? id.slice(0, MAX_ID_LENGTH) : id;
}

function resolveContextPath(pathSpec: string, context?: Record<string, unknown>): unknown {
  if (!context) return undefined;
  const trimmed = pathSpec.trim();
  if (trimmed.length === 0) return undefined;
  const segments = trimmed.split('.').map((segment) => segment.trim()).filter(Boolean);
  if (segments.some((segment) => !SAFE_ID_PATTERN.test(segment))) {
    return undefined;
  }
  let current: unknown = context;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function parseLiteral(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim();
  if (trimmed === 'true') return { ok: true, value: true };
  if (trimmed === 'false') return { ok: true, value: false };
  if (trimmed === 'null') return { ok: true, value: null };
  if (/^[-]?[0-9]+(\.[0-9]+)?$/.test(trimmed)) {
    const value = Number(trimmed);
    if (Number.isFinite(value)) return { ok: true, value };
  }
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
    return { ok: true, value: trimmed.slice(1, -1) };
  }
  return { ok: false };
}

function evaluateSimpleCondition(condition: string, context?: Record<string, unknown>): boolean {
  if (!condition || condition.length > MAX_CONDITION_LENGTH) return false;
  const trimmed = condition.trim();
  if (trimmed.length === 0) return false;

  if (trimmed.includes('||')) {
    return trimmed.split('||').some((part) => evaluateSimpleCondition(part, context));
  }
  if (trimmed.includes('&&')) {
    return trimmed.split('&&').every((part) => evaluateSimpleCondition(part, context));
  }
  if (trimmed.startsWith('!')) {
    return !evaluateSimpleCondition(trimmed.slice(1), context);
  }

  const comparatorMatch = trimmed.match(/^(?<path>[a-zA-Z0-9_.-]+)\s*(==|!=|>=|<=|>|<)\s*(?<value>.+)$/);
  if (comparatorMatch?.groups) {
    const left = resolveContextPath(comparatorMatch.groups.path, context);
    const parsed = parseLiteral(comparatorMatch.groups.value);
    if (!parsed.ok) return false;
    const right = parsed.value;
    switch (comparatorMatch[2]) {
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '>=':
        return typeof left === 'number' && typeof right === 'number' && left >= right;
      case '<=':
        return typeof left === 'number' && typeof right === 'number' && left <= right;
      case '>':
        return typeof left === 'number' && typeof right === 'number' && left > right;
      case '<':
        return typeof left === 'number' && typeof right === 'number' && left < right;
      default:
        return false;
    }
  }

  const value = resolveContextPath(trimmed, context);
  return Boolean(value);
}

function applyConditionals(
  builder: TechniqueCompositionBuilder,
  conditionals: LCLConditional[],
  options: LCLCompileOptions,
  baseOptions: { id: string; name: string; description: string }
): TechniqueCompositionBuilder {
  let current = builder;
  const evaluator = options.evaluateCondition ?? evaluateSimpleCondition;
  for (const conditional of conditionals) {
    const when = conditional.when?.trim() ?? '';
    if (when.length === 0) continue;
    if (!evaluator(when, options.context)) continue;
    const primitiveId = assertSafeId(conditional.primitiveId, 'conditional_primitive_id');
    assertPrimitiveExists(primitiveId);
    if (conditional.then === 'add') {
      current.addPrimitive(primitiveId);
    } else if (conditional.then === 'remove') {
      current.removePrimitive(primitiveId);
    } else if (conditional.then === 'replace') {
      current = new TechniqueCompositionBuilder({
        id: baseOptions.id,
        name: baseOptions.name,
        description: baseOptions.description,
        primitiveIds: [primitiveId],
      });
    }
  }
  return current;
}

function normalizeOperatorSpec(spec: LCLOperatorSpec, index: number, existingIds: Set<string>): TechniqueOperator {
  const inputs = normalizeReferenceIds(spec.inputs, 'operator_inputs');
  const outputs = spec.outputs ? normalizeReferenceIds(spec.outputs, 'operator_outputs') : undefined;
  let baseId = `lcl_${spec.type}_${index + 1}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (baseId.length > MAX_OPERATOR_ID_LENGTH) {
    baseId = baseId.slice(0, MAX_OPERATOR_ID_LENGTH);
  }
  let candidate = baseId;
  let counter = 1;
  while (existingIds.has(candidate)) {
    candidate = `${baseId}_${counter}`;
    if (candidate.length > MAX_OPERATOR_ID_LENGTH) {
      candidate = candidate.slice(0, MAX_OPERATOR_ID_LENGTH);
    }
    counter += 1;
  }
  existingIds.add(candidate);
  return {
    id: candidate,
    type: spec.type,
    inputs,
    outputs,
    parameters: spec.parameters,
  };
}

export function compileLCL(expr: LCLExpression, options: LCLCompileOptions = {}): TechniqueComposition {
  if (!expr || typeof expr !== 'object') {
    throw new Error('unverified_by_trace(lcl_expression_invalid)');
  }
  const now = options.now ?? new Date().toISOString();
  const id = createCompositionId();
  const name = buildCompositionName(expr);
  const description = buildCompositionDescription(expr);

  let builder: TechniqueCompositionBuilder;
  if (expr.base === 'composition') {
    const compositionId = assertSafeId(expr.baseId ?? '', 'composition_id');
    const base = DEFAULT_TECHNIQUE_COMPOSITIONS_BY_ID.get(compositionId);
    if (!base) {
      throw new Error(`unverified_by_trace(lcl_composition_not_found): ${compositionId}`);
    }
    builder = TechniqueCompositionBuilder.from(base, { id, name, description });
    if (expr.overrides?.corePrimitives || expr.overrides?.optionalPrimitives) {
      const overrides = resolveBasePrimitives(expr);
      builder = new TechniqueCompositionBuilder({ id, name, description, primitiveIds: overrides });
    }
  } else {
    const basePrimitives = resolveBasePrimitives(expr);
    builder = new TechniqueCompositionBuilder({ id, name, description, primitiveIds: basePrimitives });
  }

  if (expr.conditionals && expr.conditionals.length > 0) {
    builder = applyConditionals(builder, expr.conditionals, options, { id, name, description });
  }

  if (expr.operators && expr.operators.length > 0) {
    const snapshot = builder.snapshot();
    const existingIds = new Set<string>([
      ...snapshot.primitiveIds,
      ...(snapshot.operators ?? []).map((operator) => operator.id),
    ]);
    expr.operators.forEach((spec, index) => {
      const operator = normalizeOperatorSpec(spec, index, existingIds);
      builder.addOperator(operator);
    });
  }

  return builder.build({
    now,
    primitives: DEFAULT_TECHNIQUE_PRIMITIVES,
  });
}

export async function loadPreset(
  presetName: string,
  options?: { workspaceRoot?: string }
): Promise<LCLExpression | null> {
  const name = assertSafeId(presetName, 'preset_name');
  const presets = await loadPresets(options?.workspaceRoot);
  return presets[name] ?? null;
}

export async function savePreset(
  presetName: string,
  expression: LCLExpression,
  options?: { workspaceRoot?: string }
): Promise<void> {
  const name = assertSafeId(presetName, 'preset_name');
  const presets = await loadPresets(options?.workspaceRoot);
  presets[name] = expression;
  await savePresets(presets, options?.workspaceRoot);
}
