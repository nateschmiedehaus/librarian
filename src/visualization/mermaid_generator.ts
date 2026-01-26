/**
 * @fileoverview Mermaid Diagram Generator
 *
 * Generates Mermaid diagram syntax for visualizing code relationships,
 * dependencies, call hierarchies, and architecture.
 *
 * Diagram Types:
 * - Dependency graphs (flowchart)
 * - Call hierarchies (flowchart)
 * - Class hierarchies (classDiagram)
 * - Sequence diagrams (sequence)
 * - Architecture views (C4-style)
 * - Component diagrams (flowchart with subgraphs)
 */

import type { UniversalKnowledge } from '../knowledge/universal_types.js';

// ============================================================================
// TYPES
// ============================================================================

export type DiagramType =
  | 'dependency'
  | 'call_hierarchy'
  | 'class_hierarchy'
  | 'sequence'
  | 'architecture'
  | 'component';

export interface DiagramRequest {
  type: DiagramType;
  scope: 'file' | 'module' | 'directory' | 'full';
  focus?: string;    // Entity to center on
  depth?: number;    // How many levels to show
  maxNodes?: number; // Limit nodes for readability
}

export interface DiagramResult {
  mermaid: string;
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
  focusEntity?: string;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate a Mermaid diagram from knowledge entities.
 */
export function generateMermaidDiagram(
  knowledge: UniversalKnowledge[],
  request: DiagramRequest
): DiagramResult {
  switch (request.type) {
    case 'dependency':
      return generateDependencyGraph(knowledge, request);
    case 'call_hierarchy':
      return generateCallHierarchy(knowledge, request);
    case 'class_hierarchy':
      return generateClassHierarchy(knowledge, request);
    case 'sequence':
      return generateSequenceDiagram(knowledge, request);
    case 'architecture':
      return generateArchitectureDiagram(knowledge, request);
    case 'component':
      return generateComponentDiagram(knowledge, request);
    default:
      return generateDependencyGraph(knowledge, request);
  }
}

// ============================================================================
// DEPENDENCY GRAPH
// ============================================================================

function generateDependencyGraph(
  knowledge: UniversalKnowledge[],
  request: DiagramRequest
): DiagramResult {
  const maxNodes = request.maxNodes ?? 50;
  const depth = request.depth ?? 3;

  // Filter and limit nodes
  let nodes = filterByScope(knowledge, request);
  if (request.focus) {
    nodes = limitByDepth(nodes, request.focus, depth);
  }

  const truncated = nodes.length > maxNodes;
  if (truncated) {
    nodes = nodes.slice(0, maxNodes);
  }

  // Build diagram
  const lines: string[] = ['graph TD'];
  const nodeSet = new Set(nodes.map(n => n.id));

  // Add nodes with health styling
  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);
    const label = node.name;
    const healthClass = getHealthClass(node);

    lines.push(`  ${nodeId}["${escapeLabel(label)}"]:::${healthClass}`);
  }

  // Add edges
  let edgeCount = 0;
  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);
    const imports = node.relationships?.imports ?? [];

    for (const imp of imports) {
      if (nodeSet.has(imp.id)) {
        const targetId = sanitizeId(imp.id);
        lines.push(`  ${nodeId} --> ${targetId}`);
        edgeCount++;
      }
    }
  }

  // Add style definitions
  lines.push('');
  lines.push('  classDef healthy fill:#90EE90,stroke:#228B22');
  lines.push('  classDef warning fill:#FFD700,stroke:#DAA520');
  lines.push('  classDef critical fill:#FF6B6B,stroke:#DC143C');
  lines.push('  classDef unknown fill:#D3D3D3,stroke:#808080');

  return {
    mermaid: lines.join('\n'),
    nodeCount: nodes.length,
    edgeCount,
    truncated,
    focusEntity: request.focus,
  };
}

// ============================================================================
// CALL HIERARCHY
// ============================================================================

