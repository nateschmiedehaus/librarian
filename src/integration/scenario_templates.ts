export type ScenarioKind =
  | 'onboarding'
  | 'search'
  | 'change_impact'
  | 'refactor'
  | 'bug_triage'
  | 'performance'
  | 'security_review'
  | 'test_gap'
  | 'dependency_upgrade'
  | 'architecture_drift'
  | 'ownership'
  | 'release_planning'
  | 'compliance'
  | 'incident_response'
  | 'docs_recovery'
  | 'rationale'
  | 'data_change'
  | 'ci_failure'
  | 'observability'
  | 'cross_repo'
  | 'domain'
  | 'risk'
  | 'knowledge_gap'
  | 'coordination'
  | 'review'
  | 'feature_delivery'
  | 'generic';

export interface ScenarioGuidance {
  kind: ScenarioKind;
  label: string;
  objective: string;
  evidenceFocus: string[];
  outputs: string[];
  checklist: string[];
  risks: string[];
}

export interface ScenarioInput {
  intent: string;
  taskType?: string;
  relatedFiles?: string[];
  coverageGaps?: string[];
}

interface ScenarioDefinition extends ScenarioGuidance {
  keywords: string[];
  taskTypes?: string[];
}

const SCENARIOS: ScenarioDefinition[] = [
  {
    kind: 'incident_response',
    label: 'Incident Response',
    keywords: ['incident', 'outage', 'rollback', 'postmortem', 'sev'],
    taskTypes: ['bug_fix', 'review'],
    objective: 'Stabilize the system and find the regression window.',
    evidenceFocus: ['recent commits', 'alerts/logs', 'deployment timeline'],
    outputs: ['rollback plan', 'suspect changes', 'mitigation checklist'],
    checklist: ['Identify last-known-good commit', 'Trace change window', 'Verify blast radius', 'Draft rollback steps'],
    risks: ['Config drift', 'Hidden dependency change', 'Missing telemetry'],
  },
  {
    kind: 'security_review',
    label: 'Security Review',
    keywords: ['security', 'vulnerability', 'attack', 'auth', 'authorization', 'authentication', 'xss', 'csrf', 'injection', 'secret'],
    taskTypes: ['review'],
    objective: 'Map attack surfaces and sensitive data paths.',
    evidenceFocus: ['entry points', 'authz checks', 'data handling'],
    outputs: ['risk matrix', 'sensitive flow map', 'mitigation plan'],
    checklist: ['List entry points', 'Trace sensitive data', 'Verify authz boundaries', 'Audit input validation'],
    risks: ['Untrusted input reachability', 'Privilege escalation', 'Missing rate limits'],
  },
  {
    kind: 'compliance',
    label: 'Compliance Readiness',
    keywords: ['compliance', 'gdpr', 'pci', 'soc', 'policy', 'regulatory'],
    taskTypes: ['review'],
    objective: 'Verify policy-aligned handling of data and access.',
    evidenceFocus: ['data retention', 'access logs', 'policy docs'],
    outputs: ['compliance checklist', 'violations list', 'remediation plan'],
    checklist: ['Locate data processing flows', 'Check retention policies', 'Validate audit trails'],
    risks: ['Unlogged access', 'Unclear data ownership', 'Missing deletion paths'],
  },
  {
    kind: 'performance',
    label: 'Performance Optimization',
    keywords: ['performance', 'latency', 'slow', 'throughput', 'optimiz', 'bottleneck', 'hot path'],
    taskTypes: ['review', 'feature'],
    objective: 'Identify bottlenecks and the highest-leverage optimizations.',
    evidenceFocus: ['hot paths', 'profiling data', 'query counts'],
    outputs: ['bottleneck list', 'optimization plan', 'expected impact'],
    checklist: ['Trace request flow', 'Measure hotspots', 'Rank fixes by impact'],
    risks: ['Caching inconsistency', 'N+1 queries', 'Hidden sync I/O'],
  },
  {
    kind: 'bug_triage',
    label: 'Bug Triage',
    keywords: ['bug', 'error', 'exception', 'crash', 'failure', 'regression', 'fix', 'issue'],
    taskTypes: ['bug_fix'],
    objective: 'Identify likely root causes and reproduction steps.',
    evidenceFocus: ['stack traces', 'recent changes', 'tests'],
    outputs: ['root-cause candidates', 'repro steps', 'fix checklist'],
    checklist: ['Find failure signatures', 'Trace recent changes', 'Verify coverage gaps'],
    risks: ['Heisenbugs', 'Missing repro path', 'Stale knowledge'],
  },
  {
    kind: 'change_impact',
    label: 'Change Impact',
    keywords: ['impact', 'affect', 'break', 'downstream', 'upstream', 'blast radius'],
    taskTypes: ['feature', 'refactor'],
    objective: 'Map dependencies and affected surfaces before change.',
    evidenceFocus: ['dependency graph', 'tests', 'public APIs'],
    outputs: ['impact list', 'affected tests', 'mitigation steps'],
    checklist: ['Enumerate dependents', 'Find critical tests', 'Check contracts'],
    risks: ['Hidden consumers', 'Incomplete test coverage', 'Untracked configs'],
  },
  {
    kind: 'refactor',
    label: 'Refactor Safety',
    keywords: ['refactor', 'cleanup', 'rename', 'migrate'],
    taskTypes: ['refactor'],
    objective: 'Refactor while preserving contracts and behavior.',
    evidenceFocus: ['public interfaces', 'tests', 'usage patterns'],
    outputs: ['refactor plan', 'invariants list', 'test plan'],
    checklist: ['Identify invariants', 'Locate critical tests', 'Stage safe changes'],
    risks: ['Hidden coupling', 'Behavioral drift', 'Incomplete updates'],
  },
  {
    kind: 'test_gap',
    label: 'Test Gap Discovery',
    keywords: ['test gap', 'coverage', 'missing test', 'untested', 'test plan'],
    taskTypes: ['review'],
    objective: 'Surface untested behavior and prioritize coverage.',
    evidenceFocus: ['test mapping', 'coverage data', 'critical paths'],
    outputs: ['missing tests list', 'priority order', 'sample assertions'],
    checklist: ['Map tests to code', 'Identify critical paths', 'Prioritize gaps'],
    risks: ['False confidence', 'Coverage skew'],
  },
  {
    kind: 'dependency_upgrade',
    label: 'Dependency Upgrade',
    keywords: ['dependency', 'upgrade', 'bump', 'version', 'package'],
    taskTypes: ['feature', 'review'],
    objective: 'Assess compatibility risk and upgrade impact.',
    evidenceFocus: ['dependency graph', 'release notes', 'usage sites'],
    outputs: ['upgrade impact report', 'compatibility checklist', 'test plan'],
    checklist: ['Find usage sites', 'Assess breaking changes', 'Plan validation'],
    risks: ['Hidden transitive changes', 'ABI breakage'],
  },
  {
    kind: 'architecture_drift',
    label: 'Architecture Drift',
    keywords: ['architecture', 'drift', 'design divergence', 'design doc'],
    taskTypes: ['review'],
    objective: 'Identify where implementation diverges from design.',
    evidenceFocus: ['architecture docs', 'dependency graph', 'recent changes'],
    outputs: ['drift report', 'remediation plan'],
    checklist: ['Compare design vs implementation', 'Highlight divergence', 'Propose fixes'],
    risks: ['Outdated docs', 'Implicit contracts'],
  },
  {
    kind: 'ownership',
    label: 'Ownership and Responsibility',
    keywords: ['owner', 'ownership', 'maintainer', 'reviewer', 'oncall'],
    taskTypes: ['review'],
    objective: 'Identify owners, reviewers, and escalation paths.',
    evidenceFocus: ['commit history', 'CODEOWNERS', 'team docs'],
    outputs: ['owner list', 'review routing', 'escalation paths'],
    checklist: ['Find primary maintainers', 'Map reviewer pool', 'Confirm escalation'],
    risks: ['Stale ownership', 'Unknown reviewers'],
  },
  {
    kind: 'release_planning',
    label: 'Release Planning',
    keywords: ['release', 'ship', 'deploy', 'launch'],
    taskTypes: ['feature', 'review'],
    objective: 'Enumerate steps required for safe release.',
    evidenceFocus: ['change impact', 'test coverage', 'risk signals'],
    outputs: ['release checklist', 'gating tests', 'risk notes'],
    checklist: ['List gating tests', 'Confirm rollback', 'Verify feature flags'],
    risks: ['Incomplete rollout plan', 'Missing monitoring'],
  },
  {
    kind: 'docs_recovery',
    label: 'Documentation Recovery',
    keywords: ['docs', 'documentation', 'readme', 'summarize', 'overview'],
    taskTypes: ['feature', 'review'],
    objective: 'Recover or generate missing documentation.',
    evidenceFocus: ['code summaries', 'architecture map', 'usage examples'],
    outputs: ['narrative summary', 'examples', 'gotchas'],
    checklist: ['Summarize purpose', 'List entry points', 'Capture caveats'],
    risks: ['Outdated assumptions', 'Missing context'],
  },
  {
    kind: 'rationale',
    label: 'Design Rationale',
    keywords: ['rationale', 'decision', 'tradeoff', 'why was'],
    taskTypes: ['review'],
    objective: 'Recover decision context and tradeoffs.',
    evidenceFocus: ['ADRs', 'commit history', 'discussion notes'],
    outputs: ['decision summary', 'constraints list', 'alternative analysis'],
    checklist: ['Locate ADRs', 'Trace historical changes', 'Capture constraints'],
    risks: ['Missing artifacts', 'Ambiguous intent'],
  },
  {
    kind: 'data_change',
    label: 'Data Model Change',
    keywords: ['schema', 'database', 'migration', 'data model'],
    taskTypes: ['feature', 'refactor'],
    objective: 'Map downstream impact of data changes.',
    evidenceFocus: ['schema map', 'data flow', 'tests'],
    outputs: ['impact list', 'migration plan', 'rollback steps'],
    checklist: ['Trace consumers', 'Plan migrations', 'Validate rollback'],
    risks: ['Partial migrations', 'Data loss'],
  },
  {
    kind: 'ci_failure',
    label: 'CI and Build Failure',
    keywords: ['ci', 'build', 'pipeline', 'lint', 'test failure'],
    taskTypes: ['bug_fix', 'review'],
    objective: 'Identify the breaking change and fix path.',
    evidenceFocus: ['failed steps', 'recent commits', 'test logs'],
    outputs: ['suspect list', 'repro steps', 'fix options'],
    checklist: ['Locate failing step', 'Identify last green commit', 'Reproduce locally'],
    risks: ['Flaky tests', 'Hidden environment drift'],
  },
  {
    kind: 'observability',
    label: 'Observability Coverage',
    keywords: ['observability', 'logging', 'metrics', 'tracing', 'telemetry'],
    taskTypes: ['review'],
    objective: 'Identify missing telemetry in critical flows.',
    evidenceFocus: ['log coverage', 'metrics map', 'error paths'],
    outputs: ['instrumentation gaps', 'logging plan'],
    checklist: ['Trace critical flows', 'Check error handling', 'Add signals'],
    risks: ['Silent failures', 'Unmonitored hotspots'],
  },
  {
    kind: 'cross_repo',
    label: 'Cross-Repo Usage',
    keywords: ['cross repo', 'multi repo', 'multi-repo', 'federation'],
    taskTypes: ['review'],
    objective: 'Identify cross-repo dependencies and owners.',
    evidenceFocus: ['dependency map', 'usage graph', 'ownership data'],
    outputs: ['usage report', 'owner list', 'risk notes'],
    checklist: ['Find consumers', 'Map owners', 'Assess change impact'],
    risks: ['Hidden consumers', 'Version skew'],
  },
  {
    kind: 'domain',
    label: 'Domain Knowledge Extraction',
    keywords: ['domain', 'glossary', 'concept', 'terminology'],
    taskTypes: ['feature', 'review'],
    objective: 'Extract domain concepts and rules.',
    evidenceFocus: ['naming patterns', 'docs', 'schemas'],
    outputs: ['glossary', 'concept graph', 'key rules'],
    checklist: ['Find domain entities', 'Extract rules', 'Capture constraints'],
    risks: ['Overfitting to code', 'Missing domain docs'],
  },
  {
    kind: 'risk',
    label: 'Risk Scoring',
    keywords: ['risk', 'critical', 'danger', 'unsafe'],
    taskTypes: ['review'],
    objective: 'Rank modules by risk and explain drivers.',
    evidenceFocus: ['change frequency', 'test coverage', 'complexity'],
    outputs: ['risk ranking', 'risk drivers', 'mitigation plan'],
    checklist: ['Gather risk signals', 'Rank hotspots', 'Propose mitigations'],
    risks: ['Biased signals', 'Blind spots'],
  },
  {
    kind: 'knowledge_gap',
    label: 'Knowledge Gap Detection',
    keywords: ['knowledge gap', 'unknown', 'low confidence', 'coverage gap'],
    taskTypes: ['review'],
    objective: 'Identify missing understanding and evidence gaps.',
    evidenceFocus: ['confidence map', 'evidence traces'],
    outputs: ['gap list', 'evidence plan', 'follow-up tasks'],
    checklist: ['Find low confidence areas', 'Prioritize evidence collection'],
    risks: ['Hidden assumptions', 'Stale indices'],
  },
  {
    kind: 'coordination',
    label: 'Multi-Agent Coordination',
    keywords: ['handoff', 'coordination', 'agents', 'task map', 'plan'],
    taskTypes: ['feature', 'review'],
    objective: 'Build a task map for parallel execution.',
    evidenceFocus: ['dependency map', 'ownership map', 'risk map'],
    outputs: ['task graph', 'sequencing plan', 'validation gates'],
    checklist: ['Split by dependency', 'Assign owners', 'Define validation'],
    risks: ['Parallel conflicts', 'Missing coordination'],
  },
  {
    kind: 'onboarding',
    label: 'Onboarding',
    keywords: ['onboard', 'onboarding', 'orientation', 'mental model', 'new to'],
    taskTypes: ['feature', 'review'],
    objective: 'Provide a fast mental model for a module or subsystem.',
    evidenceFocus: ['entry points', 'dependency map', 'ownership'],
    outputs: ['system narrative', 'entry points', 'key risks'],
    checklist: ['Find entry points', 'Explain responsibilities', 'List key risks'],
    risks: ['Implicit coupling', 'Hidden runtime flows'],
  },
  {
    kind: 'search',
    label: 'Targeted Navigation',
    keywords: ['where', 'locate', 'find', 'search', 'implementation'],
    taskTypes: ['feature', 'review'],
    objective: 'Locate relevant code and the surrounding call paths.',
    evidenceFocus: ['dependency graph', 'code search', 'context packs'],
    outputs: ['ranked locations', 'call paths'],
    checklist: ['Find entry points', 'Trace call graph', 'Confirm tests'],
    risks: ['Stale index', 'Incomplete coverage'],
  },
  {
    kind: 'review',
    label: 'System Review',
    keywords: ['review', 'audit', 'analysis', 'assessment'],
    taskTypes: ['review'],
    objective: 'Evaluate system health, risks, and gaps.',
    evidenceFocus: ['quality signals', 'coverage', 'history'],
    outputs: ['risk summary', 'gap list', 'recommendations'],
    checklist: ['Scan for hotspots', 'Validate coverage', 'Review recent changes'],
    risks: ['False positives', 'Outdated signals'],
  },
  {
    kind: 'feature_delivery',
    label: 'Feature Delivery',
    keywords: ['feature', 'implement', 'add', 'build'],
    taskTypes: ['feature'],
    objective: 'Plan and implement a new capability safely.',
    evidenceFocus: ['entry points', 'dependencies', 'tests'],
    outputs: ['implementation plan', 'test plan', 'risk notes'],
    checklist: ['Identify entry points', 'Map dependencies', 'Plan tests'],
    risks: ['Untracked side effects', 'Missing validations'],
  },
];

