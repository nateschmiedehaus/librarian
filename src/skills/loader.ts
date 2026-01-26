/**
 * @fileoverview Skills Loader
 *
 * Discovers and loads Agent Skills from directories containing SKILL.md files.
 * Skills are portable procedural knowledge that agents can use.
 *
 * @packageDocumentation
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, stat, access, constants } from 'node:fs/promises';
import { join, basename, extname, relative } from 'node:path';
import {
  SKILLS_SCHEMA_VERSION,
  createEmptyValidation,
  createCacheMetadata,
  type AgentSkill,
  type SkillIdentity,
  type SkillMetadata,
  type SkillSource,
  type SkillDefinition,
  type SkillTrigger,
  type WorkflowStep,
  type StepAction,
  type SkillInput,
  type SkillOutput,
  type SkillDependency,
  type SkillExample,
  type SkillScript,
  type SkillResource,
  type SkillConfig,
} from './types.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Loader configuration */
export interface LoaderConfig {
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;

  /** Maximum depth to search for skills */
  maxDepth: number;

  /** Patterns to skip */
  skipPatterns: RegExp[];

  /** Whether to validate scripts are executable */
  checkExecutable: boolean;

  /** Whether to compute content hashes */
  computeHashes: boolean;
}

/** Default loader configuration */
export const DEFAULT_LOADER_CONFIG: LoaderConfig = {
  cacheTtlMs: 3600000, // 1 hour
  maxDepth: 5,
  skipPatterns: [/node_modules/, /\.git/, /dist/, /build/, /coverage/],
  checkExecutable: true,
  computeHashes: true,
};

/** Loader result */
export interface LoadResult {
  skill: AgentSkill;
  warnings: string[];
  errors: string[];
}

/** Discovery result */
export interface DiscoveryResult {
  skillPaths: string[];
  scannedDirs: number;
  skippedDirs: number;
}

// ============================================================================
// SKILL DISCOVERY
// ============================================================================

/**
 * Discover skills in a directory tree.
 * Looks for directories containing SKILL.md files.
 */
export async function discoverSkills(
  rootDir: string,
  config: LoaderConfig = DEFAULT_LOADER_CONFIG
): Promise<DiscoveryResult> {
  const skillPaths: string[] = [];
  let scannedDirs = 0;
  let skippedDirs = 0;

  async function scanDir(dir: string, depth: number): Promise<void> {
    if (depth > config.maxDepth) return;

    // Check if should skip
    const dirName = basename(dir);
    if (config.skipPatterns.some((p) => p.test(dirName))) {
      skippedDirs++;
      return;
    }

    scannedDirs++;

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      // Check for SKILL.md
      if (entries.some((e) => e.isFile() && e.name.toUpperCase() === 'SKILL.MD')) {
        skillPaths.push(dir);
      }

      // Recurse into subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await scanDir(join(dir, entry.name), depth + 1);
        }
      }
    } catch {
      // Ignore permission errors, etc.
    }
  }

  await scanDir(rootDir, 0);

  return { skillPaths, scannedDirs, skippedDirs };
}

// ============================================================================
// SKILL LOADING
// ============================================================================

/**
 * Load a skill from a directory.
 */
export async function loadSkill(
  skillDir: string,
  workspaceRoot: string,
  config: LoaderConfig = DEFAULT_LOADER_CONFIG
): Promise<LoadResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Read SKILL.md
  const skillMdPath = join(skillDir, 'SKILL.md');
  let skillMdContent: string;

  try {
    skillMdContent = await readFile(skillMdPath, 'utf-8');
  } catch (e) {
    errors.push(`Failed to read SKILL.md: ${e}`);
    throw new Error(`Cannot load skill: SKILL.md not found in ${skillDir}`);
  }

  // Parse SKILL.md
  const definition = parseSkillMd(skillMdContent);

  // Get directory stats
  const dirStats = await stat(skillDir);

  // Build identity
  const relativePath = relative(workspaceRoot, skillDir);
  const dirName = basename(skillDir);
  const identity: SkillIdentity = {
    id: dirName,
    name: definition.name || dirName,
    version: definition.version || '1.0.0',
    namespace: definition.namespace,
    qualifiedName: definition.namespace ? `${definition.namespace}:${dirName}` : dirName,
    path: relativePath,
    absolutePath: skillDir,
  };

  // Build metadata
  const meta: SkillMetadata = {
    description: definition.description || '',
    longDescription: definition.longDescription,
    author: definition.author,
    license: definition.license,
    tags: definition.tags || [],
    createdAt: dirStats.birthtime.toISOString(),
    modifiedAt: dirStats.mtime.toISOString(),
    source: { type: 'local', path: skillDir },
  };

  // Load scripts
  const scripts = await loadScripts(skillDir, config);

  // Load resources
  const resources = await loadResources(skillDir, config);

  // Build config
  const skillConfig: SkillConfig = {
    timeoutMs: definition.timeout,
    maxRetries: definition.maxRetries,
    retryDelayMs: definition.retryDelay,
    env: definition.env,
    cwd: skillDir,
    sandbox: definition.sandbox ?? true,
    custom: definition.custom,
  };

  // Compute content hash
  const contentHash = config.computeHashes
    ? computeContentHash(skillMdContent)
    : '';
  const depsHash = config.computeHashes
    ? computeDepsHash(definition.skillDefinition.dependencies)
    : '';

  // Build skill
  const skill: AgentSkill = {
    schemaVersion: SKILLS_SCHEMA_VERSION,
    identity,
    meta,
    definition: definition.skillDefinition,
    scripts,
    resources,
    config: skillConfig,
    validation: createEmptyValidation(),
    cache: createCacheMetadata(config.cacheTtlMs, contentHash, depsHash),
  };

  return { skill, warnings, errors };
}

