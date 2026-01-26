import { TECHNIQUE_SEMANTIC_PROFILE_IDS, type TechniqueSemanticProfileId } from './techniques.js';

export interface TechniqueSemanticProfile {
  id: TechniqueSemanticProfileId;
  description: string;
  preconditions: string[];
  postconditions: string[];
  invariants: string[];
  evidenceRequirements: string[];
  termination: 'always' | 'conditional' | 'unknown';
  determinism: 'deterministic' | 'probabilistic' | 'unknown';
  complexity: 'constant' | 'linear' | 'quadratic' | 'unbounded' | 'unknown';
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => deepFreeze(entry));
    return Object.freeze(value);
  }
  const record = value as Record<string, unknown>;
  Object.values(record).forEach((entry) => deepFreeze(entry));
  return Object.freeze(value);
}

function freezeRegistry<T extends Record<string, Record<string, unknown>>>(value: T): T {
  return deepFreeze(value);
}

export const TECHNIQUE_SEMANTIC_PROFILES = freezeRegistry({
    general: {
      id: 'general',
      description: 'Default profile when no stronger semantics are asserted.',
      preconditions: ['Intent stated', 'Inputs available'],
      postconditions: ['Outputs recorded', 'Notes captured'],
      invariants: ['No hidden side effects'],
      evidenceRequirements: ['Outcome summary'],
      termination: 'conditional',
      determinism: 'unknown',
      complexity: 'unknown',
    },
    framing: {
      id: 'framing',
      description: 'Goal clarification, scope setting, and constraint framing.',
      preconditions: ['Prompt or problem statement available'],
      postconditions: ['Goal statement recorded', 'Constraints captured'],
      invariants: ['Scope boundaries explicit'],
      evidenceRequirements: ['Goal statement', 'Constraint list'],
      termination: 'always',
      determinism: 'deterministic',
      complexity: 'constant',
    },
    analysis: {
      id: 'analysis',
      description: 'Evidence gathering, diagnosis, and hypothesis evaluation.',
      preconditions: ['Observed signal or question exists'],
      postconditions: ['Hypotheses narrowed', 'Evidence recorded'],
      invariants: ['Claims traceable to evidence'],
      evidenceRequirements: ['Evidence pack', 'Decision rationale'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'linear',
    },
    planning: {
      id: 'planning',
      description: 'Sequencing, dependency mapping, and risk anticipation.',
      preconditions: ['Goal and constraints defined'],
      postconditions: ['Plan recorded', 'Dependencies identified'],
      invariants: ['Plan references constraints'],
      evidenceRequirements: ['Plan artifact', 'Risk register'],
      termination: 'always',
      determinism: 'deterministic',
      complexity: 'linear',
    },
    design: {
      id: 'design',
      description: 'Architecture, interface, and system design decisions.',
      preconditions: ['Requirements and constraints defined'],
      postconditions: ['Design decisions recorded', 'Interfaces specified'],
      invariants: ['Design linked to requirements'],
      evidenceRequirements: ['Design notes', 'Interface contracts'],
      termination: 'conditional',
      determinism: 'deterministic',
      complexity: 'linear',
    },
    implementation: {
      id: 'implementation',
      description: 'Code changes and implementation of planned work.',
      preconditions: ['Plan approved', 'Dependencies available'],
      postconditions: ['Implementation completed', 'Change recorded'],
      invariants: ['Behavioral impact assessed'],
      evidenceRequirements: ['Diff summary', 'Change log'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'unbounded',
    },
    execution: {
      id: 'execution',
      description: 'Runtime actions and controlled execution steps.',
      preconditions: ['Execution authorization', 'Inputs validated'],
      postconditions: ['Execution outcome recorded'],
      invariants: ['Side effects logged'],
      evidenceRequirements: ['Run logs', 'Artifacts'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'unbounded',
    },
    testing: {
      id: 'testing',
      description: 'Executing tests and capturing results.',
      preconditions: ['Test plan defined'],
      postconditions: ['Test results recorded', 'Failures triaged'],
      invariants: ['Test evidence preserved'],
      evidenceRequirements: ['Test logs', 'Coverage summary'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'linear',
    },
    verification: {
      id: 'verification',
      description: 'Validation and checking of claims against evidence.',
      preconditions: ['Verification plan exists'],
      postconditions: ['Verification verdict recorded'],
      invariants: ['Verification tied to evidence'],
      evidenceRequirements: ['Verification results', 'Pass/fail rationale'],
      termination: 'always',
      determinism: 'deterministic',
      complexity: 'linear',
    },
    quality: {
      id: 'quality',
      description: 'Reviewing, critiquing, and improving quality.',
      preconditions: ['Quality criteria defined'],
      postconditions: ['Quality assessment recorded', 'Improvements identified'],
      invariants: ['Issues traceable to evidence'],
      evidenceRequirements: ['Review notes', 'Quality rubric'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'linear',
    },
    risk: {
      id: 'risk',
      description: 'Risk identification, ranking, and mitigation planning.',
      preconditions: ['Context and stakes known'],
      postconditions: ['Risk register updated', 'Mitigations assigned'],
      invariants: ['Risks prioritized by impact'],
      evidenceRequirements: ['Risk register', 'Mitigation plan'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'linear',
    },
    security: {
      id: 'security',
      description: 'Threat identification and security hardening.',
      preconditions: ['Threat surface identified'],
      postconditions: ['Security findings recorded', 'Mitigations applied'],
      invariants: ['Secrets protected'],
      evidenceRequirements: ['Security review report', 'Mitigation evidence'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'linear',
    },
    compliance: {
      id: 'compliance',
      description: 'Policy enforcement, auditability, and compliance checks.',
      preconditions: ['Policies and rules specified'],
      postconditions: ['Compliance status recorded'],
      invariants: ['Audit trail preserved'],
      evidenceRequirements: ['Compliance report', 'Policy references'],
      termination: 'always',
      determinism: 'deterministic',
      complexity: 'linear',
    },
    governance: {
      id: 'governance',
      description: 'Approvals, accountability, and decision recording.',
      preconditions: ['Stakeholders identified'],
      postconditions: ['Decision recorded', 'Audit evidence attached'],
      invariants: ['No silent bypass'],
      evidenceRequirements: ['Approval trail', 'Reason codes'],
      termination: 'always',
      determinism: 'deterministic',
      complexity: 'linear',
    },
    research: {
      id: 'research',
      description: 'External discovery, synthesis, and evidence capture.',
      preconditions: ['Research question defined'],
      postconditions: ['Sources captured', 'Synthesis recorded'],
      invariants: ['Provenance preserved'],
      evidenceRequirements: ['Source list', 'Digests'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'linear',
    },
    coordination: {
      id: 'coordination',
      description: 'Multi-agent orchestration and collaboration.',
      preconditions: ['Roles defined', 'Shared context established'],
      postconditions: ['Assignments recorded', 'Consensus achieved'],
      invariants: ['Ownership clarity maintained'],
      evidenceRequirements: ['Coordination log', 'Decision summary'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'linear',
    },
    operations: {
      id: 'operations',
      description: 'Runbooks, deployments, and operational control.',
      preconditions: ['Operational intent defined'],
      postconditions: ['Operational actions recorded'],
      invariants: ['Rollback path documented'],
      evidenceRequirements: ['Run logs', 'Operational checklist'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'linear',
    },
    observability: {
      id: 'observability',
      description: 'Instrumentation, monitoring, and signal capture.',
      preconditions: ['Signals and metrics defined'],
      postconditions: ['Telemetry captured'],
      invariants: ['Signals tied to hypotheses'],
      evidenceRequirements: ['Telemetry snapshot', 'Trace links'],
      termination: 'conditional',
      determinism: 'deterministic',
      complexity: 'linear',
    },
    artifact: {
      id: 'artifact',
      description: 'Artifact creation, packaging, and versioning.',
      preconditions: ['Artifact schema defined'],
      postconditions: ['Artifact stored', 'Version recorded'],
      invariants: ['Artifact provenance preserved'],
      evidenceRequirements: ['Artifact metadata', 'Version notes'],
      termination: 'always',
      determinism: 'deterministic',
      complexity: 'linear',
    },
    evidence: {
      id: 'evidence',
      description: 'Evidence packaging, provenance, and trace linkage.',
      preconditions: ['Claims and sources defined'],
      postconditions: ['Evidence pack assembled'],
      invariants: ['Evidence traceability maintained'],
      evidenceRequirements: ['Evidence pack', 'Source list'],
      termination: 'always',
      determinism: 'deterministic',
      complexity: 'linear',
    },
    recovery: {
      id: 'recovery',
      description: 'Incident response, rollback, and stabilization.',
      preconditions: ['Failure or degradation detected'],
      postconditions: ['Service stabilized', 'Recovery notes recorded'],
      invariants: ['Safety gates enforced'],
      evidenceRequirements: ['Incident timeline', 'Mitigation record'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'unbounded',
    },
    optimization: {
      id: 'optimization',
      description: 'Performance tuning and resource efficiency improvements.',
      preconditions: ['Baseline measured'],
      postconditions: ['Delta quantified', 'Tradeoffs recorded'],
      invariants: ['No regression without rationale'],
      evidenceRequirements: ['Benchmarks', 'Regression analysis'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'quadratic',
    },
    meta: {
      id: 'meta',
      description: 'Self-improvement, calibration, and system evolution.',
      preconditions: ['Metrics available'],
      postconditions: ['Improvements recorded', 'Feedback integrated'],
      invariants: ['Changes traceable'],
      evidenceRequirements: ['Before/after metrics', 'Change log'],
      termination: 'conditional',
      determinism: 'probabilistic',
      complexity: 'unbounded',
    },
  } satisfies Record<TechniqueSemanticProfileId, TechniqueSemanticProfile>);

export function getTechniqueSemanticProfile(id: TechniqueSemanticProfileId): TechniqueSemanticProfile {
  if (!TECHNIQUE_SEMANTIC_PROFILE_IDS.includes(id)) {
    throw new Error(`unverified_by_trace(semantic_profile_missing): ${id}`);
  }
  const profile = TECHNIQUE_SEMANTIC_PROFILES[id];
  if (!profile) {
    throw new Error(`unverified_by_trace(semantic_profile_missing): ${id}`);
  }
  return profile;
}
