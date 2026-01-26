/**
 * @fileoverview Skills Validator
 *
 * Validates loaded Agent Skills for correctness, completeness, and security.
 *
 * Validation checks:
 * - Required fields present
 * - Script executability
 * - Workflow step references valid
 * - Dependency availability
 * - Input/output type correctness
 * - Security constraints (sandbox, permissions)
 *
 * @packageDocumentation
 */

import { access, constants } from 'node:fs/promises';
import {
  SKILLS_SCHEMA_VERSION,
  type AgentSkill,
  type SkillValidation,
  type ValidationIssue,
  type WorkflowStep,
  type SkillInput,
  type SkillOutput,
} from './types.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Validator configuration */
export interface ValidatorConfig {
  /** Validate script executability */
  checkExecutable: boolean;

  /** Validate file paths exist */
  checkPaths: boolean;

  /** Validate dependencies are resolvable */
  checkDependencies: boolean;

  /** Maximum allowed inputs */
  maxInputs: number;

  /** Maximum allowed outputs */
  maxOutputs: number;

  /** Maximum allowed workflow steps */
  maxSteps: number;

  /** Required fields in identity */
  requiredIdentityFields: (keyof AgentSkill['identity'])[];

  /** Required fields in metadata */
  requiredMetaFields: (keyof AgentSkill['meta'])[];

  /** Banned patterns in scripts (security) */
  bannedPatterns: RegExp[];
}

