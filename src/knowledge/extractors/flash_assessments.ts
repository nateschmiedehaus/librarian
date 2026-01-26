/**
 * @fileoverview Flash Assessments - At-a-Glance Health Checks
 *
 * Provides quick, actionable assessments for files and directories
 * identifying potential issues, required attention, and improvement opportunities.
 *
 * Assessment categories:
 * - Quality: Code smells, complexity, maintainability
 * - Testing: Coverage gaps, missing tests
 * - Documentation: Missing docs, outdated comments
 * - Security: Potential vulnerabilities, sensitive data exposure
 * - Architecture: Coupling issues, pattern violations
 * - Performance: Potential bottlenecks, memory concerns
 */

import * as path from 'path';
import type { FileKnowledge, DirectoryKnowledge } from '../../types.js';

// =============================================================================
// TYPES
// =============================================================================

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingCategory =
  | 'quality'
  | 'testing'
  | 'documentation'
  | 'security'
  | 'architecture'
  | 'performance'
  | 'maintenance';

export interface FlashFinding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  suggestion?: string;
  location?: {
    file?: string;
    line?: number;
  };
  tags: string[];
}

export interface FlashAssessment {
  entityId: string;
  entityType: 'file' | 'directory';
  entityPath: string;
  findings: FlashFinding[];
  overallHealth: 'healthy' | 'needs-attention' | 'at-risk' | 'critical';
  healthScore: number; // 0-100
  quickSummary: string;
  assessedAt: string;
}

// =============================================================================
// FILE ASSESSMENT
// =============================================================================

export interface FileAssessmentInput {
  file: FileKnowledge;
  content?: string;
}

/**
 * Perform a flash assessment of a file
 */
export function assessFile(input: FileAssessmentInput): FlashAssessment {
  const { file, content } = input;
  const findings: FlashFinding[] = [];

  // Run all file checks
  findings.push(...checkFileSize(file));
  findings.push(...checkFileComplexity(file));
  findings.push(...checkFileTesting(file));
  findings.push(...checkFileDocumentation(file, content));
  findings.push(...checkFileNaming(file));
  findings.push(...checkFileStructure(file));

  if (content) {
    findings.push(...checkCodePatterns(file, content));
    findings.push(...checkSecurityPatterns(file, content));
    findings.push(...checkPerformancePatterns(file, content));
  }

  // Calculate health score
  const healthScore = calculateHealthScore(findings);
  const overallHealth = determineOverallHealth(healthScore);
  const quickSummary = generateFileSummary(file, findings, healthScore);

  return {
    entityId: file.id,
    entityType: 'file',
    entityPath: file.path,
    findings,
    overallHealth,
    healthScore,
    quickSummary,
    assessedAt: new Date().toISOString(),
  };
}

function checkFileSize(file: FileKnowledge): FlashFinding[] {
  const findings: FlashFinding[] = [];

  if (file.lineCount > 500) {
    findings.push({
      id: 'large-file',
      category: 'quality',
      severity: file.lineCount > 1000 ? 'high' : 'medium',
      title: 'Large file',
      description: `File has ${file.lineCount} lines. Consider splitting into smaller modules.`,
      suggestion: 'Extract related functionality into separate files to improve maintainability.',
      tags: ['refactoring', 'maintainability', 'size'],
    });
  }

  if (file.functionCount > 20) {
    findings.push({
      id: 'too-many-functions',
      category: 'quality',
      severity: 'medium',
      title: 'Many functions in single file',
      description: `File contains ${file.functionCount} functions. May indicate low cohesion.`,
      suggestion: 'Group related functions into separate modules.',
      tags: ['cohesion', 'refactoring'],
    });
  }

  return findings;
}

