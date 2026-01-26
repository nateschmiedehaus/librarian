/**
 * @fileoverview Epistemics Module - Evidence Graph and Defeater Calculus
 *
 * This module provides the epistemic engine for Librarian:
 * - Evidence graph with claims, supports, opposes, and defeaters
 * - Contradiction tracking (never silently reconciled)
 * - Calibrated confidence decomposition
 * - Typed defeater calculus
 *
 * @packageDocumentation
 */

// Types
export {
  // Schema version
  EVIDENCE_GRAPH_SCHEMA_VERSION,

  // Core types
  type Claim,
  type ClaimId,
  type ClaimType,
  type ClaimSubject,
  type ClaimSource,
  type ClaimStatus,

  // Confidence
  type ClaimSignalStrength,
  createDefaultSignalStrength,
  computeOverallSignalStrength,

  // Edges
  type EvidenceEdge,
  type EdgeType,

  // Defeaters
  type ExtendedDefeaterType,
  type ExtendedDefeater,
  type DefeaterSeverity,

  // Contradictions
  type Contradiction,
  type ContradictionType,
  type ContradictionStatus,
  type ContradictionResolution,

  // Graph
  type EvidenceGraph,
  type EvidenceGraphMeta,
  type SerializedEvidenceGraph,

  // Type guards
  isClaimId,
  isClaim,
  isEvidenceEdge,
  isExtendedDefeater,
  isContradiction,
  isEvidenceGraph,

  // Serialization
  serializeEvidenceGraph,
  deserializeEvidenceGraph,

  // Factory functions
  createClaimId,
  createEmptyEvidenceGraph,
  createClaim,
  createDefeater,
  createContradiction,
} from './types.js';

// Storage
export {
  // Storage interface
  type EvidenceGraphStorage,
  type ClaimQueryOptions,
  type EdgeQueryOptions,
  type DefeaterQueryOptions,
  type ContradictionQueryOptions,
  type TraversalResult,
  type GraphStats,

  // Implementation
  SqliteEvidenceGraphStorage,
  createEvidenceGraphStorage,
} from './storage.js';

// Defeater Calculus Engine
export {
  // Configuration
  DEFAULT_DEFEATER_CONFIG,
  type DefeaterEngineConfig,

  // Detection
  detectDefeaters,
  type DetectionResult,
  type DetectionContext,

  // Application
  applyDefeaters,
  type ApplicationResult,

  // Resolution
  getResolutionActions,
  resolveDefeater,
  type ResolutionAction,

  // Health Assessment
  assessGraphHealth,
  type GraphHealthAssessment,

  // Full Cycle
  runDefeaterCycle,
} from './defeaters.js';

// Computed Confidence
export {
  // Constants
  CONFIDENCE_FLOOR,
  CONFIDENCE_CEILING,
  COMPONENT_WEIGHTS,

  // Core computation
  computeConfidence,
  computeConfidenceBatch,
  computeConfidenceStats,

  // Entity adapters
  extractSignalsFromFunction,
  extractSignalsFromFile,
  extractSignalsFromContextPack,

  // Types
  type ConfidenceSignals,
  type ComputedConfidenceResult,
} from './computed_confidence.js';

// Claim-outcome tracking (Track F C1)
export {
  ClaimOutcomeTracker,
  createClaimOutcomeTracker,
  type ClaimOutcomeCategory,
  type TrackClaimInput,
  type RecordOutcomeInput,
  type ClaimOutcomeTrackerConfig,
  type OutcomeCalibrationOptions,
} from './outcomes.js';

// Calibration curve computation (Track F C2)
export {
  computeCalibrationCurve,
  buildCalibrationReport,
  snapshotCalibrationReport,
  restoreCalibrationReport,
  adjustConfidenceScore,
  type CalibrationSample,
  type CalibrationBucket,
  type CalibrationCurve,
  type CalibrationReport,
  type CalibrationReportSnapshot,
  type CalibrationCurveOptions,
  type CalibrationAdjustmentOptions,
  type CalibrationAdjustmentResult,
} from './calibration.js';