/**
 * Load multiple skills from discovered paths.
 */
export async function loadSkills(
  skillPaths: string[],
  workspaceRoot: string,
  config: LoaderConfig = DEFAULT_LOADER_CONFIG
): Promise<{ skills: AgentSkill[]; failed: Array<{ path: string; error: string }> }> {
  const skills: AgentSkill[] = [];
  const failed: Array<{ path: string; error: string }> = [];

  for (const path of skillPaths) {
    try {
      const result = await loadSkill(path, workspaceRoot, config);
      skills.push(result.skill);
    } catch (e) {
      failed.push({ path, error: String(e) });
    }
  }

  return { skills, failed };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((v) => typeof v === 'string');
}

// ============================================================================
// SKILL.MD PARSING
// ============================================================================

interface ParsedSkillMd {
  name?: string;
  version?: string;
  namespace?: string;
  description?: string;
  longDescription?: string;
  author?: string;
  license?: string;
  tags?: string[];
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  env?: Record<string, string>;
  sandbox?: boolean;
  custom?: Record<string, unknown>;
  skillDefinition: SkillDefinition;
}

/**
 * Parse SKILL.md content into structured data.
 */
function parseSkillMd(content: string): ParsedSkillMd {
  const lines = content.split('\n');
  const sections: Record<string, string> = {};
  let currentSection = 'header';
  let currentContent: string[] = [];

  // Parse sections
  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headerMatch) {
      // Save previous section
      sections[currentSection] = currentContent.join('\n').trim();
      currentSection = headerMatch[1].toLowerCase().replace(/\s+/g, '_');
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  // Save last section
  sections[currentSection] = currentContent.join('\n').trim();

  // Extract frontmatter
  const frontmatter = parseFrontmatter(sections.header || '');

  // Parse trigger section
  const trigger = parseTriggerSection(sections.trigger || sections.when || '');

  // Parse workflow section
  const workflow = parseWorkflowSection(sections.workflow || sections.steps || '');

  // Parse inputs section
  const inputs = parseInputsSection(sections.inputs || sections.parameters || '');

  // Parse outputs section
  const outputs = parseOutputsSection(sections.outputs || sections.results || '');

  // Parse dependencies section
  const dependencies = parseDependenciesSection(sections.dependencies || sections.requires || '');

  // Parse examples section
  const examples = parseExamplesSection(sections.examples || sections.usage || '');

  // Parse limitations
  const limitations = parseLimitationsSection(sections.limitations || sections.caveats || '');

  // Helper to extract string from unknown
  const getString = (value: unknown): string | undefined =>
    typeof value === 'string' ? value : undefined;

  return {
    name: getString(frontmatter.name),
    version: getString(frontmatter.version),
    namespace: getString(frontmatter.namespace),
    description: getString(frontmatter.description) || extractFirstParagraph(sections.header || ''),
    longDescription: sections.description || sections.about,
    author: getString(frontmatter.author),
    license: getString(frontmatter.license),
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.filter((t): t is string => typeof t === 'string') : undefined,
    timeout: typeof frontmatter.timeout === 'number' ? frontmatter.timeout : undefined,
    maxRetries: typeof frontmatter.maxRetries === 'number' ? frontmatter.maxRetries : undefined,
    retryDelay: typeof frontmatter.retryDelay === 'number' ? frontmatter.retryDelay : undefined,
    env: isStringRecord(frontmatter.env) ? frontmatter.env : undefined,
    sandbox: typeof frontmatter.sandbox === 'boolean' ? frontmatter.sandbox : undefined,
    custom: isRecord(frontmatter.custom) ? frontmatter.custom : undefined,
    skillDefinition: {
      trigger,
      workflow,
      inputs,
      outputs,
      dependencies,
      limitations,
      examples,
    },
  };
}

