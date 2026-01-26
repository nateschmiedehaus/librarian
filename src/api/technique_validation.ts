import type { TechniqueComposition, TechniquePrimitive } from '../strategic/techniques.js';
import { getRelationshipSemantics } from '../strategic/technique_semantics.js';
import { validateTechniquePrimitiveExamples } from './technique_contracts.js';

export type TechniqueValidationSeverity = 'error' | 'warning';

export interface TechniqueValidationIssue {
  severity: TechniqueValidationSeverity;
  code: string;
  message: string;
  targetId?: string;
  targetType?: 'primitive' | 'composition' | 'relationship';
}

export interface TechniquePrimitiveSignature {
  id: string;
  inputs: string[];
  outputs: string[];
  hasContract: boolean;
}

export interface TechniquePrimitiveAnalysis {
  signature: TechniquePrimitiveSignature;
  issues: TechniqueValidationIssue[];
}

export interface TechniqueCompositionAnalysis {
  missingPrimitiveIds: string[];
  signatures: Map<string, TechniquePrimitiveSignature>;
  issues: TechniqueValidationIssue[];
}

const SEMANTIC_TERMINATION_VALUES = new Set(['always', 'conditional', 'unknown']);
const SEMANTIC_DETERMINISM_VALUES = new Set(['deterministic', 'probabilistic', 'unknown']);
const SEMANTIC_COMPLEXITY_VALUES = new Set(['constant', 'linear', 'quadratic', 'unbounded', 'unknown']);
const DATAFLOW_RELATIONSHIPS = new Set([
  'produces',
  'evidence_for',
  'derived_from',
  'refines',
  'requires_context',
]);
const REVERSE_DATAFLOW_RELATIONSHIPS = new Set(['consumes']);
const CYCLE_DEPENDENCY_TYPES = new Set([
  'blocked_by',
  'requires_decision',
  'requires_research',
  'requires_approval',
  'requires_resource',
]);

