/**
 * Helpers for mapping Codex CLI presets to current CLI options.
 */

export type CodexReasoningLevel = 'minimal' | 'low' | 'medium' | 'high' | 'auto';

export interface CodexCliOptions {
  model?: string;
  configOverrides: string[];
}

const CODEX_PRESET_PATTERN = /^gpt-5-codex-(minimal|low|medium|high)$/;
const GPT5_PRESET_PATTERN = /^gpt-5-(minimal|low|medium|high)$/;

const ALLOWED_REASONING: Record<string, Exclude<CodexReasoningLevel, 'auto'>> = {
  minimal: 'low',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

export function resolveCodexCliOptions(
  modelPreset?: string,
  requestedReasoning?: CodexReasoningLevel
): CodexCliOptions {
  let resolvedModel = modelPreset;
  const configOverrides: string[] = [];
  let reasoningApplied = false;
  const normalizedPreset = modelPreset?.toLowerCase();

  const applyReasoning = (level?: CodexReasoningLevel | string) => {
    if (!level || level === 'auto' || reasoningApplied) return;
    const normalized = ALLOWED_REASONING[level];
    if (!normalized) return;
    configOverrides.push(`model_reasoning_effort=\"${normalized}\"`);
    reasoningApplied = true;
  };

  const applyMiniDefault = () => {
    if (!normalizedPreset) return;
    if (!normalizedPreset.includes('mini')) return;
    if (reasoningApplied) return;
    applyReasoning('low');
  };

  if (modelPreset) {
    const codexTier = CODEX_PRESET_PATTERN.exec(modelPreset);
    if (codexTier) {
      resolvedModel = 'gpt-5-codex';
      applyReasoning(codexTier[1]);
    } else {
      const generalTier = GPT5_PRESET_PATTERN.exec(modelPreset);
      if (generalTier) {
        resolvedModel = 'gpt-5';
        applyReasoning(generalTier[1]);
      } else {
        applyReasoning(requestedReasoning);
        applyMiniDefault();
      }
    }
  } else {
    applyReasoning(requestedReasoning);
  }

  if (!reasoningApplied) {
    applyReasoning(requestedReasoning);
    applyMiniDefault();
  }

  return {
    model: resolvedModel,
    configOverrides,
  };
}
