import { parseArgs } from 'node:util';
import * as path from 'node:path';
import { resolveDbPath } from '../db_path.js';
import { createSqliteStorage } from '../../storage/sqlite_storage.js';
import { queryLibrarian } from '../../api/query.js';
import { isBootstrapRequired } from '../../api/bootstrap.js';
import type { LibrarianQuery } from '../../types.js';
import { createError, suggestSimilarQueries } from '../errors.js';
import { createSpinner, formatDuration, printKeyValue } from '../progress.js';
import { safeJsonParse } from '../../utils/safe_json.js';

export interface QueryCommandOptions {
  workspace: string;
  args: string[];
  rawArgs: string[];
}

export async function queryCommand(options: QueryCommandOptions): Promise<void> {
  const { workspace, rawArgs } = options;

  // Parse command-specific options
  const { values, positionals } = parseArgs({
    args: rawArgs.slice(1), // Skip 'query' command
    options: {
      depth: { type: 'string', default: 'L1' },
      files: { type: 'string' },
      timeout: { type: 'string', default: '0' },
      json: { type: 'boolean', default: false },
      'no-synthesis': { type: 'boolean', default: false },
      'llm-provider': { type: 'string' },
      'llm-model': { type: 'string' },
      uc: { type: 'string' },
      'uc-priority': { type: 'string' },
      'uc-evidence': { type: 'string' },
      'uc-freshness-days': { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  });

  const intent = positionals.join(' ');
  if (!intent) {
    throw createError('INVALID_ARGUMENT', 'Query intent is required. Usage: librarian query "<intent>"');
  }

  const depth = validateDepth(values.depth as string);
  const affectedFiles = values.files
    ? (values.files as string).split(',').map((entry) => {
      const raw = entry.trim();
      return raw ? (path.isAbsolute(raw) ? raw : path.resolve(workspace, raw)) : '';
    }).filter(Boolean)
    : undefined;
  const timeoutMs = parseInt(values.timeout as string, 10);
  if (timeoutMs > 0) {
    throw createError('INVALID_ARGUMENT', 'Timeouts are not allowed for librarian queries');
  }
  const outputJson = values.json as boolean;
  const noSynthesis = values['no-synthesis'] as boolean;
  const requestedLlmProviderRaw = typeof values['llm-provider'] === 'string' ? values['llm-provider'].trim() : '';
  const requestedLlmProvider = (requestedLlmProviderRaw === 'claude' || requestedLlmProviderRaw === 'codex') ? requestedLlmProviderRaw : undefined;
  const requestedLlmModel = typeof values['llm-model'] === 'string' ? values['llm-model'].trim() : undefined;
  const ucRaw = typeof values.uc === 'string' ? values.uc : '';
  const ucIds = ucRaw ? ucRaw.split(',').map((id) => id.trim()).filter(Boolean) : undefined;
  const ucPriority = typeof values['uc-priority'] === 'string' ? values['uc-priority'] : undefined;
  const ucEvidence = typeof values['uc-evidence'] === 'string' ? Number.parseFloat(values['uc-evidence']) : undefined;
  const ucFreshnessDays = typeof values['uc-freshness-days'] === 'string'
    ? Number.parseInt(values['uc-freshness-days'], 10)
    : undefined;
  // Initialize storage
  const dbPath = await resolveDbPath(workspace);
  const storage = createSqliteStorage(dbPath, workspace);
  await storage.initialize();
  try {
    // Check if bootstrapped
    const bootstrapCheck = await isBootstrapRequired(workspace, storage);
    if (bootstrapCheck.required) {
      throw createError('NOT_BOOTSTRAPPED', bootstrapCheck.reason);
    }
    const spinner = createSpinner(`Querying: "${intent.substring(0, 50)}${intent.length > 50 ? '...' : ''}"`);
    let resolvedProvider = requestedLlmProvider;
    let resolvedModel = requestedLlmModel;
    if (!resolvedProvider && resolvedModel) {
      if (resolvedModel.startsWith('claude-')) resolvedProvider = 'claude';
      else if (resolvedModel.startsWith('gpt-')) resolvedProvider = 'codex';
    }
    if (!resolvedProvider && !resolvedModel) {
      const rawDefaults = await storage.getState('librarian.llm_defaults.v1');
      const parsed = rawDefaults ? safeJsonParse<Record<string, unknown>>(rawDefaults) : null;
      const provider = parsed?.ok ? parsed.value.provider : null;
      const modelId = parsed?.ok ? parsed.value.modelId : null;
      if ((provider === 'claude' || provider === 'codex') && typeof modelId === 'string' && modelId.trim()) {
        resolvedProvider = provider;
        resolvedModel = modelId.trim();
      }
    }
    if (!resolvedProvider) resolvedProvider = 'codex';
    if (!resolvedModel) resolvedModel = resolvedProvider === 'codex' ? 'gpt-5.1-codex-mini' : 'claude-haiku-4-5-20241022';
    process.env.LIBRARIAN_LLM_PROVIDER = resolvedProvider;
    process.env.LIBRARIAN_LLM_MODEL = resolvedModel;
    const query: LibrarianQuery = {
      intent,
      depth,
      affectedFiles,
      ucRequirements: ucIds ? {
        ucIds,
        priority: (ucPriority === 'low' || ucPriority === 'medium' || ucPriority === 'high') ? ucPriority : undefined,
        evidenceThreshold: Number.isFinite(ucEvidence ?? NaN) ? ucEvidence : undefined,
        freshnessMaxDays: Number.isFinite(ucFreshnessDays ?? NaN) ? ucFreshnessDays : undefined,
      } : undefined,
      llmRequirement: noSynthesis ? 'disabled' : undefined,
    };
    try {
      const startTime = Date.now();
      const response = await queryLibrarian(query, storage);
      const elapsed = Date.now() - startTime;

      spinner.succeed(`Query completed in ${formatDuration(elapsed)}`);

      if (outputJson) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      console.log('\nQuery Results:');
      console.log('==============\n');

      printKeyValue([
        { key: 'Intent', value: intent },
        { key: 'Depth', value: depth },
        { key: 'Affected Files', value: affectedFiles?.join(', ') || 'None specified' },
        { key: 'UC Requirements', value: ucIds?.join(', ') || 'None specified' },
        { key: 'Total Confidence', value: response.totalConfidence.toFixed(3) },
        { key: 'Cache Hit', value: response.cacheHit },
        { key: 'Latency', value: `${response.latencyMs}ms` },
        { key: 'Packs Found', value: response.packs.length },
      ]);
      console.log();

      if (response.explanation) {
        console.log('Explanation:');
        console.log(`  ${response.explanation}`);
        console.log();
      }

      if (response.packs.length > 0) {
        console.log('Context Packs:');
        for (const pack of response.packs) {
          console.log(`\n  [${pack.packType}] ${pack.targetId}`);
          console.log(`  Confidence: ${pack.confidence.toFixed(3)}${pack.calibratedConfidence ? ` (calibrated: ${pack.calibratedConfidence.toFixed(3)})` : ''}`);
          console.log(`  Summary: ${pack.summary.substring(0, 100)}${pack.summary.length > 100 ? '...' : ''}`);
          if (pack.keyFacts.length > 0) {
            console.log('  Key Facts:');
            for (const fact of pack.keyFacts.slice(0, 3)) {
              console.log(`    - ${fact}`);
            }
          }
          if (pack.relatedFiles.length > 0) {
            console.log(`  Related Files: ${pack.relatedFiles.slice(0, 3).join(', ')}${pack.relatedFiles.length > 3 ? '...' : ''}`);
          }
        }
        console.log();
      } else {
        console.log('No context packs found for this query.\n');
        const suggestions = suggestSimilarQueries(intent, []);
        if (suggestions.length > 0) {
          console.log('Try these alternative queries:');
          for (const suggestion of suggestions) {
            console.log(`  - ${suggestion}`);
          }
          console.log();
        }
      }

      if (response.coverageGaps && response.coverageGaps.length > 0) {
        console.log('Coverage Gaps:');
        for (const gap of response.coverageGaps) {
          console.log(`  - ${gap}`);
        }
        console.log();
      }

      if (response.methodHints && response.methodHints.length > 0) {
        console.log('Method Hints:');
        for (const hint of response.methodHints) {
          console.log(`  - ${hint}`);
        }
        console.log();
      }

      if (response.drillDownHints.length > 0) {
        console.log('Drill-Down Hints:');
        for (const hint of response.drillDownHints) {
          console.log(`  - ${hint}`);
        }
        console.log();
      }

      if (response.calibration) {
        console.log('Calibration Info:');
        printKeyValue([
          { key: 'Buckets', value: response.calibration.bucketCount },
          { key: 'Samples', value: response.calibration.sampleCount },
          { key: 'Expected Error', value: response.calibration.expectedCalibrationError.toFixed(4) },
        ]);
        console.log();
      }

      if (response.uncertainty) {
        console.log('Uncertainty Metrics:');
        printKeyValue([
          { key: 'Confidence', value: response.uncertainty.confidence.toFixed(3) },
          { key: 'Entropy', value: response.uncertainty.entropy.toFixed(3) },
          { key: 'Variance', value: response.uncertainty.variance.toFixed(3) },
        ]);
      }

    } catch (error) {
      spinner.fail('Query failed');
      throw error;
    }

  } finally {
    await storage.close();
  }
}

function validateDepth(depth: string): 'L0' | 'L1' | 'L2' | 'L3' {
  const normalized = depth.toUpperCase();
  if (normalized === 'L0' || normalized === 'L1' || normalized === 'L2' || normalized === 'L3') {
    return normalized;
  }
  throw createError('INVALID_ARGUMENT', `Invalid depth: ${depth}. Must be L0, L1, L2, or L3.`);
}