function normalizeLabels(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function hasOverlap(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function hasDependencyCycle(edges: Map<string, Set<string>>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const nodes = new Set<string>();
  for (const [from, tos] of edges) {
    nodes.add(from);
    for (const to of tos) nodes.add(to);
  }

  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of edges.get(node) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of nodes) {
    if (visit(node)) return true;
  }
  return false;
}

export function analyzeTechniquePrimitive(
  primitive: TechniquePrimitive,
  options?: { strictContracts?: boolean }
): TechniquePrimitiveAnalysis {
  const issues: TechniqueValidationIssue[] = [];
  const contract = primitive.contract;

  if (!contract) {
    issues.push({
      severity: options?.strictContracts ? 'error' : 'warning',
      code: 'primitive_contract_missing',
      message: `Primitive ${primitive.id} has no executable contract.`,
      targetId: primitive.id,
      targetType: 'primitive',
    });
  } else {
    if (!Array.isArray(contract.inputs) || !Array.isArray(contract.outputs)) {
      issues.push({
        severity: 'error',
        code: 'primitive_contract_shape_invalid',
        message: `Primitive ${primitive.id} contract inputs/outputs must be arrays.`,
        targetId: primitive.id,
        targetType: 'primitive',
      });
    } else {
      for (const field of contract.inputs) {
        if (!field || typeof field.name !== 'string' || field.name.trim().length === 0) {
          issues.push({
            severity: 'error',
            code: 'primitive_contract_input_invalid',
            message: `Primitive ${primitive.id} has invalid contract input names.`,
            targetId: primitive.id,
            targetType: 'primitive',
          });
          break;
        }
      }
      for (const field of contract.outputs) {
        if (!field || typeof field.name !== 'string' || field.name.trim().length === 0) {
          issues.push({
            severity: 'error',
            code: 'primitive_contract_output_invalid',
            message: `Primitive ${primitive.id} has invalid contract output names.`,
            targetId: primitive.id,
            targetType: 'primitive',
          });
          break;
        }
      }
    }
  }

  const semantics = primitive.semantics;
  if (semantics) {
    if (!SEMANTIC_TERMINATION_VALUES.has(semantics.termination)) {
      issues.push({
        severity: 'error',
        code: 'primitive_semantics_termination_invalid',
        message: `Primitive ${primitive.id} has invalid termination semantics.`,
        targetId: primitive.id,
        targetType: 'primitive',
      });
    }
    if (!SEMANTIC_DETERMINISM_VALUES.has(semantics.determinism)) {
      issues.push({
        severity: 'error',
        code: 'primitive_semantics_determinism_invalid',
        message: `Primitive ${primitive.id} has invalid determinism semantics.`,
        targetId: primitive.id,
        targetType: 'primitive',
      });
    }
    if (!SEMANTIC_COMPLEXITY_VALUES.has(semantics.complexity)) {
      issues.push({
        severity: 'error',
        code: 'primitive_semantics_complexity_invalid',
        message: `Primitive ${primitive.id} has invalid complexity semantics.`,
        targetId: primitive.id,
        targetType: 'primitive',
      });
    }
  }

  const contractInputs = Array.isArray(contract?.inputs) ? contract.inputs : undefined;
  const contractOutputs = Array.isArray(contract?.outputs) ? contract.outputs : undefined;
  const contractInputNames = contractInputs
    ?.map((input) => input?.name)
    .filter((name): name is string => typeof name === 'string');
  const contractOutputNames = contractOutputs
    ?.map((output) => output?.name)
    .filter((name): name is string => typeof name === 'string');
  const signature: TechniquePrimitiveSignature = {
    id: primitive.id,
    inputs: normalizeLabels(contractInputNames ?? primitive.inputsRequired),
    outputs: normalizeLabels(contractOutputNames ?? primitive.outputs),
    hasContract: Boolean(contract),
  };

  const exampleIssues = validateTechniquePrimitiveExamples(primitive);
  if (exampleIssues.length > 0) {
    const detail = exampleIssues[0];
    issues.push({
      severity: options?.strictContracts ? 'error' : 'warning',
      code: 'primitive_contract_example_invalid',
      message: `Primitive ${primitive.id} has ${exampleIssues.length} invalid example(s). First: ${detail.message}`,
      targetId: primitive.id,
      targetType: 'primitive',
    });
  }

  return { signature, issues };
}

export function analyzeTechniqueComposition(
  composition: TechniqueComposition,
  primitives: TechniquePrimitive[],
  options?: { strictContracts?: boolean }
): TechniqueCompositionAnalysis {
  const primitiveById = new Map(primitives.map((primitive) => [primitive.id, primitive]));
  const missingPrimitiveIds = composition.primitiveIds.filter((id) => !primitiveById.has(id));
  const signatures = new Map<string, TechniquePrimitiveSignature>();
  const issues: TechniqueValidationIssue[] = [];
  const dependencyEdges = new Map<string, Set<string>>();

  if (missingPrimitiveIds.length > 0) {
    issues.push({
      severity: 'error',
      code: 'composition_missing_primitives',
      message: `Composition ${composition.id} references missing primitives.`,
      targetId: composition.id,
      targetType: 'composition',
    });
  }

  for (const primitiveId of composition.primitiveIds) {
    const primitive = primitiveById.get(primitiveId);
    if (!primitive) continue;
    const analysis = analyzeTechniquePrimitive(primitive, options);
    signatures.set(primitiveId, analysis.signature);
    issues.push(...analysis.issues);
  }

  for (const relationship of composition.relationships ?? []) {
    if (!relationship || typeof relationship.type !== 'string' || relationship.type.length === 0) {
      issues.push({
        severity: 'error',
        code: 'composition_relationship_type_invalid',
        message: `Composition ${composition.id} has invalid relationship type.`,
        targetId: composition.id,
        targetType: 'relationship',
      });
      continue;
    }
    if (relationship.fromId === relationship.toId) {
      issues.push({
        severity: 'warning',
        code: 'composition_relationship_self_loop',
        message: `Composition ${composition.id} has self-referential relationships.`,
        targetId: composition.id,
        targetType: 'relationship',
      });
    }
    const fromSignature = signatures.get(relationship.fromId);
    const toSignature = signatures.get(relationship.toId);
    if (!fromSignature || !toSignature) {
      issues.push({
        severity: 'error',
        code: 'composition_relationship_missing_node',
        message: `Composition ${composition.id} references missing relationship nodes.`,
        targetId: composition.id,
        targetType: 'relationship',
      });
      continue;
    }
    try {
      const semantics = getRelationshipSemantics(relationship.type);
      if (CYCLE_DEPENDENCY_TYPES.has(semantics.dependencyType) && semantics.direction !== 'bidirectional') {
        const fromId = semantics.direction === 'from_to' ? relationship.fromId : relationship.toId;
        const toId = semantics.direction === 'from_to' ? relationship.toId : relationship.fromId;
        if (!dependencyEdges.has(fromId)) dependencyEdges.set(fromId, new Set());
        dependencyEdges.get(fromId)?.add(toId);
      }
    } catch {
      issues.push({
        severity: 'error',
        code: 'composition_relationship_type_unknown',
        message: `Composition ${composition.id} has unknown relationship type.`,
        targetId: composition.id,
        targetType: 'relationship',
      });
      continue;
    }
    const isReverse = REVERSE_DATAFLOW_RELATIONSHIPS.has(relationship.type);
    const source = isReverse ? toSignature : fromSignature;
    const target = isReverse ? fromSignature : toSignature;
    if (DATAFLOW_RELATIONSHIPS.has(relationship.type) || REVERSE_DATAFLOW_RELATIONSHIPS.has(relationship.type)) {
      if (!hasOverlap(source.outputs, target.inputs)) {
        issues.push({
          severity: options?.strictContracts ? 'error' : 'warning',
          code: 'composition_data_gap',
          message: `Relationship ${relationship.type} lacks matching outputs/inputs between ${source.id} and ${target.id}.`,
          targetId: composition.id,
          targetType: 'composition',
        });
      }
    }
  }

  if (hasDependencyCycle(dependencyEdges)) {
    issues.push({
      severity: 'warning',
      code: 'composition_dependency_cycle',
      message: `Composition ${composition.id} has dependency cycles.`,
      targetId: composition.id,
      targetType: 'composition',
    });
  }

  return { missingPrimitiveIds, signatures, issues };
}
