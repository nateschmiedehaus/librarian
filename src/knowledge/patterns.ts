/**
 * @fileoverview Pattern Knowledge System
 *
 * Detects and tracks patterns in the codebase:
 * - Design patterns (factory, singleton, observer, etc.)
 * - Anti-patterns (god objects, feature envy, etc.)
 * - Naming conventions and team style
 * - Recurring code structures
 * - Emergent architectural patterns
 *
 * ARCHITECTURAL REQUIREMENT:
 * Semantic pattern claims (e.g., "this is a Singleton pattern") require LLM synthesis.
 * The heuristic query() method is DEPRECATED for semantic claims.
 * Use queryWithLLM() for production pattern detection.
 *
 * Metric-based analysis (line counts, dependency cycles, export counts) is permitted
 * without LLM as these are objective measurements, not semantic claims.
 */

import type { LibrarianStorage, FunctionKnowledge, ModuleKnowledge } from '../storage/types.js';
import { computeGraphMetrics } from '../graphs/metrics.js';
import { buildModuleGraphs } from './module_graph.js';
import { analyzeAsyncPatterns, analyzeErrorHandlingPatterns, analyzeTestingPatterns } from './pattern_behavior.js';
import { analyzeNamingConventions, analyzeTeamStylePatterns } from './pattern_naming.js';
import { resolveLlmServiceAdapter } from '../adapters/llm_service.js';
import { resolveLibrarianModelId } from '../api/llm_env.js';

// ============================================================================
// TYPES
// ============================================================================

export interface PatternQuery {
  type:
    | 'design_patterns'   // Classic design patterns
    | 'anti_patterns'     // Anti-patterns and smells
    | 'naming'            // Naming conventions
    | 'team_style'        // Team coding style
    | 'recurring'         // Recurring code structures
    | 'emergent'          // Emergent patterns
    | 'error_handling'    // Error handling patterns
    | 'async_patterns'    // Async/await patterns
    | 'testing_patterns'; // Testing patterns

  target?: string;
  minOccurrences?: number;
}

export interface PatternResult {
  query: PatternQuery;
  patterns?: DetectedPattern[];
  antiPatterns?: DetectedAntiPattern[];
  conventions?: NamingConvention[];
  summary: string;
  recommendations: string[];
}

export interface DetectedPattern {
  name: string;
  type: 'design' | 'behavioral' | 'structural' | 'team' | 'emergent';
  occurrences: PatternOccurrence[];
  confidence: number;
  description: string;
}

export interface PatternOccurrence {
  file: string;
  line?: number;
  evidence: string;
}

export interface DetectedAntiPattern {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  occurrences: PatternOccurrence[];
  description: string;
  remediation: string;
}

export interface NamingConvention {
  pattern: string;
  type: 'function' | 'variable' | 'class' | 'file' | 'directory';
  count: number;
  examples: string[];
  adherence: number; // 0-1
}

export interface PatternLLMConfig {
  provider: 'claude' | 'codex';
  modelId?: string;
}

// ============================================================================
// PATTERN KNOWLEDGE
// ============================================================================

export class PatternKnowledge {
  constructor(private storage: LibrarianStorage) {}

