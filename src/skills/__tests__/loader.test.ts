/**
 * @fileoverview Tests for Skills Loader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  discoverSkills,
  loadSkill,
  loadSkills,
  DEFAULT_LOADER_CONFIG,
  type LoaderConfig,
} from '../loader.js';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Skills Loader', () => {
  let testDir: string;
  let workspaceRoot: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `skills-loader-test-${Date.now()}`);
    workspaceRoot = testDir;
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================================================
  // SKILL DISCOVERY
  // ============================================================================

  describe('discoverSkills', () => {
    it('should find skill directories containing SKILL.md', async () => {
      // Create a skill directory
      const skillDir = join(testDir, 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '# My Skill\n');

      const result = await discoverSkills(testDir);

      expect(result.skillPaths).toHaveLength(1);
      expect(result.skillPaths[0]).toBe(skillDir);
      expect(result.scannedDirs).toBeGreaterThan(0);
    });

    it('should find multiple skill directories', async () => {
      // Create multiple skills
      const skill1 = join(testDir, 'skill-one');
      const skill2 = join(testDir, 'skill-two');
      const skill3 = join(testDir, 'nested', 'skill-three');

      await mkdir(skill1, { recursive: true });
      await mkdir(skill2, { recursive: true });
      await mkdir(skill3, { recursive: true });

      await writeFile(join(skill1, 'SKILL.md'), '# Skill One\n');
      await writeFile(join(skill2, 'SKILL.md'), '# Skill Two\n');
      await writeFile(join(skill3, 'SKILL.md'), '# Skill Three\n');

      const result = await discoverSkills(testDir);

      expect(result.skillPaths).toHaveLength(3);
      expect(result.skillPaths).toContain(skill1);
      expect(result.skillPaths).toContain(skill2);
      expect(result.skillPaths).toContain(skill3);
    });

    it('should skip node_modules and .git directories', async () => {
      // Create skills in skip directories
      const validSkill = join(testDir, 'valid-skill');
      const nodeModulesSkill = join(testDir, 'node_modules', 'hidden-skill');
      const gitSkill = join(testDir, '.git', 'git-skill');

      await mkdir(validSkill, { recursive: true });
      await mkdir(nodeModulesSkill, { recursive: true });
      await mkdir(gitSkill, { recursive: true });

      await writeFile(join(validSkill, 'SKILL.md'), '# Valid\n');
      await writeFile(join(nodeModulesSkill, 'SKILL.md'), '# Hidden\n');
      await writeFile(join(gitSkill, 'SKILL.md'), '# Git\n');

      const result = await discoverSkills(testDir);

      expect(result.skillPaths).toHaveLength(1);
      expect(result.skillPaths[0]).toBe(validSkill);
      expect(result.skippedDirs).toBeGreaterThan(0);
    });

    it('should respect maxDepth configuration', async () => {
      // Create deeply nested skill
      const deepSkill = join(testDir, 'a', 'b', 'c', 'd', 'e', 'f', 'deep-skill');
      await mkdir(deepSkill, { recursive: true });
      await writeFile(join(deepSkill, 'SKILL.md'), '# Deep\n');

      // Default maxDepth is 5
      const result = await discoverSkills(testDir);
      expect(result.skillPaths).toHaveLength(0);

      // With higher maxDepth
      const resultDeep = await discoverSkills(testDir, { ...DEFAULT_LOADER_CONFIG, maxDepth: 10 });
      expect(resultDeep.skillPaths).toHaveLength(1);
    });

    it('should handle case-insensitive SKILL.md', async () => {
      const skillDir = join(testDir, 'case-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'skill.MD'), '# Case Skill\n');

      const result = await discoverSkills(testDir);

      expect(result.skillPaths).toHaveLength(1);
    });

    it('should return empty when no skills found', async () => {
      const result = await discoverSkills(testDir);

      expect(result.skillPaths).toHaveLength(0);
      expect(result.scannedDirs).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SKILL LOADING
  // ============================================================================

  describe('loadSkill', () => {
    it('should load a minimal skill', async () => {
      const skillDir = join(testDir, 'minimal-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `# Minimal Skill

A simple skill for testing.

## Trigger
- Task type: \`test\`

## Workflow
1. Run the test
`
      );

      const result = await loadSkill(skillDir, workspaceRoot);

      expect(result.skill).toBeDefined();
      expect(result.skill.identity.id).toBe('minimal-skill');
      expect(result.skill.identity.name).toBe('minimal-skill');
      expect(result.skill.definition.trigger.taskTypes).toContain('test');
      expect(result.errors).toHaveLength(0);
    });

    it('should parse frontmatter', async () => {
      const skillDir = join(testDir, 'frontmatter-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `---
name: My Custom Name
version: 2.0.0
namespace: company
author: Test Author
license: MIT
tags: ["testing", "example"]
---
# Frontmatter Skill

Description here.

## Trigger
- Task type: \`test\`

## Workflow
1. Step one
`
      );

      const result = await loadSkill(skillDir, workspaceRoot);

      expect(result.skill.identity.name).toBe('My Custom Name');
      expect(result.skill.identity.version).toBe('2.0.0');
      expect(result.skill.identity.namespace).toBe('company');
      expect(result.skill.identity.qualifiedName).toBe('company:frontmatter-skill');
      expect(result.skill.meta.author).toBe('Test Author');
      expect(result.skill.meta.license).toBe('MIT');
    });

    it('should parse trigger section', async () => {
      const skillDir = join(testDir, 'trigger-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `# Trigger Skill

## Trigger
- Task type: \`build\`
- Task type: \`test\`
- Intent pattern: \`run build\`
- File glob: \`*.ts\`
- Priority: 10

## Workflow
1. Execute
`
      );

      const result = await loadSkill(skillDir, workspaceRoot);
      const trigger = result.skill.definition.trigger;

      expect(trigger.taskTypes).toContain('build');
      expect(trigger.taskTypes).toContain('test');
      expect(trigger.intentPatterns).toContain('run build');
      expect(trigger.filePatterns).toContain('*.ts');
      expect(trigger.priority).toBe(10);
    });

    it('should parse workflow steps', async () => {
      const skillDir = join(testDir, 'workflow-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `# Workflow Skill

## Workflow
1. Prepare the environment
   - script: \`prepare.sh\`
2. Build the project
   - exec command: \`npm build\`
   - after: \`step_1\`
3. Verify results
   - ask llm: \`Check if build succeeded\`
   - error: stop
`
      );

      const result = await loadSkill(skillDir, workspaceRoot);
      const workflow = result.skill.definition.workflow;

      expect(workflow).toHaveLength(3);
      expect(workflow[0].name).toContain('Prepare');
      expect(workflow[0].action.type).toBe('script');
      expect(workflow[1].action.type).toBe('command');
      expect(workflow[2].action.type).toBe('llm');
      expect(workflow[2].onError).toBe('stop');
    });

    it('should parse inputs section', async () => {
      const skillDir = join(testDir, 'inputs-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `# Inputs Skill

## Inputs
- \`projectPath\` (directory) - Path to the project
- \`verbose\` (boolean, optional) - Enable verbose output
- \`count\` (number) - Number of iterations

## Workflow
1. Process
`
      );

      const result = await loadSkill(skillDir, workspaceRoot);
      const inputs = result.skill.definition.inputs;

      expect(inputs).toHaveLength(3);
      expect(inputs[0].name).toBe('projectPath');
      expect(inputs[0].type).toBe('directory');
      expect(inputs[0].required).toBe(true);
      expect(inputs[1].name).toBe('verbose');
      expect(inputs[1].type).toBe('boolean');
      expect(inputs[1].required).toBe(false);
      expect(inputs[2].name).toBe('count');
      expect(inputs[2].type).toBe('number');
    });

    it('should parse outputs section', async () => {
      const skillDir = join(testDir, 'outputs-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `# Outputs Skill

## Outputs
- \`result\` (string) - The operation result
- \`outputFile\` (file) - Generated output file

## Workflow
1. Generate
`
      );

      const result = await loadSkill(skillDir, workspaceRoot);
      const outputs = result.skill.definition.outputs;

      expect(outputs).toHaveLength(2);
      expect(outputs[0].name).toBe('result');
      expect(outputs[0].type).toBe('string');
      expect(outputs[1].name).toBe('outputFile');
      expect(outputs[1].type).toBe('file');
    });

    it('should parse dependencies section', async () => {
      const skillDir = join(testDir, 'deps-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `# Dependencies Skill

## Dependencies
- \`base-skill\` @1.0.0
- \`optional-skill\` (optional)

## Workflow
1. Run
`
      );

      const result = await loadSkill(skillDir, workspaceRoot);
      const deps = result.skill.definition.dependencies;

      expect(deps).toHaveLength(2);
      expect(deps[0].skillId).toBe('base-skill');
      expect(deps[0].version).toBe('1.0.0');
      expect(deps[1].skillId).toBe('optional-skill');
      expect(deps[1].optional).toBe(true);
    });

    it('should load scripts from scripts directory', async () => {
      const skillDir = join(testDir, 'scripts-skill');
      const scriptsDir = join(skillDir, 'scripts');
      await mkdir(scriptsDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '# Scripts Skill\n\n## Workflow\n1. Run\n');
      await writeFile(join(scriptsDir, 'run.sh'), '#!/bin/bash\necho "Hello"');
      await writeFile(join(scriptsDir, 'helper.js'), 'console.log("helper");');
      await chmod(join(scriptsDir, 'run.sh'), 0o755);

      const result = await loadSkill(skillDir, workspaceRoot);

      expect(result.skill.scripts).toHaveLength(2);
      const bashScript = result.skill.scripts.find((s) => s.type === 'bash');
      const nodeScript = result.skill.scripts.find((s) => s.type === 'node');
      expect(bashScript).toBeDefined();
      expect(bashScript?.executable).toBe(true);
      expect(nodeScript).toBeDefined();
    });

    it('should load resources from resources directory', async () => {
      const skillDir = join(testDir, 'resources-skill');
      const resourcesDir = join(skillDir, 'resources');
      await mkdir(resourcesDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '# Resources Skill\n\n## Workflow\n1. Run\n');
      await writeFile(join(resourcesDir, 'template.hbs'), '{{name}}');
      await writeFile(join(resourcesDir, 'config.json'), '{}');

      const result = await loadSkill(skillDir, workspaceRoot);

      expect(result.skill.resources).toHaveLength(2);
      const template = result.skill.resources.find((r) => r.type === 'template');
      const config = result.skill.resources.find((r) => r.type === 'config');
      expect(template).toBeDefined();
      expect(config).toBeDefined();
    });

    it('should compute content hashes when enabled', async () => {
      const skillDir = join(testDir, 'hash-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '# Hash Skill\n\n## Workflow\n1. Run\n');

      const result = await loadSkill(skillDir, workspaceRoot, {
        ...DEFAULT_LOADER_CONFIG,
        computeHashes: true,
      });

      expect(result.skill.cache.contentHash).toBeTruthy();
      expect(result.skill.cache.contentHash.length).toBe(16);
    });

    it('should throw when SKILL.md not found', async () => {
      const skillDir = join(testDir, 'no-skill');
      await mkdir(skillDir, { recursive: true });

      await expect(loadSkill(skillDir, workspaceRoot)).rejects.toThrow('SKILL.md not found');
    });
  });

  // ============================================================================
  // LOADING MULTIPLE SKILLS
  // ============================================================================

  describe('loadSkills', () => {
    it('should load multiple skills', async () => {
      const skill1 = join(testDir, 'skill-1');
      const skill2 = join(testDir, 'skill-2');

      await mkdir(skill1, { recursive: true });
      await mkdir(skill2, { recursive: true });

      await writeFile(join(skill1, 'SKILL.md'), '# Skill 1\n\n## Workflow\n1. Run\n');
      await writeFile(join(skill2, 'SKILL.md'), '# Skill 2\n\n## Workflow\n1. Run\n');

      const result = await loadSkills([skill1, skill2], workspaceRoot);

      expect(result.skills).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should report failed skill loads', async () => {
      const validSkill = join(testDir, 'valid');
      const invalidSkill = join(testDir, 'invalid');

      await mkdir(validSkill, { recursive: true });
      await mkdir(invalidSkill, { recursive: true });

      await writeFile(join(validSkill, 'SKILL.md'), '# Valid\n\n## Workflow\n1. Run\n');
      // No SKILL.md in invalid

      const result = await loadSkills([validSkill, invalidSkill], workspaceRoot);

      expect(result.skills).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].path).toBe(invalidSkill);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty SKILL.md', async () => {
      const skillDir = join(testDir, 'empty-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '');

      const result = await loadSkill(skillDir, workspaceRoot);

      expect(result.skill.identity.id).toBe('empty-skill');
      expect(result.skill.definition.workflow).toHaveLength(0);
    });

    it('should handle skill with only workflow', async () => {
      const skillDir = join(testDir, 'minimal');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `## Workflow
1. First step
2. Second step
`
      );

      const result = await loadSkill(skillDir, workspaceRoot);

      expect(result.skill.definition.workflow).toHaveLength(2);
    });

    it('should handle alternative section names', async () => {
      const skillDir = join(testDir, 'alternative');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `# Alternative Skill

## When
- Task type: \`test\`

## Steps
1. Do something

## Parameters
- \`param\` (string) - A parameter

## Results
- \`output\` (string) - The output
`
      );

      const result = await loadSkill(skillDir, workspaceRoot);

      expect(result.skill.definition.trigger.taskTypes).toContain('test');
      expect(result.skill.definition.workflow).toHaveLength(1);
      expect(result.skill.definition.inputs).toHaveLength(1);
      expect(result.skill.definition.outputs).toHaveLength(1);
    });
  });
});
