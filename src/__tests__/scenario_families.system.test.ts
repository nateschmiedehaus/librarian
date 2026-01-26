/**
 * @fileoverview Tier‑2 Scenario Family Harness (SF‑01…SF‑05)
 *
 * Provider‑required system test that executes a minimal scenario family suite
 * and emits AdequacyReport.v1 + TraceReplayReport.v1 audit artifacts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createSqliteStorage } from '../storage/sqlite_storage.js';
import { bootstrapProject } from '../api/bootstrap.js';
import { queryLibrarianWithObserver } from '../api/query.js';
import { requireProviders } from '../api/provider_check.js';
import { createEvidenceLedger, createSessionId, type EvidenceEntry } from '../epistemics/evidence_ledger.js';
import type { LibrarianQuery, LibrarianResponse } from '../types.js';
import type { LibrarianStorage } from '../storage/types.js';

type ScenarioFamily = {
  id: string;
  label: string;
  intent: string;
  depth: LibrarianQuery['depth'];
  taskType?: LibrarianQuery['taskType'];
  llmRequirement?: LibrarianQuery['llmRequirement'];
  affectedFiles?: string[];
  ucIds?: string[];
  disclosures?: string[];
};

type AdequacyReportArtifactV1 = {
  kind: 'AdequacyReport.v1';
  schema_version: 1;
  created_at: string;
  scenario_id: string;
  workspace: string;
  trace_id: string;
  template_id?: string;
  report: LibrarianResponse['adequacy'] | null;
  disclosures: string[];
};

type TraceReplayReportV1 = {
  kind: 'TraceReplayReport.v1';
  schema_version: 1;
  created_at: string;
  scenario_id: string;
  workspace: string;
  trace_id: string;
  session_id: string | null;
  ledger_path?: string;
  entry_count: number;
  entries: Array<{
    id: string;
    timestamp: string;
    kind: string;
    payload: unknown;
    provenance: unknown;
    confidence?: unknown;
    related_entries: string[];
    session_id?: string | null;
  }>;
  disclosures: string[];
};

const FIXTURE_ROOT = path.resolve(__dirname, '../../../../test/fixtures/librarian_usecase');
const AUDIT_ROOT = path.join(FIXTURE_ROOT, 'state', 'audits', 'librarian', 'scenarios');

const SCENARIOS: ScenarioFamily[] = [
  {
    id: 'SF-01',
    label: 'Orientation baseline',
    intent: 'What are the main entry points in this repo?',
    depth: 'L0',
    llmRequirement: 'disabled',
    affectedFiles: ['src/index.js'],
    disclosures: ['unverified_by_trace(skeleton): deterministic baseline on fixture repo'],
  },
  {
    id: 'SF-02',
    label: 'RepoMap at scale',
    intent: 'Summarize the repo structure and key modules.',
    depth: 'L1',
    disclosures: ['unverified_by_trace(skeleton): fixture scale is limited'],
  },
  {
    id: 'SF-03',
    label: 'Multi-repo correlation',
    intent: 'Identify shared patterns across services in this repo.',
    depth: 'L2',
    disclosures: ['unverified_by_trace(skeleton): single-fixture stand-in for multi-repo'],
  },
  {
    id: 'SF-04',
    label: 'EditContext minimality',
    intent: 'What is the minimal context needed to modify authentication?',
    depth: 'L1',
    affectedFiles: ['src/auth/authenticate.js'],
  },
  {
    id: 'SF-05',
    label: 'Change delta and risk',
    intent: 'Assess change risk if we update authentication flow.',
    depth: 'L2',
    affectedFiles: ['src/auth/authenticate.js'],
  },
];

let storage: LibrarianStorage;
let runDir: string;

beforeAll(async () => {
  if (!fsSync.existsSync(FIXTURE_ROOT)) {
    throw new Error(`unverified_by_trace(fixture_missing): ${FIXTURE_ROOT}`);
  }
  await requireProviders({ llm: true, embedding: true }, { workspaceRoot: FIXTURE_ROOT });

  const dbPath = path.join(os.tmpdir(), `librarian-sf-${randomUUID()}.db`);
  storage = createSqliteStorage(dbPath, FIXTURE_ROOT);
  await storage.initialize();

  try {
    await bootstrapProject(
      {
        workspace: FIXTURE_ROOT,
        bootstrapMode: 'fast',
        include: ['**/*'],
        exclude: ['node_modules/**', '.git/**'],
        maxFileSizeBytes: 512_000,
        skipProviderProbe: true,
      },
      storage
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`unverified_by_trace(bootstrap_failed): ${message}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  runDir = path.join(AUDIT_ROOT, timestamp);
  await fs.mkdir(runDir, { recursive: true });
}, 300000);

afterAll(async () => {
  await storage?.close?.();
});

async function runScenarioFamily(scenario: ScenarioFamily): Promise<{
  response: LibrarianResponse;
  adequacyPath: string;
  tracePath: string;
  traceEntries: EvidenceEntry[];
  sessionId: string;
}> {
  const scenarioDir = path.join(runDir, scenario.id);
  await fs.mkdir(scenarioDir, { recursive: true });

  const ledgerPath = path.join(scenarioDir, 'evidence_ledger.sqlite');
  const ledger = createEvidenceLedger(ledgerPath);
  await ledger.initialize();
  const sessionId = createSessionId();

  const query: LibrarianQuery = {
    intent: scenario.intent,
    depth: scenario.depth,
    taskType: scenario.taskType,
    llmRequirement: scenario.llmRequirement,
    affectedFiles: scenario.affectedFiles,
    ucRequirements: scenario.ucIds ? { ucIds: scenario.ucIds } : undefined,
  };

  const response = await queryLibrarianWithObserver(query, storage, {
    traceOptions: { evidenceLedger: ledger, sessionId },
  });

  const entries = await ledger.query({ sessionId, orderDirection: 'asc' });
  await ledger.close();

  const adequacyDisclosures = [
    ...(scenario.disclosures ?? []),
    ...(response.adequacy ? [] : ['unverified_by_trace(adequacy_unavailable)']),
  ];

  const adequacyReport: AdequacyReportArtifactV1 = {
    kind: 'AdequacyReport.v1',
    schema_version: 1,
    created_at: new Date().toISOString(),
    scenario_id: scenario.id,
    workspace: FIXTURE_ROOT,
    trace_id: response.traceId,
    template_id: response.constructionPlan?.templateId,
    report: response.adequacy ?? null,
    disclosures: adequacyDisclosures,
  };
  const adequacyPath = path.join(scenarioDir, 'AdequacyReport.v1.json');
  await fs.writeFile(adequacyPath, JSON.stringify(adequacyReport, null, 2) + '\n', 'utf8');

  const traceDisclosures = [
    ...(scenario.disclosures ?? []),
    ...(entries.length > 0 ? [] : ['unverified_by_trace(replay_unavailable): no ledger entries recorded']),
  ];

  const traceReport: TraceReplayReportV1 = {
    kind: 'TraceReplayReport.v1',
    schema_version: 1,
    created_at: new Date().toISOString(),
    scenario_id: scenario.id,
    workspace: FIXTURE_ROOT,
    trace_id: response.traceId,
    session_id: sessionId,
    ledger_path: ledgerPath,
    entry_count: entries.length,
    entries: entries.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      kind: entry.kind,
      payload: entry.payload,
      provenance: entry.provenance,
      confidence: entry.confidence,
      related_entries: entry.relatedEntries,
      session_id: entry.sessionId ?? null,
    })),
    disclosures: traceDisclosures,
  };
  const tracePath = path.join(scenarioDir, 'TraceReplayReport.v1.json');
  await fs.writeFile(tracePath, JSON.stringify(traceReport, null, 2) + '\n', 'utf8');

  return { response, adequacyPath, tracePath, traceEntries: entries, sessionId };
}

describe('Tier‑2 Scenario Families (SF‑01…SF‑05)', () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.id} ${scenario.label} emits audit artifacts`, async () => {
      const { response, adequacyPath, tracePath, traceEntries, sessionId } = await runScenarioFamily(scenario);

      expect(response.traceId).toBe(sessionId);
      expect(response.constructionPlan?.templateId).toBeTruthy();
      expect(traceEntries.length).toBeGreaterThan(0);

      const adequacyRaw = await fs.readFile(adequacyPath, 'utf8');
      const adequacy = JSON.parse(adequacyRaw) as AdequacyReportArtifactV1;
      expect(adequacy.kind).toBe('AdequacyReport.v1');
      expect(adequacy.scenario_id).toBe(scenario.id);
      expect(adequacy.trace_id).toBe(response.traceId);

      const traceRaw = await fs.readFile(tracePath, 'utf8');
      const trace = JSON.parse(traceRaw) as TraceReplayReportV1;
      expect(trace.kind).toBe('TraceReplayReport.v1');
      expect(trace.scenario_id).toBe(scenario.id);
      expect(trace.trace_id).toBe(response.traceId);
      expect(trace.entry_count).toBeGreaterThan(0);
    });
  }
});