  /**
   * LLM-backed pattern detection. Use this for production pattern analysis.
   *
   * ARCHITECTURAL REQUIREMENT: Semantic pattern claims require LLM synthesis.
   * This method provides verified pattern detection with evidence traces.
   */
  async queryWithLLM(q: PatternQuery, config: PatternLLMConfig): Promise<PatternResult> {
    // Get heuristic candidates first (for context)
    const heuristicResult = await this.queryHeuristic(q);

    // For metric-based queries, heuristic is sufficient
    if (q.type === 'anti_patterns' || q.type === 'emergent') {
      // Anti-patterns and emergent patterns are based on objective metrics
      // (line counts, export counts, graph analysis) - LLM enhancement optional
      return heuristicResult;
    }

    // For semantic claims (design patterns, naming, etc.), LLM is required
    try {
      const llmService = resolveLlmServiceAdapter();

      const functions = await this.storage.getFunctions();
      const modules = await this.storage.getModules();

      // Build context for LLM
      const sampleFunctions = functions.slice(0, 20).map(f => ({
        name: f.name,
        signature: f.signature,
        file: f.filePath,
      }));
      const sampleModules = modules.slice(0, 15).map(m => ({
        path: m.path,
        exports: m.exports.slice(0, 10),
      }));

      const prompt = buildPatternPrompt(q, sampleFunctions, sampleModules, heuristicResult);

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: PATTERN_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ];

      const response = await llmService.chat({
        provider: config.provider,
        modelId: config.modelId
          ?? resolveLibrarianModelId(config.provider)
          ?? 'claude-haiku-4-5-20241022',
        messages,
        maxTokens: 1500,
      });

      return parsePatternResponse(response.content, q, heuristicResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `unverified_by_trace(patterns_llm_failed): Pattern detection requires LLM synthesis. ${message}`
      );
    }
  }

  /**
   * @deprecated Use queryWithLLM() for semantic pattern claims.
   *
   * Heuristic-only pattern detection based on naming conventions.
   * WARNING: Semantic claims from this method are not verified by LLM synthesis.
   * Use only for rapid prototyping or when LLM is unavailable with explicit acknowledgment.
   */
  async query(q: PatternQuery): Promise<PatternResult> {
    console.warn(
      '[DEPRECATED] PatternKnowledge.query() uses heuristic detection. ' +
      'Use queryWithLLM() for verified semantic pattern claims per VISION architecture.'
    );
    return this.queryHeuristic(q);
  }

  /**
   * Internal heuristic query method.
   * Provides candidates for LLM verification, not final pattern claims.
   */
  private async queryHeuristic(q: PatternQuery): Promise<PatternResult> {
    switch (q.type) {
      case 'design_patterns':
        return this.detectDesignPatterns(q);
      case 'anti_patterns':
        return this.detectAntiPatterns(q);
      case 'naming':
        return this.analyzeNaming(q);
      case 'team_style':
        return this.analyzeTeamStyle(q);
      case 'recurring':
        return this.findRecurringPatterns(q);
      case 'emergent':
        return this.findEmergentPatterns(q);
      case 'error_handling':
        return this.analyzeErrorHandling(q);
      case 'async_patterns':
        return this.analyzeAsyncPatterns(q);
      case 'testing_patterns':
        return this.analyzeTestingPatterns(q);
      default:
        return { query: q, summary: 'Unknown query type', recommendations: [] };
    }
  }

  private async detectDesignPatterns(query: PatternQuery): Promise<PatternResult> {
    const functions = await this.storage.getFunctions();
    const modules = await this.storage.getModules();
    const patterns: DetectedPattern[] = [];

    // Singleton pattern
    const singletonCandidates = functions.filter(f =>
      f.name.toLowerCase().includes('getinstance') ||
      f.name.toLowerCase() === 'instance' ||
      (f.signature.includes('static') && f.name.toLowerCase().includes('instance'))
    );
    if (singletonCandidates.length > 0) {
      patterns.push({
        name: 'Singleton',
        type: 'design',
        occurrences: singletonCandidates.map(f => ({
          file: f.filePath,
          line: f.startLine,
          evidence: f.signature,
        })),
        confidence: 0.8,
        description: 'Ensures a class has only one instance',
      });
    }

    // Factory pattern
    const factoryCandidates = functions.filter(f =>
      f.name.toLowerCase().startsWith('create') ||
      f.name.toLowerCase().includes('factory') ||
      f.name.toLowerCase().startsWith('build') ||
      f.name.toLowerCase().startsWith('make')
    );
    if (factoryCandidates.length >= (query.minOccurrences ?? 3)) {
      patterns.push({
        name: 'Factory',
        type: 'design',
        occurrences: factoryCandidates.slice(0, 10).map(f => ({
          file: f.filePath,
          line: f.startLine,
          evidence: f.name,
        })),
        confidence: 0.75,
        description: 'Provides interface for creating objects',
      });
    }

    // Observer/Event pattern
    const observerCandidates = functions.filter(f =>
      f.name.toLowerCase().includes('subscribe') ||
      f.name.toLowerCase().includes('unsubscribe') ||
      f.name.toLowerCase().includes('emit') ||
      f.name.toLowerCase().includes('listener') ||
      f.name.toLowerCase().includes('onevent') ||
      f.name.toLowerCase().startsWith('on')
    );
    if (observerCandidates.length >= (query.minOccurrences ?? 3)) {
      patterns.push({
        name: 'Observer/Event',
        type: 'behavioral',
        occurrences: observerCandidates.slice(0, 10).map(f => ({
          file: f.filePath,
          line: f.startLine,
          evidence: f.name,
        })),
        confidence: 0.7,
        description: 'Defines subscription mechanism for events',
      });
    }

    // Strategy pattern
    const strategyCandidates = modules.filter(m =>
      m.path.toLowerCase().includes('strategy') ||
      m.exports.some(e => e.toLowerCase().includes('strategy'))
    );
    if (strategyCandidates.length > 0) {
      patterns.push({
        name: 'Strategy',
        type: 'behavioral',
        occurrences: strategyCandidates.map(m => ({
          file: m.path,
          evidence: 'Strategy in name/exports',
        })),
        confidence: 0.65,
        description: 'Enables selecting algorithms at runtime',
      });
    }

    // Builder pattern
    const builderCandidates = functions.filter(f =>
      f.name.toLowerCase().includes('builder') ||
      (f.signature.includes('this') && f.name.toLowerCase().startsWith('with'))
    );
    if (builderCandidates.length >= 2) {
      patterns.push({
        name: 'Builder',
        type: 'design',
        occurrences: builderCandidates.slice(0, 5).map(f => ({
          file: f.filePath,
          line: f.startLine,
          evidence: f.name,
        })),
        confidence: 0.6,
        description: 'Separates construction from representation',
      });
    }

    return {
      query,
      patterns,
      summary: `Detected ${patterns.length} design patterns`,
      recommendations: patterns.length < 2
        ? ['Consider using more design patterns for better code organization']
        : [],
    };
  }

  private async detectAntiPatterns(query: PatternQuery): Promise<PatternResult> {
    const functions = await this.storage.getFunctions();
    const modules = await this.storage.getModules();
    const { graph } = buildModuleGraphs(modules);
    const antiPatterns: DetectedAntiPattern[] = [];

    // God Object
    for (const mod of modules) {
      if (mod.exports.length > 25) {
        antiPatterns.push({
          name: 'God Object',
          severity: mod.exports.length > 40 ? 'critical' : 'high',
          occurrences: [{ file: mod.path, evidence: `${mod.exports.length} exports` }],
          description: `${mod.path} has too many responsibilities`,
          remediation: 'Split into smaller, focused modules',
        });
      }
    }

    // Long Method
    const longMethods = functions.filter(f => f.endLine - f.startLine > 100);
    if (longMethods.length > 0) {
      antiPatterns.push({
        name: 'Long Method',
        severity: 'medium',
        occurrences: longMethods.slice(0, 10).map(f => ({
          file: f.filePath,
          line: f.startLine,
          evidence: `${f.endLine - f.startLine} lines`,
        })),
        description: `${longMethods.length} functions exceed 100 lines`,
        remediation: 'Extract smaller functions with single responsibilities',
      });
    }

    // Feature Envy (too many external dependencies)
    for (const mod of modules) {
      const externalDeps = mod.dependencies.filter(d => !d.startsWith('.'));
      if (externalDeps.length > 12) {
        antiPatterns.push({
          name: 'Feature Envy',
          severity: 'medium',
          occurrences: [{ file: mod.path, evidence: `${externalDeps.length} external deps` }],
          description: `Module depends on too many external packages`,
          remediation: 'Consider if this module has too many responsibilities',
        });
      }
    }

    const cycles = findDependencyCycles(graph, 10);
    if (cycles.length > 0) {
      antiPatterns.push({
        name: 'Circular Dependency',
        severity: cycles.length > 5 ? 'critical' : 'high',
        occurrences: cycles.slice(0, 3).map((cycle) => ({
          file: cycle.join(' -> '),
          evidence: `${cycle.length} modules in cycle`,
        })),
        description: `${cycles.length} circular dependencies detected`,
        remediation: 'Break cycles with dependency inversion or shared abstractions',
      });
    }

    return {
      query,
      antiPatterns,
      summary: `Detected ${antiPatterns.length} anti-patterns`,
      recommendations: antiPatterns
        .filter(a => a.severity === 'high' || a.severity === 'critical')
        .map(a => `Fix ${a.name}: ${a.remediation}`),
    };
  }

  private async analyzeNaming(query: PatternQuery): Promise<PatternResult> {
    const functions = await this.storage.getFunctions();
    const modules = await this.storage.getModules();
    return analyzeNamingConventions(functions, modules, query);
  }

  private async analyzeTeamStyle(query: PatternQuery): Promise<PatternResult> {
    const functions = await this.storage.getFunctions();
    const modules = await this.storage.getModules();
    return analyzeTeamStylePatterns(functions, modules, query);
  }

  private async findRecurringPatterns(query: PatternQuery): Promise<PatternResult> {
    const namingResult = await this.analyzeNaming(query);

    return {
      query,
      conventions: namingResult.conventions,
      summary: `Found ${namingResult.conventions?.length ?? 0} recurring patterns`,
      recommendations: [],
    };
  }

  private async findEmergentPatterns(query: PatternQuery): Promise<PatternResult> {
    const modules = await this.storage.getModules();
    const patterns: DetectedPattern[] = [];
    const { graph } = buildModuleGraphs(modules);
    const { metrics, report } = computeGraphMetrics({ module: graph });

    // Detect layered architecture
    const layers = ['bin', 'api', 'service', 'lib', 'utils', 'types', 'storage', 'integration'];
    const foundLayers = layers.filter(layer =>
      modules.some(m => m.path.includes(`/${layer}/`) || m.path.includes(`/${layer}s/`))
    );
    if (foundLayers.length >= 3) {
      patterns.push({
        name: 'Layered Architecture',
        type: 'emergent',
        occurrences: foundLayers.map(l => ({ file: `src/${l}`, evidence: 'directory exists' })),
        confidence: 0.8,
        description: `Codebase uses ${foundLayers.join(', ')} layers`,
      });
    }

    // Detect feature-based organization
    const topDirs = new Set<string>();
    for (const mod of modules) {
      const parts = mod.path.split('/');
      if (parts.length >= 2) topDirs.add(parts[1]);
    }
    const featureDirs = [...topDirs].filter(d =>
      !['utils', 'types', 'lib', 'common', 'shared', 'config'].includes(d)
    );
    if (featureDirs.length >= 4) {
      patterns.push({
        name: 'Feature-Based Organization',
        type: 'emergent',
        occurrences: featureDirs.slice(0, 5).map(f => ({ file: `src/${f}`, evidence: 'feature directory' })),
        confidence: 0.7,
        description: `Code organized by feature: ${featureDirs.slice(0, 5).join(', ')}`,
      });
    }

    const bridgeModules = metrics.filter((m) => m.isBridge).slice(0, 5);
    if (bridgeModules.length > 0) {
      patterns.push({
        name: 'Integration Hubs',
        type: 'emergent',
        occurrences: bridgeModules.map((m) => ({
          file: m.entityId,
          evidence: `bridge score ${(m.betweenness * 100).toFixed(1)}%`,
        })),
        confidence: 0.75,
        description: 'Modules connecting multiple communities',
      });
    }

    if (report.totals.communities > 2) {
      patterns.push({
        name: 'Community Structure',
        type: 'emergent',
        occurrences: [],
        confidence: Math.min(0.9, report.totals.communities / Math.max(1, modules.length / 10)),
        description: `${report.totals.communities} module communities detected`,
      });
    }

    return {
      query,
      patterns,
      summary: `Detected ${patterns.length} emergent patterns`,
      recommendations: [],
    };
  }

  private async analyzeErrorHandling(query: PatternQuery): Promise<PatternResult> {
    const functions = await this.storage.getFunctions();
    return analyzeErrorHandlingPatterns(functions, query);
  }

  private async analyzeAsyncPatterns(query: PatternQuery): Promise<PatternResult> {
    const functions = await this.storage.getFunctions();
    return analyzeAsyncPatterns(functions, query);
  }

  private async analyzeTestingPatterns(query: PatternQuery): Promise<PatternResult> {
    const functions = await this.storage.getFunctions();
    return analyzeTestingPatterns(functions, query);
  }
}