// Quantification invariant helpers (DEPRECATED - use ConfidenceValue instead)
export {
  /** @deprecated Use ConfidenceValue from confidence.ts instead */
  type QuantificationSource,
  /** @deprecated Use ConfidenceValue from confidence.ts instead */
  type QuantifiedValue,
  /** @deprecated Use ConfidenceValue from confidence.ts instead */
  type QuantifiedValueLike,
  /** @deprecated Use isConfidenceValue from confidence.ts instead */
  isQuantifiedValue,
  /** @deprecated Use getNumericValue from confidence.ts instead */
  resolveQuantifiedValue,
  /** @deprecated Use absent() from confidence.ts instead - placeholder() allows arbitrary numbers */
  placeholder,
  configurable,
  calibrated,
  derived,
} from './quantification.js';

// Principled Confidence System (CANONICAL - replaces QuantifiedValue)
export {
  // Core type
  type ConfidenceValue,
  type DeterministicConfidence,
  type DerivedConfidence,
  type MeasuredConfidence,
  type BoundedConfidence,
  type AbsentConfidence,

  // Type guards
  isConfidenceValue,
  isDeterministicConfidence,
  isDerivedConfidence,
  isMeasuredConfidence,
  isBoundedConfidence,
  isAbsentConfidence,

  // Derivation rules (D1-D6)
  syntacticConfidence,
  sequenceConfidence,
  parallelAllConfidence,
  parallelAnyConfidence,
  uncalibratedConfidence,
  measuredConfidence,
  type CalibrationResult,
  adjustConfidenceValue,
  type ConfidenceAdjustmentResult,

  // Degradation handlers
  getNumericValue,
  getEffectiveConfidence,
  selectWithDegradation,
  checkConfidenceThreshold,
  reportConfidenceStatus,
  type ExecutionBlockResult,
  type ConfidenceStatusReport,

  // Factory functions
  deterministic,
  bounded,
  absent,

  // D7 boundary enforcement utilities
  combinedConfidence,
  applyDecay,
  andConfidence,
  orConfidence,
  meetsThreshold,
  assertConfidenceValue,
} from './confidence.js';

// Evidence Ledger (append-only epistemic event log)
export {
  // Branded types
  type EvidenceId,
  type SessionId,
  createEvidenceId,
  createSessionId,

  // Evidence kinds
  type EvidenceKind,

  // Provenance
  type ProvenanceSource,
  type EvidenceProvenance,

  // Payload types
  type CodeLocation,
  type ExtractionEvidence,
  type RetrievalEvidence,
  type SynthesisEvidence,
  type ClaimEvidence,
  type VerificationEvidence,
  type ContradictionEvidence,
  type FeedbackEvidence,
  type OutcomeEvidence,
  type ToolCallEvidence,
  type EpisodeEvidence,
  type CalibrationEvidence,
  type EvidencePayload,

  // Entry and chain
  type EvidenceEntry,
  type EvidenceChain,

  // Query interface
  type EvidenceQuery,
  type EvidenceFilter,
  type Unsubscribe,

  // Ledger interface
  type IEvidenceLedger,

  // Implementation
  SqliteEvidenceLedger,
  createEvidenceLedger,
} from './evidence_ledger.js';

// Primitive Contracts (design-by-contract for technique primitives)
export {
  // Branded types
  type ContractId,
  type PrimitiveId,
  createContractId,
  createPrimitiveId,

  // Execution context
  type ProviderStatus,
  type ExecutionBudget,
  type ExecutionContext,

  // Conditions
  type Precondition,
  type Postcondition,
  type Invariant,

  // Confidence derivation
  type ConfidenceFactorSource,
  type ConfidenceFactor,
  type ConfidenceCombiner,
  type ConfidenceDerivationSpec,

  // Error handling
  type ExpectedError,
  type RetryPolicy,
  type ErrorSpec,

  // Performance
  type PerformanceBounds,

  // Contract
  type PrimitiveContract,

  // Registry
  type IContractRegistry,
  getContractRegistry,
  resetContractRegistry,

  // Execution
  ContractViolation,
  type ContractWarning,
  type ContractVerification,
  type ContractExecution,
  type ContractResult,
  type IContractExecutor,
  ContractExecutor,
  createContractExecutor,

  // Defaults and helpers
  DEFAULT_RETRY_POLICY,
  createPrecondition,
  createPostcondition,
} from './contracts.js';

// Defeater-Ledger Integration
export {
  // Configuration
  type DefeaterLedgerConfig,

  // Events
  type DefeaterDetectionEvent,
  type DefeaterApplicationEvent,

  // Bridge
  DefeaterLedgerBridge,
  createDefeaterLedgerBridge,
} from './defeater_ledger.js';