function checkFileComplexity(file: FileKnowledge): FlashFinding[] {
  const findings: FlashFinding[] = [];

  if (file.complexity === 'high') {
    findings.push({
      id: 'high-complexity',
      category: 'quality',
      severity: 'high',
      title: 'High complexity',
      description: 'File has high structural complexity which may impact maintainability.',
      suggestion: 'Refactor complex functions. Consider extracting classes or helper modules.',
      tags: ['complexity', 'refactoring', 'technical-debt'],
    });
  }

  // Check import count for coupling
  if (file.importCount > 15) {
    findings.push({
      id: 'many-imports',
      category: 'architecture',
      severity: 'medium',
      title: 'High import count',
      description: `File imports ${file.importCount} modules. May indicate high coupling.`,
      suggestion: 'Review dependencies. Consider facade pattern or dependency injection.',
      tags: ['coupling', 'dependencies', 'architecture'],
    });
  }

  return findings;
}

function checkFileTesting(file: FileKnowledge): FlashFinding[] {
  const findings: FlashFinding[] = [];

  // Check if code file lacks tests
  if (file.category === 'code' && !file.hasTests && file.functionCount > 0) {
    findings.push({
      id: 'missing-tests',
      category: 'testing',
      severity: file.complexity === 'high' ? 'high' : 'medium',
      title: 'No tests found',
      description: 'This code file appears to lack test coverage.',
      suggestion: 'Add unit tests. Prioritize testing public interfaces and complex logic.',
      tags: ['testing', 'coverage', 'quality-gate'],
    });
  }

  // Check coverage if available
  if (file.testCoverage !== undefined && file.testCoverage < 0.5) {
    findings.push({
      id: 'low-coverage',
      category: 'testing',
      severity: file.testCoverage < 0.2 ? 'high' : 'medium',
      title: 'Low test coverage',
      description: `Test coverage is ${Math.round(file.testCoverage * 100)}%.`,
      suggestion: 'Add tests for uncovered code paths and edge cases.',
      tags: ['testing', 'coverage'],
    });
  }

  return findings;
}

function checkFileDocumentation(file: FileKnowledge, content?: string): FlashFinding[] {
  const findings: FlashFinding[] = [];

  // Check for file-level documentation
  if (content) {
    const hasFileDoc = /@fileoverview|@file|\/\*\*[\s\S]*?\*\//.test(content.slice(0, 500));

    if (!hasFileDoc && file.category === 'code' && file.functionCount > 3) {
      findings.push({
        id: 'missing-file-doc',
        category: 'documentation',
        severity: 'low',
        title: 'Missing file documentation',
        description: 'No file-level documentation found.',
        suggestion: 'Add a @fileoverview JSDoc comment explaining the file\'s purpose.',
        tags: ['documentation', 'maintainability'],
      });
    }
  }

  // Check for purpose/summary
  if (!file.purpose || file.purpose.length < 10) {
    findings.push({
      id: 'unclear-purpose',
      category: 'documentation',
      severity: 'info',
      title: 'Unclear file purpose',
      description: 'The purpose of this file is not clearly documented.',
      suggestion: 'Add clear documentation describing what this file does and why it exists.',
      tags: ['documentation', 'onboarding'],
    });
  }

  return findings;
}

function checkFileNaming(file: FileKnowledge): FlashFinding[] {
  const findings: FlashFinding[] = [];

  // Check for inconsistent naming
  const name = file.name;

  // Detect mixed naming conventions
  const hasCamelCase = /[a-z][A-Z]/.test(name);
  const hasSnakeCase = /_/.test(name);
  const hasKebabCase = /-/.test(name);
  const mixedConventions = [hasCamelCase, hasSnakeCase, hasKebabCase].filter(Boolean).length > 1;

  if (mixedConventions) {
    findings.push({
      id: 'mixed-naming',
      category: 'quality',
      severity: 'low',
      title: 'Mixed naming conventions',
      description: `File name "${name}" mixes naming conventions.`,
      suggestion: 'Use consistent naming (kebab-case is common for files).',
      tags: ['naming', 'consistency'],
    });
  }

  // Check for overly generic names
  const genericNames = ['utils', 'helpers', 'common', 'misc', 'stuff', 'data'];
  const baseName = name.replace(/\.[^.]+$/, '').toLowerCase();
  if (genericNames.includes(baseName)) {
    findings.push({
      id: 'generic-name',
      category: 'architecture',
      severity: 'info',
      title: 'Generic file name',
      description: `"${name}" is a generic name. May become a dumping ground.`,
      suggestion: 'Consider more specific naming that reflects the actual purpose.',
      tags: ['naming', 'architecture', 'cohesion'],
    });
  }

  return findings;
}

