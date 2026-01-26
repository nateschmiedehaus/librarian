export type KnowledgeSource = 'syntactic' | 'naming' | 'structural' | 'behavioral' | 'semantic';

export interface KnowledgeClaim {
  claim: string;
  source: KnowledgeSource;
  confidence: number;
  evidence: string;
}

export interface KnowledgeState {
  facts: KnowledgeClaim[];
  inferences: KnowledgeClaim[];
  unknowns: string[];
  contradictions: string[];
}

export interface BootstrapPhase {
  name: string;
  goal: string;
  confidence: number | 'varies';
  steps: string[];
  outputs: string[];
  failureMode: string;
}

export interface ZeroKnowledgeProtocolState {
  phases: BootstrapPhase[];
  currentPhase: number;
  accumulatedKnowledge: KnowledgeState;
  confidenceThreshold: number;
  history: PhaseResult[];
}

export interface PhaseResult {
  phase: string;
  facts?: KnowledgeClaim[];
  inferences?: KnowledgeClaim[];
  unknowns?: string[];
  contradictions?: string[];
  outputs?: string[];
}

export interface EvidenceSource {
  source: KnowledgeSource;
  evidence: string;
  weight: number;
  reliability: number;
}

export interface EvidenceBasedConfidence {
  claim: string;
  evidenceSources: EvidenceSource[];
  confidence: number;
  calibrationMethod: 'no_evidence' | 'contradictory_evidence' | 'combining_agreement';
}

export type UnderstandingLevel = 0 | 1 | 2 | 3 | 4;

export interface ProgressiveUnderstanding {
  level: UnderstandingLevel;
  whatWeKnow: KnowledgeAtLevel[];
  whatWeInfer: KnowledgeAtLevel[];
  whatWeDoNotKnow: string[];
  nextStepsToImprove: string[];
}

export interface KnowledgeAtLevel {
  level: UnderstandingLevel;
  claim: string;
  confidence: number;
  evidence: string;
  verificationMethod: KnowledgeSource;
}

export interface EscalationDecision {
  situation: string;
  currentConfidence: number;
  requiredConfidence: number;
  decision: 'proceed' | 'try_alternative' | 'ask_human' | 'assume_explicit' | 'refuse';
  rationale: string;
  ifProceeding?: {
    uncertaintyBounds: [number, number];
    assumptions: string[];
    riskAcknowledgment: string;
  };
}