function generateCallHierarchy(
  knowledge: UniversalKnowledge[],
  request: DiagramRequest
): DiagramResult {
  const maxNodes = request.maxNodes ?? 30;
  const depth = request.depth ?? 4;

  let nodes = filterByScope(knowledge, request);
  if (request.focus) {
    nodes = limitByCallDepth(nodes, request.focus, depth);
  }

  const truncated = nodes.length > maxNodes;
  if (truncated) {
    nodes = nodes.slice(0, maxNodes);
  }

  const lines: string[] = ['graph TB'];
  const nodeSet = new Set(nodes.map(n => n.id));

  // Add nodes
  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);
    const label = `${node.name}`;
    const complexity = node.quality?.complexity?.cognitive ?? 0;
    const healthClass = complexity > 15 ? 'warning' : complexity > 25 ? 'critical' : 'healthy';

    lines.push(`  ${nodeId}["${escapeLabel(label)}"]:::${healthClass}`);
  }

  // Add call edges
  let edgeCount = 0;
  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);
    const calls = node.relationships?.calls ?? [];

    for (const call of calls) {
      if (nodeSet.has(call.id)) {
        const targetId = sanitizeId(call.id);
        const style = call.callType === 'callback' ? '-.->' : '-->';
        lines.push(`  ${nodeId} ${style} ${targetId}`);
        edgeCount++;
      }
    }
  }

  lines.push('');
  lines.push('  classDef healthy fill:#90EE90,stroke:#228B22');
  lines.push('  classDef warning fill:#FFD700,stroke:#DAA520');
  lines.push('  classDef critical fill:#FF6B6B,stroke:#DC143C');

  return {
    mermaid: lines.join('\n'),
    nodeCount: nodes.length,
    edgeCount,
    truncated,
    focusEntity: request.focus,
  };
}

// ============================================================================
// CLASS HIERARCHY
// ============================================================================

function generateClassHierarchy(
  knowledge: UniversalKnowledge[],
  request: DiagramRequest
): DiagramResult {
  const maxNodes = request.maxNodes ?? 30;

  // Filter to classes and interfaces
  let nodes = filterByScope(knowledge, request).filter(
    n => n.kind === 'class' || n.kind === 'interface' || n.kind === 'type'
  );

  const truncated = nodes.length > maxNodes;
  if (truncated) {
    nodes = nodes.slice(0, maxNodes);
  }

  const lines: string[] = ['classDiagram'];
  const nodeSet = new Set(nodes.map(n => n.id));

  // Add classes
  for (const node of nodes) {
    const className = sanitizeClassName(node.name);
    const stereotype = node.kind === 'interface' ? '<<interface>>' : '';

    if (stereotype) {
      lines.push(`  class ${className} {`);
      lines.push(`    ${stereotype}`);
      lines.push(`  }`);
    } else {
      lines.push(`  class ${className}`);
    }
  }

  // Add inheritance relationships
  let edgeCount = 0;
  for (const node of nodes) {
    const className = sanitizeClassName(node.name);

    // Extends
    if (node.relationships?.extends && nodeSet.has(node.relationships.extends.id)) {
      const parentName = sanitizeClassName(node.relationships.extends.name);
      lines.push(`  ${parentName} <|-- ${className}`);
      edgeCount++;
    }

    // Implements
    for (const impl of node.relationships?.implements ?? []) {
      if (nodeSet.has(impl.id)) {
        const interfaceName = sanitizeClassName(impl.name);
        lines.push(`  ${interfaceName} <|.. ${className}`);
        edgeCount++;
      }
    }
  }

  return {
    mermaid: lines.join('\n'),
    nodeCount: nodes.length,
    edgeCount,
    truncated,
    focusEntity: request.focus,
  };
}

// ============================================================================
// SEQUENCE DIAGRAM
// ============================================================================