function findDependencyCycles(graph: Map<string, Set<string>>, limit: number): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const inStack = new Set<string>();
  const seen = new Set<string>();

  const dfs = (node: string) => {
    visited.add(node);
    stack.push(node);
    inStack.add(node);

    for (const neighbor of graph.get(node) ?? []) {
      if (cycles.length >= limit) return;
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        const idx = stack.indexOf(neighbor);
        if (idx >= 0) {
          const cycle = stack.slice(idx);
          const key = [...cycle].sort().join('|');
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push([...cycle, neighbor]);
          }
        }
      }
    }

    stack.pop();
    inStack.delete(node);
  };

  for (const node of graph.keys()) {
    if (cycles.length >= limit) break;
    if (!visited.has(node)) dfs(node);
  }

  return cycles;
}

// ============================================================================
// LLM SUPPORT
// ============================================================================

const PATTERN_SYSTEM_PROMPT = `You are a software architect analyzing code for design patterns.
Identify patterns based on actual code structure and behavior, not just naming conventions.
Return JSON with high-confidence findings only.`;

interface FunctionSample {
  name: string;
  signature: string;
  file: string;
}

interface ModuleSample {
  path: string;
  exports: string[];
}

function buildPatternPrompt(
  query: PatternQuery,
  functions: FunctionSample[],
  modules: ModuleSample[],
  heuristicResult: PatternResult
): string {
  const functionList = functions.map(f => `- ${f.name}: ${f.signature} (${f.file})`).join('\n');
  const moduleList = modules.map(m => `- ${m.path}: exports [${m.exports.join(', ')}]`).join('\n');

  const heuristicHints = heuristicResult.patterns?.map(p => p.name).join(', ') || 'none';

  return `Analyze this codebase for ${query.type}.

Sample functions:
${functionList}

Sample modules:
${moduleList}

Heuristic candidates (verify these): ${heuristicHints}

Respond in JSON:
{
  "patterns": [
    {"name": "...", "type": "design|behavioral|structural|team|emergent", "confidence": 0.0-1.0, "description": "...", "evidence": ["file:line - reason"]}
  ],
  "summary": "...",
  "recommendations": ["..."]
}

Only include patterns with confidence >= 0.6 based on actual code structure.`;
}

