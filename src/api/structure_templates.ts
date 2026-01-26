import type { LCLOperatorSpec } from './lcl.js';
import { configurable, resolveQuantifiedValue } from '../epistemics/quantification.js';

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const DEFAULT_MAX_ITERATIONS = configurable(
  10,
  [1, 100],
  'Default loop iteration cap for LCL structure templates.'
);

export type StructureTemplateName = keyof typeof STRUCTURE_TEMPLATES;

export interface StructureTemplateResult {
  operators: LCLOperatorSpec[];
}

function normalizePrimitiveIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('unverified_by_trace(structure_template_invalid_primitives)');
  }
  const out: string[] = [];
  for (const entry of ids) {
    if (typeof entry !== 'string') {
      throw new Error('unverified_by_trace(structure_template_invalid_primitives)');
    }
    const trimmed = entry.trim();
    if (!SAFE_ID_PATTERN.test(trimmed)) {
      throw new Error('unverified_by_trace(structure_template_invalid_id)');
    }
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  if (out.length === 0) {
    throw new Error('unverified_by_trace(structure_template_invalid_primitives)');
  }
  return out;
}

export const STRUCTURE_TEMPLATES = {
  pipeline: (primitiveIds: string[]): StructureTemplateResult => {
    const ids = normalizePrimitiveIds(primitiveIds);
    return {
      operators: [
        {
          type: 'sequence',
          inputs: ids,
          outputs: [ids[ids.length - 1]],
        },
      ],
    };
  },
  fanout: (primitiveIds: string[]): StructureTemplateResult => {
    const ids = normalizePrimitiveIds(primitiveIds);
    return {
      operators: [
        {
          type: 'parallel',
          inputs: ids,
          outputs: ids,
        },
      ],
    };
  },
  gated: (gateId: string, primitiveIds: string[], options?: { failOnGate?: boolean }): StructureTemplateResult => {
    const gate = normalizePrimitiveIds([gateId])[0];
    const ids = normalizePrimitiveIds(primitiveIds);
    return {
      operators: [
        {
          type: 'gate',
          inputs: [gate, ...ids],
          outputs: ids,
          parameters: {
            failOnGate: options?.failOnGate ?? true,
          },
        },
      ],
    };
  },
  iterative: (
    primitiveIds: string[],
    options?: { maxIterations?: number; terminationCondition?: string }
  ): StructureTemplateResult => {
    const ids = normalizePrimitiveIds(primitiveIds);
    return {
      operators: [
        {
          type: 'loop',
          inputs: ids,
          parameters: {
            maxIterations: options?.maxIterations ?? resolveQuantifiedValue(DEFAULT_MAX_ITERATIONS),
            terminationCondition: options?.terminationCondition ?? 'convergence',
          },
        },
      ],
    };
  },
  quorum: (primitiveIds: string[], options?: { threshold?: number }): StructureTemplateResult => {
    const ids = normalizePrimitiveIds(primitiveIds);
    return {
      operators: [
        {
          type: 'quorum',
          inputs: ids,
          parameters: {
            threshold: options?.threshold ?? Math.max(1, Math.ceil(ids.length / 2)),
          },
        },
      ],
    };
  },
} as const;

export function applyTemplate(template: 'pipeline', primitiveIds: string[]): LCLOperatorSpec[];
export function applyTemplate(template: 'fanout', primitiveIds: string[]): LCLOperatorSpec[];
export function applyTemplate(
  template: 'gated',
  gateId: string,
  primitiveIds: string[],
  options?: { failOnGate?: boolean }
): LCLOperatorSpec[];
export function applyTemplate(
  template: 'iterative',
  primitiveIds: string[],
  options?: { maxIterations?: number; terminationCondition?: string }
): LCLOperatorSpec[];
export function applyTemplate(
  template: 'quorum',
  primitiveIds: string[],
  options?: { threshold?: number }
): LCLOperatorSpec[];
export function applyTemplate(template: StructureTemplateName, ...args: unknown[]): LCLOperatorSpec[] {
  switch (template) {
    case 'pipeline':
      return STRUCTURE_TEMPLATES.pipeline(args[0] as string[]).operators;
    case 'fanout':
      return STRUCTURE_TEMPLATES.fanout(args[0] as string[]).operators;
    case 'gated':
      return STRUCTURE_TEMPLATES.gated(
        args[0] as string,
        args[1] as string[],
        args[2] as { failOnGate?: boolean } | undefined
      ).operators;
    case 'iterative':
      return STRUCTURE_TEMPLATES.iterative(
        args[0] as string[],
        args[1] as { maxIterations?: number; terminationCondition?: string } | undefined
      ).operators;
    case 'quorum':
      return STRUCTURE_TEMPLATES.quorum(
        args[0] as string[],
        args[1] as { threshold?: number } | undefined
      ).operators;
    default:
      throw new Error(`unverified_by_trace(structure_template_unknown): ${String(template)}`);
  }
}
