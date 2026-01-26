export type ContextLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface ContextLevelDefinition {
  level: ContextLevel;
  maxTokens: number;
  packLimit: number;
  description: string;
}

export const CONTEXT_LEVELS: Record<ContextLevel, ContextLevelDefinition> = {
  L0: { level: 'L0', maxTokens: 2000, packLimit: 4, description: 'Minimal context (function signature + purpose)' },
  L1: { level: 'L1', maxTokens: 10000, packLimit: 8, description: 'Standard context (module summary + related)' },
  L2: { level: 'L2', maxTokens: 30000, packLimit: 12, description: 'Extended context (graphs + community)' },
  L3: { level: 'L3', maxTokens: 80000, packLimit: 20, description: 'Comprehensive context (history + similar tasks)' },
};

export function resolveContextLevel(level?: string | null): ContextLevelDefinition {
  const key = (level || 'L1').toUpperCase() as ContextLevel;
  return CONTEXT_LEVELS[key] ?? CONTEXT_LEVELS.L1;
}