function checkFileStructure(file: FileKnowledge): FlashFinding[] {
  const findings: FlashFinding[] = [];

  // Check class count
  if (file.classCount > 3) {
    findings.push({
      id: 'many-classes',
      category: 'architecture',
      severity: 'medium',
      title: 'Multiple classes in file',
      description: `File contains ${file.classCount} classes.`,
      suggestion: 'Consider one class per file for better organization.',
      tags: ['architecture', 'organization'],
    });
  }

  // Check export count vs function count ratio
  if (file.functionCount > 5 && file.exportCount > file.functionCount * 0.8) {
    findings.push({
      id: 'over-exporting',
      category: 'architecture',
      severity: 'info',
      title: 'Many public exports',
      description: 'Most functions are exported. May indicate poor encapsulation.',
      suggestion: 'Consider making internal helpers private.',
      tags: ['encapsulation', 'api-surface'],
    });
  }

  return findings;
}

function checkCodePatterns(file: FileKnowledge, content: string): FlashFinding[] {
  const findings: FlashFinding[] = [];

  // Check for TODO/FIXME comments
  const todoMatches = content.match(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)[\s:]/gi);
  if (todoMatches && todoMatches.length > 5) {
    findings.push({
      id: 'many-todos',
      category: 'maintenance',
      severity: 'medium',
      title: 'Many TODO comments',
      description: `Found ${todoMatches.length} TODO/FIXME comments.`,
      suggestion: 'Address or track these items in your issue tracker.',
      tags: ['technical-debt', 'maintenance'],
    });
  }

  // Check for console.log in non-test files
  if (file.category === 'code' && !file.hasTests) {
    const consoleMatches = content.match(/console\.(log|warn|error|debug)/g);
    if (consoleMatches && consoleMatches.length > 3) {
      findings.push({
        id: 'console-statements',
        category: 'quality',
        severity: 'low',
        title: 'Console statements',
        description: `Found ${consoleMatches.length} console statements.`,
        suggestion: 'Replace with proper logging or remove debug statements.',
        tags: ['cleanup', 'logging'],
      });
    }
  }

  // Check for any type usage in TypeScript
  if (/\.tsx?$/.test(file.extension)) {
    const anyMatches = content.match(/:\s*any\b|as\s+any\b|<any>/g);
    if (anyMatches && anyMatches.length > 3) {
      findings.push({
        id: 'many-any-types',
        category: 'quality',
        severity: 'medium',
        title: 'Excessive any types',
        description: `Found ${anyMatches.length} uses of 'any' type.`,
        suggestion: 'Replace with proper types for type safety.',
        tags: ['typescript', 'type-safety'],
      });
    }
  }

  // Check for deeply nested code by looking for high indentation levels
  // Look for lines with 5+ levels of indentation (20+ spaces or 5+ tabs)
  const lines = content.split('\n');
  let deeplyNestedLines = 0;
  for (const line of lines) {
    const leadingWhitespace = line.match(/^(\s*)/)?.[1] || '';
    const spaces = leadingWhitespace.replace(/\t/g, '    ').length;
    // 5+ nesting levels (assuming 2-4 space indent = 10-20 spaces)
    if (spaces >= 16 && line.trim().length > 0) {
      deeplyNestedLines++;
    }
  }

  if (deeplyNestedLines > 5) {
    findings.push({
      id: 'deep-nesting',
      category: 'quality',
      severity: 'medium',
      title: 'Deep nesting detected',
      description: `Found ${deeplyNestedLines} lines with 4+ levels of nesting.`,
      suggestion: 'Refactor using early returns, extracted functions, or async/await.',
      tags: ['complexity', 'readability'],
    });
  }

  return findings;
}