function parsePatternResponse(
  response: string,
  query: PatternQuery,
  heuristicResult: PatternResult
): PatternResult {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      'unverified_by_trace(patterns_llm_invalid_response): LLM response contained no JSON.'
    );
  }

  let parsed: {
    patterns?: Array<{
      name?: string;
      type?: string;
      confidence?: number;
      description?: string;
      evidence?: string[];
    }>;
    summary?: string;
    recommendations?: string[];
  };

  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    throw new Error(
      `unverified_by_trace(patterns_llm_parse_failed): Failed to parse LLM response JSON.`
    );
  }

  const patterns: DetectedPattern[] = (parsed.patterns ?? [])
    .filter(p => p.name && (p.confidence ?? 0) >= 0.6)
    .map(p => ({
      name: p.name ?? 'Unknown',
      type: validatePatternType(p.type),
      occurrences: (p.evidence ?? []).map(e => {
        const [file, ...rest] = e.split(' - ');
        return { file: file ?? '', evidence: rest.join(' - ') || 'LLM-detected' };
      }),
      confidence: p.confidence ?? 0.6,
      description: p.description ?? '',
    }));

  return {
    query,
    patterns,
    antiPatterns: heuristicResult.antiPatterns, // Keep metric-based anti-patterns
    conventions: heuristicResult.conventions,
    summary: parsed.summary ?? `LLM detected ${patterns.length} patterns`,
    recommendations: parsed.recommendations ?? [],
  };
}

function validatePatternType(
  type: string | undefined
): 'design' | 'behavioral' | 'structural' | 'team' | 'emergent' {
  const valid = ['design', 'behavioral', 'structural', 'team', 'emergent'];
  if (type && valid.includes(type)) {
    return type as 'design' | 'behavioral' | 'structural' | 'team' | 'emergent';
  }
  return 'design';
}
