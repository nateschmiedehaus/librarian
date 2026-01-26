/**
 * @fileoverview Agent interfaces for Librarian system
 *
 * Designed for extension: MVP ships with IndexLibrarian only,
 * future versions add PatternLibrarian, DecisionLibrarian, etc.
 */

import type { LibrarianStorage } from '../storage/types.js';
import type { LibrarianVersion, IndexingTask, IndexingResult } from '../types.js';

// ============================================================================
// AGENT CAPABILITY ENUM
// ============================================================================

/**
 * Capabilities that librarian agents can have.
 * Used for discovery and routing.
 */
export type AgentCapability =
  | 'indexing'           // Can index files and create embeddings
  | 'pattern_detection'  // Can detect architectural patterns (Phase 3+)
  | 'decision_tracking'  // Can track decisions and outcomes (Phase 3+)
  | 'summarization'      // Can create hierarchical summaries (Phase 3+)
  | 'dependency_analysis'; // Can analyze dependencies (Phase 2+)

// ============================================================================
// AGENT INTERFACE
// ============================================================================

/**
 * Base interface for all librarian agents.
 * Agents are specialized workers that perform specific knowledge tasks.
 */
export interface LibrarianAgent {
  /** Unique identifier for this agent type */
  readonly agentType: string;

  /** Human-readable name */
  readonly name: string;

  /** Capabilities this agent provides */
  readonly capabilities: readonly AgentCapability[];

  /** Version of this agent implementation */
  readonly version: string;

  /** Quality tier this agent outputs */
  readonly qualityTier: 'mvp' | 'enhanced' | 'full';

  /**
   * Initialize the agent with storage.
   * Called once before any work methods.
   */
  initialize(storage: LibrarianStorage): Promise<void>;

  /**
   * Check if agent is ready to work.
   */
  isReady(): boolean;

  /**
   * Shutdown the agent gracefully.
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// INDEXING AGENT INTERFACE
// ============================================================================

/**
 * Interface for agents that can index code.
 */
export interface IndexingAgent extends LibrarianAgent {
  /**
   * Process an indexing task.
   * Should emit progress events during execution.
   */
  processTask(task: IndexingTask): Promise<IndexingResult>;

  /**
   * Index a single file.
   * Lower-level API for incremental updates.
   */
  indexFile(filePath: string): Promise<FileIndexResult>;

  /**
   * Remove all indexed data for a file.
   */
  removeFile(filePath: string): Promise<void>;

  /**
   * Get indexing statistics.
   */
  getStats(): IndexingStats;
}

export interface FileIndexResult {
  filePath: string;
  functionsFound: number;
  functionsIndexed: number;
  moduleIndexed: boolean;
  contextPacksCreated: number;
  durationMs: number;
  errors: string[];
}

export interface IndexingStats {
  totalFilesIndexed: number;
  totalFunctionsIndexed: number;
  totalModulesIndexed: number;
  totalContextPacksCreated: number;
  averageFileProcessingMs: number;
  lastIndexingTime: Date | null;
}

// ============================================================================
// PATTERN AGENT INTERFACE (Phase 3+)
// ============================================================================

/**
 * Interface for agents that detect patterns.
 * Not implemented in MVP.
 */
export interface PatternAgent extends LibrarianAgent {
  detectPatterns(files: string[]): Promise<PatternDetectionResult>;
}

export interface PatternDetectionResult {
  patternsFound: Pattern[];
  antiPatternsFound: AntiPattern[];
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  confidence: number;
  examples: string[];
}

export interface AntiPattern {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  locations: string[];
}

// ============================================================================
// AGENT REGISTRY
// ============================================================================

/**
 * Registry of available agent types.
 * Agents register themselves here for discovery.
 */
export interface AgentRegistry {
  register(agent: LibrarianAgent): void;
  getAgent(agentType: string): LibrarianAgent | undefined;
  getAgentsByCapability(capability: AgentCapability): LibrarianAgent[];
  getAllAgents(): LibrarianAgent[];
}

/**
 * Simple in-memory agent registry.
 */
export class SimpleAgentRegistry implements AgentRegistry {
  private agents = new Map<string, LibrarianAgent>();

  register(agent: LibrarianAgent): void {
    this.agents.set(agent.agentType, agent);
  }

  getAgent(agentType: string): LibrarianAgent | undefined {
    return this.agents.get(agentType);
  }

  getAgentsByCapability(capability: AgentCapability): LibrarianAgent[] {
    return Array.from(this.agents.values()).filter((agent) =>
      agent.capabilities.includes(capability)
    );
  }

  getAllAgents(): LibrarianAgent[] {
    return Array.from(this.agents.values());
  }
}
