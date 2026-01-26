/**
 * @fileoverview Citation accuracy scoring for eval harness.
 */

export interface EvidenceLocation {
  startLine: number;
  endLine?: number;
}

export interface CitationEvidenceRef {
  refId: string;
  path?: string;
  location?: EvidenceLocation;
}

export type CitationInput =
  | string
  | {
    refId?: string;
    file?: string;
    line?: number;
    endLine?: number;
  };

export interface CitationAccuracyInput {
  citations?: CitationInput[];
  evidenceRefs: CitationEvidenceRef[];
}

export interface CitationAccuracyResult {
  accuracy: number;
  validCitations: number;
  totalCitations: number;
  invalidCitations: string[];
}

interface ParsedCitation {
  raw: string;
  path?: string;
  line?: number;
  endLine?: number;
}

export function computeCitationAccuracy(
  input: CitationAccuracyInput
): CitationAccuracyResult {
  const citations = (input.citations ?? []).filter((citation) => {
    if (typeof citation === 'string') {
      return citation.trim().length > 0;
    }
    if (!citation) return false;
    return Boolean(citation.refId || citation.file);
  });

  const totalCitations = citations.length;
  if (totalCitations === 0) {
    return {
      accuracy: 0,
      validCitations: 0,
      totalCitations: 0,
      invalidCitations: [],
    };
  }

  const refIdSet = new Set(input.evidenceRefs.map((ref) => ref.refId));
  const evidenceByPath = buildEvidenceByPath(input.evidenceRefs);

  let validCitations = 0;
  const invalidCitations: string[] = [];

  for (const citation of citations) {
    const isValid = isCitationValid(citation, refIdSet, evidenceByPath);
    if (isValid) {
      validCitations += 1;
    } else {
      invalidCitations.push(typeof citation === 'string' ? citation : JSON.stringify(citation));
    }
  }

  return {
    accuracy: validCitations / totalCitations,
    validCitations,
    totalCitations,
    invalidCitations,
  };
}

function isCitationValid(
  citation: CitationInput,
  refIdSet: Set<string>,
  evidenceByPath: Map<string, CitationEvidenceRef[]>
): boolean {
  if (typeof citation === 'string') {
    const trimmed = citation.trim();
    if (!trimmed) return false;
    if (refIdSet.has(trimmed)) return true;

    const parsed = parseCitationString(trimmed);
    if (!parsed.path) return false;
    return matchesEvidence(parsed, evidenceByPath);
  }

  if (!citation) return false;
  if (citation.refId && refIdSet.has(citation.refId)) return true;

  const file = citation.file?.trim();
  if (!file) return false;

  return matchesEvidence(
    {
      raw: file,
      path: file,
      line: citation.line,
      endLine: citation.endLine,
    },
    evidenceByPath
  );
}

function matchesEvidence(
  citation: ParsedCitation,
  evidenceByPath: Map<string, CitationEvidenceRef[]>
): boolean {
  const candidates = findEvidenceCandidates(citation.path ?? '', evidenceByPath);
  if (candidates.length === 0) return false;
  if (!citation.line) return true;

  for (const candidate of candidates) {
    const location = candidate.location;
    if (!location?.startLine) return true;
    const citeStart = citation.line;
    const citeEnd = citation.endLine ?? citation.line;
    const evidenceStart = location.startLine;
    const evidenceEnd = location.endLine ?? location.startLine;
    if (rangesOverlap(citeStart, citeEnd, evidenceStart, evidenceEnd)) {
      return true;
    }
  }

  return false;
}

function buildEvidenceByPath(
  evidenceRefs: CitationEvidenceRef[]
): Map<string, CitationEvidenceRef[]> {
  const map = new Map<string, CitationEvidenceRef[]>();

  for (const ref of evidenceRefs) {
    if (!ref.path) continue;
    const normalized = normalizePath(ref.path);
    const bucket = map.get(normalized);
    if (bucket) {
      bucket.push(ref);
    } else {
      map.set(normalized, [ref]);
    }
  }

  return map;
}

function findEvidenceCandidates(
  path: string,
  evidenceByPath: Map<string, CitationEvidenceRef[]>
): CitationEvidenceRef[] {
  const normalized = normalizePath(path);
  const direct = evidenceByPath.get(normalized);
  if (direct) return direct;

  const candidates: CitationEvidenceRef[] = [];
  for (const [key, refs] of evidenceByPath.entries()) {
    if (normalized.endsWith(key) || key.endsWith(normalized)) {
      candidates.push(...refs);
    }
  }

  return candidates;
}

function parseCitationString(value: string): ParsedCitation {
  const raw = value.trim();
  if (!raw) return { raw };

  const hashMatch = raw.match(/^(.*)#L(\d+)(?:-L?(\d+))?$/);
  if (hashMatch) {
    return {
      raw,
      path: hashMatch[1].trim(),
      line: parseLine(hashMatch[2]),
      endLine: parseLine(hashMatch[3]),
    };
  }

  const rangeMatch = raw.match(/^(.*):(\d+)-(\d+)$/);
  if (rangeMatch) {
    return {
      raw,
      path: rangeMatch[1].trim(),
      line: parseLine(rangeMatch[2]),
      endLine: parseLine(rangeMatch[3]),
    };
  }

  const lineColumnMatch = raw.match(/^(.*):(\d+):(\d+)$/);
  if (lineColumnMatch) {
    return {
      raw,
      path: lineColumnMatch[1].trim(),
      line: parseLine(lineColumnMatch[2]),
    };
  }

  const lineMatch = raw.match(/^(.*):(\d+)$/);
  if (lineMatch) {
    return {
      raw,
      path: lineMatch[1].trim(),
      line: parseLine(lineMatch[2]),
    };
  }

  return {
    raw,
    path: raw,
  };
}

function parseLine(value?: string): number | undefined {
  if (!value) return undefined;
  const line = Number.parseInt(value, 10);
  return Number.isFinite(line) && line > 0 ? line : undefined;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA <= endB && endA >= startB;
}