function generateSequenceDiagram(
  knowledge: UniversalKnowledge[],
  request: DiagramRequest
): DiagramResult {
  // Sequence diagrams require a focused entity and its call chain
  if (!request.focus) {
    return {
      mermaid: 'sequenceDiagram\n  Note over User: Focus entity required for sequence diagram',
      nodeCount: 0,
      edgeCount: 0,
      truncated: false,
    };
  }

  const depth = request.depth ?? 5;
  const focusNode = knowledge.find(k => k.id === request.focus);

  if (!focusNode) {
    return {
      mermaid: 'sequenceDiagram\n  Note over User: Focus entity not found',
      nodeCount: 0,
      edgeCount: 0,
      truncated: false,
    };
  }

  const lines: string[] = ['sequenceDiagram'];
  const participants = new Set<string>();
  const calls: Array<{ from: string; to: string; label: string }> = [];

  // Build call sequence
  function traceCalls(node: UniversalKnowledge, currentDepth: number, visited: Set<string>): void {
    if (currentDepth >= depth || visited.has(node.id)) return;
    visited.add(node.id);

    participants.add(node.name);

    for (const call of node.relationships?.calls ?? []) {
      const target = knowledge.find(k => k.id === call.id);
      if (target) {
        participants.add(target.name);
        calls.push({
          from: node.name,
          to: target.name,
          label: call.callType ?? 'call',
        });
        traceCalls(target, currentDepth + 1, visited);
      }
    }
  }

  traceCalls(focusNode, 0, new Set());

  // Add participants
  for (const p of participants) {
    lines.push(`  participant ${sanitizeParticipant(p)}`);
  }

  // Add calls
  for (const call of calls) {
    const from = sanitizeParticipant(call.from);
    const to = sanitizeParticipant(call.to);
    lines.push(`  ${from}->>+${to}: ${call.label}`);
    lines.push(`  ${to}-->>-${from}: return`);
  }

  return {
    mermaid: lines.join('\n'),
    nodeCount: participants.size,
    edgeCount: calls.length,
    truncated: false,
    focusEntity: request.focus,
  };
}

// ============================================================================
// ARCHITECTURE DIAGRAM (C4-style)
// ============================================================================

function generateArchitectureDiagram(
  knowledge: UniversalKnowledge[],
  request: DiagramRequest
): DiagramResult {
  const maxNodes = request.maxNodes ?? 40;

  let nodes = filterByScope(knowledge, request);
  const truncated = nodes.length > maxNodes;
  if (truncated) {
    nodes = nodes.slice(0, maxNodes);
  }

  // Group by layer/module
  const layers = groupByLayer(nodes);

  const lines: string[] = ['graph TB'];

  // Create subgraphs for each layer
  for (const [layer, layerNodes] of Object.entries(layers)) {
    lines.push(`  subgraph ${sanitizeId(layer)}["${escapeLabel(layer)}"]`);
    lines.push('    direction LR');

    for (const node of layerNodes) {
      const nodeId = sanitizeId(node.id);
      const label = node.name;
      const healthClass = getHealthClass(node);

      lines.push(`    ${nodeId}["${escapeLabel(label)}"]:::${healthClass}`);
    }

    lines.push('  end');
  }

  // Add cross-layer dependencies
  const nodeSet = new Set(nodes.map(n => n.id));
  let edgeCount = 0;

  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);

    for (const imp of node.relationships?.imports ?? []) {
      if (nodeSet.has(imp.id)) {
        const targetId = sanitizeId(imp.id);
        lines.push(`  ${nodeId} --> ${targetId}`);
        edgeCount++;
      }
    }
  }

  lines.push('');
  lines.push('  classDef healthy fill:#90EE90,stroke:#228B22');
  lines.push('  classDef warning fill:#FFD700,stroke:#DAA520');
  lines.push('  classDef critical fill:#FF6B6B,stroke:#DC143C');
  lines.push('  classDef unknown fill:#D3D3D3,stroke:#808080');

  return {
    mermaid: lines.join('\n'),
    nodeCount: nodes.length,
    edgeCount,
    truncated,
    focusEntity: request.focus,
  };
}

