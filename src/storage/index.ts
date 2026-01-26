/**
 * @fileoverview Storage module exports
 */

export type {
  LibrarianStorage,
  StorageCapabilities,
  StorageSlices,
  StorageLifecycle,
  MetadataStorage,
  KnowledgeStorage,
  ChecksumStorage,
  EmbeddingStorage,
  QueryCacheStorage,
  GraphCacheStorage,
  EvolutionStorage,
  EvidenceStorage,
  ConfidenceStorage,
  GraphStorage,
  IngestionStorage,
  TestMappingStorage,
  CommitStorage,
  OwnershipStorage,
  UniversalKnowledgeStorage,
  AssessmentStorage,
  GitAnalysisStorage,
  CloneStorage,
  DebtStorage,
  FaultLocalizationStorage,
  MaintenanceStorage,
  StorageBackend,
  StorageFactory,
  ConcurrencyContract,
  TransactionConflictStrategy,
  GraphEdge,
  GraphEdgeQueryOptions,
  QueryOptions,
  ContextPackQueryOptions,
  SimilaritySearchOptions,
  SimilarityResult,
  TransactionContext,
  IngestionQueryOptions,
  StorageStats,
} from './types.js';

export {
  SqliteLibrarianStorage,
  createSqliteStorage,
  createStorageFromBackend,
} from './sqlite_storage.js';

export { createStorageSlices } from './slices.js';
export {
  withinTransaction,
  TransactionConflictError,
  DEFAULT_CONCURRENCY_CONTRACT,
  isTransactionConflictError,
} from './transactions.js';

export type {
  FileStaleStatus,
  StalenessStats,
  StalenessCheckOptions,
} from './staleness.js';

export {
  StalenessTracker,
  createStalenessTracker,
} from './staleness.js';
