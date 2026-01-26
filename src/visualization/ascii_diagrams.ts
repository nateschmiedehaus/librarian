/**
 * @fileoverview ASCII Diagram Generator
 *
 * Generates ASCII art diagrams for terminals without Mermaid rendering.
 * Provides tree views, dependency graphs, and quick health summaries.
 */

import type { UniversalKnowledge } from '../knowledge/universal_types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TreeNode {
  id: string;
  name: string;
  kind: string;
  health: 'good' | 'warning' | 'critical';
  coverage?: number;
  complexity?: number;
  children: TreeNode[];
}

export interface ASCIIResult {
  content: string;
  width: number;
  height: number;
}

// ============================================================================
// TREE VIEW
// ============================================================================

/**
 * Generate an ASCII tree view of code structure.
 */
export function generateASCIITree(
  knowledge: UniversalKnowledge[],
  focusPath?: string
): ASCIIResult {
  // Build tree structure from knowledge
  const tree = buildTree(knowledge, focusPath);
  const lines = renderTree(tree, '', true);

  return {
    content: lines.join('\n'),
    width: Math.max(...lines.map(l => l.length)),
    height: lines.length,
  };
}

function buildTree(
  knowledge: UniversalKnowledge[],
  focusPath?: string
): TreeNode {
  // Group by directory structure
  const root: TreeNode = {
    id: 'root',
    name: focusPath ?? 'src',
    kind: 'directory',
    health: 'good',
    children: [],
  };

  // Create path-based hierarchy
  const pathMap = new Map<string, TreeNode>();
  pathMap.set('', root);

  for (const k of knowledge) {
    const parts = k.module.split('/');
    let currentPath = '';
    let parent = root;

    // Create intermediate directories
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const newPath = currentPath ? `${currentPath}/${part}` : part;

      if (!pathMap.has(newPath)) {
        const dirNode: TreeNode = {
          id: newPath,
          name: part,
          kind: 'directory',
          health: 'good',
          children: [],
        };
        parent.children.push(dirNode);
        pathMap.set(newPath, dirNode);
      }

      parent = pathMap.get(newPath)!;
      currentPath = newPath;
    }

    // Add the entity itself
    const health = getHealth(k);
    const coverage = getCoverage(k);

    parent.children.push({
      id: k.id,
      name: k.name,
      kind: k.kind,
      health,
      coverage,
      complexity: k.quality?.complexity?.cognitive,
      children: [],
    });
  }

  return root;
}

function renderTree(
  node: TreeNode,
  prefix: string,
  isLast: boolean
): string[] {
  const lines: string[] = [];

  // Connector characters
  const connector = isLast ? '└── ' : '├── ';
  const extension = isLast ? '    ' : '│   ';

  // Format node display
  const healthIcon = getHealthIcon(node.health);
  const stats = formatStats(node);
  const label = `${node.name} ${stats}${healthIcon}`;

  lines.push(`${prefix}${connector}${label}`);

  // Render children
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const childIsLast = i === node.children.length - 1;
    const childLines = renderTree(child, prefix + extension, childIsLast);
    lines.push(...childLines);
  }

  return lines;
}

function getHealthIcon(health: 'good' | 'warning' | 'critical'): string {
  switch (health) {
    case 'good': return ' ✓';
    case 'warning': return ' ⚠';
    case 'critical': return ' ✗';
  }
}

function formatStats(node: TreeNode): string {
  const parts: string[] = [];

  if (node.coverage !== undefined) {
    parts.push(`${node.coverage}%`);
  }

  if (node.complexity !== undefined) {
    parts.push(`C${node.complexity}`);
  }

  if (parts.length === 0) return '';
  return `(${parts.join(', ')}) `;
}

function getHealth(k: UniversalKnowledge): 'good' | 'warning' | 'critical' {
  const maintainability = k.quality?.maintainability?.index ?? 50;
  const complexity = k.quality?.complexity?.cognitive ?? 0;

  if (maintainability < 30 || complexity > 25) return 'critical';
  if (maintainability < 50 || complexity > 15) return 'warning';
  return 'good';
}

function getCoverage(k: UniversalKnowledge): number | undefined {
  const coverage = k.quality?.coverage?.function;
  if (coverage === undefined) return undefined;
  return Math.round(coverage * 100);
}

// ============================================================================
// DEPENDENCY BOX DIAGRAM
// ============================================================================

/**
 * Generate a simple box diagram showing dependencies.
 */
