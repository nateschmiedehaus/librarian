/**
 * @fileoverview Enhanced Retrieval System
 *
 * Addresses problems found in embedding validation:
 * 1. Adversarial cases (same filename, different modules) → Add file path metadata
 * 2. Agent routing failures → Query expansion with domain terms
 * 3. Structural similarity confusion → Hybrid keyword + semantic
 * 4. Re-ranking with import graph → Boost files that import/export together
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     ENHANCED RETRIEVAL                         │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  1. QUERY EXPANSION                                            │
 * │     • Add domain-specific synonyms                             │
 * │     • Expand abbreviations (AST → Abstract Syntax Tree)        │
 * │                                                                 │
 * │  2. METADATA-ENRICHED EMBEDDINGS                               │
 * │     • Include file path in embedding input                     │
 * │     • Include module name                                      │
 * │     • Include imports/exports as context                       │
 * │                                                                 │
 * │  3. HYBRID SCORING                                             │
 * │     • Semantic similarity (embedding cosine)                   │
 * │     • Keyword match (filename, function names)                 │
 * │     • Combined score = α*semantic + β*keyword                  │
 * │                                                                 │
 * │  4. STRUCTURAL RE-RANKING                                      │
 * │     • Boost files that import query-relevant files             │
 * │     • Boost files in same module as top results                │
 * │     • Penalize files with no structural connection             │
 * └─────────────────────────────────────────────────────────────────┘
 */

import {
  generateRealEmbedding,
  cosineSimilarity,
  type EmbeddingModelId,
} from './real_embeddings.js';

// ============================================================================
// TYPES
// ============================================================================

export interface FileMetadata {
  filePath: string;
  moduleName: string;
  imports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
}

export interface EnrichedDocument {
  filePath: string;
  content: string;
  metadata: FileMetadata;
  embedding?: Float32Array;
}

export interface RetrievalResult {
  filePath: string;
  semanticScore: number;
  keywordScore: number;
  structuralBoost: number;
  finalScore: number;
  metadata: FileMetadata;
}

export interface RetrievalOptions {
  topK?: number;
  semanticWeight?: number;
  keywordWeight?: number;
  structuralWeight?: number;
  modelId?: EmbeddingModelId;
}

// ============================================================================
// DOMAIN KNOWLEDGE FOR QUERY EXPANSION
// ============================================================================

const DOMAIN_SYNONYMS: Record<string, string[]> = {
  // Agent/orchestration domain
  agent: ['swarm', 'worker', 'executor', 'runner', 'scheduler', 'orchestrator'],
  task: ['job', 'work', 'action', 'operation', 'swarm'],
  route: ['dispatch', 'assign', 'match', 'schedule', 'scheduler'],
  expertise: ['skill', 'capability', 'competency', 'specialty'],
  skills: ['expertise', 'capability', 'competency', 'specialty'],
  capability: ['skill', 'expertise', 'competency'],
  capabilities: ['capability', 'skill', 'expertise'],
  routing: ['route', 'dispatch', 'assign', 'schedule'],
  match: ['schedule', 'assign', 'dispatch', 'route', 'swarm'],
  scheduler: ['swarm', 'runner', 'dispatch', 'orchestrator'],
  orchestrate: ['swarm', 'agent', 'coordinate', 'dispatch'],

  // Code analysis domain
  ast: ['abstract syntax tree', 'parse tree', 'syntax', 'parser'],
  parse: ['analyze', 'tokenize', 'extract', 'process', 'indexer'],
  index: ['catalog', 'ingest', 'store', 'record', 'indexer'],
  embed: ['vector', 'embedding', 'semantic', 'encode'],

  // Documentation domain
  markdown: ['docs', 'documentation', 'readme', 'md'],
  documentation: ['docs', 'markdown', 'readme', 'indexer'],
  readme: ['docs', 'documentation', 'markdown'],
  docs: ['documentation', 'markdown', 'readme', 'indexer'],
  routes: ['endpoint', 'handler', 'router'],
  endpoint: ['route', 'handler', 'api'],

  // Storage domain
  database: ['db', 'sqlite', 'storage', 'persistence'],
  query: ['search', 'find', 'retrieve', 'lookup'],
  storage: ['sqlite', 'database', 'persistence', 'store'],

  // Graph domain
  graph: ['network', 'dependency', 'call graph', 'import graph', 'metrics'],
  metric: ['measure', 'score', 'rank', 'weight', 'graph'],
  dependency: ['graph', 'import', 'call', 'reference'],

  // Engine domain
  engine: ['relevance', 'constraint', 'meta', 'ranking'],
  relevance: ['ranking', 'scoring', 'similarity', 'engine'],
  ranking: ['scoring', 'relevance', 'order', 'priority'],

  // Quality domain
  confidence: ['certainty', 'reliability', 'trust', 'score', 'calibration'],
  quality: ['validation', 'check', 'verify', 'assess'],
  calibration: ['confidence', 'accuracy', 'precision'],
  calibrate: ['calibration', 'confidence', 'accuracy'],
};