// ============================================================================
// COMPONENT DIAGRAM
// ============================================================================

function generateComponentDiagram(
  knowledge: UniversalKnowledge[],
  request: DiagramRequest
): DiagramResult {
  const maxNodes = request.maxNodes ?? 30;

  let nodes = filterByScope(knowledge, request).filter(
    n => n.kind === 'module' || n.kind === 'class' || n.kind === 'component'
  );

  const truncated = nodes.length > maxNodes;
  if (truncated) {
    nodes = nodes.slice(0, maxNodes);
  }

  const lines: string[] = ['graph LR'];
  const nodeSet = new Set(nodes.map(n => n.id));

  // Add nodes with component styling
  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);
    const label = node.name;
    const shape = node.kind === 'module' ? `([${escapeLabel(label)}])` : `[${escapeLabel(label)}]`;

    lines.push(`  ${nodeId}${shape}`);
  }

  // Add edges with labels
  let edgeCount = 0;
  for (const node of nodes) {
    const nodeId = sanitizeId(node.id);

    for (const imp of node.relationships?.imports ?? []) {
      if (nodeSet.has(imp.id)) {
        const targetId = sanitizeId(imp.id);
        lines.push(`  ${nodeId} --> ${targetId}`);
        edgeCount++;
      }
    }
  }

  return {
    mermaid: lines.join('\n'),
    nodeCount: nodes.length,
    edgeCount,
    truncated,
    focusEntity: request.focus,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function sanitizeId(id: string): string {
  // Mermaid IDs must be alphanumeric with underscores
  return id.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50);
}

function sanitizeClassName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}

function sanitizeParticipant(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_');
}

function escapeLabel(label: string): string {
  // Escape characters that would break Mermaid
  return label
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .slice(0, 40);
}

function getHealthClass(node: UniversalKnowledge): string {
  const quality = node.quality;
  if (!quality) return 'unknown';

  const maintainability = quality.maintainability?.index ?? 50;
  const complexity = quality.complexity?.cognitive ?? 0;

  if (maintainability < 30 || complexity > 25) return 'critical';
  if (maintainability < 50 || complexity > 15) return 'warning';
  return 'healthy';
}

function filterByScope(
  knowledge: UniversalKnowledge[],
  request: DiagramRequest
): UniversalKnowledge[] {
  // For now, return all - scope filtering would require path matching
  return knowledge;
}

function limitByDepth(
  nodes: UniversalKnowledge[],
  focusId: string,
  maxDepth: number
): UniversalKnowledge[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const included = new Set<string>();

  function traverse(id: string, depth: number): void {
    if (depth > maxDepth || included.has(id)) return;

    const node = nodeMap.get(id);
    if (!node) return;

    included.add(id);

    for (const imp of node.relationships?.imports ?? []) {
      traverse(imp.id, depth + 1);
    }
  }

  traverse(focusId, 0);
  return nodes.filter(n => included.has(n.id));
}

function limitByCallDepth(
  nodes: UniversalKnowledge[],
  focusId: string,
  maxDepth: number
): UniversalKnowledge[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const included = new Set<string>();

  function traverse(id: string, depth: number): void {
    if (depth > maxDepth || included.has(id)) return;

    const node = nodeMap.get(id);
    if (!node) return;

    included.add(id);

    for (const call of node.relationships?.calls ?? []) {
      traverse(call.id, depth + 1);
    }
  }

  traverse(focusId, 0);
  return nodes.filter(n => included.has(n.id));
}

function groupByLayer(nodes: UniversalKnowledge[]): Record<string, UniversalKnowledge[]> {
  const layers: Record<string, UniversalKnowledge[]> = {};

  for (const node of nodes) {
    const layer = node.relationships?.layer ?? node.module.split('/')[0] ?? 'other';

    if (!layers[layer]) {
      layers[layer] = [];
    }
    layers[layer].push(node);
  }

  return layers;
}