export function generateDependencyBox(
  knowledge: UniversalKnowledge,
  allKnowledge: UniversalKnowledge[]
): ASCIIResult {
  const lines: string[] = [];
  const width = 60;

  // Header box
  lines.push('╔' + '═'.repeat(width - 2) + '╗');
  lines.push('║' + centerText(knowledge.name, width - 2) + '║');
  lines.push('║' + centerText(`[${knowledge.kind}]`, width - 2) + '║');
  lines.push('╠' + '═'.repeat(width - 2) + '╣');

  // Purpose
  const purpose = knowledge.semantics?.purpose?.summary ?? 'No description';
  const wrappedPurpose = wrapText(purpose, width - 4);
  for (const line of wrappedPurpose) {
    lines.push('║ ' + padRight(line, width - 4) + ' ║');
  }

  lines.push('╠' + '═'.repeat(width - 2) + '╣');

  // Imports
  const imports = knowledge.relationships?.imports ?? [];
  lines.push('║' + padRight(' Imports:', width - 2) + '║');
  if (imports.length === 0) {
    lines.push('║' + padRight('   (none)', width - 2) + '║');
  } else {
    for (const imp of imports.slice(0, 5)) {
      lines.push('║' + padRight(`   → ${imp.name}`, width - 2) + '║');
    }
    if (imports.length > 5) {
      lines.push('║' + padRight(`   ... +${imports.length - 5} more`, width - 2) + '║');
    }
  }

  lines.push('╠' + '═'.repeat(width - 2) + '╣');

  // Used by
  const calledBy = knowledge.relationships?.calledBy ?? [];
  lines.push('║' + padRight(' Used By:', width - 2) + '║');
  if (calledBy.length === 0) {
    lines.push('║' + padRight('   (none)', width - 2) + '║');
  } else {
    for (const caller of calledBy.slice(0, 5)) {
      lines.push('║' + padRight(`   ← ${caller.name}`, width - 2) + '║');
    }
    if (calledBy.length > 5) {
      lines.push('║' + padRight(`   ... +${calledBy.length - 5} more`, width - 2) + '║');
    }
  }

  lines.push('╚' + '═'.repeat(width - 2) + '╝');

  return {
    content: lines.join('\n'),
    width,
    height: lines.length,
  };
}

// ============================================================================
// HEALTH SUMMARY
// ============================================================================

/**
 * Generate a quick health summary table.
 */
export function generateHealthSummary(
  knowledge: UniversalKnowledge[]
): ASCIIResult {
  const lines: string[] = [];

  // Header
  lines.push('┌─────────────────────────────────────────────────────────────┐');
  lines.push('│                    CODEBASE HEALTH SUMMARY                  │');
  lines.push('├─────────────────────────────────────────────────────────────┤');

  // Stats
  const stats = calculateStats(knowledge);

  lines.push('│                                                             │');
  lines.push(`│  Total Entities:  ${padRight(String(stats.total), 40)}│`);
  lines.push(`│  ✓ Healthy:       ${padRight(String(stats.healthy), 40)}│`);
  lines.push(`│  ⚠ Warning:       ${padRight(String(stats.warning), 40)}│`);
  lines.push(`│  ✗ Critical:      ${padRight(String(stats.critical), 40)}│`);
  lines.push('│                                                             │');
  lines.push('├─────────────────────────────────────────────────────────────┤');
  lines.push('│  METRICS                                                    │');
  lines.push('├─────────────────────────────────────────────────────────────┤');
  lines.push(`│  Avg Coverage:    ${padRight(`${stats.avgCoverage}%`, 40)}│`);
  lines.push(`│  Avg Complexity:  ${padRight(String(stats.avgComplexity), 40)}│`);
  lines.push(`│  Tech Debt:       ${padRight(`${stats.totalDebt}h estimated`, 40)}│`);
  lines.push('│                                                             │');

  // Critical items
  if (stats.criticalItems.length > 0) {
    lines.push('├─────────────────────────────────────────────────────────────┤');
    lines.push('│  CRITICAL ITEMS                                             │');
    lines.push('├─────────────────────────────────────────────────────────────┤');

    for (const item of stats.criticalItems.slice(0, 5)) {
      lines.push(`│  ✗ ${padRight(item, 56)}│`);
    }
    if (stats.criticalItems.length > 5) {
      lines.push(`│    ... +${padRight(String(stats.criticalItems.length - 5) + ' more', 50)}│`);
    }
  }

  lines.push('└─────────────────────────────────────────────────────────────┘');

  return {
    content: lines.join('\n'),
    width: 65,
    height: lines.length,
  };
}

interface Stats {
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  avgCoverage: number;
  avgComplexity: number;
  totalDebt: number;
  criticalItems: string[];
}

function calculateStats(knowledge: UniversalKnowledge[]): Stats {
  let healthy = 0;
  let warning = 0;
  let critical = 0;
  let totalCoverage = 0;
  let coverageCount = 0;
  let totalComplexity = 0;
  let totalDebt = 0;
  const criticalItems: string[] = [];

  for (const k of knowledge) {
    const health = getHealth(k);

    switch (health) {
      case 'good':
        healthy++;
        break;
      case 'warning':
        warning++;
        break;
      case 'critical':
        critical++;
        criticalItems.push(k.name);
        break;
    }

    const coverage = getCoverage(k);
    if (coverage !== undefined) {
      totalCoverage += coverage;
      coverageCount++;
    }

    totalComplexity += k.quality?.complexity?.cognitive ?? 0;
    totalDebt += k.quality?.maintainability?.technicalDebt?.minutes ?? 0;
  }

  return {
    total: knowledge.length,
    healthy,
    warning,
    critical,
    avgCoverage: coverageCount > 0 ? Math.round(totalCoverage / coverageCount) : 0,
    avgComplexity: knowledge.length > 0 ? Math.round(totalComplexity / knowledge.length) : 0,
    totalDebt: Math.round(totalDebt / 60),
    criticalItems,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const leftPad = Math.floor((width - text.length) / 2);
  const rightPad = width - text.length - leftPad;
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
}

function padRight(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}