/** Default validator configuration */
export const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  checkExecutable: true,
  checkPaths: true,
  checkDependencies: false, // Requires registry access
  maxInputs: 50,
  maxOutputs: 50,
  maxSteps: 100,
  requiredIdentityFields: ['id', 'name', 'version', 'qualifiedName', 'path'],
  requiredMetaFields: ['description', 'modifiedAt', 'source'],
  bannedPatterns: [
    /rm\s+-rf\s+\//, // Dangerous rm commands
    /curl.*\|\s*(?:bash|sh)/, // Pipe to shell
    /eval\s*\(/, // Eval
    /process\.env\[\s*['"](?:AWS|GCP|AZURE)/, // Cloud credentials
  ],
};

/** Validation context for dependency tracking */
export interface ValidationContext {
  /** Available skill IDs (for dependency checking) */
  availableSkills: Set<string>;

  /** Loaded skill directory paths */
  skillPaths: Map<string, string>;
}

/** Empty validation context */
export function createEmptyContext(): ValidationContext {
  return {
    availableSkills: new Set(),
    skillPaths: new Map(),
  };
}

// ============================================================================
// MAIN VALIDATOR
// ============================================================================

/**
 * Validate a loaded skill.
 */
export async function validateSkill(
  skill: AgentSkill,
  config: ValidatorConfig = DEFAULT_VALIDATOR_CONFIG,
  context: ValidationContext = createEmptyContext()
): Promise<SkillValidation> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  // Validate identity
  validateIdentity(skill, config, errors, warnings);

  // Validate metadata
  validateMetadata(skill, config, errors, warnings);

  // Validate definition
  validateDefinition(skill, config, errors, warnings, info);

  // Validate workflow
  validateWorkflow(skill, config, errors, warnings, info);

  // Validate inputs/outputs
  validateInputsOutputs(skill, config, errors, warnings);

  // Validate scripts
  await validateScripts(skill, config, errors, warnings, info);

  // Validate resources
  validateResources(skill, config, errors, warnings);

  // Validate dependencies
  if (config.checkDependencies) {
    validateDependencies(skill, context, errors, warnings);
  }

  // Validate security
  await validateSecurity(skill, config, errors, warnings);

  return {
    valid: errors.length === 0,
    validatedAt: new Date().toISOString(),
    validatorVersion: SKILLS_SCHEMA_VERSION,
    errors,
    warnings,
    info,
  };
}

/**
 * Validate multiple skills.
 */
export async function validateSkills(
  skills: AgentSkill[],
  config: ValidatorConfig = DEFAULT_VALIDATOR_CONFIG
): Promise<Map<string, SkillValidation>> {
  // Build context with all available skills
  const context: ValidationContext = {
    availableSkills: new Set(skills.map((s) => s.identity.id)),
    skillPaths: new Map(skills.map((s) => [s.identity.id, s.identity.absolutePath])),
  };

  const results = new Map<string, SkillValidation>();

  for (const skill of skills) {
    const validation = await validateSkill(skill, config, context);
    results.set(skill.identity.id, validation);

    // Update skill's validation field
    skill.validation = validation;
  }

  return results;
}

// ============================================================================
// IDENTITY VALIDATION
// ============================================================================

function validateIdentity(
  skill: AgentSkill,
  config: ValidatorConfig,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { identity } = skill;

  // Check required fields
  for (const field of config.requiredIdentityFields) {
    if (!identity[field]) {
      errors.push({
        code: 'MISSING_IDENTITY_FIELD',
        message: `Missing required identity field: ${field}`,
        severity: 'error',
        location: 'identity',
      });
    }
  }

  // Validate ID format
  if (identity.id && !/^[a-z0-9][a-z0-9-_]*$/i.test(identity.id)) {
    warnings.push({
      code: 'INVALID_ID_FORMAT',
      message: 'Skill ID should be alphanumeric with hyphens/underscores',
      severity: 'warning',
      location: `identity.id: ${identity.id}`,
      suggestion: 'Use kebab-case or snake_case for skill IDs',
    });
  }

  // Validate version format (semver)
  if (identity.version && !/^\d+\.\d+\.\d+/.test(identity.version)) {
    warnings.push({
      code: 'INVALID_VERSION_FORMAT',
      message: 'Version should follow semver (e.g., 1.0.0)',
      severity: 'warning',
      location: `identity.version: ${identity.version}`,
    });
  }

  // Validate namespace format
  if (identity.namespace && !/^[a-z][a-z0-9-_]*$/i.test(identity.namespace)) {
    warnings.push({
      code: 'INVALID_NAMESPACE_FORMAT',
      message: 'Namespace should be alphanumeric',
      severity: 'warning',
      location: `identity.namespace: ${identity.namespace}`,
    });
  }
}

// ============================================================================
// METADATA VALIDATION
// ============================================================================

function validateMetadata(
  skill: AgentSkill,
  config: ValidatorConfig,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { meta } = skill;

  // Check required fields
  for (const field of config.requiredMetaFields) {
    if (!meta[field]) {
      errors.push({
        code: 'MISSING_META_FIELD',
        message: `Missing required metadata field: ${field}`,
        severity: 'error',
        location: 'meta',
      });
    }
  }

  // Validate description length
  if (meta.description && meta.description.length < 10) {
    warnings.push({
      code: 'SHORT_DESCRIPTION',
      message: 'Description is very short, consider being more descriptive',
      severity: 'warning',
      location: 'meta.description',
    });
  }

  // Validate tags
  if (meta.tags.length === 0) {
    warnings.push({
      code: 'NO_TAGS',
      message: 'No tags specified, consider adding tags for discoverability',
      severity: 'warning',
      location: 'meta.tags',
    });
  }

  // Validate modified date
  if (meta.modifiedAt) {
    const date = new Date(meta.modifiedAt);
    if (isNaN(date.getTime())) {
      errors.push({
        code: 'INVALID_DATE',
        message: 'Invalid modifiedAt date format',
        severity: 'error',
        location: 'meta.modifiedAt',
      });
    }
  }
}

// ============================================================================
// DEFINITION VALIDATION
// ============================================================================

function validateDefinition(
  skill: AgentSkill,
  config: ValidatorConfig,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): void {
  const { definition } = skill;

  // Validate trigger
  if (!definition.trigger) {
    errors.push({
      code: 'MISSING_TRIGGER',
      message: 'Skill must have a trigger definition',
      severity: 'error',
      location: 'definition.trigger',
    });
  } else {
    const trigger = definition.trigger;
    const hasTrigger =
      (trigger.taskTypes?.length ?? 0) > 0 ||
      (trigger.intentPatterns?.length ?? 0) > 0 ||
      (trigger.filePatterns?.length ?? 0) > 0 ||
      trigger.condition;

    if (!hasTrigger) {
      warnings.push({
        code: 'EMPTY_TRIGGER',
        message: 'Trigger has no conditions, skill may never activate',
        severity: 'warning',
        location: 'definition.trigger',
        suggestion: 'Add taskTypes, intentPatterns, filePatterns, or condition',
      });
    }
  }

  // Validate workflow exists
  if (!definition.workflow || definition.workflow.length === 0) {
    errors.push({
      code: 'MISSING_WORKFLOW',
      message: 'Skill must have at least one workflow step',
      severity: 'error',
      location: 'definition.workflow',
    });
  }

  // Info about examples
  if (!definition.examples || definition.examples.length === 0) {
    info.push({
      code: 'NO_EXAMPLES',
      message: 'Consider adding usage examples',
      severity: 'info',
      location: 'definition.examples',
    });
  }
}

// ============================================================================
// WORKFLOW VALIDATION
// ============================================================================

function validateWorkflow(
  skill: AgentSkill,
  config: ValidatorConfig,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): void {
  const { workflow } = skill.definition;

  if (!workflow) return;

  // Check step count
  if (workflow.length > config.maxSteps) {
    errors.push({
      code: 'TOO_MANY_STEPS',
      message: `Workflow has ${workflow.length} steps, maximum is ${config.maxSteps}`,
      severity: 'error',
      location: 'definition.workflow',
    });
  }

  // Collect step IDs
  const stepIds = new Set<string>();
  const duplicates: string[] = [];

  for (const step of workflow) {
    if (stepIds.has(step.id)) {
      duplicates.push(step.id);
    }
    stepIds.add(step.id);
  }

  // Check for duplicate IDs
  if (duplicates.length > 0) {
    errors.push({
      code: 'DUPLICATE_STEP_IDS',
      message: `Duplicate step IDs: ${duplicates.join(', ')}`,
      severity: 'error',
      location: 'definition.workflow',
    });
  }

  // Validate each step
  for (const step of workflow) {
    validateWorkflowStep(step, stepIds, errors, warnings);
  }

  // Check for dependency cycles
  const cycles = detectDependencyCycles(workflow);
  if (cycles.length > 0) {
    errors.push({
      code: 'DEPENDENCY_CYCLE',
      message: `Workflow has dependency cycles: ${cycles.join(' -> ')}`,
      severity: 'error',
      location: 'definition.workflow',
    });
  }
}

function validateWorkflowStep(
  step: WorkflowStep,
  validIds: Set<string>,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  // Validate required fields
  if (!step.id) {
    errors.push({
      code: 'MISSING_STEP_ID',
      message: `Step "${step.name}" is missing an ID`,
      severity: 'error',
      location: `workflow.step.${step.name}`,
    });
  }

  if (!step.name) {
    warnings.push({
      code: 'MISSING_STEP_NAME',
      message: `Step ${step.id} is missing a name`,
      severity: 'warning',
      location: `workflow.step.${step.id}`,
    });
  }

  // Validate action matches type
  if (step.action && step.action.type !== step.type) {
    // Allow manual type to have any action
    if (step.type !== 'manual') {
      warnings.push({
        code: 'ACTION_TYPE_MISMATCH',
        message: `Step ${step.id} has type "${step.type}" but action type "${step.action.type}"`,
        severity: 'warning',
        location: `workflow.step.${step.id}`,
      });
    }
  }

  // Validate dependencies reference valid steps
  if (step.dependsOn) {
    for (const depId of step.dependsOn) {
      if (!validIds.has(depId)) {
        errors.push({
          code: 'INVALID_DEPENDENCY',
          message: `Step ${step.id} depends on non-existent step "${depId}"`,
          severity: 'error',
          location: `workflow.step.${step.id}.dependsOn`,
        });
      }
    }
  }
}

function detectDependencyCycles(workflow: WorkflowStep[]): string[] {
  const stepMap = new Map(workflow.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[] = [];

  function dfs(stepId: string, path: string[]): boolean {
    if (recursionStack.has(stepId)) {
      // Found cycle
      const cycleStart = path.indexOf(stepId);
      cycles.push(...path.slice(cycleStart), stepId);
      return true;
    }

    if (visited.has(stepId)) return false;

    visited.add(stepId);
    recursionStack.add(stepId);

    const step = stepMap.get(stepId);
    if (step?.dependsOn) {
      for (const depId of step.dependsOn) {
        if (dfs(depId, [...path, stepId])) {
          return true;
        }
      }
    }

    recursionStack.delete(stepId);
    return false;
  }

  for (const step of workflow) {
    if (!visited.has(step.id)) {
      dfs(step.id, []);
    }
  }

  return cycles;
}

// ============================================================================
// INPUT/OUTPUT VALIDATION
// ============================================================================

function validateInputsOutputs(
  skill: AgentSkill,
  config: ValidatorConfig,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { inputs, outputs } = skill.definition;

  // Check counts
  if (inputs.length > config.maxInputs) {
    errors.push({
      code: 'TOO_MANY_INPUTS',
      message: `Skill has ${inputs.length} inputs, maximum is ${config.maxInputs}`,
      severity: 'error',
      location: 'definition.inputs',
    });
  }

  if (outputs.length > config.maxOutputs) {
    errors.push({
      code: 'TOO_MANY_OUTPUTS',
      message: `Skill has ${outputs.length} outputs, maximum is ${config.maxOutputs}`,
      severity: 'error',
      location: 'definition.outputs',
    });
  }

  // Validate input names unique
  const inputNames = new Set<string>();
  for (const input of inputs) {
    if (inputNames.has(input.name)) {
      errors.push({
        code: 'DUPLICATE_INPUT_NAME',
        message: `Duplicate input name: ${input.name}`,
        severity: 'error',
        location: 'definition.inputs',
      });
    }
    inputNames.add(input.name);

    // Validate input
    validateInput(input, errors, warnings);
  }

  // Validate output names unique
  const outputNames = new Set<string>();
  for (const output of outputs) {
    if (outputNames.has(output.name)) {
      errors.push({
        code: 'DUPLICATE_OUTPUT_NAME',
        message: `Duplicate output name: ${output.name}`,
        severity: 'error',
        location: 'definition.outputs',
      });
    }
    outputNames.add(output.name);

    // Validate output
    validateOutput(output, errors, warnings);
  }
}

function validateInput(
  input: SkillInput,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  if (!input.name) {
    errors.push({
      code: 'MISSING_INPUT_NAME',
      message: 'Input is missing a name',
      severity: 'error',
      location: 'definition.inputs',
    });
  }

  if (!input.description) {
    warnings.push({
      code: 'MISSING_INPUT_DESCRIPTION',
      message: `Input "${input.name}" is missing a description`,
      severity: 'warning',
      location: `definition.inputs.${input.name}`,
    });
  }

  // Validate pattern is valid regex
  if (input.pattern) {
    try {
      new RegExp(input.pattern);
    } catch {
      errors.push({
        code: 'INVALID_INPUT_PATTERN',
        message: `Input "${input.name}" has invalid regex pattern`,
        severity: 'error',
        location: `definition.inputs.${input.name}.pattern`,
      });
    }
  }
}

function validateOutput(
  output: SkillOutput,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  if (!output.name) {
    errors.push({
      code: 'MISSING_OUTPUT_NAME',
      message: 'Output is missing a name',
      severity: 'error',
      location: 'definition.outputs',
    });
  }

  if (!output.description) {
    warnings.push({
      code: 'MISSING_OUTPUT_DESCRIPTION',
      message: `Output "${output.name}" is missing a description`,
      severity: 'warning',
      location: `definition.outputs.${output.name}`,
    });
  }
}

// ============================================================================
// SCRIPT VALIDATION
// ============================================================================

async function validateScripts(
  skill: AgentSkill,
  config: ValidatorConfig,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  info: ValidationIssue[]
): Promise<void> {
  const { scripts } = skill;

  if (scripts.length === 0) {
    info.push({
      code: 'NO_SCRIPTS',
      message: 'Skill has no scripts',
      severity: 'info',
      location: 'scripts',
    });
    return;
  }

  for (const script of scripts) {
    // Check path exists
    if (config.checkPaths) {
      try {
        await access(script.absolutePath, constants.R_OK);
      } catch {
        errors.push({
          code: 'SCRIPT_NOT_FOUND',
          message: `Script not found: ${script.path}`,
          severity: 'error',
          location: `scripts.${script.id}`,
        });
        continue;
      }
    }

    // Check executable
    if (config.checkExecutable && !script.executable) {
      warnings.push({
        code: 'SCRIPT_NOT_EXECUTABLE',
        message: `Script is not executable: ${script.path}`,
        severity: 'warning',
        location: `scripts.${script.id}`,
        suggestion: `Run: chmod +x ${script.absolutePath}`,
      });
    }
  }
}

// ============================================================================
// RESOURCE VALIDATION
// ============================================================================

function validateResources(
  skill: AgentSkill,
  config: ValidatorConfig,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { resources } = skill;

  // Check for large resources
  for (const resource of resources) {
    if (resource.sizeBytes > 10 * 1024 * 1024) {
      // 10MB
      warnings.push({
        code: 'LARGE_RESOURCE',
        message: `Resource is very large (${Math.round(resource.sizeBytes / 1024 / 1024)}MB): ${resource.path}`,
        severity: 'warning',
        location: `resources.${resource.id}`,
      });
    }
  }
}

// ============================================================================
// DEPENDENCY VALIDATION
// ============================================================================

function validateDependencies(
  skill: AgentSkill,
  context: ValidationContext,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const { dependencies } = skill.definition;

  for (const dep of dependencies) {
    if (!context.availableSkills.has(dep.skillId)) {
      if (dep.optional) {
        warnings.push({
          code: 'OPTIONAL_DEP_NOT_FOUND',
          message: `Optional dependency not available: ${dep.skillId}`,
          severity: 'warning',
          location: 'definition.dependencies',
        });
      } else {
        errors.push({
          code: 'REQUIRED_DEP_NOT_FOUND',
          message: `Required dependency not available: ${dep.skillId}`,
          severity: 'error',
          location: 'definition.dependencies',
        });
      }
    }
  }
}

// ============================================================================
// SECURITY VALIDATION
// ============================================================================

async function validateSecurity(
  skill: AgentSkill,
  config: ValidatorConfig,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): Promise<void> {
  // Check for sandbox mode
  if (skill.config.sandbox === false) {
    warnings.push({
      code: 'SANDBOX_DISABLED',
      message: 'Skill runs without sandbox protection',
      severity: 'warning',
      location: 'config.sandbox',
    });
  }

  // Check scripts for banned patterns
  for (const script of skill.scripts) {
    try {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(script.absolutePath, 'utf-8');

      for (const pattern of config.bannedPatterns) {
        if (pattern.test(content)) {
          errors.push({
            code: 'BANNED_PATTERN',
            message: `Script contains banned pattern: ${pattern.source}`,
            severity: 'error',
            location: `scripts.${script.id}`,
          });
        }
      }
    } catch {
      // Can't read script
    }
  }
}

// ============================================================================
// QUICK VALIDATION
// ============================================================================

/**
 * Quick validation that only checks essential fields.
 * Faster than full validation, useful for discovery.
 */
export function quickValidate(skill: AgentSkill): { valid: boolean; reason?: string } {
  // Check essential identity fields
  if (!skill.identity.id) {
    return { valid: false, reason: 'Missing skill ID' };
  }
  if (!skill.identity.name) {
    return { valid: false, reason: 'Missing skill name' };
  }
  if (!skill.identity.version) {
    return { valid: false, reason: 'Missing skill version' };
  }

  // Check has workflow
  if (!skill.definition.workflow || skill.definition.workflow.length === 0) {
    return { valid: false, reason: 'Missing workflow steps' };
  }

  // Check has trigger
  if (!skill.definition.trigger) {
    return { valid: false, reason: 'Missing trigger definition' };
  }

  return { valid: true };
}
