/**
 * @fileoverview Agents module exports
 */

export type {
  LibrarianAgent,
  AgentCapability,
  IndexingAgent,
  FileIndexResult,
  IndexingStats,
  PatternAgent,
  PatternDetectionResult,
  Pattern,
  AntiPattern,
  AgentRegistry,
} from './types.js';

export { SimpleAgentRegistry } from './types.js';

export {
  IndexLibrarian,
  createIndexLibrarian,
  DEFAULT_CONFIG as DEFAULT_INDEX_LIBRARIAN_CONFIG,
} from './index_librarian.js';
export type { IndexLibrarianConfig } from './index_librarian.js';