const ABBREVIATION_EXPANSIONS: Record<string, string> = {
  ast: 'abstract syntax tree',
  api: 'application programming interface',
  cli: 'command line interface',
  db: 'database',
  ci: 'continuous integration',
  cd: 'continuous deployment',
  ml: 'machine learning',
  nlp: 'natural language processing',
  ui: 'user interface',
  ux: 'user experience',
};

// ============================================================================
// QUERY EXPANSION
// ============================================================================

export function expandQuery(query: string): string {
  let expanded = query.toLowerCase();

  // Expand abbreviations
  for (const [abbr, full] of Object.entries(ABBREVIATION_EXPANSIONS)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    if (regex.test(expanded)) {
      expanded = expanded.replace(regex, `${abbr} ${full}`);
    }
  }

  // Add synonyms for domain terms
  const words = expanded.split(/\s+/);
  const additions: string[] = [];

  for (const word of words) {
    const synonyms = DOMAIN_SYNONYMS[word];
    if (synonyms) {
      // Add top 2 synonyms
      additions.push(...synonyms.slice(0, 2));
    }
  }

  if (additions.length > 0) {
    expanded = `${expanded} ${additions.join(' ')}`;
  }

  return expanded;
}

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

export function extractMetadata(filePath: string, content: string): FileMetadata {
  const moduleName = extractModuleName(filePath);
  const imports = extractImports(content);
  const exports = extractExports(content);
  const functions = extractFunctionNames(content);
  const classes = extractClassNames(content);

  return {
    filePath,
    moduleName,
    imports,
    exports,
    functions,
    classes,
  };
}

function extractModuleName(filePath: string): string {
  // Extract module from path like "agents/ast_indexer.ts" → "agents"
  const parts = filePath.split('/');
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return '';
}

function extractImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:.*?from\s+)?['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function extractExports(content: string): string[] {
  const exports: string[] = [];
  const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g;

  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  return exports;
}

function extractFunctionNames(content: string): string[] {
  const functions: string[] = [];
  const funcRegex = /(?:function|async function)\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;

  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1] || match[2];
    if (name && !functions.includes(name)) {
      functions.push(name);
    }
  }

  return functions;
}

function extractClassNames(content: string): string[] {
  const classes: string[] = [];
  const classRegex = /class\s+(\w+)/g;

  let match;
  while ((match = classRegex.exec(content)) !== null) {
    classes.push(match[1]);
  }

  return classes;
}

// ============================================================================
// METADATA-ENRICHED EMBEDDING INPUT
// ============================================================================

