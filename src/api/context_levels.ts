export type ContextLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface ContextLevelDefinition {
  level: ContextLevel;
  maxTokens: number;
  packLimit: number;
  description: string;
}

/**
 * Pack limits per context level.
 *
 * Agent ergonomics: Keep pack counts low (8-10 max) to avoid overwhelming
 * agent context windows. Higher confidence thresholds ensure only the most
 * relevant packs are included.
 *
 * L0: 3 packs - Focused, minimal context for quick lookups
 * L1: 6 packs - Standard queries, most common use case
 * L2: 8 packs - Extended exploration, still manageable
 * L3: 10 packs - Comprehensive, max for complex investigations
 */
export const CONTEXT_LEVELS: Record<ContextLevel, ContextLevelDefinition> = {
  L0: { level: 'L0', maxTokens: 2000, packLimit: 3, description: 'Minimal context (function signature + purpose)' },
  L1: { level: 'L1', maxTokens: 10000, packLimit: 6, description: 'Standard context (module summary + related)' },
  L2: { level: 'L2', maxTokens: 30000, packLimit: 8, description: 'Extended context (graphs + community)' },
  L3: { level: 'L3', maxTokens: 80000, packLimit: 10, description: 'Comprehensive context (history + similar tasks)' },
};

export function resolveContextLevel(level?: string | null): ContextLevelDefinition {
  const key = (level || 'L1').toUpperCase() as ContextLevel;
  return CONTEXT_LEVELS[key] ?? CONTEXT_LEVELS.L1;
}