/**
 * Parse frontmatter from header section.
 */
function parseFrontmatter(header: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const frontmatterMatch = header.match(/^---\n([\s\S]*?)\n---/);

  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value.trim();
        }
      }
    }
  }

  return result;
}

/**
 * Extract first paragraph from text.
 */
function extractFirstParagraph(text: string): string {
  // Skip frontmatter
  let content = text.replace(/^---[\s\S]*?---\n?/, '');
  // Get first non-empty line group
  const paragraphs = content.split(/\n\n+/);
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      return trimmed;
    }
  }
  return '';
}

/**
 * Parse trigger section.
 */
function parseTriggerSection(content: string): SkillTrigger {
  const trigger: SkillTrigger = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const listMatch = trimmed.match(/^[*-]\s+(.+)$/);
    if (listMatch) {
      const item = listMatch[1];

      if (/task.type|type/i.test(item)) {
        trigger.taskTypes = trigger.taskTypes || [];
        const types = item.match(/`([^`]+)`/g);
        if (types) {
          trigger.taskTypes.push(...types.map((t) => t.replace(/`/g, '')));
        }
      } else if (/intent|pattern/i.test(item)) {
        trigger.intentPatterns = trigger.intentPatterns || [];
        const patterns = item.match(/`([^`]+)`/g);
        if (patterns) {
          trigger.intentPatterns.push(...patterns.map((p) => p.replace(/`/g, '')));
        }
      } else if (/file|glob/i.test(item)) {
        trigger.filePatterns = trigger.filePatterns || [];
        const patterns = item.match(/`([^`]+)`/g);
        if (patterns) {
          trigger.filePatterns.push(...patterns.map((p) => p.replace(/`/g, '')));
        }
      } else if (/repo|package|monorepo/i.test(item)) {
        trigger.repoPatterns = trigger.repoPatterns || [];
        const patterns = item.match(/`([^`]+)`/g);
        if (patterns) {
          trigger.repoPatterns.push(...patterns.map((p) => p.replace(/`/g, '')));
        }
      } else if (/priority/i.test(item)) {
        const num = item.match(/\d+/);
        if (num) {
          trigger.priority = parseInt(num[0], 10);
        }
      } else if (/condition|when/i.test(item)) {
        const cond = item.match(/`([^`]+)`/);
        if (cond) {
          trigger.condition = cond[1];
        }
      }
    }
  }

  return trigger;
}

/**
 * Parse workflow section.
 */
function parseWorkflowSection(content: string): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  const lines = content.split('\n');
  let currentStep: Partial<WorkflowStep> | null = null;
  let stepIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Numbered step
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (currentStep) {
        steps.push(buildWorkflowStep(currentStep, stepIndex));
        stepIndex++;
      }
      currentStep = {
        name: numberedMatch[2],
        description: numberedMatch[2],
      };
      continue;
    }

    // Step details (indented)
    if (currentStep && trimmed.startsWith('-')) {
      const detail = trimmed.slice(1).trim();

      if (/script|run/i.test(detail)) {
        const script = detail.match(/`([^`]+)`/);
        if (script) {
          currentStep.type = 'script';
          currentStep.action = { type: 'script', script: script[1] };
        }
      } else if (/command|exec/i.test(detail)) {
        const cmd = detail.match(/`([^`]+)`/);
        if (cmd) {
          currentStep.type = 'command';
          currentStep.action = { type: 'command', command: cmd[1] };
        }
      } else if (/llm|prompt|ask/i.test(detail)) {
        const prompt = detail.match(/`([^`]+)`/) || detail.match(/"([^"]+)"/);
        if (prompt) {
          currentStep.type = 'llm';
          currentStep.action = { type: 'llm', prompt: prompt[1] };
        }
      } else if (/depend|after|require/i.test(detail)) {
        const deps = detail.match(/`([^`]+)`/g);
        if (deps) {
          currentStep.dependsOn = deps.map((d) => d.replace(/`/g, ''));
        }
      } else if (/error|fail/i.test(detail)) {
        if (/stop/i.test(detail)) currentStep.onError = 'stop';
        else if (/continue/i.test(detail)) currentStep.onError = 'continue';
        else if (/retry/i.test(detail)) currentStep.onError = 'retry';
      }
    }
  }

  // Save last step
  if (currentStep) {
    steps.push(buildWorkflowStep(currentStep, stepIndex));
  }

  return steps;
}

