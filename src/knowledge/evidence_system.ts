import type { Evidence, EvidenceType, Defeater } from './universal_types.js';

export type EvidenceOutcome = 'confirmed' | 'refuted' | 'inconclusive';

export interface EvidenceClaim {
  id: string;
  proposition: string;
  subject?: {
    id: string;
    type?: string;
  };
  polarity?: 'affirmative' | 'negative';
}

export interface EvidenceRecord extends Evidence {
  claimId: string;
  capturedAt: string;
}

export interface EvidenceStore {
  listClaims(): Promise<EvidenceClaim[]>;
  listEvidenceForClaim(claimId: string): Promise<EvidenceRecord[]>;
  updateEvidenceForClaim(claimId: string, evidence: EvidenceRecord[]): Promise<void>;
  updateEvidenceBatch?: (updates: Map<string, EvidenceRecord[]>) => Promise<void>;
}

export interface EvidenceContradiction {
  claimA: EvidenceClaim;
  claimB: EvidenceClaim;
  conflictType: 'direct' | 'indirect' | 'temporal';
  resolution?: 'prefer_newer' | 'prefer_higher_confidence' | 'needs_human';
}

export interface EvidenceValidation {
  supported: boolean;
  activeDefeaters: Defeater[];
  effectiveStrength: number;
  contradictions: EvidenceContradiction[];
}

export interface AgingReport {
  evaluatedAt: string;
  scannedClaims: number;
  updatedEvidence: number;
  skippedEvidence: number;
}

export interface EvidenceAgingConfig {
  decayPerDay: number;
  minConfidence: number;
  maxConfidence: number;
  now?: () => Date;
}

export interface EvidenceWeightConfig {
  minWeight: number;
  maxWeight: number;
  adjustments: Record<EvidenceOutcome, number>;
}

export interface ActiveEvidenceEngineConfig {
  weights?: Partial<Record<EvidenceType, number>>;
  minEvidenceStrength?: number;
  defeaterPenalty?: number;
  aging?: EvidenceAgingConfig;
  weightConfig?: Partial<EvidenceWeightConfig>;
  store?: EvidenceStore;
}

export interface ActiveEvidenceSystem {
  validateEvidence(
    claim: EvidenceClaim,
    evidence: Evidence[],
    defeaters?: Defeater[]
  ): EvidenceValidation;
  updateWeights(evidence: Evidence, outcome: EvidenceOutcome): void;
  applyAging(): Promise<AgingReport>;
  detectContradictions(): Promise<EvidenceContradiction[]>;
}

const DEFAULT_EVIDENCE_WEIGHTS: Record<EvidenceType, number> = {
  test: 0.95,
  code: 0.85,
  commit: 0.75,
  comment: 0.6,
  doc: 0.55,
  usage: 0.7,
  inferred: 0.4,
};

const VALID_EVIDENCE_TYPES: ReadonlySet<EvidenceType> = new Set([
  'test',
  'code',
  'commit',
  'comment',
  'doc',
  'usage',
  'inferred',
]);

const DEFAULT_WEIGHT_CONFIG: EvidenceWeightConfig = {
  minWeight: 0.2,
  maxWeight: 1,
  adjustments: {
    confirmed: 0.05,
    refuted: -0.1,
    inconclusive: -0.02,
  },
};

const DEFAULT_AGING_CONFIG: EvidenceAgingConfig = {
  decayPerDay: 0.02,
  minConfidence: 0.1,
  maxConfidence: 1,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeConfidence(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`unverified_by_trace(evidence_invalid_confidence): ${label}=${value}`);
  }
  return value;
}

function assertRange(value: number, label: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`unverified_by_trace(evidence_invalid_config): ${label}=${value}`);
  }
  return value;
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (24 * 60 * 60 * 1000));
}

function inferPolarity(claim: EvidenceClaim): 'affirmative' | 'negative' | null {
  return claim.polarity ?? null;
}

function claimKey(claim: EvidenceClaim): string {
  const rawSubjectId = claim.subject?.id?.trim() ?? '';
  const subjectId = rawSubjectId
    ? rawSubjectId.normalize('NFC').toLowerCase()
    : '';
  const propositionSource =
    typeof claim.proposition === 'string' ? claim.proposition : '';
  const proposition = propositionSource.trim().normalize('NFC').toLowerCase();
  if (!proposition) {
    throw new Error(
      `unverified_by_trace(evidence_invalid_claim): empty proposition for ${claim.id}`
    );
  }
  return subjectId ? `${subjectId}::${proposition}` : `::${proposition}`;
}

function parseTimestamp(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`unverified_by_trace(evidence_invalid_timestamp): ${value}`);
  }
  return parsed;
}