function checkSecurityPatterns(file: FileKnowledge, content: string): FlashFinding[] {
  const findings: FlashFinding[] = [];

  // Check for hardcoded secrets patterns
  const secretPatterns = [
    /password\s*[:=]\s*['"][^'"]+['"]/gi,
    /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
    /secret\s*[:=]\s*['"][^'"]+['"]/gi,
    /token\s*[:=]\s*['"][A-Za-z0-9+/=]{20,}['"]/gi,
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      findings.push({
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'critical',
        title: 'Potential hardcoded secret',
        description: 'File may contain hardcoded credentials or secrets.',
        suggestion: 'Move secrets to environment variables or a secrets manager.',
        tags: ['security', 'secrets', 'credential-leak'],
      });
      break;
    }
  }

  // Check for SQL injection vulnerability patterns
  if (/\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)/i.test(content)) {
    findings.push({
      id: 'sql-injection-risk',
      category: 'security',
      severity: 'high',
      title: 'Potential SQL injection',
      description: 'String interpolation in SQL query detected.',
      suggestion: 'Use parameterized queries or an ORM.',
      tags: ['security', 'sql-injection', 'owasp'],
    });
  }

  // Check for eval usage
  if (/\beval\s*\(/.test(content)) {
    findings.push({
      id: 'eval-usage',
      category: 'security',
      severity: 'high',
      title: 'Dangerous eval() usage',
      description: 'eval() can execute arbitrary code and is a security risk.',
      suggestion: 'Avoid eval. Use safer alternatives like JSON.parse or Function.',
      tags: ['security', 'code-injection'],
    });
  }

  return findings;
}

function checkPerformancePatterns(file: FileKnowledge, content: string): FlashFinding[] {
  const findings: FlashFinding[] = [];

  // Check for sync file operations in non-config files
  if (file.category === 'code' && /readFileSync|writeFileSync|existsSync/.test(content)) {
    findings.push({
      id: 'sync-io',
      category: 'performance',
      severity: 'medium',
      title: 'Synchronous I/O operations',
      description: 'Sync file operations can block the event loop.',
      suggestion: 'Use async versions (readFile, writeFile) in runtime code.',
      tags: ['performance', 'async', 'blocking'],
    });
  }

  // Check for potential memory leaks in React
  if (/\.tsx?$/.test(file.extension)) {
    if (/addEventListener|setInterval|setTimeout/.test(content)) {
      if (!/removeEventListener|clearInterval|clearTimeout|useEffect.*return/.test(content)) {
        findings.push({
          id: 'potential-memory-leak',
          category: 'performance',
          severity: 'medium',
          title: 'Potential memory leak',
          description: 'Event listeners or timers may not be cleaned up.',
          suggestion: 'Ensure cleanup in useEffect return or componentWillUnmount.',
          tags: ['memory', 'react', 'cleanup'],
        });
      }
    }
  }

  // Check for N+1 patterns
  if (/for\s*\([^)]*\)[\s\S]*?await[\s\S]*?fetch|\.map\([^)]*\)[\s\S]*?await/.test(content)) {
    findings.push({
      id: 'n-plus-one',
      category: 'performance',
      severity: 'medium',
      title: 'Potential N+1 query pattern',
      description: 'Async operations inside loops may cause performance issues.',
      suggestion: 'Use Promise.all or batch operations.',
      tags: ['performance', 'database', 'network'],
    });
  }

  return findings;
}

// =============================================================================
// DIRECTORY ASSESSMENT
// =============================================================================

export interface DirectoryAssessmentInput {
  directory: DirectoryKnowledge;
  files?: FileKnowledge[];
}

/**
 * Perform a flash assessment of a directory
 */