/**
 * Build a complete workflow step from partial data.
 */
function buildWorkflowStep(partial: Partial<WorkflowStep>, index: number): WorkflowStep {
  const id = partial.id || `step_${index + 1}`;
  const name = partial.name || `Step ${index + 1}`;
  const type = partial.type || 'manual';
  const action = partial.action || { type: 'manual', instruction: name };

  return {
    id,
    name,
    description: partial.description || name,
    type,
    action,
    dependsOn: partial.dependsOn,
    onError: partial.onError,
    maxRetries: partial.maxRetries,
  };
}

/**
 * Parse inputs section.
 */
function parseInputsSection(content: string): SkillInput[] {
  const inputs: SkillInput[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const listMatch = trimmed.match(/^[*-]\s+`(\w+)`\s*(?:\(([^)]+)\))?\s*[-:]\s*(.+)$/);

    if (listMatch) {
      const [, name, typeInfo, description] = listMatch;
      const isRequired = !/optional/i.test(typeInfo || '') && !/optional/i.test(description);
      const type = detectInputType(typeInfo || description);

      inputs.push({
        name,
        type,
        description: description.replace(/\(required\)|\(optional\)/gi, '').trim(),
        required: isRequired,
      });
    }
  }

  return inputs;
}

/**
 * Detect input type from description.
 */
function detectInputType(desc: string): SkillInput['type'] {
  const lower = desc.toLowerCase();
  if (lower.includes('file')) return 'file';
  if (lower.includes('directory') || lower.includes('folder')) return 'directory';
  if (lower.includes('number') || lower.includes('int') || lower.includes('float')) return 'number';
  if (lower.includes('bool') || lower.includes('flag')) return 'boolean';
  if (lower.includes('array') || lower.includes('list')) return 'array';
  if (lower.includes('object') || lower.includes('json')) return 'object';
  return 'string';
}

/**
 * Parse outputs section.
 */
function parseOutputsSection(content: string): SkillOutput[] {
  const outputs: SkillOutput[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const listMatch = trimmed.match(/^[*-]\s+`(\w+)`\s*(?:\(([^)]+)\))?\s*[-:]\s*(.+)$/);

    if (listMatch) {
      const [, name, typeInfo, description] = listMatch;
      const type = detectInputType(typeInfo || description);

      outputs.push({
        name,
        type,
        description: description.trim(),
      });
    }
  }

  return outputs;
}

/**
 * Parse dependencies section.
 */
