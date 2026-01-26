/**
 * @fileoverview Field Extractors for Universal Knowledge
 *
 * Each extractor focuses on a specific section of the UniversalKnowledge schema
 * and can operate independently with its own confidence score.
 */

export { extractIdentity, type IdentityExtraction } from './identity.js';
export {
  // NOTE: extractSemantics (heuristic-only) is NOT exported.
  // Per VISION architecture, semantic claims require LLM synthesis.
  // Use extractSemanticsWithLLM for all production use.
  extractSemanticsWithLLM,
  type SemanticsExtraction,
  type SemanticsInput,
  type LLMSemanticsConfig,
} from './semantics.js';
export { extractQuality, type QualityExtraction } from './quality_extractor.js';

// File and Directory Knowledge Extractors
export {
  extractFileKnowledge,
  type FileExtractionInput,
  type FileExtractionConfig,
  type FileExtractionResult,
} from './file_extractor.js';
export {
  extractDirectoryKnowledge,
  extractDirectoriesInBatch,
  computeTotalFileCounts,
  type DirectoryExtractionInput,
  type DirectoryExtractionConfig,
  type DirectoryExtractionResult,
} from './directory_extractor.js';

// Flash Assessments
export {
  assessFile,
  assessDirectory,
  type FlashAssessment,
  type FlashFinding,
  type FindingSeverity,
} from './flash_assessments.js';

// Security Extractor
export {
  extractSecurity,
  extractSecurityWithLLM,
  type SecurityExtraction,
  type SecurityInput,
} from './security_extractor.js';

// Testing Extractor
export {
  extractTesting,
  type TestingExtraction,
  type TestingInput,
} from './testing_extractor.js';

// History and Ownership Extractor
export {
  extractHistory,
  extractOwnership,
  extractHistoryAndOwnership,
  type HistoryExtraction,
  type OwnershipExtraction,
  type HistoryAndOwnershipExtraction,
  type HistoryInput,
  type OwnershipInput,
} from './history_extractor.js';

// Rationale Extractor
export {
  // NOTE: extractRationale (heuristic-only) is NOT exported.
  // Per VISION architecture, rationale claims require LLM synthesis.
  // Use extractRationaleWithLLM for all production use.
  extractRationaleWithLLM,
  type RationaleExtraction,
  type RationaleInput,
  type LLMRationaleConfig,
} from './rationale_extractor.js';

// Traceability Extractor
export {
  extractTraceability,
  extractTraceabilityBatch,
  buildTraceabilityGraph,
  type TraceabilityExtraction,
  type TraceabilityInput,
  type TraceabilityGraph,
  type TraceabilityNode,
  type TraceabilityEdge,
} from './traceability_extractor.js';

// Evidence Collector
export {
  collectEvidence,
  validateKnowledge,
  triggerDefeater,
  addDefeater,
  type EvidenceCollectionInput,
  type EvidenceCollectionResult,
  type ValidationResult,
} from './evidence_collector.js';

// Relationships Extractor (Cochange + Similarity)
export {
  extractRelationships,
  extractRelationshipsBatch,
  enrichRelationships,
  analyzeCochangePatterns,
  detectCircularDependencies,
  type RelationshipsExtraction,
  type RelationshipsInput,
  type EnrichedRelationships,
  type CochangeAnalysis,
} from './relationships_extractor.js';

// Consolidated Extractor (P0-4 efficiency: 3 LLM calls → 1)
export {
  extractConsolidated,
  type ConsolidatedInput,
  type ConsolidatedConfig,
  type ConsolidatedExtraction,
} from './consolidated_extractor.js';