const FALLBACK_BY_TASK_TYPE: Record<string, ScenarioKind> = {
  bug_fix: 'bug_triage',
  refactor: 'refactor',
  review: 'review',
  feature: 'feature_delivery',
};

const FALLBACK_GUIDANCE: ScenarioGuidance = {
  kind: 'generic',
  label: 'General Analysis',
  objective: 'Provide relevant context with evidence and confidence.',
  evidenceFocus: ['context packs', 'dependency graph', 'recent changes'],
  outputs: ['summary', 'evidence list', 'next steps'],
  checklist: ['Review key files', 'Validate evidence', 'Identify gaps'],
  risks: ['Stale index', 'Missing evidence'],
};

export function resolveScenarioGuidance(input: ScenarioInput): ScenarioGuidance {
  const intent = normalizeIntent(input.intent);
  const taskType = normalizeTaskType(input.taskType);
  const definition = findScenarioDefinition(intent, taskType);
  if (!definition) {
    return withDynamicHints(FALLBACK_GUIDANCE, input);
  }
  return withDynamicHints(definition, input);
}

function findScenarioDefinition(intent: string, taskType: string): ScenarioDefinition | null {
  // First pass: Find scenarios that match on keywords (primary signal)
  for (const definition of SCENARIOS) {
    if (matchesKeywords(definition, intent)) {
      return definition;
    }
  }
  // Second pass: Find scenarios that match on taskType (secondary signal)
  for (const definition of SCENARIOS) {
    if (matchesTaskType(definition, taskType)) {
      return definition;
    }
  }
  // Final fallback by task type
  const fallbackKind = FALLBACK_BY_TASK_TYPE[taskType];
  if (fallbackKind) {
    return SCENARIOS.find((scenario) => scenario.kind === fallbackKind) ?? null;
  }
  return null;
}

