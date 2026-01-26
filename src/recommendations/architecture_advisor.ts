/**
 * @fileoverview Architecture Improvement Advisor
 *
 * Detects architectural issues and suggests improvements:
 * - Circular dependencies
 * - Layer violations
 * - God modules (excessive coupling)
 * - Orphan code (unreferenced)
 * - Coupling hotspots
 *
 * Generates Mermaid diagrams to visualize issues.
 */

import type { UniversalKnowledge, Reference } from '../knowledge/universal_types.js';

// ============================================================================
// TYPES
// ============================================================================

export type ArchitectureIssueType =
  | 'circular_dependency'
  | 'layer_violation'
  | 'god_module'
  | 'orphan_code'
  | 'coupling_hotspot'
  | 'unstable_abstraction'
  | 'package_tangle';

export interface EntityReference {
  id: string;
  name: string;
  file: string;
  layer?: string;
}

export interface ArchitectureRecommendation {
  type: ArchitectureIssueType;
  severity: 'info' | 'warning' | 'error';
  title: string;
  description: string;
  affected: EntityReference[];
  suggestion: string;
  diagram?: string;  // Mermaid diagram showing the issue
}

// ============================================================================
// LAYER DEFINITIONS
// ============================================================================

/**
 * Common architectural layers and their allowed dependencies.
 * Higher layers can depend on lower layers, but not vice versa.
 */
const LAYER_HIERARCHY: Record<string, number> = {
  'presentation': 4,
  'ui': 4,
  'view': 4,
  'controller': 4,
  'api': 3,
  'application': 3,
  'service': 3,
  'orchestrator': 3,
  'domain': 2,
  'model': 2,
  'core': 2,
  'entity': 2,
  'infrastructure': 1,
  'storage': 1,
  'repository': 1,
  'util': 0,
  'utils': 0,
  'shared': 0,
  'common': 0,
};

// ============================================================================
// MAIN ANALYZER
// ============================================================================

/**
 * Analyze architecture and detect issues.
 */
export function analyzeArchitecture(
  knowledge: UniversalKnowledge[]
): ArchitectureRecommendation[] {
  const recommendations: ArchitectureRecommendation[] = [];

  // Detect circular dependencies
  const cycles = detectCycles(knowledge);
  for (const cycle of cycles) {
    recommendations.push(createCycleRecommendation(cycle));
  }

  // Detect layer violations
  const violations = detectLayerViolations(knowledge);
  for (const violation of violations) {
    recommendations.push(createLayerViolationRecommendation(violation));
  }

  // Detect god modules
  const godModules = detectGodModules(knowledge);
  for (const god of godModules) {
    recommendations.push(createGodModuleRecommendation(god));
  }

  // Detect orphan code
  const orphans = detectOrphanCode(knowledge);
  if (orphans.length > 0) {
    recommendations.push(createOrphanRecommendation(orphans));
  }

  // Detect coupling hotspots
  const hotspots = detectCouplingHotspots(knowledge);
  for (const hotspot of hotspots) {
    recommendations.push(createHotspotRecommendation(hotspot));
  }

  // Detect unstable abstractions
  const unstable = detectUnstableAbstractions(knowledge);
  for (const entity of unstable) {
    recommendations.push(createUnstableAbstractionRecommendation(entity));
  }

  return recommendations;
}

// ============================================================================
// DETECTION ALGORITHMS
// ============================================================================

interface DependencyEdge {
  from: UniversalKnowledge;
  to: UniversalKnowledge;
}

interface LayerViolation {
  from: UniversalKnowledge;
  to: UniversalKnowledge;
  fromLayer: string;
  toLayer: string;
}

interface CouplingHotspot {
  entity: UniversalKnowledge;
  afferent: number;
  efferent: number;
  connections: Reference[];
}

/**
 * Detect circular dependencies using DFS.
 */