export function assessDirectory(input: DirectoryAssessmentInput): FlashAssessment {
  const { directory, files = [] } = input;
  const findings: FlashFinding[] = [];

  // Run all directory checks
  findings.push(...checkDirectorySize(directory));
  findings.push(...checkDirectoryOrganization(directory));
  findings.push(...checkDirectoryDocumentation(directory));
  findings.push(...checkDirectoryTestCoverage(directory, files));
  findings.push(...checkDirectoryNaming(directory));
  findings.push(...checkDirectoryArchitecture(directory, files));

  // Calculate health score
  const healthScore = calculateHealthScore(findings);
  const overallHealth = determineOverallHealth(healthScore);
  const quickSummary = generateDirectorySummary(directory, findings, healthScore);

  return {
    entityId: directory.id,
    entityType: 'directory',
    entityPath: directory.path,
    findings,
    overallHealth,
    healthScore,
    quickSummary,
    assessedAt: new Date().toISOString(),
  };
}

function checkDirectorySize(dir: DirectoryKnowledge): FlashFinding[] {
  const findings: FlashFinding[] = [];

  if (dir.totalFiles > 100) {
    findings.push({
      id: 'large-directory',
      category: 'architecture',
      severity: dir.totalFiles > 300 ? 'high' : 'medium',
      title: 'Large directory',
      description: `Directory contains ${dir.totalFiles} files total.`,
      suggestion: 'Consider breaking into feature-based subdirectories.',
      tags: ['organization', 'scale'],
    });
  }

  if (dir.fileCount > 30 && dir.pattern === 'flat') {
    findings.push({
      id: 'flat-directory',
      category: 'architecture',
      severity: 'medium',
      title: 'Many files in flat structure',
      description: `${dir.fileCount} files directly in this directory.`,
      suggestion: 'Organize into subdirectories by feature or type.',
      tags: ['organization', 'navigation'],
    });
  }

  return findings;
}

function checkDirectoryOrganization(dir: DirectoryKnowledge): FlashFinding[] {
  const findings: FlashFinding[] = [];

  // Check for mixed concerns
  const fileTypes = Object.keys(dir.fileTypes);
  const hasCode = fileTypes.some((ext) => /\.(ts|tsx|js|jsx)/.test(ext));
  const hasConfig = fileTypes.some((ext) => /\.(json|yaml|yml)/.test(ext));
  const hasStyles = fileTypes.some((ext) => /\.(css|scss|less)/.test(ext));

  if (hasCode && hasConfig && hasStyles && dir.role !== 'root') {
    findings.push({
      id: 'mixed-concerns',
      category: 'architecture',
      severity: 'low',
      title: 'Mixed file types',
      description: 'Directory contains code, config, and styles together.',
      suggestion: 'Consider separating concerns into subdirectories.',
      tags: ['organization', 'separation-of-concerns'],
    });
  }

  return findings;
}

function checkDirectoryDocumentation(dir: DirectoryKnowledge): FlashFinding[] {
  const findings: FlashFinding[] = [];

  // Check for README in significant directories
  if (!dir.hasReadme && dir.totalFiles > 10 && dir.depth < 3) {
    findings.push({
      id: 'missing-readme',
      category: 'documentation',
      severity: 'low',
      title: 'Missing README',
      description: 'No README file to explain this directory\'s purpose.',
      suggestion: 'Add a README.md explaining what this directory contains.',
      tags: ['documentation', 'onboarding'],
    });
  }

  // Check for index file in module directories
  if (!dir.hasIndex && dir.role === 'feature' && dir.fileCount > 3) {
    findings.push({
      id: 'missing-index',
      category: 'architecture',
      severity: 'low',
      title: 'Missing index file',
      description: 'No index.ts/js to provide clean exports.',
      suggestion: 'Add an index file to define the public API of this module.',
      tags: ['architecture', 'api-surface'],
    });
  }

  return findings;
}

