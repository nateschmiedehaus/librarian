import { ZERO_KNOWLEDGE_PROTOCOL, type BootstrapPhase } from './zero_knowledge_bootstrap.js';

export type Role =
  | 'developer'
  | 'reviewer'
  | 'architect'
  | 'debugger'
  | 'learner'
  | 'maintainer'
  | 'migrator'
  | 'security_analyst'
  | 'performance_engineer'
  | 'documentation_writer';

export type Task =
  | 'understand'
  | 'modify'
  | 'verify'
  | 'debug'
  | 'design'
  | 'document'
  | 'test'
  | 'optimize'
  | 'migrate'
  | 'secure';

export type ProjectState =
  | 'greenfield'
  | 'active'
  | 'stable'
  | 'legacy'
  | 'abandoned'
  | 'generated'
  | 'obfuscated';

export type KnowledgeState =
  | 'excellent'
  | 'good'
  | 'poor'
  | 'none'
  | 'misleading';

export interface SituationVector {
  role: Role;
  task: Task;
  projectState: ProjectState;
  knowledgeState: KnowledgeState;
}

export interface TaskProtocol {
  id: string;
  name: string;
  goal: string;
  patterns: string[];
  operators?: string[];
  evidenceExpectations?: string[];
  precautions?: string[];
}

export interface Protocol {
  phase1: BootstrapPhase[] | null;
  phase2: TaskProtocol;
  confidenceRequirements: number;
  notes: string[];
}

const BASE_PROTOCOLS: Record<Task, TaskProtocol> = {
  understand: {
    id: 'protocol_understand',
    name: 'Codebase Understanding',
    goal: 'Build a reliable mental model of the codebase.',
    patterns: ['pattern_codebase_onboarding', 'pattern_documentation'],
    operators: ['sequence', 'loop'],
    evidenceExpectations: ['Inventory of files', 'Architecture summary'],
  },
  modify: {
    id: 'protocol_modify',
    name: 'Safe Modification',
    goal: 'Change behavior while preserving correctness.',
    patterns: ['pattern_change_verification', 'pattern_dependency_update'],
    operators: ['gate', 'loop'],
    evidenceExpectations: ['Impact analysis', 'Verification plan'],
  },
  verify: {
    id: 'protocol_verify',
    name: 'Verification',
    goal: 'Establish strong evidence for correctness.',
    patterns: ['pattern_change_verification', 'pattern_test_generation'],
    operators: ['gate', 'quorum'],
    evidenceExpectations: ['Test results', 'Coverage gaps closed'],
  },
  debug: {
    id: 'protocol_debug',
    name: 'Debugging',
    goal: 'Identify root causes and confirm fixes.',
    patterns: ['pattern_bug_investigation'],
    operators: ['loop'],
    evidenceExpectations: ['Root cause identified', 'Repro confirmed'],
  },
  design: {
    id: 'protocol_design',
    name: 'Architecture Design',
    goal: 'Define a resilient system shape.',
    patterns: ['pattern_api_design', 'pattern_technical_debt'],
    operators: ['parallel'],
    evidenceExpectations: ['Design constraints', 'Tradeoffs recorded'],
  },
  document: {
    id: 'protocol_document',
    name: 'Documentation',
    goal: 'Explain the system clearly and accurately.',
    patterns: ['pattern_documentation', 'pattern_codebase_onboarding'],
    operators: ['sequence'],
    evidenceExpectations: ['Docs updated', 'Examples verified'],
  },
  test: {
    id: 'protocol_test',
    name: 'Test Generation',
    goal: 'Increase coverage for critical paths.',
    patterns: ['pattern_test_generation', 'pattern_change_verification'],
    operators: ['parallel'],
    evidenceExpectations: ['Test plan', 'New tests executed'],
  },
  optimize: {
    id: 'protocol_optimize',
    name: 'Optimization',
    goal: 'Improve performance with measurable gains.',
    patterns: ['pattern_performance_investigation', 'pattern_technical_debt'],
    operators: ['loop'],
    evidenceExpectations: ['Baseline metrics', 'Post-change benchmarks'],
  },
  migrate: {
    id: 'protocol_migrate',
    name: 'Migration',
    goal: 'Safely move to new technologies or schemas.',
    patterns: ['pattern_dependency_update', 'pattern_release_verification'],
    operators: ['gate'],
    evidenceExpectations: ['Rollback plan', 'Migration rehearsal'],
  },
  secure: {
    id: 'protocol_secure',
    name: 'Security Audit',
    goal: 'Identify and mitigate vulnerabilities.',
    patterns: ['pattern_security_audit', 'pattern_incident_response'],
    operators: ['parallel', 'gate'],
    evidenceExpectations: ['Threat model', 'Remediation plan'],
  },
};

