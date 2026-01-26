import type {
  TechniquePrimitive,
  TechniquePrimitiveContract,
  JsonSchemaObject,
  JsonSchemaProperty,
  JsonSchemaType,
} from '../strategic/techniques.js';

export interface TechniqueContractIssue {
  code: string;
  message: string;
  path?: string;
  phase?: 'input' | 'output' | 'condition';
}

export interface TechniqueContractValidationResult {
  ok: boolean;
  issues: TechniqueContractIssue[];
}

const MAX_SCHEMA_DEPTH = 6;
const MAX_SCHEMA_NODES = 1000;
const MAX_CONDITION_COUNT = 200;
const MAX_CONDITION_LENGTH = 200;
const MAX_EXAMPLE_COUNT = 100;
const EXISTS_CONDITION_PATTERN = /^exists\((input|output)\[(.+)\]\)$/;
const SAFE_CONDITION_KEY_PATTERN = /^[A-Za-z0-9_./:-]+$/;
const FORBIDDEN_SCHEMA_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

type ParsedCondition = { scope: 'input' | 'output'; key: string } | { error: 'malformed' };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  try {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  } catch {
    return false;
  }
}

function schemaAllowsType(typeValue: JsonSchemaProperty['type'], expected: JsonSchemaType): boolean {
  if (!typeValue) return true;
  if (Array.isArray(typeValue)) {
    return typeValue.includes(expected);
  }
  return typeValue === expected;
}

function isTypeMatch(value: unknown, expected: JsonSchemaType): boolean {
  switch (expected) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return isPlainObject(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return false;
  }
}

function validateSchemaValue(
  schema: JsonSchemaProperty,
  value: unknown,
  issues: TechniqueContractIssue[],
  path: string,
  phase: TechniqueContractIssue['phase'],
  state: { nodesSeen: number; exceeded: boolean; seen: WeakSet<object> },
  depth = 0
): void {
  if (state.exceeded) return;
  state.nodesSeen += 1;
  if (state.nodesSeen > MAX_SCHEMA_NODES) {
    issues.push({
      code: 'contract_schema_budget_exceeded',
      message: `Schema budget exceeded at ${path}.`,
      path,
      phase,
    });
    state.exceeded = true;
    return;
  }
  if (depth >= MAX_SCHEMA_DEPTH) {
    issues.push({
      code: 'contract_schema_depth_exceeded',
      message: `Schema depth exceeded at ${path}.`,
      path,
      phase,
    });
    state.exceeded = true;
    return;
  }
  const typeValue = schema.type;
  if (typeValue) {
    const allowedTypes = Array.isArray(typeValue) ? typeValue : [typeValue];
    const matches = allowedTypes.some((expected) => isTypeMatch(value, expected));
    if (!matches) {
      issues.push({
        code: `contract_${phase}_type_invalid`,
        message: `Expected ${allowedTypes.join('|')} at ${path}.`,
        path,
        phase,
      });
      return;
    }
  }

  const isTraversableObject = schema.properties && isPlainObject(value) && schemaAllowsType(typeValue, 'object');
  const isTraversableArray = schema.items && Array.isArray(value) && schemaAllowsType(typeValue, 'array');
  if (isTraversableObject || isTraversableArray) {
    const ref = value as object;
    if (state.seen.has(ref)) {
      issues.push({
        code: 'contract_schema_circular_reference',
        message: `Circular reference detected at ${path}.`,
        path,
        phase,
      });
      return;
    }
    state.seen.add(ref);
  }

  if (isTraversableObject) {
    const properties = schema.properties ?? {};
    const keys = Object.keys(properties).filter((key) => Object.prototype.hasOwnProperty.call(value, key));
    if (state.nodesSeen + keys.length > MAX_SCHEMA_NODES) {
      issues.push({
        code: 'contract_schema_budget_exceeded',
        message: `Schema budget exceeded at ${path}.`,
        path,
        phase,
      });
      state.exceeded = true;
      return;
    }
    for (const key of keys) {
      if (state.exceeded) return;
      if (FORBIDDEN_SCHEMA_KEYS.has(key)) {
        issues.push({
          code: 'contract_schema_forbidden_key',
          message: `Schema contains forbidden key: ${key}.`,
          path: `${path}.${key}`,
          phase,
        });
        continue;
      }
      const propertySchema = properties[key];
      if (!propertySchema) {
        continue;
      }
      validateSchemaValue(propertySchema, value[key], issues, `${path}.${key}`, phase, state, depth + 1);
      if (state.exceeded) return;
    }
  }

  if (isTraversableArray) {
    const items = schema.items;
    if (!items) {
      issues.push({
        code: 'contract_schema_items_missing',
        message: `Array schema missing items definition at ${path}.`,
        path,
        phase,
      });
      return;
    }
    if (state.nodesSeen + value.length > MAX_SCHEMA_NODES) {
      issues.push({
        code: 'contract_schema_budget_exceeded',
        message: `Schema budget exceeded at ${path}.`,
        path,
        phase,
      });
      state.exceeded = true;
      return;
    }
    for (let index = 0; index < value.length; index += 1) {
      if (state.exceeded) return;
      validateSchemaValue(items, value[index], issues, `${path}[${index}]`, phase, state, depth + 1);
      if (state.exceeded) return;
    }
  }
}