function detectCycles(knowledge: UniversalKnowledge[]): UniversalKnowledge[][] {
  const cycles: UniversalKnowledge[][] = [];
  const nodeMap = new Map(knowledge.map(k => [k.id, k]));
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: UniversalKnowledge[] = [];

  function dfs(node: UniversalKnowledge): void {
    visited.add(node.id);
    recStack.add(node.id);
    path.push(node);

    for (const imp of node.relationships.imports) {
      const neighbor = nodeMap.get(imp.id);
      if (!neighbor) continue;

      if (recStack.has(neighbor.id)) {
        // Found a cycle - extract it from path
        const cycleStart = path.findIndex(n => n.id === neighbor.id);
        if (cycleStart !== -1) {
          const cycle = [...path.slice(cycleStart), neighbor];
          // Avoid duplicate cycles
          const cycleKey = cycle.map(c => c.id).sort().join(',');
          if (!cycles.some(c => c.map(n => n.id).sort().join(',') === cycleKey)) {
            cycles.push(cycle);
          }
        }
      } else if (!visited.has(neighbor.id)) {
        dfs(neighbor);
      }
    }

    path.pop();
    recStack.delete(node.id);
  }

  for (const node of knowledge) {
    if (!visited.has(node.id)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Detect layer violations (lower layers depending on higher).
 */
function detectLayerViolations(knowledge: UniversalKnowledge[]): LayerViolation[] {
  const violations: LayerViolation[] = [];
  const nodeMap = new Map(knowledge.map(k => [k.id, k]));

  for (const k of knowledge) {
    const fromLayer = inferLayer(k);
    const fromLevel = LAYER_HIERARCHY[fromLayer] ?? -1;

    for (const imp of k.relationships.imports) {
      const target = nodeMap.get(imp.id);
      if (!target) continue;

      const toLayer = inferLayer(target);
      const toLevel = LAYER_HIERARCHY[toLayer] ?? -1;

      // Violation: lower level depends on higher level
      if (fromLevel !== -1 && toLevel !== -1 && fromLevel < toLevel) {
        violations.push({
          from: k,
          to: target,
          fromLayer,
          toLayer,
        });
      }
    }
  }

  return violations;
}

/**
 * Detect god modules with excessive coupling.
 */
function detectGodModules(knowledge: UniversalKnowledge[]): UniversalKnowledge[] {
  const AFFERENT_THRESHOLD = 20;
  const EFFERENT_THRESHOLD = 20;

  return knowledge.filter(k =>
    k.relationships.coupling.afferent > AFFERENT_THRESHOLD ||
    k.relationships.coupling.efferent > EFFERENT_THRESHOLD
  );
}

/**
 * Detect orphan code (never imported or called).
 */
function detectOrphanCode(knowledge: UniversalKnowledge[]): UniversalKnowledge[] {
  return knowledge.filter(k =>
    k.relationships.calledBy.length === 0 &&
    k.relationships.coupling.afferent === 0 &&
    k.visibility === 'public' &&
    k.kind === 'function' &&
    !k.name.startsWith('test') &&
    !k.location.file.includes('__tests__')
  );
}

/**
 * Detect coupling hotspots (high change impact).
 */
function detectCouplingHotspots(knowledge: UniversalKnowledge[]): CouplingHotspot[] {
  const HOTSPOT_THRESHOLD = 10;

  return knowledge
    .filter(k => k.relationships.coupling.afferent > HOTSPOT_THRESHOLD)
    .map(k => ({
      entity: k,
      afferent: k.relationships.coupling.afferent,
      efferent: k.relationships.coupling.efferent,
      connections: k.relationships.calledBy,
    }));
}

/**
 * Detect unstable abstractions (abstract but frequently changed).
 */
function detectUnstableAbstractions(knowledge: UniversalKnowledge[]): UniversalKnowledge[] {
  const CHURN_THRESHOLD = 5;
  const INSTABILITY_THRESHOLD = 0.7;

  return knowledge.filter(k =>
    (k.kind === 'interface' || k.kind === 'type') &&
    k.quality.churn.changeCount > CHURN_THRESHOLD &&
    k.relationships.coupling.instability > INSTABILITY_THRESHOLD
  );
}

/**
 * Infer architectural layer from module path and explicit layer property.
 */
function inferLayer(k: UniversalKnowledge): string {
  // Explicit layer takes priority
  if (k.relationships.layer) {
    return k.relationships.layer.toLowerCase();
  }

  // Infer from path
  const pathParts = k.module.toLowerCase().split('/');
  for (const part of pathParts) {
    if (LAYER_HIERARCHY[part] !== undefined) {
      return part;
    }
  }

  return 'unknown';
}

// ============================================================================
// RECOMMENDATION FACTORIES
// ============================================================================

function createCycleRecommendation(cycle: UniversalKnowledge[]): ArchitectureRecommendation {
  const names = cycle.map(c => c.name);
  const cycleStr = names.join(' → ');

  // Generate Mermaid diagram
  const diagram = generateCycleDiagram(cycle);

  return {
    type: 'circular_dependency',
    severity: 'error',
    title: `Circular dependency: ${names.slice(0, 3).join(' → ')}${names.length > 3 ? '...' : ''}`,
    description: `Detected circular dependency: ${cycleStr}. Circular dependencies make code harder to understand, test, and refactor.`,
    affected: cycle.map(c => ({
      id: c.id,
      name: c.name,
      file: c.location.file,
    })),
    suggestion: 'Break the cycle by: (1) Extracting shared code into a separate module, (2) Using dependency injection, (3) Introducing an interface that one side depends on.',
    diagram,
  };
}

function createLayerViolationRecommendation(violation: LayerViolation): ArchitectureRecommendation {
  const diagram = `graph TD
  ${sanitizeId(violation.from.id)}["${violation.from.name}<br/>(${violation.fromLayer})"]
  ${sanitizeId(violation.to.id)}["${violation.to.name}<br/>(${violation.toLayer})"]
  ${sanitizeId(violation.from.id)} -->|"violates layer"| ${sanitizeId(violation.to.id)}

  style ${sanitizeId(violation.from.id)} fill:#FF6B6B
  style ${sanitizeId(violation.to.id)} fill:#FFD700`;

  return {
    type: 'layer_violation',
    severity: 'warning',
    title: `${violation.fromLayer} should not depend on ${violation.toLayer}`,
    description: `${violation.from.name} (${violation.fromLayer}) imports ${violation.to.name} (${violation.toLayer}), violating the dependency rule that lower layers should not depend on higher layers.`,
    affected: [
      { id: violation.from.id, name: violation.from.name, file: violation.from.location.file, layer: violation.fromLayer },
      { id: violation.to.id, name: violation.to.name, file: violation.to.location.file, layer: violation.toLayer },
    ],
    suggestion: `Introduce an interface in ${violation.toLayer} that ${violation.fromLayer} can depend on, or move the shared code to a lower layer.`,
    diagram,
  };
}

function createGodModuleRecommendation(god: UniversalKnowledge): ArchitectureRecommendation {
  const { afferent, efferent } = god.relationships.coupling;

  return {
    type: 'god_module',
    severity: 'warning',
    title: `${god.name} has too many dependencies`,
    description: `This module has ${efferent} outgoing and ${afferent} incoming dependencies. High coupling makes the module fragile and hard to change.`,
    affected: [{ id: god.id, name: god.name, file: god.location.file }],
    suggestion: 'Consider splitting into smaller, focused modules with clear responsibilities. Use the Single Responsibility Principle as a guide.',
  };
}

function createOrphanRecommendation(orphans: UniversalKnowledge[]): ArchitectureRecommendation {
  const names = orphans.slice(0, 5).map(o => o.name);
  const moreCount = orphans.length - 5;

  return {
    type: 'orphan_code',
    severity: 'info',
    title: `${orphans.length} potentially unused public functions`,
    description: `Found public functions that are never imported or called: ${names.join(', ')}${moreCount > 0 ? ` and ${moreCount} more` : ''}`,
    affected: orphans.map(o => ({ id: o.id, name: o.name, file: o.location.file })),
    suggestion: 'Review these functions. If truly unused, consider removing them to reduce maintenance burden. If used dynamically, consider adding explicit exports or documentation.',
  };
}

function createHotspotRecommendation(hotspot: CouplingHotspot): ArchitectureRecommendation {
  const connectionNames = hotspot.connections.slice(0, 5).map(c => c.name);

  return {
    type: 'coupling_hotspot',
    severity: 'warning',
    title: `${hotspot.entity.name} is a high-impact change target`,
    description: `${hotspot.afferent} modules depend on this. Changes here affect: ${connectionNames.join(', ')}${hotspot.connections.length > 5 ? '...' : ''}`,
    affected: [{ id: hotspot.entity.id, name: hotspot.entity.name, file: hotspot.entity.location.file }],
    suggestion: 'Consider stabilizing this interface. Add comprehensive tests, document breaking change policy, and consider versioning for major changes.',
  };
}

function createUnstableAbstractionRecommendation(entity: UniversalKnowledge): ArchitectureRecommendation {
  return {
    type: 'unstable_abstraction',
    severity: 'warning',
    title: `${entity.name} is an unstable abstraction`,
    description: `This ${entity.kind} has been changed ${entity.quality.churn.changeCount} times recently with instability ${entity.relationships.coupling.instability.toFixed(2)}. Interfaces should be stable.`,
    affected: [{ id: entity.id, name: entity.name, file: entity.location.file }],
    suggestion: 'Consider stabilizing this interface before adding more dependents. If frequent changes are expected, add versioning or deprecation strategy.',
  };
}

// ============================================================================
// DIAGRAM GENERATORS
// ============================================================================

function generateCycleDiagram(cycle: UniversalKnowledge[]): string {
  const lines = ['graph LR'];

  // Add nodes
  for (const node of cycle) {
    const nodeId = sanitizeId(node.id);
    lines.push(`  ${nodeId}["${node.name}"]:::cycle`);
  }

  // Add edges
  for (let i = 0; i < cycle.length - 1; i++) {
    const from = sanitizeId(cycle[i].id);
    const to = sanitizeId(cycle[i + 1].id);
    lines.push(`  ${from} --> ${to}`);
  }

  lines.push('');
  lines.push('  classDef cycle fill:#FF6B6B,stroke:#DC143C');

  return lines.join('\n');
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const _internal = {
  detectCycles,
  detectLayerViolations,
  detectGodModules,
  inferLayer,
};