export function buildEnrichedEmbeddingInput(
  content: string,
  metadata: FileMetadata
): string {
  const parts: string[] = [];

  // Add file path context (helps distinguish same-name files)
  parts.push(`File: ${metadata.filePath}`);
  parts.push(`Module: ${metadata.moduleName}`);

  // Add exports (what this file provides)
  if (metadata.exports.length > 0) {
    parts.push(`Exports: ${metadata.exports.slice(0, 10).join(', ')}`);
  }

  // Add function names
  if (metadata.functions.length > 0) {
    parts.push(`Functions: ${metadata.functions.slice(0, 10).join(', ')}`);
  }

  // Add imports (what this file depends on)
  if (metadata.imports.length > 0) {
    const shortImports = metadata.imports
      .slice(0, 5)
      .map((i) => i.replace(/^.*\//, '').replace(/\.js$/, ''));
    parts.push(`Imports: ${shortImports.join(', ')}`);
  }

  // Add content (truncated)
  const contentPreview = content.slice(0, 1500);
  parts.push('Code:\n' + contentPreview);

  return parts.join('\n');
}

// ============================================================================
// KEYWORD SCORING
// ============================================================================

export function computeKeywordScore(
  query: string,
  metadata: FileMetadata,
  content: string
): number {
  // Expand query with synonyms for keyword matching too
  const expandedQuery = expandQuery(query);
  const queryWords = Array.from(
    new Set(expandedQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2))
  );
  if (queryWords.length === 0) return 0;

  let matches = 0;
  const total = Math.max(6, Math.min(queryWords.length, 20));

  // Weight different match locations
  const filename = metadata.filePath.split('/').pop()?.toLowerCase() || '';
  const moduleName = metadata.moduleName.toLowerCase();
  const functionNames = metadata.functions.map((f) => f.toLowerCase()).join(' ');
  const exportNames = metadata.exports.map((e) => e.toLowerCase()).join(' ');
  const contentSample = content.toLowerCase().slice(0, 1000);

  for (const word of queryWords) {
    // Filename match is most valuable
    if (filename.includes(word)) {
      matches += 3.0;
    }
    // Module name match
    else if (moduleName.includes(word)) {
      matches += 2.0;
    }
    // Function/export name match
    else if (functionNames.includes(word) || exportNames.includes(word)) {
      matches += 1.0;
    }
    // Content match
    else if (contentSample.includes(word)) {
      matches += 0.5;
    }
  }

  // Normalize to 0-1 range but allow for bonus from multiple strong matches
  return Math.min(1, matches / (total * 1.2));
}

// ============================================================================
// STRUCTURAL SCORING
// ============================================================================

export function computeStructuralBoost(
  targetMetadata: FileMetadata,
  topResults: FileMetadata[],
  importGraph: Map<string, Set<string>>
): number {
  let boost = 0;

  // Check if target imports or is imported by top results
  const targetImports = new Set(targetMetadata.imports.map((i) => i.replace(/^.*\//, '')));
  const targetPath = targetMetadata.filePath;

  for (const topResult of topResults.slice(0, 3)) {
    const topPath = topResult.filePath;
    const topImports = new Set(topResult.imports.map((i) => i.replace(/^.*\//, '')));

    // Does target import top result?
    if (targetImports.has(topPath.replace(/^.*\//, '').replace(/\.ts$/, ''))) {
      boost += 0.2;
    }

    // Does top result import target?
    if (topImports.has(targetPath.replace(/^.*\//, '').replace(/\.ts$/, ''))) {
      boost += 0.2;
    }

    // Same module?
    if (targetMetadata.moduleName === topResult.moduleName && targetMetadata.moduleName !== '') {
      boost += 0.1;
    }
  }

  return Math.min(0.5, boost); // Cap at 0.5
}

// ============================================================================
// ENHANCED RETRIEVAL
// ============================================================================

export class EnhancedRetrieval {
  private documents: Map<string, EnrichedDocument> = new Map();
  private modelId: EmbeddingModelId;

  constructor(modelId: EmbeddingModelId = 'all-MiniLM-L6-v2') {
    this.modelId = modelId;
  }

  /**
   * Index a document with metadata enrichment.
   */
  async indexDocument(filePath: string, content: string): Promise<void> {
    const metadata = extractMetadata(filePath, content);
    const enrichedInput = buildEnrichedEmbeddingInput(content, metadata);

    const result = await generateRealEmbedding(enrichedInput, this.modelId);

    this.documents.set(filePath, {
      filePath,
      content,
      metadata,
      embedding: result.embedding,
    });
  }

  /**
   * Retrieve documents using hybrid scoring.
   */
  async retrieve(query: string, options: RetrievalOptions = {}): Promise<RetrievalResult[]> {
    const {
      topK = 10,
      semanticWeight = 0.6,
      keywordWeight = 0.3,
      structuralWeight = 0.1,
    } = options;

    // Step 1: Expand query
    const expandedQuery = expandQuery(query);

    // Step 2: Generate query embedding
    const queryResult = await generateRealEmbedding(expandedQuery, this.modelId);
    const queryEmbedding = queryResult.embedding;

    // Step 3: Compute initial scores
    const results: RetrievalResult[] = [];

    for (const [filePath, doc] of this.documents) {
      if (!doc.embedding) continue;

      const semanticScore = cosineSimilarity(queryEmbedding, doc.embedding);
      const keywordScore = computeKeywordScore(query, doc.metadata, doc.content);

      results.push({
        filePath,
        semanticScore,
        keywordScore,
        structuralBoost: 0, // Computed in next step
        finalScore: 0, // Computed after structural boost
        metadata: doc.metadata,
      });
    }

    // Step 4: Sort by semantic + keyword for initial ranking
    results.sort((a, b) => {
      const scoreA = semanticWeight * a.semanticScore + keywordWeight * a.keywordScore;
      const scoreB = semanticWeight * b.semanticScore + keywordWeight * b.keywordScore;
      return scoreB - scoreA;
    });

    // Step 5: Compute structural boost based on top results
    const topMetadata = results.slice(0, 5).map((r) => r.metadata);
    const importGraph = this.buildImportGraph();

    for (const result of results) {
      result.structuralBoost = computeStructuralBoost(
        result.metadata,
        topMetadata,
        importGraph
      );

      result.finalScore =
        semanticWeight * result.semanticScore +
        keywordWeight * result.keywordScore +
        structuralWeight * result.structuralBoost;
    }

    // Step 6: Re-sort by final score
    results.sort((a, b) => b.finalScore - a.finalScore);

    return results.slice(0, topK);
  }

  private buildImportGraph(): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const [filePath, doc] of this.documents) {
      const imports = new Set(doc.metadata.imports);
      graph.set(filePath, imports);
    }

    return graph;
  }

  /**
   * Get document count.
   */
  get size(): number {
    return this.documents.size;
  }

  /**
   * Clear all indexed documents.
   */
  clear(): void {
    this.documents.clear();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DOMAIN_SYNONYMS,
  ABBREVIATION_EXPANSIONS,
};