function parseDependenciesSection(content: string): SkillDependency[] {
  const dependencies: SkillDependency[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const listMatch = trimmed.match(/^[*-]\s+`([^`]+)`(?:\s*@?\s*([^\s]+))?/);

    if (listMatch) {
      const [, skillId, version] = listMatch;
      const isOptional = /optional/i.test(trimmed);

      dependencies.push({
        skillId,
        version: version?.replace(/^v/, ''),
        optional: isOptional,
      });
    }
  }

  return dependencies;
}

/**
 * Parse examples section.
 */
function parseExamplesSection(content: string): SkillExample[] {
  const examples: SkillExample[] = [];
  const lines = content.split('\n');
  let currentExample: Partial<SkillExample> | null = null;
  let inCodeBlock = false;
  let codeContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        if (currentExample) {
          try {
            currentExample.inputs = JSON.parse(codeContent.join('\n'));
          } catch {
            // Not JSON, just description
          }
        }
        codeContent = [];
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Example header
    const headerMatch = line.match(/^#+\s+(.+)$/);
    if (headerMatch) {
      if (currentExample) {
        examples.push({
          name: currentExample.name || 'Example',
          description: currentExample.description,
          inputs: currentExample.inputs || {},
          expectedOutputs: currentExample.expectedOutputs,
        });
      }
      currentExample = { name: headerMatch[1] };
      continue;
    }

    // Description
    if (currentExample && line.trim() && !line.startsWith('-')) {
      currentExample.description = (currentExample.description || '') + line.trim() + ' ';
    }
  }

  // Save last example
  if (currentExample) {
    examples.push({
      name: currentExample.name || 'Example',
      description: currentExample.description?.trim(),
      inputs: currentExample.inputs || {},
      expectedOutputs: currentExample.expectedOutputs,
    });
  }

  return examples.filter((e) => Object.keys(e.inputs).length > 0 || e.description);
}

/**
 * Parse limitations section.
 */
function parseLimitationsSection(content: string): string[] {
  const limitations: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const listMatch = trimmed.match(/^[*-]\s+(.+)$/);
    if (listMatch) {
      limitations.push(listMatch[1]);
    }
  }

  return limitations;
}

// ============================================================================
// SCRIPT LOADING
// ============================================================================

/**
 * Load scripts from a skill directory.
 */
async function loadScripts(
  skillDir: string,
  config: LoaderConfig
): Promise<SkillScript[]> {
  const scripts: SkillScript[] = [];
  const scriptsDir = join(skillDir, 'scripts');

  try {
    const entries = await readdir(scriptsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const scriptPath = join(scriptsDir, entry.name);
        const content = await readFile(scriptPath, 'utf-8');
        const scriptType = detectScriptType(entry.name);

        let executable = false;
        if (config.checkExecutable) {
          try {
            await access(scriptPath, constants.X_OK);
            executable = true;
          } catch {
            executable = false;
          }
        }

        scripts.push({
          id: entry.name.replace(/\.[^.]+$/, ''),
          name: entry.name,
          path: relative(skillDir, scriptPath),
          absolutePath: scriptPath,
          type: scriptType,
          executable,
          hash: config.computeHashes ? computeContentHash(content) : '',
        });
      }
    }
  } catch {
    // No scripts directory
  }

  return scripts;
}

/**
 * Detect script type from filename.
 */
function detectScriptType(filename: string): SkillScript['type'] {
  const ext = extname(filename).toLowerCase();
  switch (ext) {
    case '.sh':
    case '.bash':
      return 'bash';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'node';
    case '.ts':
    case '.mts':
    case '.cts':
      return 'typescript';
    case '.py':
      return 'python';
    default:
      return 'other';
  }
}

// ============================================================================
// RESOURCE LOADING
// ============================================================================

/**
 * Load resources from a skill directory.
 */
async function loadResources(
  skillDir: string,
  config: LoaderConfig
): Promise<SkillResource[]> {
  const resources: SkillResource[] = [];
  const resourcesDir = join(skillDir, 'resources');

  try {
    const entries = await readdir(resourcesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const resourcePath = join(resourcesDir, entry.name);
        const stats = await stat(resourcePath);
        const content = await readFile(resourcePath);
        const resourceType = detectResourceType(entry.name);

        resources.push({
          id: entry.name.replace(/\.[^.]+$/, ''),
          name: entry.name,
          path: relative(skillDir, resourcePath),
          absolutePath: resourcePath,
          type: resourceType,
          mimeType: detectMimeType(entry.name),
          hash: config.computeHashes ? computeContentHash(content.toString()) : '',
          sizeBytes: stats.size,
        });
      }
    }
  } catch {
    // No resources directory
  }

  return resources;
}

/**
 * Detect resource type from filename.
 */
function detectResourceType(filename: string): SkillResource['type'] {
  const ext = extname(filename).toLowerCase();
  const name = filename.toLowerCase();

  if (name.includes('template') || ext === '.hbs' || ext === '.ejs' || ext === '.mustache') {
    return 'template';
  }
  if (name.includes('example') || name.includes('sample')) {
    return 'example';
  }
  if (ext === '.json' && name.includes('schema')) {
    return 'schema';
  }
  if (ext === '.json' || ext === '.yaml' || ext === '.yml' || ext === '.toml') {
    return 'config';
  }
  if (ext === '.csv' || ext === '.tsv' || ext === '.sql') {
    return 'data';
  }
  return 'other';
}

/**
 * Detect MIME type from filename.
 */
function detectMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.json': 'application/json',
    '.yaml': 'application/x-yaml',
    '.yml': 'application/x-yaml',
    '.xml': 'application/xml',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.csv': 'text/csv',
    '.sql': 'application/sql',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Compute SHA-256 hash of content.
 */
function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Compute hash of dependencies for cache invalidation.
 */
function computeDepsHash(dependencies: SkillDependency[]): string {
  const depsString = dependencies
    .map((d) => `${d.skillId}@${d.version || '*'}`)
    .sort()
    .join(',');
  return createHash('sha256').update(depsString).digest('hex').slice(0, 16);
}