export interface EpistemicEscalationOptions {
  humanAvailable?: boolean;
  defaultRequiredConfidence?: number;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
const MAX_CONFIDENCE = 0.95;
const SOURCE_RELIABILITY: Record<KnowledgeSource, number> = {
  syntactic: 1.0,
  naming: 0.6,
  structural: 0.5,
  behavioral: 0.8,
  semantic: 0.7,
};

export const ZERO_KNOWLEDGE_PROTOCOL: BootstrapPhase[] = [
  {
    name: 'structural_inventory',
    goal: 'Enumerate what exists without interpreting meaning',
    confidence: 1.0,
    steps: [
      'Count files by extension (establish language mix)',
      'Parse all parseable files to AST (structural extraction)',
      'List all exported symbols (public interface)',
      'List all imports/dependencies (dependency graph skeleton)',
      'Identify entry points (main functions, index files)',
    ],
    outputs: ['file_inventory', 'language_distribution', 'symbol_table', 'import_graph', 'entry_points'],
    failureMode: 'If files cannot be parsed, fall back to regex extraction',
  },
  {
    name: 'naming_inference',
    goal: 'Infer likely purposes from naming conventions',
    confidence: 0.6,
    steps: [
      'Classify files by naming pattern (test, config, util, model, etc.)',
      'Infer function purposes from verb-noun patterns',
      'Identify domain vocabulary (recurring terms)',
      'Map naming conventions (camelCase, snake_case, etc.)',
    ],
    outputs: ['file_classifications', 'function_purposes_inferred', 'domain_vocabulary'],
    failureMode: 'If names are obfuscated, skip and mark as UNKNOWN',
  },
  {
    name: 'structural_inference',
    goal: 'Infer architecture from structural patterns',
    confidence: 0.5,
    steps: [
      'Detect directory-based modules',
      'Identify potential MVC/layered patterns',
      'Find central hub files (high in-degree in import graph)',
      'Identify peripheral files (high out-degree, low in-degree)',
    ],
    outputs: ['likely_modules', 'architectural_pattern_hypothesis', 'central_files', 'peripheral_files'],
    failureMode: 'If structure is flat, report "no clear architecture"',
  },
  {
    name: 'behavioral_probing',
    goal: 'Observe behavior to verify structural inferences',
    confidence: 0.8,
    steps: [
      'Attempt to build/compile (verify buildability)',
      'Run existing tests (verify current health)',
      'Add instrumentation to entry points (observe call flow)',
      'Execute with sample inputs (observe behavior)',
    ],
    outputs: ['build_status', 'test_results', 'observed_call_graph', 'runtime_behavior'],
    failureMode: 'If cannot build, stay at static analysis',
  },
  {
    name: 'semantic_extraction',
    goal: 'Extract meaning using LLM reasoning',
    confidence: 0.7,
    steps: [
      'Summarize each file purpose',
      'Extract entity purposes',
      'Identify cross-cutting concerns',
      'Generate architectural summary',
    ],
    outputs: ['file_summaries', 'entity_purposes', 'concerns', 'architecture_summary'],
    failureMode: 'If LLM unavailable, stop at structural understanding',
  },
  {
    name: 'verification_loop',
    goal: 'Verify inferences and calibrate confidence',
    confidence: 'varies',
    steps: [
      'Cross-check inferences against behavioral observations',
      'Identify contradictions between phases',
      'Calibrate confidence based on evidence agreement',
      'Mark remaining unknowns explicitly',
    ],
    outputs: ['verified_knowledge', 'contradictions', 'calibrated_confidence', 'unknowns'],
    failureMode: 'Always produces output (even if all UNKNOWN)',
  },
];

export function getZeroKnowledgeProtocol(): BootstrapPhase[] {
  return ZERO_KNOWLEDGE_PROTOCOL.map((phase) => ({ ...phase, steps: [...phase.steps], outputs: [...phase.outputs] }));
}

export function createZeroKnowledgeState(options?: { confidenceThreshold?: number }): ZeroKnowledgeProtocolState {
  return {
    phases: getZeroKnowledgeProtocol(),
    currentPhase: 0,
    accumulatedKnowledge: {
      facts: [],
      inferences: [],
      unknowns: [],
      contradictions: [],
    },
    confidenceThreshold: clampNumber(options?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD, 0, 1),
    history: [],
  };
}

export function recordPhaseResult(
  state: ZeroKnowledgeProtocolState,
  result: PhaseResult
): ZeroKnowledgeProtocolState {
  const phaseIndex = state.phases.findIndex((phase) => phase.name === result.phase);
  if (phaseIndex < 0) {
    throw new Error(`unverified_by_trace(zero_knowledge_phase_unknown): ${result.phase}`);
  }
  const normalized = normalizePhaseResult(result);
  const knowledge = mergeKnowledge(state.accumulatedKnowledge, normalized);
  const nextPhase = Math.max(state.currentPhase, phaseIndex + 1);
  return {
    ...state,
    currentPhase: nextPhase,
    accumulatedKnowledge: knowledge,
    history: [...state.history, normalized],
  };
}

export function computeEvidenceBasedConfidence(
  claim: string,
  sources: EvidenceSource[]
): EvidenceBasedConfidence {
  if (sources.length === 0) {
    return { claim, evidenceSources: [], confidence: 0.5, calibrationMethod: 'no_evidence' };
  }

  const normalized = sources.map(normalizeEvidenceSource);
  const agreements = normalized.filter((source) => source.weight > 0);
  const contradictions = normalized.filter((source) => source.weight < 0);

  if (contradictions.length > 0) {
    const netEvidence = sumEvidence(agreements) - sumEvidence(contradictions, true);
    return {
      claim,
      evidenceSources: normalized,
      confidence: clampNumber(0.5 + netEvidence * 0.3, 0.1, 0.5),
      calibrationMethod: 'contradictory_evidence',
    };
  }

  let combined = 0.5;
  const ordered = agreements.slice().sort((a, b) => b.reliability - a.reliability);
  for (const source of ordered) {
    const contribution = source.weight * source.reliability * (1 - combined);
    combined += contribution;
  }

  return {
    claim,
    evidenceSources: normalized,
    confidence: Math.min(MAX_CONFIDENCE, combined),
    calibrationMethod: 'combining_agreement',
  };
}

export function reportUnderstanding(state: KnowledgeState): ProgressiveUnderstanding {
  const level = computeUnderstandingLevel(state);
  const syntacticFacts = state.facts.filter((fact) => fact.source === 'syntactic');
  const inferences = state.facts
    .filter((fact) => fact.source !== 'syntactic')
    .concat(state.inferences);

  return {
    level,
    whatWeKnow: syntacticFacts.map((fact) => ({
      level: 1,
      claim: fact.claim,
      confidence: fact.confidence,
      evidence: fact.evidence,
      verificationMethod: 'syntactic',
    })),
    whatWeInfer: inferences.map((fact) => ({
      level: inferenceLevel(fact),
      claim: fact.claim,
      confidence: fact.confidence,
      evidence: fact.evidence,
      verificationMethod: fact.source,
    })),
    whatWeDoNotKnow: [...state.unknowns],
    nextStepsToImprove: suggestNextSteps(level, state.unknowns),
  };
}

export class EpistemicEscalationEngine {
  private humanAvailable: boolean;
  private defaultRequiredConfidence: number;

