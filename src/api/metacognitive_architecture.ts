export type Timestamp = string;

export interface ReasoningState {
  currentStrategyId: string;
  strategyStartTime: Timestamp;
  progressIndicators: ProgressIndicator[];
  recentOutcomes?: Array<{ success: boolean; note?: string }>;
}

export interface MetacognitiveState {
  currentStrategy: ReasoningStrategy;
  strategyStartTime: Timestamp;
  progressIndicators: ProgressIndicator[];
  impasses: Impasse[];
  strategySwitches: StrategySwitch[];
}

export interface ReasoningStrategy {
  id: string;
  name: string;
  applicableWhen: string[];
  progressMetric: string;
  expectedProgressRate: number;
}

export interface Impasse {
  type: 'stuck' | 'circular' | 'diminishing_returns' | 'contradiction';
  detectedAt: Timestamp;
  evidence: string;
  suggestedRecovery: string[];
}

export interface ProgressIndicator {
  metric: string;
  value: number;
  trend: 'improving' | 'stable' | 'declining';
  expectedValue: number;
}

export interface StrategySwitch {
  from: string;
  to: string;
  reason: string;
  at: Timestamp;
}

export interface ReasoningExplanation {
  summary: string;
  impasse?: Impasse;
  recommendedStrategy?: ReasoningStrategy;
}

export const REASONING_STRATEGIES: ReasoningStrategy[] = [
  {
    id: 'deductive',
    name: 'Deductive Reasoning',
    applicableWhen: ['clear premises', 'formal structure', 'logical derivation needed'],
    progressMetric: 'conclusions_derived',
    expectedProgressRate: 0.5,
  },
  {
    id: 'abductive',
    name: 'Abductive Reasoning',
    applicableWhen: ['need explanation', 'symptoms known', 'cause unknown'],
    progressMetric: 'hypotheses_eliminated',
    expectedProgressRate: 0.3,
  },
  {
    id: 'analogical',
    name: 'Analogical Reasoning',
    applicableWhen: ['novel problem', 'similar known problems exist'],
    progressMetric: 'relevant_analogies_found',
    expectedProgressRate: 0.4,
  },
  {
    id: 'decomposition',
    name: 'Decomposition',
    applicableWhen: ['complex problem', 'independent sub-problems'],
    progressMetric: 'sub_problems_solved',
    expectedProgressRate: 0.2,
  },
  {
    id: 'brute_force',
    name: 'Systematic Enumeration',
    applicableWhen: ['finite search space', 'other strategies failed'],
    progressMetric: 'options_evaluated',
    expectedProgressRate: 1.0,
  },
  {
    id: 'ask_human',
    name: 'Human Consultation',
    applicableWhen: ['multiple impasses', 'low confidence', 'high stakes'],
    progressMetric: 'clarifications_received',
    expectedProgressRate: 0.1,
  },
];

export class MetacognitiveMonitor {
  monitor(state: ReasoningState): MetacognitiveState {
    const strategy = resolveStrategy(state.currentStrategyId);
    const impasses = [];
    const detected = this.detectImpasse({
      currentStrategy: strategy,
      strategyStartTime: state.strategyStartTime,
      progressIndicators: state.progressIndicators,
      impasses: [],
      strategySwitches: [],
    });
    if (detected) {
      impasses.push(detected);
    }
    return {
      currentStrategy: strategy,
      strategyStartTime: state.strategyStartTime,
      progressIndicators: state.progressIndicators,
      impasses,
      strategySwitches: [],
    };
  }

  detectImpasse(state: MetacognitiveState): Impasse | null {
    const now = new Date().toISOString();
    for (const indicator of state.progressIndicators) {
      if (indicator.trend === 'declining' || indicator.value < indicator.expectedValue * 0.5) {
        return {
          type: 'diminishing_returns',
          detectedAt: now,
          evidence: `Progress on ${indicator.metric} is below expected.`,
          suggestedRecovery: [
            'Switch to decomposition',
            'Reduce scope and retry',
          ],
        };
      }
    }
    return null;
  }

  selectAlternativeStrategy(
    currentStrategy: ReasoningStrategy,
    impasse: Impasse
  ): ReasoningStrategy {
    if (impasse.type === 'contradiction') {
      return resolveStrategy('ask_human');
    }
    if (impasse.type === 'circular') {
      return resolveStrategy('decomposition');
    }
    if (impasse.type === 'diminishing_returns') {
      return resolveStrategy('analogical');
    }
    return resolveStrategy(currentStrategy.id === 'deductive' ? 'abductive' : 'deductive');
  }

  shouldEscalate(state: MetacognitiveState): boolean {
    if (state.impasses.some((impasse) => impasse.type === 'contradiction')) {
      return true;
    }
    return state.impasses.length >= 2;
  }

  explainReasoning(state: MetacognitiveState): ReasoningExplanation {
    const impasse = state.impasses[0];
    const recommendedStrategy = impasse
      ? this.selectAlternativeStrategy(state.currentStrategy, impasse)
      : undefined;
    return {
      summary: `Current strategy: ${state.currentStrategy.name}.`,
      impasse,
      recommendedStrategy,
    };
  }
}

function resolveStrategy(id: string): ReasoningStrategy {
  return REASONING_STRATEGIES.find((strategy) => strategy.id === id) ?? REASONING_STRATEGIES[0];
}
