import type { TechniqueComposition } from '../strategic/techniques.js';

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;
const TOKEN_PATTERN = /[a-z0-9]+/g;

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'your',
  'our',
  'their',
  'plan',
  'work',
  'workflow',
  'process',
  'system',
  'technique',
  'composition',
  'method',
  'guide',
]);

export const COMPOSITION_KEYWORDS: Record<string, string[]> = {
  tc_agentic_review_v1: ['review', 'audit', 'code review', 'risk review'],
  tc_root_cause_recovery: ['root cause', 'failure', 'incident', 'bug', 'regression'],
  tc_release_readiness: ['release', 'rollout', 'deploy', 'migration'],
  tc_repo_rehab_triage: ['rehab', 'triage', 'stabilize', 'legacy', 'debt'],
  tc_performance_reliability: ['performance', 'latency', 'throughput', 'scaling'],
  tc_security_review: ['security', 'threat', 'abuse', 'vulnerability', 'audit'],
  tc_ux_discovery: ['ux', 'user journey', 'usability', 'onboarding', 'experience'],
  tc_scaling_readiness: ['scaling readiness', 'capacity', 'throughput', 'scale'],
  tc_social_platform: ['social platform', 'social', 'community', 'feed', 'sharing'],
  tc_video_platform: ['video platform', 'video', 'streaming', 'media'],
  tc_industrial_backend: ['industrial', 'backend', 'logistics', 'operations', 'pipeline'],
  tc_developer_tool: ['developer tool', 'devtool', 'cli', 'sdk', 'framework'],
  tc_dashboard: ['dashboard', 'analytics', 'admin', 'reporting'],
  tc_landing_page: ['landing page', 'marketing site', 'homepage'],
  tc_payment_system: ['payment', 'billing', 'checkout', 'subscription'],
  tc_e_commerce: ['e-commerce', 'commerce', 'store', 'cart'],
  tc_search_system: ['search', 'query', 'indexing', 'ranking'],
  tc_notification: ['notification', 'email', 'sms', 'push'],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(CONTROL_CHAR_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text).match(TOKEN_PATTERN) ?? [];
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function deriveKeywords(composition: TechniqueComposition): string[] {
  const source = [
    composition.name,
    composition.description,
    composition.primitiveIds.join(' '),
  ].filter(Boolean).join(' ');
  const tokens = tokenize(source)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  return uniqueInOrder(tokens);
}

export function getCompositionKeywords(composition: TechniqueComposition): string[] {
  const curated = COMPOSITION_KEYWORDS[composition.id] ?? [];
  const derived = deriveKeywords(composition);
  return uniqueInOrder([...curated, ...derived]);
}

function matchKeywords(
  normalizedIntent: string,
  intentTokens: Set<string>,
  keywords: string[]
): string[] {
  const matches: string[] = [];
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) continue;
    if (normalizedKeyword.includes(' ')) {
      if (normalizedIntent.includes(normalizedKeyword)) {
        matches.push(keyword);
      }
      continue;
    }
    if (intentTokens.has(normalizedKeyword)) {
      matches.push(keyword);
    }
  }
  return matches;
}

export function matchCompositionKeywords(intent: string, composition: TechniqueComposition): string[] {
  const normalizedIntent = normalizeText(intent);
  if (!normalizedIntent) return [];
  const intentTokens = new Set(tokenize(normalizedIntent));
  return matchKeywords(normalizedIntent, intentTokens, getCompositionKeywords(composition));
}

export function selectTechniqueCompositionsByKeyword(
  intent: string,
  compositions: TechniqueComposition[]
): TechniqueComposition[] {
  const normalizedIntent = normalizeText(intent);
  if (!normalizedIntent) return [];
  const intentTokens = new Set(tokenize(normalizedIntent));
  return compositions.filter((composition) => {
    const keywords = getCompositionKeywords(composition);
    return matchKeywords(normalizedIntent, intentTokens, keywords).length > 0;
  });
}