function matchesKeywords(definition: ScenarioDefinition, intent: string): boolean {
  for (const keyword of definition.keywords) {
    if (intent.includes(keyword)) return true;
  }
  return false;
}

function matchesTaskType(definition: ScenarioDefinition, taskType: string): boolean {
  return !!(definition.taskTypes && taskType && definition.taskTypes.includes(taskType));
}

function normalizeIntent(intent: string): string {
  return (intent ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeTaskType(taskType?: string): string {
  return (taskType ?? '').toLowerCase().replace(/[\s-]+/g, '_');
}

function withDynamicHints(definition: ScenarioGuidance, input: ScenarioInput): ScenarioGuidance {
  const relatedFiles = dedupe(input.relatedFiles ?? []);
  const coverageGaps = dedupe(input.coverageGaps ?? []);
  const dynamicChecklist: string[] = [];
  if (relatedFiles.length) {
    dynamicChecklist.push(`Inspect ${relatedFiles.slice(0, 3).join(', ')} for entry points and dependencies.`);
  }
  if (coverageGaps.length) {
    dynamicChecklist.push(`Resolve coverage gaps: ${coverageGaps.slice(0, 2).join(' | ')}`);
  }
  const dynamicRisks = coverageGaps.map((gap) => `Coverage gap: ${gap}`);
  return {
    ...definition,
    checklist: mergeUnique(definition.checklist, dynamicChecklist, 6),
    risks: mergeUnique(definition.risks, dynamicRisks, 6),
  };
}

function mergeUnique(base: string[], extra: string[], limit: number): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const item of [...base, ...extra]) {
    const value = item.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    merged.push(value);
    if (merged.length >= limit) break;
  }
  return merged;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    output.push(trimmed);
  }
  return output;
}