export class ActiveEvidenceEngine implements ActiveEvidenceSystem {
  private readonly weights: Map<EvidenceType, number>;
  private readonly minEvidenceStrength: number;
  private readonly defeaterPenalty: number;
  private readonly aging: EvidenceAgingConfig;
  private readonly weightConfig: EvidenceWeightConfig;
  private readonly store?: EvidenceStore;

  constructor(config: ActiveEvidenceEngineConfig = {}) {
    this.weights = new Map<EvidenceType, number>();
    const baseWeights = { ...DEFAULT_EVIDENCE_WEIGHTS, ...config.weights };
    for (const [type, value] of Object.entries(baseWeights)) {
      if (!VALID_EVIDENCE_TYPES.has(type as EvidenceType)) {
        throw new Error(
          `unverified_by_trace(evidence_invalid_type): weight:${type}`
        );
      }
      this.weights.set(type as EvidenceType, normalizeConfidence(value, `weight:${type}`));
    }
    this.minEvidenceStrength = assertRange(
      config.minEvidenceStrength ?? 0.55,
      'minEvidenceStrength',
      0,
      1
    );
    this.defeaterPenalty = assertRange(
      config.defeaterPenalty ?? 0.15,
      'defeaterPenalty',
      0,
      1
    );
    this.aging = { ...DEFAULT_AGING_CONFIG, ...config.aging };
    const adjustments = {
      ...DEFAULT_WEIGHT_CONFIG.adjustments,
      ...(config.weightConfig?.adjustments ?? {}),
    };
    this.weightConfig = { ...DEFAULT_WEIGHT_CONFIG, ...config.weightConfig, adjustments };
    this.store = config.store;
  }

  getEvidenceWeights(): Record<EvidenceType, number> {
    const entries: Record<EvidenceType, number> = { ...DEFAULT_EVIDENCE_WEIGHTS };
    for (const [type, value] of this.weights.entries()) {
      entries[type] = value;
    }
    return entries;
  }

  validateEvidence(
    claim: EvidenceClaim,
    evidence: Evidence[],
    defeaters: Defeater[] = []
  ): EvidenceValidation {
    const claimId = typeof claim.id === 'string' ? claim.id.trim() : '';
    const claimProposition =
      typeof claim.proposition === 'string' ? claim.proposition.trim() : '';
    if (!claimId || !claimProposition) {
      throw new Error('unverified_by_trace(evidence_invalid_claim): missing claim data');
    }

    for (const [index, entry] of evidence.entries()) {
      if (!entry || typeof entry !== 'object') {
        throw new Error(
          `unverified_by_trace(evidence_invalid_entry): evidence[${index}]`
        );
      }
      if (typeof entry.type !== 'string' || entry.type.length === 0) {
        throw new Error(
          `unverified_by_trace(evidence_invalid_entry): evidence[${index}].type`
        );
      }
      if (!VALID_EVIDENCE_TYPES.has(entry.type as EvidenceType)) {
        throw new Error(
          `unverified_by_trace(evidence_invalid_type): evidence[${index}].type=${entry.type}`
        );
      }
      if (typeof entry.source !== 'string' || entry.source.trim().length === 0) {
        throw new Error(
          `unverified_by_trace(evidence_invalid_entry): evidence[${index}].source`
        );
      }
      if (typeof entry.description !== 'string' || entry.description.trim().length === 0) {
        throw new Error(
          `unverified_by_trace(evidence_invalid_entry): evidence[${index}].description`
        );
      }
      if (typeof entry.confidence !== 'number') {
        throw new Error(
          `unverified_by_trace(evidence_invalid_confidence): evidence[${index}].confidence`
        );
      }
      normalizeConfidence(entry.confidence, `evidence[${index}].confidence`);
    }

    const activeDefeaters = defeaters.filter((d) => Boolean(d.detected));
    const contradictions = activeDefeaters
      .filter((d) => d.type === 'contradiction')
      .map((d) => ({
        claimA: claim,
        claimB: { id: 'unknown', proposition: d.description },
        conflictType: 'direct' as const,
        resolution: 'needs_human' as const,
      }));

    if (evidence.length === 0) {
      return {
        supported: false,
        activeDefeaters,
        effectiveStrength: 0,
        contradictions,
      };
    }

    const baseStrength = this.computeEvidenceStrength(evidence);
    const penaltyFactor = clamp(
      1 - activeDefeaters.length * this.defeaterPenalty,
      0,
      1
    );
    const effectiveStrength = baseStrength * penaltyFactor;
    const supported =
      effectiveStrength >= this.minEvidenceStrength &&
      activeDefeaters.every((d) => d.type !== 'contradiction');

    return {
      supported,
      activeDefeaters,
      effectiveStrength,
      contradictions,
    };
  }