function checkDirectoryTestCoverage(dir: DirectoryKnowledge, files: FileKnowledge[]): FlashFinding[] {
  const findings: FlashFinding[] = [];

  if (dir.role === 'utility' || dir.role === 'layer') {
    // Check if tests exist
    if (!dir.hasTests && dir.totalFiles > 5) {
      findings.push({
        id: 'directory-no-tests',
        category: 'testing',
        severity: 'medium',
        title: 'No tests in directory',
        description: `${dir.role} directory has no visible tests.`,
        suggestion: 'Add __tests__ folder or colocated .test.ts files.',
        tags: ['testing', 'coverage'],
      });
    }

    // Check coverage of files if provided
    if (files.length > 0) {
      const codeFiles = files.filter((f) => f.category === 'code');
      const testedFiles = files.filter((f) => f.hasTests);
      const ratio = codeFiles.length > 0 ? testedFiles.length / codeFiles.length : 1;

      if (ratio < 0.5) {
        findings.push({
          id: 'low-test-ratio',
          category: 'testing',
          severity: 'medium',
          title: 'Low test coverage',
          description: `Only ${Math.round(ratio * 100)}% of code files have tests.`,
          suggestion: 'Add tests for uncovered files.',
          tags: ['testing', 'coverage'],
        });
      }
    }
  }

  return findings;
}

function checkDirectoryNaming(dir: DirectoryKnowledge): FlashFinding[] {
  const findings: FlashFinding[] = [];

  // Check for deep nesting
  if (dir.depth > 6) {
    findings.push({
      id: 'deep-nesting',
      category: 'architecture',
      severity: 'low',
      title: 'Deep directory nesting',
      description: `Directory is ${dir.depth} levels deep.`,
      suggestion: 'Flatten structure where possible for easier navigation.',
      tags: ['organization', 'navigation'],
    });
  }

  return findings;
}

function checkDirectoryArchitecture(dir: DirectoryKnowledge, files: FileKnowledge[]): FlashFinding[] {
  const findings: FlashFinding[] = [];

  // Check for circular dependencies hint
  if (dir.relatedDirectories.length > 5) {
    findings.push({
      id: 'many-relationships',
      category: 'architecture',
      severity: 'info',
      title: 'Many related directories',
      description: 'Directory has relationships with many other directories.',
      suggestion: 'Review for circular dependencies or excessive coupling.',
      tags: ['architecture', 'coupling'],
    });
  }

  // Check complexity distribution in files
  if (files.length > 0) {
    const highComplexity = files.filter((f) => f.complexity === 'high');
    if (highComplexity.length > files.length * 0.5) {
      findings.push({
        id: 'high-complexity-cluster',
        category: 'quality',
        severity: 'high',
        title: 'High complexity cluster',
        description: `${highComplexity.length}/${files.length} files have high complexity.`,
        suggestion: 'This area needs refactoring attention.',
        tags: ['complexity', 'technical-debt', 'hotspot'],
      });
    }
  }

  return findings;
}

// =============================================================================
// HELPERS
// =============================================================================

function calculateHealthScore(findings: FlashFinding[]): number {
  let score = 100;

  const severityPenalties: Record<FindingSeverity, number> = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
    info: 1,
  };

  for (const finding of findings) {
    score -= severityPenalties[finding.severity];
  }

  return Math.max(0, Math.min(100, score));
}

function determineOverallHealth(score: number): FlashAssessment['overallHealth'] {
  if (score >= 85) return 'healthy';
  if (score >= 65) return 'needs-attention';
  if (score >= 40) return 'at-risk';
  return 'critical';
}

function generateFileSummary(file: FileKnowledge, findings: FlashFinding[], score: number): string {
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;

  if (score >= 85) {
    return `${file.name} is in good health with ${findings.length} minor findings.`;
  }
  if (criticalCount > 0) {
    return `${file.name} has ${criticalCount} critical issue(s) requiring immediate attention.`;
  }
  if (highCount > 0) {
    return `${file.name} has ${highCount} high-priority issue(s) to address.`;
  }
  return `${file.name} has ${findings.length} findings to review.`;
}

function generateDirectorySummary(dir: DirectoryKnowledge, findings: FlashFinding[], score: number): string {
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;

  if (score >= 85) {
    return `${dir.name}/ is well-organized with ${findings.length} minor suggestions.`;
  }
  if (criticalCount > 0 || highCount > 2) {
    return `${dir.name}/ needs architectural attention. ${criticalCount + highCount} significant issues.`;
  }
  return `${dir.name}/ has ${findings.length} areas for improvement.`;
}