  constructor(options: EpistemicEscalationOptions = {}) {
    this.humanAvailable = options.humanAvailable ?? false;
    this.defaultRequiredConfidence = clampNumber(options.defaultRequiredConfidence ?? DEFAULT_CONFIDENCE_THRESHOLD, 0, 1);
  }

  decideEscalation(
    task: string,
    currentKnowledge: KnowledgeState,
    requiredConfidence = this.defaultRequiredConfidence
  ): EscalationDecision {
    const currentConfidence = computeTaskConfidence(currentKnowledge);
    if (currentConfidence >= requiredConfidence) {
      return {
        situation: task,
        currentConfidence,
        requiredConfidence,
        decision: 'proceed',
        rationale: 'Sufficient confidence',
      };
    }

    const alternatives = findAlternativeAnalysisMethods(currentKnowledge);
    if (alternatives.length > 0) {
      return {
        situation: task,
        currentConfidence,
        requiredConfidence,
        decision: 'try_alternative',
        rationale: `Trying: ${alternatives[0]}`,
      };
    }

    const clarifyingQuestions = generateClarifyingQuestions(currentKnowledge);
    if (clarifyingQuestions.length > 0 && this.humanAvailable) {
      return {
        situation: task,
        currentConfidence,
        requiredConfidence,
        decision: 'ask_human',
        rationale: `Question: ${clarifyingQuestions[0]}`,
      };
    }

    const safeAssumptions = findSafeAssumptions(currentKnowledge);
    if (safeAssumptions.length > 0) {
      return {
        situation: task,
        currentConfidence,
        requiredConfidence,
        decision: 'assume_explicit',
        rationale: `Assuming: ${safeAssumptions.join(', ')}`,
        ifProceeding: {
          uncertaintyBounds: [
            clampNumber(currentConfidence * 0.8, 0, 1),
            clampNumber(currentConfidence * 1.2, 0, 1),
          ],
          assumptions: safeAssumptions,
          riskAcknowledgment: 'Proceeding with explicit assumptions',
        },
      };
    }

    return {
      situation: task,
      currentConfidence,
      requiredConfidence,
      decision: 'refuse',
      rationale: `Cannot achieve ${requiredConfidence} confidence. Missing: ${currentKnowledge.unknowns.join(', ')}`,
    };
  }
}

function normalizePhaseResult(result: PhaseResult): PhaseResult {
  return {
    phase: result.phase,
    facts: normalizeClaims(result.facts),
    inferences: normalizeClaims(result.inferences),
    unknowns: normalizeStrings(result.unknowns),
    contradictions: normalizeStrings(result.contradictions),
    outputs: normalizeStrings(result.outputs),
  };
}

function normalizeClaims(input?: KnowledgeClaim[]): KnowledgeClaim[] {
  if (!input) return [];
  return input
    .map((claim) => normalizeClaim(claim))
    .filter((claim): claim is KnowledgeClaim => Boolean(claim));
}

function normalizeClaim(claim?: KnowledgeClaim | null): KnowledgeClaim | null {
  if (!claim || typeof claim.claim !== 'string' || claim.claim.trim().length === 0) return null;
  if (!isKnowledgeSource(claim.source)) return null;
  const evidence = typeof claim.evidence === 'string' ? claim.evidence.trim() : '';
  if (!evidence) return null;
  return {
    claim: claim.claim.trim(),
    source: claim.source,
    confidence: clampNumber(claim.confidence, 0, 1),
    evidence,
  };
}

function normalizeStrings(values?: string[]): string[] {
  if (!values) return [];
  const normalized = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
}

function mergeKnowledge(base: KnowledgeState, result: PhaseResult): KnowledgeState {
  return {
    facts: mergeClaims(base.facts, result.facts ?? []),
    inferences: mergeClaims(base.inferences, result.inferences ?? []),
    unknowns: mergeStrings(base.unknowns, result.unknowns ?? []),
    contradictions: mergeStrings(base.contradictions, result.contradictions ?? []),
  };
}

function mergeClaims(existing: KnowledgeClaim[], incoming: KnowledgeClaim[]): KnowledgeClaim[] {
  const merged = new Map<string, KnowledgeClaim>();
  for (const claim of existing) {
    merged.set(`${claim.source}:${claim.claim}`, claim);
  }
  for (const claim of incoming) {
    const key = `${claim.source}:${claim.claim}`;
    const prior = merged.get(key);
    if (!prior || claim.confidence > prior.confidence) {
      merged.set(key, claim);
    }
  }
  return Array.from(merged.values());
}

function mergeStrings(existing: string[], incoming: string[]): string[] {
  const merged = new Set(existing);
  for (const entry of incoming) merged.add(entry);
  return Array.from(merged);
}

function normalizeEvidenceSource(source: EvidenceSource): EvidenceSource {
  const reliability = Number.isFinite(source.reliability)
    ? clampNumber(source.reliability, 0, 1)
    : SOURCE_RELIABILITY[source.source];
  const weight = Number.isFinite(source.weight) ? clampNumber(source.weight, -1, 1) : 0;
  const evidence = typeof source.evidence === 'string' ? source.evidence.trim() : '';
  return {
    source: source.source,
    evidence,
    weight,
    reliability,
  };
}

function sumEvidence(sources: EvidenceSource[], absolute = false): number {
  return sources.reduce((sum, source) => {
    const weight = absolute ? Math.abs(source.weight) : source.weight;
    return sum + weight * source.reliability;
  }, 0);
}

function computeUnderstandingLevel(state: KnowledgeState): UnderstandingLevel {
  const hasSyntactic = state.facts.some((fact) => fact.source === 'syntactic');
  const hasInference = state.facts.some((fact) => fact.source !== 'syntactic') || state.inferences.length > 0;
  const hasBehavioral = state.facts.some((fact) => fact.source === 'behavioral')
    || state.inferences.some((fact) => fact.source === 'behavioral');
  const hasSemantic = state.facts.some((fact) => fact.source === 'semantic')
    || state.inferences.some((fact) => fact.source === 'semantic');

  if (!hasSyntactic && !hasInference) return 0;
  if (hasSemantic && hasBehavioral) return 4;
  if (hasBehavioral) return 3;
  if (hasInference) return 2;
  return 1;
}

function inferenceLevel(fact: KnowledgeClaim): UnderstandingLevel {
  switch (fact.source) {
    case 'naming':
    case 'structural':
      return 2;
    case 'behavioral':
      return 3;
    case 'semantic':
      return 4;
    default:
      return 1;
  }
}

function suggestNextSteps(level: UnderstandingLevel, unknowns: string[]): string[] {
  const next: string[] = [];
  if (level <= 0) {
    next.push('Run structural inventory to establish the syntactic baseline.');
  } else if (level === 1) {
    next.push('Apply naming inference to classify files and entities.');
  } else if (level === 2) {
    next.push('Attempt behavioral probing via build/tests.');
  } else if (level === 3) {
    next.push('Run semantic extraction to summarize architecture.');
  } else {
    next.push('Verify contradictions and keep confidence calibrated.');
  }
  if (unknowns.length > 0) {
    next.push(`Address ${Math.min(unknowns.length, 3)} unknowns before making strong claims.`);
  }
  return next;
}

function computeTaskConfidence(state: KnowledgeState): number {
  const claims = [...state.facts, ...state.inferences];
  if (claims.length === 0) return 0.5;
  const total = claims.reduce((sum, claim) => {
    const reliability = SOURCE_RELIABILITY[claim.source] ?? 0.5;
    return sum + clampNumber(claim.confidence, 0, 1) * reliability;
  }, 0);
  const base = total / claims.length;
  const contradictionPenalty = Math.min(0.4, state.contradictions.length * 0.1);
  const unknownPenalty = Math.min(0.3, state.unknowns.length * 0.02);
  return clampNumber(base - contradictionPenalty - unknownPenalty, 0, 1);
}

function findAlternativeAnalysisMethods(state: KnowledgeState): string[] {
  const sources = new Set(state.facts.map((fact) => fact.source).concat(state.inferences.map((fact) => fact.source)));
  if (!sources.has('syntactic')) return ['Parse and inventory source files.'];
  if (!sources.has('naming')) return ['Infer intent from naming conventions.'];
  if (!sources.has('structural')) return ['Build an import graph to infer structure.'];
  if (!sources.has('behavioral')) return ['Run builds/tests to capture behavioral evidence.'];
  if (!sources.has('semantic')) return ['Generate semantic summaries with an LLM.'];
  return [];
}

function generateClarifyingQuestions(state: KnowledgeState): string[] {
  if (state.unknowns.length > 0) {
    return state.unknowns.slice(0, 3).map((unknown) => `Clarify: ${unknown}?`);
  }
  if (state.contradictions.length > 0) {
    return state.contradictions.slice(0, 3).map((contradiction) => `Resolve contradiction: ${contradiction}?`);
  }
  return [];
}

function findSafeAssumptions(state: KnowledgeState): string[] {
  if (state.unknowns.length === 0) return [];
  const assumptions = [
    'Proceed with read-only analysis until unknowns are resolved.',
  ];
  if (state.contradictions.length > 0) {
    assumptions.push('Treat contradictory signals as high-risk and avoid writes.');
  }
  return assumptions;
}

function isKnowledgeSource(value: unknown): value is KnowledgeSource {
  return value === 'syntactic' || value === 'naming' || value === 'structural' || value === 'behavioral' || value === 'semantic';
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export const __testing = {
  computeUnderstandingLevel,
  computeTaskConfidence,
  findAlternativeAnalysisMethods,
  generateClarifyingQuestions,
  findSafeAssumptions,
};
