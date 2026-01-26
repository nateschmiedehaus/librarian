import { describe, it, expect, vi } from 'vitest';
import {
  createTechniqueComposition,
  createTechniquePrimitive,
  type JsonSchemaObject,
  type JsonSchemaType,
} from '../techniques.js';
import { createVerificationPlan } from '../verification_plan.js';

describe('technique primitives', () => {
  it('defaults missing arrays', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T03:00:00.000Z'));

    const primitive = createTechniquePrimitive({
      id: 'tp-1',
      name: 'Hypothesis Split',
      intent: 'Diagnose root cause',
    });

    expect(primitive.triggers).toEqual([]);
    expect(primitive.actions).toEqual([]);
    expect(primitive.primitiveKind).toBe('procedural');
    expect(primitive.abstractionLevel).toBe('tactical');
    expect(primitive.contract?.inputs).toEqual([]);
    expect(primitive.contract?.outputs).toEqual([]);
    expect(primitive.contract?.inputSchema).toMatchObject({
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: true,
    });
    expect(primitive.contract?.outputSchema).toMatchObject({
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: true,
    });
    expect(primitive.createdAt).toBe('2026-01-19T03:00:00.000Z');

    vi.useRealTimers();
  });

  it('creates a composition with timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T03:05:00.000Z'));

    const composition = createTechniqueComposition({
      id: 'tc-1',
      name: 'Debug Loop',
      description: 'Hypothesize, test, refine',
      primitiveIds: ['tp-1', 'tp-2'],
    });

    expect(composition.primitiveIds).toEqual(['tp-1', 'tp-2']);
    expect(composition.createdAt).toBe('2026-01-19T03:05:00.000Z');

    vi.useRealTimers();
  });

  it('defaults semantic fields on primitives', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp-defaults',
      name: 'Defaults',
      intent: 'Check defaults',
    });

    expect(primitive.category).toBe('general');
    expect(primitive.semanticProfileId).toBe('general');
    expect(primitive.domains).toEqual([]);
    expect(primitive.semantics).toBeUndefined();
    expect(primitive.contract?.inputs).toEqual([]);
  });

  it('preserves explicit semantic fields on primitives', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp-explicit',
      name: 'Explicit',
      intent: 'Check explicit fields',
      category: 'analysis',
      semanticProfileId: 'analysis',
      primitiveKind: 'diagnostic',
      abstractionLevel: 'strategic',
      domains: ['debugging', 'evidence'],
      semantics: {
        preconditions: ['Signal observed'],
        postconditions: ['Evidence logged'],
        invariants: ['Evidence linked'],
        evidenceRequirements: ['Trace output'],
        termination: 'conditional',
        determinism: 'probabilistic',
        complexity: 'linear',
      },
    });

    expect(primitive.category).toBe('analysis');
    expect(primitive.semanticProfileId).toBe('analysis');
    expect(primitive.primitiveKind).toBe('diagnostic');
    expect(primitive.abstractionLevel).toBe('strategic');
    expect(primitive.domains).toEqual(['debugging', 'evidence']);
    expect(primitive.semantics?.preconditions).toEqual(['Signal observed']);
  });

  it('derives verification checks from plans', () => {
    const verification = createVerificationPlan({
      id: 'vp-test',
      target: 'Testing',
      methods: [
        {
          type: 'automated_test',
          description: 'Run unit tests',
          automatable: true,
          command: 'npm test',
        },
        {
          type: 'manual_test',
          description: 'Manual inspection',
          automatable: false,
        },
      ],
      expectedObservations: ['Tests pass'],
    });
    const primitive = createTechniquePrimitive({
      id: 'tp-verify',
      name: 'Verify',
      intent: 'Check verification contract',
      inputsRequired: ['signal'],
      outputs: ['report'],
      verification,
    });

    expect(primitive.contract?.verification?.automatedChecks).toEqual(['automated_test:npm test']);
    expect(primitive.contract?.verification?.manualChecks).toEqual(['Manual inspection']);
    expect(primitive.contract?.verification?.expectedObservations).toEqual(['Tests pass']);
    expect(primitive.contract?.inputs[0]?.origin).toBe('unspecified');
    expect(primitive.contract?.inputSchema).toMatchObject({
      required: ['signal'],
    });
    expect(primitive.contract?.outputSchema).toMatchObject({
      required: ['report'],
    });
  });

  it('rejects invalid contract schemas', () => {
    expect(() => createTechniquePrimitive({
      id: 'tp-schema',
      name: 'Schema',
      intent: 'Reject invalid schema',
      inputsRequired: ['input'],
      outputs: ['output'],
      contract: {
        inputs: [{ name: 'input', required: true, origin: 'declared' }],
        outputs: [{ name: 'output', required: true, origin: 'declared' }],
        inputSchema: { type: 'bogus' } as unknown as JsonSchemaObject,
      },
    })).toThrow(/invalid_technique_contract/);
  });

  it('rejects malformed schema requirements', () => {
    expect(() => createTechniquePrimitive({
      id: 'tp-schema-required-missing',
      name: 'Schema required',
      intent: 'Reject missing required fields',
      inputsRequired: ['input'],
      outputs: ['output'],
      contract: {
        inputs: [{ name: 'input', required: true, origin: 'declared' }],
        outputs: [{ name: 'output', required: true, origin: 'declared' }],
        inputSchema: {
          type: 'object',
          properties: {},
          required: ['missing'],
          additionalProperties: true,
        },
      },
    })).toThrow(/invalid_technique_contract/);

    expect(() => createTechniquePrimitive({
      id: 'tp-schema-required-type',
      name: 'Schema required type',
      intent: 'Reject non-string required entries',
      inputsRequired: ['input'],
      outputs: ['output'],
      contract: {
        inputs: [{ name: 'input', required: true, origin: 'declared' }],
        outputs: [{ name: 'output', required: true, origin: 'declared' }],
        inputSchema: {
          type: 'object',
          properties: { input: { type: 'string' } },
          required: ['input', 123 as unknown as string],
          additionalProperties: true,
        },
      },
    })).toThrow(/invalid_technique_contract/);
  });

  it('rejects invalid nested schemas', () => {
    expect(() => createTechniquePrimitive({
      id: 'tp-schema-nested',
      name: 'Schema nested',
      intent: 'Reject nested schema',
      inputsRequired: ['input'],
      outputs: ['output'],
      contract: {
        inputs: [{ name: 'input', required: true, origin: 'declared' }],
        outputs: [{ name: 'output', required: true, origin: 'declared' }],
        inputSchema: {
          type: 'object',
          properties: { input: { type: 'string' } },
          required: ['input'],
          additionalProperties: { type: 'bogus' } as unknown as JsonSchemaObject,
        },
      },
    })).toThrow(/invalid_technique_contract/);

    expect(() => createTechniquePrimitive({
      id: 'tp-schema-nested-props',
      name: 'Schema nested props',
      intent: 'Reject nested properties',
      inputsRequired: ['input'],
      outputs: ['output'],
      contract: {
        inputs: [{ name: 'input', required: true, origin: 'declared' }],
        outputs: [{ name: 'output', required: true, origin: 'declared' }],
        inputSchema: {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: { bad: { type: 'bogus' as unknown as JsonSchemaType } },
            },
          },
          required: ['nested'],
          additionalProperties: true,
        },
      },
    })).toThrow(/invalid_technique_contract/);

    expect(() => createTechniquePrimitive({
      id: 'tp-schema-nested-items',
      name: 'Schema nested items',
      intent: 'Reject nested items',
      inputsRequired: ['input'],
      outputs: ['output'],
      contract: {
        inputs: [{ name: 'input', required: true, origin: 'declared' }],
        outputs: [{ name: 'output', required: true, origin: 'declared' }],
        inputSchema: {
          type: 'object',
          properties: {
            list: {
              type: 'array',
              items: { type: 'bogus' as unknown as JsonSchemaType },
            },
          },
          required: ['list'],
          additionalProperties: true,
        },
      },
    })).toThrow(/invalid_technique_contract/);
  });

  it('accepts explicit valid schemas', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp-schema-valid',
      name: 'Schema valid',
      intent: 'Accept valid schema',
      contract: {
        inputs: [{ name: 'input', required: true, origin: 'declared', type: 'string' }],
        outputs: [{ name: 'output', required: true, origin: 'declared', type: 'boolean' }],
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input value' },
            nested: {
              type: 'object',
              properties: { child: { type: 'number' } },
              additionalProperties: false,
            },
          },
          required: ['input'],
          additionalProperties: false,
        },
        outputSchema: {
          type: 'object',
          properties: { output: { type: 'boolean' } },
          required: ['output'],
          additionalProperties: false,
        },
      },
    });

    expect(primitive.contract?.inputSchema?.properties?.input).toMatchObject({ type: 'string' });
    expect(primitive.contract?.outputSchema?.properties?.output).toMatchObject({ type: 'boolean' });
  });

  it('rejects unsafe field names', () => {
    expect(() => createTechniquePrimitive({
      id: 'tp-schema-unsafe',
      name: 'Schema unsafe',
      intent: 'Reject unsafe field names',
      contract: {
        inputs: [{ name: '__proto__', required: true, origin: 'declared', type: 'string' }],
        outputs: [{ name: 'output', required: true, origin: 'declared', type: 'string' }],
      },
    })).toThrow(/invalid_technique_contract/);

    expect(() => createTechniquePrimitive({
      id: 'tp-schema-unsafe-prop',
      name: 'Schema unsafe prop',
      intent: 'Reject unsafe schema properties',
      contract: {
        inputs: [{ name: 'input', required: true, origin: 'declared', type: 'string' }],
        outputs: [{ name: 'output', required: true, origin: 'declared', type: 'string' }],
        inputSchema: {
          type: 'object',
          properties: { '<script>': { type: 'string' } },
          required: ['<script>'],
          additionalProperties: true,
        },
      },
    })).toThrow(/invalid_technique_contract/);
  });

  it('rejects overly deep schemas', () => {
    let nested: JsonSchemaObject = { type: 'object', properties: {}, additionalProperties: true };
    for (let i = 0; i < 25; i += 1) {
      nested = {
        type: 'object',
        properties: { level: nested },
        required: ['level'],
        additionalProperties: true,
      };
    }

    expect(() => createTechniquePrimitive({
      id: 'tp-schema-depth',
      name: 'Schema depth',
      intent: 'Reject deep schema',
      contract: {
        inputs: [{ name: 'input', required: true, origin: 'declared', type: 'string' }],
        outputs: [{ name: 'output', required: true, origin: 'declared', type: 'string' }],
        inputSchema: nested,
      },
    })).toThrow(/invalid_technique_contract/);
  });

  it('generates schemas from field specs', () => {
    const primitive = createTechniquePrimitive({
      id: 'tp-schema-types',
      name: 'Schema types',
      intent: 'Generate schema types',
      contract: {
        inputs: [
          { name: 'count', required: true, origin: 'declared', type: 'number' },
          { name: 'flag', required: false, origin: 'declared', type: 'boolean' },
          { name: 'mystery', required: false, origin: 'declared', type: 'unknown' },
        ],
        outputs: [
          { name: 'items', required: true, origin: 'declared', type: 'array' },
        ],
      },
    });

    const inputSchema = primitive.contract?.inputSchema as JsonSchemaObject;
    const outputSchema = primitive.contract?.outputSchema as JsonSchemaObject;
    expect(inputSchema.type).toBe('object');
    expect(inputSchema.properties?.count).toMatchObject({ type: 'number' });
    expect(inputSchema.properties?.flag).toMatchObject({ type: 'boolean' });
    expect(Array.isArray(inputSchema.properties?.mystery?.type)).toBe(true);
    expect(inputSchema.required).toEqual(['count']);
    expect(inputSchema.additionalProperties).toBe(true);
    expect(outputSchema.properties?.items).toMatchObject({ type: 'array' });
    expect(outputSchema.required).toEqual(['items']);
  });

  it('rejects duplicate contract fields', () => {
    expect(() => createTechniquePrimitive({
      id: 'tp-dup-fields',
      name: 'Dup fields',
      intent: 'Reject duplicate fields',
      contract: {
        inputs: [
          { name: 'dup', required: true, origin: 'declared', type: 'string' },
          { name: 'dup', required: false, origin: 'declared', type: 'string' },
        ],
        outputs: [
          { name: 'out', required: true, origin: 'declared', type: 'string' },
        ],
      },
    })).toThrow(/invalid_technique_contract/);
  });

  it('rejects invalid primitive semantic inputs', () => {
    expect(() => createTechniquePrimitive({
      id: 'tp-invalid-category',
      name: 'Invalid category',
      intent: 'Invalid category',
      category: 'invalid' as never,
    })).toThrow(/invalid_technique_category/);

    expect(() => createTechniquePrimitive({
      id: 'tp-invalid-profile',
      name: 'Invalid profile',
      intent: 'Invalid profile',
      semanticProfileId: 'invalid' as never,
    })).toThrow(/invalid_semantic_profile/);

    expect(() => createTechniquePrimitive({
      id: 'tp-invalid-kind',
      name: 'Invalid kind',
      intent: 'Invalid kind',
      primitiveKind: 'invalid' as never,
    })).toThrow(/invalid_technique_kind/);

    expect(() => createTechniquePrimitive({
      id: 'tp-invalid-level',
      name: 'Invalid level',
      intent: 'Invalid level',
      abstractionLevel: 'invalid' as never,
    })).toThrow(/invalid_technique_level/);

    expect(() => createTechniquePrimitive({
      id: 'tp-invalid-domains',
      name: 'Invalid domains',
      intent: 'Invalid domains',
      domains: ['ok', ''] as string[],
    })).toThrow(/invalid_technique_domains/);

    expect(() => createTechniquePrimitive({
      id: 'tp-invalid-semantics',
      name: 'Invalid semantics',
      intent: 'Invalid semantics',
      semantics: {
        preconditions: [],
        postconditions: [],
        termination: 'missing' as never,
        determinism: 'unknown',
        complexity: 'linear',
      },
    })).toThrow(/invalid_technique_semantics/);
  });
});