const BASE_CONFIDENCE: Record<Task, number> = {
  understand: 0.6,
  modify: 0.8,
  verify: 0.9,
  debug: 0.7,
  design: 0.7,
  document: 0.8,
  test: 0.7,
  optimize: 0.7,
  migrate: 0.85,
  secure: 0.95,
};

const ROLE_MULTIPLIER: Record<Role, number> = {
  developer: 1.0,
  reviewer: 1.1,
  architect: 0.9,
  debugger: 0.9,
  learner: 0.7,
  maintainer: 1.0,
  migrator: 1.1,
  security_analyst: 1.2,
  performance_engineer: 0.9,
  documentation_writer: 1.0,
};

export class UniversalProtocolSelector {
  selectProtocol(situation: SituationVector): Protocol {
    const taskProtocol = this.selectTaskProtocol(situation);
    const confidenceRequirements = this.computeRequiredConfidence(situation.role, situation.task);
    const notes: string[] = [];
    let phase1: BootstrapPhase[] | null = null;

    if (situation.knowledgeState === 'none' || situation.knowledgeState === 'misleading') {
      phase1 = ZERO_KNOWLEDGE_PROTOCOL;
      notes.push('Zero-knowledge bootstrap required before task execution.');
    }
    if (situation.knowledgeState === 'poor') {
      notes.push('Low documentation quality: add a rapid onboarding pass.');
    }

    return {
      phase1,
      phase2: taskProtocol,
      confidenceRequirements,
      notes,
    };
  }

  private selectTaskProtocol(situation: SituationVector): TaskProtocol {
    const base = cloneProtocol(BASE_PROTOCOLS[situation.task]);
    const withKnowledge = this.applyKnowledgeState(base, situation.knowledgeState);
    if (situation.projectState === 'legacy' || situation.projectState === 'abandoned') {
      return this.wrapWithLegacyPrecautions(withKnowledge);
    }
    if (situation.projectState === 'generated' || situation.projectState === 'obfuscated') {
      return this.wrapWithStructuralAnalysis(withKnowledge);
    }
    return withKnowledge;
  }

  private computeRequiredConfidence(role: Role, task: Task): number {
    const base = BASE_CONFIDENCE[task] ?? 0.7;
    const multiplier = ROLE_MULTIPLIER[role] ?? 1.0;
    return Math.min(0.95, clampNumber(base * multiplier, 0, 1));
  }

  private wrapWithLegacyPrecautions(protocol: TaskProtocol): TaskProtocol {
    const precautions = mergeStrings(protocol.precautions, [
      'Assume hidden dependencies and preserve backward compatibility.',
      'Prefer additive or reversible changes.',
      'Require rollback plan for changes.',
    ]);
    const patterns = mergeStrings(protocol.patterns, ['pattern_dependency_update', 'pattern_change_verification']);
    return {
      ...protocol,
      id: `${protocol.id}_legacy`,
      precautions,
      patterns,
    };
  }

  private wrapWithStructuralAnalysis(protocol: TaskProtocol): TaskProtocol {
    const precautions = mergeStrings(protocol.precautions, [
      'Verify structural inventory before acting.',
      'Document entry points and generated artifacts.',
    ]);
    const patterns = mergeStrings(protocol.patterns, ['pattern_codebase_onboarding']);
    return {
      ...protocol,
      id: `${protocol.id}_structural`,
      precautions,
      patterns,
    };
  }

  private applyKnowledgeState(protocol: TaskProtocol, knowledgeState: KnowledgeState): TaskProtocol {
    if (knowledgeState === 'excellent' || knowledgeState === 'good') return protocol;
    const patterns = mergeStrings(protocol.patterns, ['pattern_codebase_onboarding']);
    return {
      ...protocol,
      patterns,
      precautions: mergeStrings(protocol.precautions, ['Explicitly mark unknowns before proceeding.']),
    };
  }
}

function cloneProtocol(protocol: TaskProtocol): TaskProtocol {
  return {
    ...protocol,
    patterns: [...protocol.patterns],
    operators: protocol.operators ? [...protocol.operators] : undefined,
    evidenceExpectations: protocol.evidenceExpectations ? [...protocol.evidenceExpectations] : undefined,
    precautions: protocol.precautions ? [...protocol.precautions] : undefined,
  };
}

function mergeStrings(existing: string[] | undefined, additions: string[]): string[] {
  const merged = new Set(existing ?? []);
  for (const entry of additions) merged.add(entry);
  return Array.from(merged);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export const __testing = {
  BASE_PROTOCOLS,
  cloneProtocol,
  mergeStrings,
};
