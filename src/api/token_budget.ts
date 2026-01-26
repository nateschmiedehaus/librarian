import { estimateTokenCount } from './governor_context.js';
import { resolveContextLevel, type ContextLevel } from './context_levels.js';
import type { AgentKnowledgeContext } from './context_assembly.js';

export interface TokenBudgetResult {
  context: AgentKnowledgeContext;
  usedTokens: number;
  truncated: boolean;
  truncationSteps: string[];
}

function estimateContextTokens(context: AgentKnowledgeContext): number {
  return estimateTokenCount(JSON.stringify(context));
}

function trimSnippets(context: AgentKnowledgeContext, maxSnippetsPerFile: number, maxSnippetChars: number): void {
  for (const file of context.required.targetFiles) {
    if (file.snippets.length > maxSnippetsPerFile) file.snippets = file.snippets.slice(0, maxSnippetsPerFile);
    for (const snippet of file.snippets) {
      if (snippet.content.length > maxSnippetChars) snippet.content = `${snippet.content.slice(0, maxSnippetChars)}…`;
    }
  }
}

export function enforceTokenBudget(
  input: AgentKnowledgeContext,
  level: ContextLevel,
  maxTokensOverride?: number
): TokenBudgetResult {
  const definition = resolveContextLevel(level);
  const maxTokens = maxTokensOverride ?? definition.maxTokens;
  const context: AgentKnowledgeContext = {
    ...input,
    required: {
      ...input.required,
      targetFiles: input.required.targetFiles.map((file) => ({
        ...file,
        keyFacts: [...file.keyFacts],
        snippets: file.snippets.map((snippet) => ({ ...snippet })),
        packIds: [...file.packIds],
      })),
    },
    supplementary: {
      relatedFiles: [...input.supplementary.relatedFiles],
      recentChanges: [...input.supplementary.recentChanges],
      patterns: [...input.supplementary.patterns],
      antiPatterns: [...input.supplementary.antiPatterns],
      similarTasks: [...input.supplementary.similarTasks],
      knowledgeSources: [...input.supplementary.knowledgeSources],
    },
  };

  const truncationSteps: string[] = [];
  let usedTokens = estimateContextTokens(context);
  if (usedTokens <= maxTokens) {
    return { context, usedTokens, truncated: false, truncationSteps };
  }

  context.supplementary = { relatedFiles: [], recentChanges: [], patterns: [], antiPatterns: [], similarTasks: [], knowledgeSources: [] };
  truncationSteps.push('removed_supplementary');
  usedTokens = estimateContextTokens(context);
  if (usedTokens <= maxTokens) {
    return { context, usedTokens, truncated: true, truncationSteps };
  }

  context.required.targetFiles = context.required.targetFiles.slice(0, Math.max(1, Math.floor(definition.packLimit / 2)));
  truncationSteps.push('trimmed_required_files');
  usedTokens = estimateContextTokens(context);
  if (usedTokens <= maxTokens) {
    return { context, usedTokens, truncated: true, truncationSteps };
  }

  trimSnippets(context, 1, 360);
  truncationSteps.push('trimmed_snippets');
  usedTokens = estimateContextTokens(context);
  if (usedTokens <= maxTokens) {
    return { context, usedTokens, truncated: true, truncationSteps };
  }

  throw new Error(`unverified_by_trace(context_token_overflow): context exceeds ${maxTokens} tokens after truncation`);
}