  updateWeights(evidence: Evidence, outcome: EvidenceOutcome): void {
    if (!(outcome in this.weightConfig.adjustments)) {
      throw new Error(`unverified_by_trace(evidence_invalid_outcome): ${outcome}`);
    }
    if (!VALID_EVIDENCE_TYPES.has(evidence.type)) {
      throw new Error(`unverified_by_trace(evidence_invalid_type): ${evidence.type}`);
    }
    const current = this.getWeight(evidence.type);
    const adjustment = this.weightConfig.adjustments[outcome] ?? 0;
    const delta = adjustment * normalizeConfidence(evidence.confidence, 'evidence');
    const updated = clamp(
      current + delta,
      this.weightConfig.minWeight,
      this.weightConfig.maxWeight
    );
    this.weights.set(evidence.type, updated);
  }

  async applyAging(): Promise<AgingReport> {
    if (!this.store) {
      throw new Error('unverified_by_trace(evidence_store_unavailable): no evidence store configured');
    }

    const now = (this.aging.now ?? (() => new Date()))();
    let claims: EvidenceClaim[];
    try {
      claims = await this.store.listClaims();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`unverified_by_trace(evidence_store_read_failed): ${message}`);
    }
    let updatedEvidence = 0;
    let skippedEvidence = 0;
    const pendingUpdates = new Map<string, EvidenceRecord[]>();

    for (const claim of claims) {
      let records: EvidenceRecord[];
      try {
        records = await this.store.listEvidenceForClaim(claim.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`unverified_by_trace(evidence_store_read_failed): ${message}`);
      }
      if (records.length === 0) {
        continue;
      }
      const updatedRecords = records.map((record) => {
        const original = normalizeConfidence(record.confidence, 'evidence');
        const capturedAt = parseTimestamp(record.capturedAt);
        const days = daysBetween(capturedAt, now);
        const decay = Math.exp(-this.aging.decayPerDay * days);
        const next = clamp(original * decay, this.aging.minConfidence, this.aging.maxConfidence);
        if (next !== original) {
          updatedEvidence += 1;
          return { ...record, confidence: next };
        }
        skippedEvidence += 1;
        return record;
      });
      pendingUpdates.set(claim.id, updatedRecords);
    }

    try {
      if (this.store.updateEvidenceBatch) {
        await this.store.updateEvidenceBatch(pendingUpdates);
      } else {
        for (const [claimId, updates] of pendingUpdates.entries()) {
          await this.store.updateEvidenceForClaim(claimId, updates);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`unverified_by_trace(evidence_store_update_failed): ${message}`);
    }

    return {
      evaluatedAt: now.toISOString(),
      scannedClaims: claims.length,
      updatedEvidence,
      skippedEvidence,
    };
  }

  async detectContradictions(): Promise<EvidenceContradiction[]> {
    if (!this.store) {
      throw new Error('unverified_by_trace(evidence_store_unavailable): no evidence store configured');
    }

    const claims = await this.store.listClaims();
    const grouped = new Map<string, EvidenceClaim[]>();
    for (const claim of claims) {
      try {
        const key = claimKey(claim);
        const existing = grouped.get(key);
        if (existing) {
          existing.push(claim);
        } else {
          grouped.set(key, [claim]);
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('unverified_by_trace(evidence_invalid_claim)')
        ) {
          continue;
        }
        throw error;
      }
    }

    const contradictions: EvidenceContradiction[] = [];
    for (const group of grouped.values()) {
      const affirmatives = group.filter((c) => inferPolarity(c) === 'affirmative');
      const negatives = group.filter((c) => inferPolarity(c) === 'negative');
      if (affirmatives.length && negatives.length) {
        contradictions.push({
          claimA: affirmatives[0],
          claimB: negatives[0],
          conflictType: 'direct',
          resolution: 'needs_human',
        });
      }
    }

    return contradictions;
  }

  private getWeight(type: EvidenceType): number {
    const weight = this.weights.get(type) ?? DEFAULT_EVIDENCE_WEIGHTS[type];
    return normalizeConfidence(weight, `weight:${type}`);
  }

  private computeEvidenceStrength(evidence: Evidence[]): number {
    let totalWeight = 0;
    let totalScore = 0;
    for (const entry of evidence) {
      const weight = this.getWeight(entry.type);
      const confidence = normalizeConfidence(entry.confidence, 'evidence');
      totalWeight += weight;
      totalScore += confidence * weight;
    }
    if (totalWeight === 0) {
      return 0;
    }
    return totalScore / totalWeight;
  }
}
