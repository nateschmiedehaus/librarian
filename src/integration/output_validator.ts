import { AGENT_PROTOCOL_BEGIN, AGENT_PROTOCOL_END, AGENT_PROTOCOL_VERSION, type AgentKnowledgeUsage } from './agent_protocol.js';
import { noResult } from '../api/empty_values.js';
import { safeJsonParse } from '../utils/safe_json.js';

export type OutputValidationResult = { ok: boolean; errors: string[]; warnings: string[]; usage?: AgentKnowledgeUsage };

const MAX_PROTOCOL_CHARS = 40_000;

type UnknownRecord = Record<string, unknown>;

const stripFence = (text: string): string => {
  const trimmed = String(text ?? '').trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
};

const extractProtocolBlock = (output: string): string | null => {
  const start = output.indexOf(AGENT_PROTOCOL_BEGIN);
  if (start === -1) return noResult();
  const end = output.indexOf(AGENT_PROTOCOL_END, start + AGENT_PROTOCOL_BEGIN.length);
  const slice = (end === -1 ? output.slice(start + AGENT_PROTOCOL_BEGIN.length) : output.slice(start + AGENT_PROTOCOL_BEGIN.length, end)).trim();
  if (!slice) return noResult();
  if (slice.length > MAX_PROTOCOL_CHARS) throw new Error('protocol_json_too_large');
  return stripFence(slice);
};

const normalizeCoverage = (value: unknown): number | null => {
  const num = Number(value);
  if (!Number.isFinite(num)) return noResult();
  return num > 1 ? Math.min(num / 100, 1) : Math.max(0, num);
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function hasArrayField(record: UnknownRecord, key: string): boolean {
  return Array.isArray(record[key]);
}

function getCompliance(record: UnknownRecord): UnknownRecord | null {
  const compliance = record.compliance;
  return isRecord(compliance) ? compliance : noResult();
}

function isAgentKnowledgeUsage(value: unknown): value is AgentKnowledgeUsage {
  if (!isRecord(value)) return false;
  const record = value;
  const required = ['citedEvidence', 'inferences', 'gapsEncountered', 'directReads', 'queriesMade'];
  for (const key of required) {
    if (!hasArrayField(record, key)) return false;
  }

  const compliance = getCompliance(record);
  if (!compliance) return false;
  if (!Array.isArray(compliance.prohibitedActionsAttempted)) return false;
  if (typeof compliance.evidenceCoverage !== 'number') return false;
  if (typeof compliance.gapsAcknowledged !== 'boolean') return false;
  return true;
}

export function validateAgentOutput(outputText?: string): OutputValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!outputText) return { ok: false, errors: ['missing_output'], warnings };

  let parsed: unknown;
  const payload = extractProtocolBlock(String(outputText));
  if (!payload) return { ok: false, errors: ['missing_protocol_block'], warnings };
  const parsedResult = safeJsonParse<unknown>(payload);
  if (!parsedResult.ok) return { ok: false, errors: ['invalid_protocol_json'], warnings };
  parsed = parsedResult.value;

  if (!isRecord(parsed)) return { ok: false, errors: ['protocol_not_object'], warnings };

  const required = ['citedEvidence', 'inferences', 'gapsEncountered', 'directReads', 'queriesMade'];
  for (const key of required) {
    if (!hasArrayField(parsed, key)) errors.push(`missing_${key}`);
  }

  const compliance = getCompliance(parsed);
  if (!compliance) errors.push('missing_compliance');

  const coverage = normalizeCoverage(compliance?.evidenceCoverage);
  if (coverage === null) errors.push('invalid_evidence_coverage');
  else if (coverage < 0.7) errors.push('low_evidence_coverage');

  if (compliance?.gapsAcknowledged !== true) errors.push('gaps_not_acknowledged');

  const prohibited = compliance?.prohibitedActionsAttempted;
  if (!Array.isArray(prohibited)) errors.push('invalid_prohibited_actions');
  else if (prohibited.length > 0) errors.push('prohibited_actions_attempted');

  const protocolVersion = parsed.protocolVersion;
  if (typeof protocolVersion === 'string' && protocolVersion !== AGENT_PROTOCOL_VERSION) {
    warnings.push('protocol_version_mismatch');
  }

  const usage = isAgentKnowledgeUsage(parsed) ? parsed : undefined;
  return { ok: errors.length === 0, errors, warnings, usage };
}
