import * as path from 'node:path';
import { resolveDbPath } from '../db_path.js';
import { createSqliteStorage } from '../../storage/sqlite_storage.js';
import { isBootstrapRequired, getBootstrapStatus } from '../../api/bootstrap.js';
import { getIndexState } from '../../state/index_state.js';
import { getWatchState } from '../../state/watch_state.js';
import { deriveWatchHealth } from '../../state/watch_health.js';
import { checkAllProviders } from '../../api/provider_check.js';
import { LIBRARIAN_VERSION } from '../../index.js';
import { printKeyValue, formatTimestamp, formatBytes, formatDuration } from '../progress.js';
import { safeJsonParse } from '../../utils/safe_json.js';

export interface StatusCommandOptions {
  workspace: string;
  verbose?: boolean;
}

export async function statusCommand(options: StatusCommandOptions): Promise<void> {
  const { workspace, verbose } = options;

  console.log('Librarian Status');
  console.log('================\n');

  console.log('Version Information:');
  printKeyValue([{ key: 'CLI Version', value: LIBRARIAN_VERSION.string }, { key: 'Workspace', value: workspace }]);
  console.log();

  let storage;
  try {
    const dbPath = await resolveDbPath(workspace);
    storage = createSqliteStorage(dbPath, workspace);
    await storage.initialize();
  } catch (error) {
    console.log('Storage Status:');
    printKeyValue([
      { key: 'Status', value: 'Not Initialized' },
      { key: 'Reason', value: error instanceof Error ? error.message : 'Unknown error' },
    ]);
    console.log();
    console.log('Run `librarian bootstrap` to initialize the knowledge index.');
    return;
  }

  try {
    const [mvpBootstrapCheck, fullBootstrapCheck, lastBootstrap, indexState, metadata] = await Promise.all([
      isBootstrapRequired(workspace, storage, { targetQualityTier: 'mvp' }),
      isBootstrapRequired(workspace, storage, { targetQualityTier: 'full' }),
      storage.getLastBootstrapReport(),
      getIndexState(storage),
      storage.getMetadata(),
    ]);
    const bootstrapState = getBootstrapStatus(workspace);

    console.log('Bootstrap Status:');
    printKeyValue([{ key: 'Required (fast/mvp)', value: mvpBootstrapCheck.required }, { key: 'Reason (fast/mvp)', value: mvpBootstrapCheck.reason }, { key: 'Required (full)', value: fullBootstrapCheck.required }, { key: 'Reason (full)', value: fullBootstrapCheck.reason }]);
    if (lastBootstrap) {
      const durationMs = lastBootstrap.completedAt
        ? lastBootstrap.completedAt.getTime() - lastBootstrap.startedAt.getTime()
        : null;
      printKeyValue([
        { key: 'Last Run', value: lastBootstrap.success ? 'success' : 'failed' },
        { key: 'Last Started', value: formatTimestamp(lastBootstrap.startedAt) },
        { key: 'Last Completed', value: formatTimestamp(lastBootstrap.completedAt) },
        { key: 'Last Duration', value: durationMs === null ? 'Unknown' : formatDuration(durationMs) },
      ]);
      if (!lastBootstrap.success && lastBootstrap.error) {
        printKeyValue([{ key: 'Last Error', value: lastBootstrap.error }]);
      }
    } else {
      printKeyValue([{ key: 'Last Run', value: 'Never' }]);
    }

    if (bootstrapState.status !== 'not_started') {
      console.log('\nCurrent Run:');
      printKeyValue([
        { key: 'Status', value: bootstrapState.status },
        { key: 'Current Phase', value: bootstrapState.currentPhase?.name || 'None' },
        { key: 'Progress', value: `${Math.round(bootstrapState.progress * 100)}%` },
        { key: 'Started At', value: formatTimestamp(bootstrapState.startedAt) },
        { key: 'Completed At', value: formatTimestamp(bootstrapState.completedAt) },
      ]);
    }
    console.log();

    console.log('Index Status:');
    printKeyValue([
      { key: 'Phase', value: indexState.phase },
      { key: 'Last Full Index', value: formatTimestamp(indexState.lastFullIndex || null) },
    ]);
    if (indexState.progress) {
      printKeyValue([
        { key: 'Progress', value: `${indexState.progress.completed}/${indexState.progress.total}` },
      ]);
    }
    console.log();

    const watchState = await getWatchState(storage);
    console.log('Watch Status:');
    if (watchState) {
      const health = deriveWatchHealth(watchState);
      printKeyValue([
        { key: 'Watch Started', value: formatTimestamp(watchState.watch_started_at ?? null) },
        { key: 'Last Heartbeat', value: formatTimestamp(watchState.watch_last_heartbeat_at ?? null) },
        { key: 'Last Event', value: formatTimestamp(watchState.watch_last_event_at ?? null) },
        { key: 'Last Reindex OK', value: formatTimestamp(watchState.watch_last_reindex_ok_at ?? null) },
        { key: 'Suspected Dead', value: watchState.suspected_dead ?? false },
        { key: 'Needs Catch-up', value: watchState.needs_catchup ?? false },
        { key: 'Storage Attached', value: watchState.storage_attached ?? false },
      ]);
      if (health) {
        printKeyValue([
          { key: 'Derived Suspected Dead', value: health.suspectedDead },
          { key: 'Heartbeat Age (ms)', value: health.heartbeatAgeMs ?? 'unknown' },
          { key: 'Event Age (ms)', value: health.eventAgeMs ?? 'unknown' },
          { key: 'Reindex Age (ms)', value: health.reindexAgeMs ?? 'unknown' },
          { key: 'Staleness Window (ms)', value: health.stalenessMs ?? 'unknown' },
        ]);
      }
      if (watchState.effective_config) {
        printKeyValue([
          { key: 'Watch Debounce (ms)', value: watchState.effective_config.debounceMs ?? 'unknown' },
          { key: 'Cascade Enabled', value: watchState.effective_config.cascadeReindex ?? false },
          { key: 'Cascade Delay (ms)', value: watchState.effective_config.cascadeDelayMs ?? 'unknown' },
          { key: 'Cascade Batch Size', value: watchState.effective_config.cascadeBatchSize ?? 'unknown' },
          { key: 'Watch Excludes', value: (watchState.effective_config.excludes ?? []).join(', ') || 'none' },
        ]);
      }
    } else {
      printKeyValue([{ key: 'Watch Status', value: 'No watch state recorded' }]);
    }
    console.log();

    const stats = await storage.getStats();
    console.log('Index Statistics:');
    printKeyValue([
      { key: 'Total Functions', value: stats.totalFunctions },
      { key: 'Total Modules', value: stats.totalModules },
      { key: 'Total Context Packs', value: stats.totalContextPacks },
      { key: 'Total Embeddings', value: stats.totalEmbeddings },
      { key: 'Storage Size', value: formatBytes(stats.storageSizeBytes) },
      { key: 'Average Confidence', value: stats.averageConfidence.toFixed(3) },
      { key: 'Cache Hit Rate', value: `${(stats.cacheHitRate * 100).toFixed(1)}%` },
    ]);
    console.log();

    if (metadata) {
      console.log('Metadata:');
      printKeyValue([{ key: 'Version', value: metadata.version.string }, { key: 'Quality Tier', value: metadata.qualityTier }, { key: 'Last Bootstrap', value: formatTimestamp(metadata.lastBootstrap) }, { key: 'Last Indexing', value: formatTimestamp(metadata.lastIndexing) }, { key: 'Total Files', value: metadata.totalFiles }]);
      console.log();
    }

    console.log('Provider Status:');
    try {
      const rawDefaults = await storage.getState('librarian.llm_defaults.v1');
      const parsedDefaults = rawDefaults ? safeJsonParse<Record<string, unknown>>(rawDefaults) : null;
      const storedProvider = parsedDefaults?.ok ? parsedDefaults.value.provider : null;
      const storedModel = parsedDefaults?.ok ? parsedDefaults.value.modelId : null;
      if ((storedProvider === 'claude' || storedProvider === 'codex') && typeof storedModel === 'string' && storedModel.trim()) {
        printKeyValue([{ key: 'Stored LLM Provider', value: storedProvider }, { key: 'Stored LLM Model', value: storedModel.trim() }]);
        if (!process.env.LIBRARIAN_LLM_PROVIDER) process.env.LIBRARIAN_LLM_PROVIDER = storedProvider;
        if (!process.env.LIBRARIAN_LLM_MODEL) process.env.LIBRARIAN_LLM_MODEL = storedModel.trim();
      } else {
        printKeyValue([{ key: 'Stored LLM Defaults', value: 'None' }]);
      }
      const providers = await checkAllProviders({ workspaceRoot: workspace });
      printKeyValue([
        { key: 'LLM Available', value: providers.llm.available },
        { key: 'LLM Provider', value: providers.llm.provider },
        { key: 'LLM Model', value: providers.llm.model },
        { key: 'Embedding Available', value: providers.embedding.available },
        { key: 'Embedding Provider', value: providers.embedding.provider },
      ]);
      if (!providers.llm.available || !providers.embedding.available) {
        console.log('\nRun `librarian check-providers` for detailed diagnostics.');
      }
    } catch {
      printKeyValue([
        { key: 'Status', value: 'Unable to check providers' },
      ]);
    }
    console.log();

    if (verbose) {
      const packs = await storage.getContextPacks({ limit: 5, orderBy: 'accessCount', orderDirection: 'desc' });
      if (packs.length > 0) {
        console.log('Most Accessed Context Packs:');
        for (const pack of packs) {
          console.log(`  - ${pack.packType}: ${pack.targetId} (accessed ${pack.accessCount} times, confidence ${pack.confidence.toFixed(2)})`);
        }
        console.log();
      }

      const functions = await storage.getFunctions({ limit: 5, orderBy: 'confidence', orderDirection: 'desc' });
      if (functions.length > 0) {
        console.log('High Confidence Functions:');
        for (const fn of functions) {
          console.log(`  - ${fn.name} in ${fn.filePath} (confidence ${fn.confidence.toFixed(2)})`);
        }
        console.log();
      }
    }

  } finally {
    await storage.close();
  }
}
