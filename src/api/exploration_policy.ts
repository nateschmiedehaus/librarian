export interface ExplorationCandidate { id: string; confidence: number; lastVerifiedAt?: string | null; impactScore?: number; }
export interface ExplorationDecision { id: string; score: number; reason: string; }

const STALE_DAYS = 30;

export function scoreExplorationCandidate(candidate: ExplorationCandidate, now: number = Date.now()): ExplorationDecision {
  const confidenceScore = 1 - Math.max(0, Math.min(1, candidate.confidence));
  let score = confidenceScore * 0.6;
  let reason = `low confidence (${candidate.confidence.toFixed(2)})`;
  if (candidate.lastVerifiedAt) {
    const last = Date.parse(candidate.lastVerifiedAt);
    if (!Number.isNaN(last)) {
      const days = (now - last) / (1000 * 60 * 60 * 24);
      if (days > STALE_DAYS) { score += 0.3; reason += `, stale ${Math.floor(days)}d`; }
    }
  } else { score += 0.2; reason += ', never verified'; }
  if (candidate.impactScore !== undefined) { score += Math.min(0.2, Math.max(0, candidate.impactScore)); reason += `, impact ${candidate.impactScore.toFixed(2)}`; }
  return { id: candidate.id, score, reason };
}

export function prioritizeExploration(candidates: ExplorationCandidate[], now: number = Date.now()): ExplorationDecision[] {
  return candidates.map((candidate) => scoreExplorationCandidate(candidate, now)).sort((a, b) => b.score - a.score);
}

export function shouldReanalyze(candidate: ExplorationCandidate, now: number = Date.now()): boolean {
  if (!candidate.lastVerifiedAt) return true;
  const last = Date.parse(candidate.lastVerifiedAt);
  if (Number.isNaN(last)) return true;
  const days = (now - last) / (1000 * 60 * 60 * 24);
  return days > STALE_DAYS;
}