function validateSchema(
  schema: JsonSchemaObject | undefined,
  requiredFields: string[],
  value: unknown,
  phase: TechniqueContractIssue['phase']
): TechniqueContractIssue[] {
  const issues: TechniqueContractIssue[] = [];
  if (!schema) {
    issues.push({
      code: `contract_${phase}_schema_missing`,
      message: `${phase} schema missing.`,
      phase,
    });
    return issues;
  }
  if (!isPlainObject(value)) {
    issues.push({
      code: `contract_${phase}_type_invalid`,
      message: `${phase} must be an object.`,
      phase,
    });
    return issues;
  }

  const required = new Set<string>([...(schema.required ?? []), ...requiredFields]);
  const properties = schema.properties ?? {};
  for (const key of required) {
    if (FORBIDDEN_SCHEMA_KEYS.has(key)) {
      issues.push({
        code: 'contract_schema_forbidden_key',
        message: `Schema contains forbidden key: ${key}.`,
        path: `${phase}.${key}`,
        phase,
      });
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(properties, key)) {
      issues.push({
        code: 'contract_schema_inconsistent',
        message: `Schema required field not defined: ${key}.`,
        path: `${phase}.${key}`,
        phase,
      });
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      issues.push({
        code: `contract_${phase}_missing_required`,
        message: `${phase} missing required field: ${key}.`,
        path: `${phase}.${key}`,
        phase,
      });
    }
  }

  if (schema.properties) {
    const state = { nodesSeen: 0, exceeded: false, seen: new WeakSet<object>() };
    state.seen.add(value);
    for (const [key, propertySchema] of Object.entries(schema.properties)) {
      if (state.exceeded) break;
      if (FORBIDDEN_SCHEMA_KEYS.has(key)) {
        issues.push({
          code: 'contract_schema_forbidden_key',
          message: `Schema contains forbidden key: ${key}.`,
          path: `${phase}.${key}`,
          phase,
        });
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      validateSchemaValue(propertySchema, value[key], issues, `${phase}.${key}`, phase, state);
    }
    if (state.exceeded) {
      issues.push({
        code: 'contract_schema_incomplete',
        message: `${phase} validation incomplete due to schema limits.`,
        phase,
      });
    }
  }

  return issues;
}

function parseExistenceCondition(condition: string): ParsedCondition | null {
  const trimmed = condition.trim();
  const match = trimmed.match(EXISTS_CONDITION_PATTERN);
  if (!match) return null;
  const scope = match[1] as 'input' | 'output';
  const rawKey = match[2]?.trim();
  if (!rawKey || rawKey.length > MAX_CONDITION_LENGTH) return null;
  if (!rawKey.startsWith('"') || !rawKey.endsWith('"')) return null;
  const key = rawKey.slice(1, -1);
  if (!key.trim() || !SAFE_CONDITION_KEY_PATTERN.test(key) || FORBIDDEN_SCHEMA_KEYS.has(key)) {
    return { error: 'malformed' };
  }
  return { scope, key };
}

function validateConditions(
  conditions: string[] | undefined,
  context: { input: unknown; output: unknown },
  kind: 'precondition' | 'postcondition'
): TechniqueContractIssue[] {
  if (!conditions || conditions.length === 0) return [];
  const toValidate = conditions.slice(0, MAX_CONDITION_COUNT);
  const issues: TechniqueContractIssue[] = [];
  if (conditions.length > MAX_CONDITION_COUNT) {
    issues.push({
      code: 'contract_condition_limit_exceeded',
      message: `${kind} count exceeds ${MAX_CONDITION_COUNT}.`,
      phase: 'condition',
    });
  }
  for (const condition of toValidate) {
    const parsed = parseExistenceCondition(condition);
    if (!parsed) {
      issues.push({
        code: 'contract_condition_unrecognized',
        message: `Unrecognized ${kind}: ${condition}.`,
        phase: 'condition',
      });
      continue;
    }
    if ('error' in parsed) {
      issues.push({
        code: 'contract_condition_malformed',
        message: `Malformed ${kind}: ${condition}.`,
        phase: 'condition',
      });
      continue;
    }
    const source = parsed.scope === 'input' ? context.input : context.output;
    if (!isPlainObject(source) || !Object.prototype.hasOwnProperty.call(source, parsed.key)) {
      issues.push({
        code: `contract_${kind}_failed`,
        message: `${kind} failed: ${condition}.`,
        path: `${parsed.scope}.${parsed.key}`,
        phase: 'condition',
      });
    }
  }
  return issues;
}

function validateConditionSyntax(
  conditions: string[] | undefined,
  kind: 'precondition' | 'postcondition'
): TechniqueContractIssue[] {
  if (!conditions || conditions.length === 0) return [];
  const toValidate = conditions.slice(0, MAX_CONDITION_COUNT);
  const issues: TechniqueContractIssue[] = [];
  if (conditions.length > MAX_CONDITION_COUNT) {
    issues.push({
      code: 'contract_condition_limit_exceeded',
      message: `${kind} count exceeds ${MAX_CONDITION_COUNT}.`,
      phase: 'condition',
    });
  }
  for (const condition of toValidate) {
    const parsed = parseExistenceCondition(condition);
    if (!parsed) {
      issues.push({
        code: 'contract_condition_unrecognized',
        message: `Unrecognized ${kind}: ${condition}.`,
        phase: 'condition',
      });
      continue;
    }
    if ('error' in parsed) {
      issues.push({
        code: 'contract_condition_malformed',
        message: `Malformed ${kind}: ${condition}.`,
        phase: 'condition',
      });
    }
  }
  return issues;
}

function collectRequiredFields(contract: TechniquePrimitiveContract, phase: 'input' | 'output'): string[] {
  const fields = phase === 'input' ? contract.inputs : contract.outputs;
  return fields.filter((field) => field.required).map((field) => field.name);
}

export function validateTechniqueContractInput(
  contract: TechniquePrimitiveContract,
  input: unknown
): TechniqueContractIssue[] {
  return validateSchema(contract.inputSchema, collectRequiredFields(contract, 'input'), input, 'input');
}

export function validateTechniqueContractOutput(
  contract: TechniquePrimitiveContract,
  output: unknown
): TechniqueContractIssue[] {
  return validateSchema(contract.outputSchema, collectRequiredFields(contract, 'output'), output, 'output');
}

export function validateTechniqueContractPreconditions(
  contract: TechniquePrimitiveContract,
  input: unknown
): TechniqueContractIssue[] {
  return validateConditions(contract.preconditions, { input, output: {} }, 'precondition');
}

export function validateTechniqueContractPostconditions(
  contract: TechniquePrimitiveContract,
  input: unknown,
  output: unknown
): TechniqueContractIssue[] {
  return validateConditions(contract.postconditions, { input, output }, 'postcondition');
}

export function validateTechniquePrimitiveExecution(
  primitive: TechniquePrimitive,
  input: unknown,
  output: unknown
): TechniqueContractValidationResult {
  const contract = primitive.contract;
  if (!contract) {
    return {
      ok: false,
      issues: [
        {
          code: 'contract_missing',
          message: `Primitive ${primitive.id} has no contract to validate.`,
        },
      ],
    };
  }

  const inputIssues = validateTechniqueContractInput(contract, input);
  const outputIssues = validateTechniqueContractOutput(contract, output);
  const conditionIssues: TechniqueContractIssue[] = [];

  conditionIssues.push(
    ...validateConditionSyntax(contract.preconditions, 'precondition'),
    ...validateConditionSyntax(contract.postconditions, 'postcondition')
  );

  // Fail fast when structural validation fails to avoid evaluating conditions on invalid data.
  if (inputIssues.length === 0) {
    conditionIssues.push(
      ...validateConditions(contract.preconditions, { input, output }, 'precondition')
        .filter((issue) => issue.code === 'contract_precondition_failed')
    );
  }
  if (outputIssues.length === 0) {
    conditionIssues.push(
      ...validateConditions(contract.postconditions, { input, output }, 'postcondition')
        .filter((issue) => issue.code === 'contract_postcondition_failed')
    );
  }

  const issues = [...inputIssues, ...outputIssues, ...conditionIssues];
  return { ok: issues.length === 0, issues };
}

export function validateTechniquePrimitiveExamples(
  primitive: TechniquePrimitive
): TechniqueContractIssue[] {
  const contract = primitive.contract;
  if (!contract?.examples?.length) return [];
  if (contract.examples.length > MAX_EXAMPLE_COUNT) {
    return [{
      code: 'contract_examples_exceed_limit',
      message: `Example count exceeds ${MAX_EXAMPLE_COUNT}.`,
      phase: 'condition',
    }];
  }
  const issues: TechniqueContractIssue[] = [];
  contract.examples.forEach((example, index) => {
    const inputIssues = validateTechniqueContractInput(contract, example.input);
    const outputIssues = validateTechniqueContractOutput(contract, example.output);
    const conditionIssues = [
      ...validateConditions(contract.preconditions, { input: example.input, output: example.output }, 'precondition'),
      ...validateConditions(contract.postconditions, { input: example.input, output: example.output }, 'postcondition'),
    ];
    for (const issue of inputIssues) {
      issues.push({
        ...issue,
        path: issue.path ? `examples[${index}].${issue.path}` : `examples[${index}]`,
      });
    }
    for (const issue of outputIssues) {
      issues.push({
        ...issue,
        path: issue.path ? `examples[${index}].${issue.path}` : `examples[${index}]`,
      });
    }
    for (const issue of conditionIssues) {
      issues.push({
        ...issue,
        path: issue.path ? `examples[${index}].${issue.path}` : `examples[${index}]`,
      });
    }
  });
  return issues;
}
