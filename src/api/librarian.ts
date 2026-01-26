import * as path from 'path';
import * as fs from 'fs/promises';
import type { LibrarianStorage, StorageCapabilities, StorageSlices, UniversalKnowledgeQueryOptions } from '../storage/types.js';
import type {
  LibrarianVersion,
  LibrarianQuery,
  LibrarianResponse,
  ContextPack,
  BootstrapConfig,
  BootstrapReport,
  LibrarianEngineResults,
  EngineConstraintSummary,
  LlmOptional,
  LlmRequired,
  LlmResult,
} from '../types.js';
import type { AgentKnowledgeContext, ContextAssemblyOptions } from './context_assembly.js';
import { createStorageSlices } from '../storage/slices.js';
import { createSqliteStorage } from '../storage/sqlite_storage.js';
import {
  isBootstrapRequired,
  bootstrapProject,
  getBootstrapStatus,
  createBootstrapConfig,
  loadGovernorConfig,
} from './bootstrap.js';
import { detectLibrarianVersion, getCurrentVersion } from './versioning.js';
import { queryLibrarian as executeQuery, assembleContext as assembleContextQuery } from './query.js';
import { generateContextPacks } from './packs.js';
import { EmbeddingService } from './embeddings.js';
import { IndexLibrarian } from '../agents/index_librarian.js';
import { GovernorContext } from './governor_context.js';
import { DEFAULT_GOVERNOR_CONFIG, type GovernorConfig } from './governors.js';
import { Knowledge } from '../knowledge/index.js';
import type { KnowledgeQuery, KnowledgeResult } from '../knowledge/index.js';
import { createKnowledgeGenerator } from '../knowledge/generator.js';
import {
  extractFileKnowledge,
  extractDirectoryKnowledge,
  extractDirectoriesInBatch,
  computeTotalFileCounts,
  type FileExtractionConfig,
  type DirectoryExtractionConfig,
} from '../knowledge/extractors/index.js';
import { KnowledgeSynthesizer } from '../knowledge/synthesizer.js';
import { LibrarianEngineToolkit, type LibrarianAgent } from '../engines/index.js';
import { createIndexStateWriter, getIndexState } from '../state/index_state.js';
import { getWatchState } from '../state/watch_state.js';
import { deriveWatchHealth, type WatchHealth } from '../state/watch_health.js';
import { buildSystemContract, type SystemContract } from './system_contract.js';
import { FileLockManager } from '../integration/file_lock_manager.js';
import { startFileWatcher, stopFileWatcher, type FileWatcherHandle } from '../integration/file_watcher.js';
import { ProviderUnavailableError } from './provider_check.js';
import { getCurrentGitSha } from '../utils/git.js';
import { deriveSelfDiagnosis, type SelfDiagnosis } from './self_diagnosis.js';
import type { VerificationPlan } from '../strategic/verification_plan.js';
import type { Episode } from '../strategic/building_blocks.js';
import { SqliteEvidenceLedger } from '../epistemics/evidence_ledger.js';
import { enableEventLedgerBridge, disableEventLedgerBridge } from '../epistemics/event_ledger_bridge.js';
import {
  listVerificationPlans,
  getVerificationPlan,
  saveVerificationPlan,
  deleteVerificationPlan,
} from '../state/verification_plans.js';
import { listEpisodes, getEpisode, recordEpisode } from '../state/episodes_state.js';
import type { TechniquePrimitive, TechniqueComposition } from '../strategic/techniques.js';
import type { TechniquePackage } from '../strategic/technique_packages.js';
import {
  listTechniquePrimitives,
  getTechniquePrimitive,
  saveTechniquePrimitive,
  deleteTechniquePrimitive,
  listInvalidTechniquePrimitives,
  clearInvalidTechniquePrimitives,
  type InvalidTechniquePrimitiveRecord,
} from '../state/technique_primitives.js';
import { ensureTechniquePrimitives } from './technique_library.js';
import {
  listTechniquePackages,
  getTechniquePackage,
  compileTechniquePackageBundleById,
} from './technique_packages.js';
import {
  listTechniqueCompositions,
  getTechniqueComposition,
  saveTechniqueComposition,
  deleteTechniqueComposition,
} from '../state/technique_compositions.js';
import { ensureTechniqueCompositions } from './technique_compositions.js';
import {
  selectTechniqueCompositionsFromStorage,
  compileTechniqueCompositionTemplateWithGapsFromStorage,
  compileTechniqueCompositionBundleFromStorage,
  compileTechniqueBundlesFromIntent,
  planWorkFromIntent,
  type PlanWorkOptions,
  type PlanWorkResult,
} from './plan_compiler.js';
import type { CompositionSelectionOptions } from './composition_selector.js';
import {
  ClosedLoopLearner,
  type LearnedRecommendations,
  type LearningOutcome,
  type LearningUpdate,
  type LearningQueryContext,
} from './learning_loop.js';
import {
  ContextAssemblySessionManager,
  type ContextSession,
  type FollowUpResponse,
  type DrillDownResponse,
  type ContextSummary,
} from './context_sessions.js';
import {
  globalEventBus,
  createContextPacksInvalidatedEvent,
  createEntityCreatedEvent,
  createEntityUpdatedEvent,
  createUnderstandingInvalidatedEvent,
} from '../events.js';
import { bayesianDelta } from '../knowledge/confidence_updater.js';
import { LibrarianViewsDelegate, type PersonaType } from './librarian_views.js';
import type { PersonaView, GlanceCard } from '../views/persona_views.js';
import type { DiagramRequest, DiagramResult } from '../visualization/mermaid_generator.js';
import type { ASCIIResult } from '../visualization/ascii_diagrams.js';
import type { ActivationSummary } from '../knowledge/defeater_activation.js';
import type { RefactoringRecommendation } from '../recommendations/refactoring_advisor.js';
import { logWarning } from '../telemetry/logger.js';

export interface LibrarianConfig {
  workspace: string;
  dbPath?: string;
  autoBootstrap: boolean;
  /** Start file watcher after bootstrap to keep index updated on code changes */
  autoWatch?: boolean;
  bootstrapConfig?: Partial<BootstrapConfig>;
  // 0 or undefined means no timeout (preferred)
  bootstrapTimeoutMs?: number;
  onProgress?: (phase: string, progress: number, message: string) => void;
  onBootstrapStart?: () => void;
  onBootstrapComplete?: (report: BootstrapReport) => void;

  llmProvider?: 'claude' | 'codex';
  llmModelId?: string;
  embeddingService?: EmbeddingService;
}

export interface LibrarianStatus {
  initialized: boolean;
  bootstrapped: boolean;
  version: LibrarianVersion | null;
  workspace: string;
  stats: {
    totalFunctions: number;
    totalModules: number;
    totalContextPacks: number;
    averageConfidence: number;
  };
  lastBootstrap: Date | null;
  upgradeAvailable: boolean;
}

export interface WatchStatus {
  active: boolean;
  storageAttached: boolean;
  state: Awaited<ReturnType<typeof getWatchState>> | null;
  health?: WatchHealth | null;
}

const DEFAULT_CONFIG: Omit<LibrarianConfig, 'workspace'> = {
  autoBootstrap: true,
  bootstrapTimeoutMs: 0,
};

export class Librarian {
  private config: LibrarianConfig;
  private storage: LibrarianStorage | null = null;
  private indexer: IndexLibrarian | null = null;
  private embeddingService: EmbeddingService | null = null;
  private knowledge: Knowledge | null = null;
  private knowledgeSynthesizer: KnowledgeSynthesizer | null = null;
  private engines: LibrarianEngineToolkit | null = null;
  private viewsDelegate: LibrarianViewsDelegate | null = null;
  private evidenceLedger: SqliteEvidenceLedger | null = null;
  private storageCapabilities: StorageCapabilities | null = null;
  private fileWatcher: FileWatcherHandle | null = null;
  private learner: ClosedLoopLearner | null = null;
  private contextSessions: ContextAssemblySessionManager | null = null;
  private initialized = false;
  private bootstrapped = false;
  private governorConfig: GovernorConfig | null = null;

  constructor(config: LibrarianConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const librarianRoot = path.resolve(this.config.workspace, '.librarian');
    const dbPath = this.config.dbPath
      ? path.resolve(this.config.workspace, this.config.dbPath)
      : path.join(librarianRoot, 'librarian.sqlite');
    const dbPathRel = path.relative(librarianRoot, dbPath);
    if (dbPathRel.startsWith('..') || path.isAbsolute(dbPathRel)) {
      throw new Error('unverified_by_trace(storage_path_escape): dbPath must be within <workspace>/.librarian');
    }

    await fs.mkdir(path.dirname(dbPath), { recursive: true });

    this.governorConfig = await loadGovernorConfig(this.config.workspace);
    if (this.config.embeddingService) {
      this.embeddingService = this.config.embeddingService;
    } else {
      // Use real embedding providers (xenova/sentence-transformers)
      // NOT LLM-generated embeddings (they're hallucinated numbers)
      this.embeddingService = new EmbeddingService({
        maxBatchSize: this.governorConfig?.maxEmbeddingsPerBatch,
      });
    }

    this.storage = createSqliteStorage(dbPath, this.config.workspace);
    await this.storage.initialize();
    try {
      const ledgerPath = path.join(librarianRoot, 'evidence_ledger.db');
      this.evidenceLedger = new SqliteEvidenceLedger(ledgerPath);
      await this.evidenceLedger.initialize();
      enableEventLedgerBridge({ ledger: this.evidenceLedger });
    } catch (error) {
      this.evidenceLedger = null;
      logWarning('Evidence ledger initialization failed; replay unavailable.', {
        context: 'librarian',
        workspace: this.config.workspace,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    try {
      this.storageCapabilities = this.storage.getCapabilities();
      if (!this.storageCapabilities.optional.embeddings) {
        logWarning('Storage lacks embedding support; semantic retrieval is disabled.', {
          context: 'librarian',
          workspace: this.config.workspace,
        });
      }
      if (!this.storageCapabilities.optional.graphMetrics) {
        logWarning('Storage lacks graph metrics; graph expansion is disabled.', {
          context: 'librarian',
          workspace: this.config.workspace,
        });
      }
      if (!this.storageCapabilities.optional.multiVectors) {
        logWarning('Storage lacks multi-vector support; multi-vector scoring is disabled.', {
          context: 'librarian',
          workspace: this.config.workspace,
        });
      }
    } catch (error) {
      logWarning('Storage capability detection failed; defaulting to optimistic feature flags.', {
        context: 'librarian',
        workspace: this.config.workspace,
        error: error instanceof Error ? error.message : String(error),
      });
      this.storageCapabilities = null;
    }
    this.knowledge = new Knowledge(this.storage);
    this.knowledgeSynthesizer = new KnowledgeSynthesizer(this.storage, {
      llmProvider: this.config.llmProvider,
      llmModelId: this.config.llmModelId,
      workspaceRoot: this.config.workspace,
    });
    this.engines = new LibrarianEngineToolkit({
      storage: this.storage,
      workspaceRoot: this.config.workspace,
      embeddingService: this.embeddingService ?? undefined,
      reindex: async (scope) => this.reindexFiles(scope),
    });
    this.viewsDelegate = new LibrarianViewsDelegate({
      storage: this.storage,
      workspaceRoot: this.config.workspace,
    });

    this.indexer = new IndexLibrarian({
      embeddingBatchSize: this.governorConfig?.maxEmbeddingsPerBatch,
      llmProvider: this.config.llmProvider,
      llmModelId: this.config.llmModelId,
      // Real embedding providers (xenova/sentence-transformers) - configured automatically
      embeddingService: this.embeddingService ?? undefined,
      governorReportWorkspace: this.config.workspace,
      workspaceRoot: this.config.workspace,
      computeGraphMetrics: true,
    });
    await this.indexer.initialize(this.storage);

    this.initialized = true;

    // Check bootstrap status regardless of autoBootstrap setting
    const { required, reason } = await isBootstrapRequired(this.config.workspace, this.storage);

    if (required && this.config.autoBootstrap) {
      // Auto-bootstrap is enabled and bootstrap is required
      this.config.onProgress?.('bootstrap', 0, `Bootstrap required: ${reason}`);
      this.config.onBootstrapStart?.();

      const bootstrapConfig = createBootstrapConfig(this.config.workspace, {
        ...this.config.bootstrapConfig,
        timeoutMs: this.config.bootstrapTimeoutMs,
        llmProvider: this.config.llmProvider,
        llmModelId: this.config.llmModelId,
        // Real embedding providers (xenova/sentence-transformers) - configured automatically
        embeddingService: this.embeddingService ?? undefined,
        progressCallback: (phase, progress) => { this.config.onProgress?.(phase.name, progress, phase.description); },
      });

      const report = await bootstrapProject(bootstrapConfig, this.storage);
      this.bootstrapped = report.success;

      this.config.onBootstrapComplete?.(report);

      if (!report.success) {
        const lastPhase = report.phases.at(-1)?.phase.name;
        throw new Error(`Bootstrap failed${lastPhase ? ` at ${lastPhase}` : ''}: ${report.error ?? 'unknown error'}`);
      }

      // Start file watcher if autoWatch is enabled
      if (this.config.autoWatch && report.success) {
        this.startWatching();
      }
    } else if (!required) {
      // Bootstrap is not required - existing data is valid
      this.bootstrapped = true;
      // Start file watcher if autoWatch is enabled (existing bootstrap)
      if (this.config.autoWatch) {
        this.startWatching();
      }
    }
    // If required but autoBootstrap is false, bootstrapped remains false
    // The caller should check isBootstrapRequired() and handle accordingly
  }

  /**
   * Start watching for file changes to keep index up to date.
   * Called automatically if autoWatch is enabled, or can be called manually.
   */
  startWatching(): void {
    if (this.fileWatcher) return; // Already watching
    if (!this.storage) return;

    this.fileWatcher = startFileWatcher({
      workspaceRoot: this.config.workspace,
      librarian: this,
      storage: this.storage,
    });
  }

  /**
   * Stop watching for file changes.
   */
  async stopWatching(): Promise<void> {
    if (!this.fileWatcher) return;
    await stopFileWatcher(this.config.workspace);
    this.fileWatcher = null;
  }

  /**
   * Check if file watcher is active.
   */
  isWatching(): boolean {
    return this.fileWatcher !== null;
  }

  async getWatchStatus(): Promise<WatchStatus> {
    if (!this.storage) {
      return { active: this.isWatching(), storageAttached: false, state: null };
    }
    const state = await getWatchState(this.storage);
    const health = deriveWatchHealth(state);
    return {
      active: this.isWatching(),
      storageAttached: Boolean(state?.storage_attached),
      state,
      health,
    };
  }

  async getSystemContract(): Promise<SystemContract> {
    const version = getCurrentVersion();
    const metadata = this.storage ? await this.storage.getMetadata() : null;
    const watchState = this.storage ? await getWatchState(this.storage) : null;
    const watchHealth = deriveWatchHealth(watchState);
    const headSha = await getCurrentGitSha(this.config.workspace);

    return buildSystemContract({
      workspace: this.config.workspace,
      version,
      metadata,
      headSha,
      watchState,
      watchHealth,
    });
  }

  getStorageSlices(options?: { strict?: boolean }): StorageSlices {
    if (!this.storage) {
      throw new Error('Librarian storage not initialized');
    }
    return createStorageSlices(this.storage, { strict: options?.strict });
  }

  async diagnoseSelf(): Promise<SelfDiagnosis> {
    const watchState = this.storage ? await getWatchState(this.storage) : null;
    const watchHealth = deriveWatchHealth(watchState);
    const headSha = await getCurrentGitSha(this.config.workspace);
    return deriveSelfDiagnosis({ headSha, watchState, watchHealth });
  }

  async saveVerificationPlan(plan: VerificationPlan): Promise<void> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    await saveVerificationPlan(this.storage, plan);
  }

  async listVerificationPlans(): Promise<VerificationPlan[]> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return listVerificationPlans(this.storage);
  }

  async getVerificationPlan(id: string): Promise<VerificationPlan | null> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return getVerificationPlan(this.storage, id);
  }

  async deleteVerificationPlan(id: string): Promise<boolean> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return deleteVerificationPlan(this.storage, id);
  }

  async recordEpisode(episode: Episode, options?: { maxEpisodes?: number }): Promise<void> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    await recordEpisode(this.storage, episode, options);
  }

  async listEpisodes(): Promise<Episode[]> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return listEpisodes(this.storage);
  }

  async getEpisode(id: string): Promise<Episode | null> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return getEpisode(this.storage, id);
  }

  async recordLearningOutcome(episode: Episode, outcome: LearningOutcome): Promise<LearningUpdate> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    if (!this.learner) {
      this.learner = new ClosedLoopLearner(this.storage);
    }
    return this.learner.recordOutcome(episode, outcome);
  }

  async getLearnedRecommendations(
    intent: string,
    context: LearningQueryContext = {}
  ): Promise<LearnedRecommendations> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    if (!this.learner) {
      this.learner = new ClosedLoopLearner(this.storage);
    }
    return this.learner.getRecommendations(intent, context);
  }

  async listTechniquePrimitives(options?: { allowInvalid?: boolean }): Promise<TechniquePrimitive[]> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return listTechniquePrimitives(this.storage, options);
  }

  async listInvalidTechniquePrimitives(): Promise<InvalidTechniquePrimitiveRecord[]> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return listInvalidTechniquePrimitives(this.storage);
  }

  async clearInvalidTechniquePrimitives(): Promise<void> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    await clearInvalidTechniquePrimitives(this.storage);
  }

  async getTechniquePrimitive(id: string, options?: { allowInvalid?: boolean }): Promise<TechniquePrimitive | null> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return getTechniquePrimitive(this.storage, id, options);
  }

  async saveTechniquePrimitive(primitive: TechniquePrimitive): Promise<void> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    await saveTechniquePrimitive(this.storage, primitive);
  }

  async deleteTechniquePrimitive(id: string): Promise<boolean> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return deleteTechniquePrimitive(this.storage, id);
  }

  async ensureTechniquePrimitives(options?: { overwrite?: boolean }): Promise<TechniquePrimitive[]> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return ensureTechniquePrimitives(this.storage, options);
  }

  async listTechniqueCompositions(): Promise<TechniqueComposition[]> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return listTechniqueCompositions(this.storage);
  }

  async getTechniqueComposition(id: string): Promise<TechniqueComposition | null> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return getTechniqueComposition(this.storage, id);
  }

  async saveTechniqueComposition(composition: TechniqueComposition): Promise<void> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    await saveTechniqueComposition(this.storage, composition);
  }

  async deleteTechniqueComposition(id: string): Promise<boolean> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return deleteTechniqueComposition(this.storage, id);
  }

  async ensureTechniqueCompositions(options?: { overwrite?: boolean }): Promise<TechniqueComposition[]> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return ensureTechniqueCompositions(this.storage, options);
  }

  async listTechniquePackages(): Promise<TechniquePackage[]> {
    return listTechniquePackages();
  }

  async getTechniquePackage(id: string): Promise<TechniquePackage | null> {
    return getTechniquePackage(id);
  }

  async compileTechniquePackageBundle(
    packageId: string
  ): Promise<ReturnType<typeof compileTechniquePackageBundleById> | null> {
    if (!this.storage) {
      return compileTechniquePackageBundleById(packageId);
    }
    const primitives = await listTechniquePrimitives(this.storage);
    const compositions = await listTechniqueCompositions(this.storage);
    return compileTechniquePackageBundleById(packageId, { primitives, compositions });
  }

  async selectTechniqueCompositions(
    intent: string,
    options?: { limit?: number; useLearning?: boolean } & CompositionSelectionOptions
  ): Promise<TechniqueComposition[]> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    const selections = await selectTechniqueCompositionsFromStorage(this.storage, intent, {
      useLearning: options?.useLearning,
      selectionMode: options?.selectionMode,
      maxResults: options?.maxResults,
      minConfidence: options?.minConfidence,
      includeAlternatives: options?.includeAlternatives,
      alternativesLimit: options?.alternativesLimit,
      includeIntentEmbedding: options?.includeIntentEmbedding,
      allowKeywordFallback: options?.allowKeywordFallback,
      providerCheck: options?.providerCheck,
    });
    if (options?.limit && options.limit > 0) {
      return selections.slice(0, options.limit);
    }
    return selections;
  }

  async compileTechniqueCompositionTemplate(
    compositionId: string
  ): Promise<{ template: import('../strategic/work_primitives.js').WorkTemplate | null; missingPrimitiveIds: string[] }> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return compileTechniqueCompositionTemplateWithGapsFromStorage(this.storage, compositionId);
  }

  async compileTechniqueCompositionBundle(
    compositionId: string
  ): Promise<{
    template: import('../strategic/work_primitives.js').WorkTemplate | null;
    primitives: TechniquePrimitive[];
    missingPrimitiveIds: string[];
  }> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return compileTechniqueCompositionBundleFromStorage(this.storage, compositionId);
  }

  async compileTechniqueBundlesFromIntent(
    intent: string,
    options?: { limit?: number; includePrimitives?: boolean; useLearning?: boolean } & CompositionSelectionOptions
  ): Promise<Array<{
    template: import('../strategic/work_primitives.js').WorkTemplate;
    primitives?: TechniquePrimitive[];
    missingPrimitiveIds: string[];
  }>> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    const bundles = await compileTechniqueBundlesFromIntent(this.storage, intent, {
      limit: options?.limit,
      useLearning: options?.useLearning,
      selectionMode: options?.selectionMode,
      maxResults: options?.maxResults,
      minConfidence: options?.minConfidence,
      includeAlternatives: options?.includeAlternatives,
      alternativesLimit: options?.alternativesLimit,
      includeIntentEmbedding: options?.includeIntentEmbedding,
      allowKeywordFallback: options?.allowKeywordFallback,
      providerCheck: options?.providerCheck,
    });
    if (options?.includePrimitives === false) {
      return bundles.map(({ template, missingPrimitiveIds }) => ({
        template,
        missingPrimitiveIds,
      }));
    }
    return bundles;
  }

  async planWork(
    intent: string,
    options?: PlanWorkOptions
  ): Promise<PlanWorkResult[]> {
    if (!this.storage) throw new Error('Librarian storage not initialized');
    return planWorkFromIntent(this.storage, intent, options);
  }

  isReady(): boolean {
    return this.initialized && this.bootstrapped;
  }

  async getStatus(): Promise<LibrarianStatus> {
    if (!this.storage) {
      return {
        initialized: false,
        bootstrapped: false,
        version: null,
        workspace: this.config.workspace,
        stats: {
          totalFunctions: 0,
          totalModules: 0,
          totalContextPacks: 0,
          averageConfidence: 0,
        },
        lastBootstrap: null,
        upgradeAvailable: false,
      };
    }

    const version = await this.storage.getVersion();
    const stats = await this.storage.getStats();
    const lastBootstrap = await this.storage.getLastBootstrapReport();

    const currentVersion = getCurrentVersion();
    const upgradeAvailable = version ? version.major < currentVersion.major || version.minor < currentVersion.minor || QUALITY_TIERS_ORDER.indexOf(currentVersion.qualityTier) > QUALITY_TIERS_ORDER.indexOf(version.qualityTier) : false;

    return {
      initialized: this.initialized,
      bootstrapped: this.bootstrapped,
      version,
      workspace: this.config.workspace,
      stats: {
        totalFunctions: stats.totalFunctions,
        totalModules: stats.totalModules,
        totalContextPacks: stats.totalContextPacks,
        averageConfidence: stats.averageConfidence,
      },
      lastBootstrap: lastBootstrap?.completedAt || null,
      upgradeAvailable,
    };
  }

  async query(query: LibrarianQuery): Promise<LlmRequired<LibrarianResponse>> {
    return this.queryRequired(query);
  }

  async queryRequired(query: LibrarianQuery): Promise<LlmRequired<LibrarianResponse>> {
    const response = await this.runQueryWithEngines({ ...query, llmRequirement: 'required' });
    return response as LlmRequired<LibrarianResponse>;
  }

  async queryOptional(query: LibrarianQuery): Promise<LlmOptional<LibrarianResponse>> {
    const llmRequirement = query.llmRequirement === 'disabled' ? 'disabled' : 'optional';
    const response = await this.runQueryWithEngines({ ...query, llmRequirement });
    return response as LlmOptional<LibrarianResponse>;
  }

  async queryWithFallback(query: LibrarianQuery): Promise<LlmResult<LibrarianResponse>> {
    try {
      const response = await this.queryOptional(query);
      if (response.llmAvailable === false && response.llmRequirement !== 'disabled') {
        return { success: false, error: 'llm_unavailable', partialResult: response };
      }
      return { success: true, value: response };
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        const missing = error.details?.missing ?? [];
        const llmMissing = missing.some((item) => item.toLowerCase().includes('llm'));
        if (llmMissing) {
          return { success: false, error: 'llm_unavailable' };
        }
      }
      throw error;
    }
  }

  private async runQueryWithEngines(query: LibrarianQuery): Promise<LibrarianResponse> {
    this.ensureReady();
    const governor = this.createGovernorContext('query');
    const response = await executeQuery(
      query,
      this.storage!,
      this.embeddingService ?? undefined,
      governor,
      undefined,
      { evidenceLedger: this.evidenceLedger ?? undefined }
    );
    const engines = await this.buildEngineResults(query, response);
    if (engines) {
      return { ...response, engines };
    }
    return response;
  }

  async embedIntent(intent: string): Promise<Float32Array> {
    this.ensureReady();
    if (!this.embeddingService) {
      throw new Error('unverified_by_trace(provider_unavailable): embedding service not configured');
    }
    const governor = this.createGovernorContext('query');
    const result = await this.embeddingService.generateEmbedding(
      { text: intent, kind: 'query' },
      { governorContext: governor }
    );
    if (!(result.embedding instanceof Float32Array)) {
      throw new Error('unverified_by_trace(provider_invalid_output): embedding is not a Float32Array');
    }
    return result.embedding;
  }

  async assembleContext(
    query: LibrarianQuery,
    options: ContextAssemblyOptions = {}
  ): Promise<AgentKnowledgeContext> {
    this.ensureReady();
    const governor = this.createGovernorContext('context_assembly');
    const mergedOptions = { ...options, workspace: options.workspace ?? this.config.workspace };
    const workspaceRoot = mergedOptions.workspace ?? this.config.workspace;
    const knowledgeSources = this.knowledgeSynthesizer
      ? await this.knowledgeSynthesizer.buildKnowledgeSources(query, workspaceRoot, governor)
      : [];
    const existingSupplementary = mergedOptions.supplementary ?? {};
    const mergedSupplementary = knowledgeSources.length
      ? {
          ...existingSupplementary,
          knowledgeSources: [
            ...(existingSupplementary.knowledgeSources ?? []),
            ...knowledgeSources,
          ],
        }
      : existingSupplementary;
    return assembleContextQuery(query, this.storage!, this.embeddingService ?? undefined, governor, {
      ...mergedOptions,
      supplementary: mergedSupplementary,
    });
  }

  async startContextSession(query: LibrarianQuery): Promise<ContextSession> {
    this.ensureReady();
    return this.getContextSessionManager().start(query);
  }

  async followUpContextSession(sessionId: string, question: string): Promise<FollowUpResponse> {
    this.ensureReady();
    return this.getContextSessionManager().followUp(sessionId, question);
  }

  async drillDownContextSession(sessionId: string, entityId: string): Promise<DrillDownResponse> {
    this.ensureReady();
    return this.getContextSessionManager().drillDown(sessionId, entityId);
  }

  async summarizeContextSession(sessionId: string): Promise<ContextSummary> {
    this.ensureReady();
    return this.getContextSessionManager().summarize(sessionId);
  }

  async closeContextSession(sessionId: string): Promise<void> {
    this.ensureReady();
    return this.getContextSessionManager().close(sessionId);
  }

  async queryKnowledge(query: KnowledgeQuery): Promise<KnowledgeResult> {
    this.ensureReady();
    if (!this.knowledge) {
      throw new Error('Knowledge module not initialized');
    }
    return this.knowledge.query(query);
  }

  getKnowledge(): Knowledge {
    this.ensureReady();
    if (!this.knowledge) {
      throw new Error('Knowledge module not initialized');
    }
    return this.knowledge;
  }

  getEngines(): LibrarianEngineToolkit {
    this.ensureReady();
    if (!this.engines) {
      throw new Error('Engine toolkit not initialized');
    }
    return this.engines;
  }

  getStorageCapabilities(): StorageCapabilities {
    this.ensureReady();
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }
    if (!this.storageCapabilities) {
      this.storageCapabilities = this.storage.getCapabilities();
    }
    return this.storageCapabilities;
  }

  getAgent(): LibrarianAgent {
    return this.getEngines().agent;
  }

  async getContextPack(
    targetId: string,
    packType: string = 'function_context'
  ): Promise<ContextPack | null> {
    this.ensureReady();
    return this.storage!.getContextPackForTarget(targetId, packType);
  }

  async recordOutcome(
    packId: string,
    outcome: 'success' | 'failure'
  ): Promise<void> {
    this.ensureReady();
    await this.storage!.recordContextPackAccess(packId, outcome);

    // Use Bayesian update for better confidence calibration
    const pack = await this.storage!.getContextPack(packId);
    const prior = pack?.confidence ?? 0.5;

    const delta = bayesianDelta(prior, outcome === 'success');

    await this.storage!.updateConfidence(packId, 'context_pack', delta, outcome);
  }

  async reindexFiles(filePaths: string[]): Promise<void> {
    this.ensureReady();

    const governor = this.createGovernorContext('reindex');
    this.indexer?.setGovernorContext(governor);
    let stateBefore = null as Awaited<ReturnType<typeof getIndexState>> | null;
    let indexWriter = null as ReturnType<typeof createIndexStateWriter> | null;
    let totalFiles = 0;
    let completedFiles = 0;
    const normalizedPaths = filePaths.map((filePath) => this.resolveWorkspacePath(filePath));
    if (!normalizedPaths.length) return;
    const lockManager = new FileLockManager(this.config.workspace, {
      timeoutMs: this.config.bootstrapTimeoutMs ?? 0,
    });
    const lockId = `reindex-${process.pid}-${Date.now()}`;
    const lockResult = await lockManager.acquireLock(lockId, normalizedPaths);
    if (lockResult.timeout || lockResult.blocked.length > 0) {
      await lockManager.releaseLock(lockId);
      const blocked = lockResult.blocked.map((item) => item.path).join(', ');
      throw new Error(`unverified_by_trace(lease_conflict): failed to acquire file locks (${blocked || 'unknown'})`);
    }
    try {
      const llmProvider = this.config.llmProvider;
      const llmModelId = this.config.llmModelId;
      const hasLlmConfig = Boolean(llmProvider && llmModelId);
      if (!hasLlmConfig) {
        throw new ProviderUnavailableError({
          message: 'unverified_by_trace(provider_unavailable): Reindex requires live LLM providers. There is no non-agentic mode.',
          missing: ['reindex_llm_not_configured'],
          suggestion: 'Authenticate providers via CLI and set LIBRARIAN_LLM_PROVIDER/LIBRARIAN_LLM_MODEL.',
        });
      }
      const fileExtractionConfig: FileExtractionConfig = {
        llmProvider: llmProvider ?? undefined,
        llmModelId: llmModelId ?? undefined,
        skipLlm: false,
      };
      const directoryExtractionConfig: DirectoryExtractionConfig = {
        llmProvider: llmProvider ?? undefined,
        llmModelId: llmModelId ?? undefined,
        skipLlm: false,
      };
      const fileKnowledgeUpdates = [];
      const directoryPaths = new Set<string>();
      stateBefore = await getIndexState(this.storage!);
      indexWriter = createIndexStateWriter(this.storage!);
      totalFiles = normalizedPaths.length;
      await indexWriter.write({
        ...stateBefore,
        phase: 'indexing',
        progress: { total: totalFiles, completed: 0 },
      }, { force: true });
      const modules = await this.storage!.getModules();
      const moduleByPath = new Map<string, { id: string; path: string }>();
      const moduleById = new Map<string, { id: string; path: string }>();
      for (const mod of modules) {
        const normalized = path.resolve(mod.path);
        moduleByPath.set(normalized, { id: mod.id, path: mod.path });
        moduleById.set(mod.id, { id: mod.id, path: mod.path });
      }

      const dependentPaths = new Set<string>();
      for (const filePath of normalizedPaths) {
        const module = moduleByPath.get(path.resolve(filePath));
        if (!module) continue;
        const edges = await this.storage!.getGraphEdges({
          edgeTypes: ['imports'],
          toIds: [module.id],
          fromTypes: ['module'],
        });
        for (const edge of edges) {
          const dependent = moduleById.get(edge.fromId);
          if (dependent) dependentPaths.add(dependent.path);
        }
      }

      const invalidationTargets = new Set<string>([...normalizedPaths, ...dependentPaths]);
      for (const target of invalidationTargets) {
        const invalidated = await this.storage!.invalidateContextPacks(target);
        if (invalidated > 0) {
          void globalEventBus.emit(createContextPacksInvalidatedEvent(target, invalidated));
        }
      }

      for (const filePath of normalizedPaths) {
        await this.emitUnderstandingInvalidation(filePath, 'reindex');
        await this.indexer!.indexFile(filePath);
        const fileResult = await extractFileKnowledge({
          absolutePath: filePath,
          workspaceRoot: this.config.workspace,
        }, fileExtractionConfig);
        fileKnowledgeUpdates.push(fileResult.file);
        let dir = path.dirname(filePath);
        while (dir && dir.startsWith(this.config.workspace)) {
          directoryPaths.add(dir);
          if (dir === this.config.workspace) break;
          const parent = path.dirname(dir);
          if (parent === dir) break;
          dir = parent;
        }
        completedFiles += 1;
        if (indexWriter) {
          await indexWriter.write({
            ...(stateBefore ?? { phase: 'indexing' }),
            phase: 'indexing',
            progress: { total: totalFiles, completed: completedFiles, currentFile: filePath },
          });
        }
      }
      if (indexWriter) {
        const finalPhase = stateBefore?.phase === 'incremental' ? 'incremental' : 'ready';
        await indexWriter.write({
          ...(stateBefore ?? { phase: finalPhase }),
          phase: finalPhase,
          progress: { total: totalFiles, completed: completedFiles },
        }, { force: true });
        await indexWriter.flush();
      }

      if (fileKnowledgeUpdates.length) {
        const existingByPath = new Map<string, boolean>();
        for (const file of fileKnowledgeUpdates) {
          const existing = await this.storage!.getFileByPath(file.path);
          existingByPath.set(file.path, Boolean(existing));
        }
        await this.storage!.upsertFiles(fileKnowledgeUpdates);
        for (const file of fileKnowledgeUpdates) {
          const existed = existingByPath.get(file.path) ?? false;
          const event = existed
            ? createEntityUpdatedEvent('file', file.id, file.path)
            : createEntityCreatedEvent('file', file.id, file.path);
          void globalEventBus.emit(event);
        }
      }

      if (directoryPaths.size) {
        const knownFiles = await this.storage!.getFiles().catch(() => []);
        const knownPaths = knownFiles.map((file) => file.path);
        const totalFileCounts = computeTotalFileCounts(
          knownPaths.length ? knownPaths : normalizedPaths,
          this.config.workspace
        );
        const inputs = Array.from(directoryPaths.values()).map((dirPath) => ({
          absolutePath: dirPath,
          workspaceRoot: this.config.workspace,
        }));
        const dirResults = await extractDirectoriesInBatch(inputs, directoryExtractionConfig, totalFileCounts);
        const directories = dirResults.map((result) => result.directory);
        const existingByPath = new Map<string, boolean>();
        for (const dir of directories) {
          const existing = await this.storage!.getDirectoryByPath(dir.path);
          existingByPath.set(dir.path, Boolean(existing));
        }
        await this.storage!.upsertDirectories(directories);
        for (const dir of directories) {
          const existed = existingByPath.get(dir.path) ?? false;
          const event = existed
            ? createEntityUpdatedEvent('directory', dir.id, dir.path)
            : createEntityCreatedEvent('directory', dir.id, dir.path);
          void globalEventBus.emit(event);
        }
      }

      if (hasLlmConfig) {
        const moduleTargets = new Set<string>([...normalizedPaths, ...dependentPaths]);
        const modules = await this.storage!.getModules();
        const functions = await this.storage!.getFunctions();
        const packModules = modules.filter((mod) => moduleTargets.has(path.resolve(mod.path)));
        const packFunctions = functions.filter((fn) => moduleTargets.has(path.resolve(fn.filePath)));
        if (packModules.length || packFunctions.length) {
          await generateContextPacks(this.storage!, {
            governorContext: governor,
            llmProvider,
            llmModelId,
            functions: packFunctions,
            modules: packModules,
            includeSupplemental: true,
            force: true,
          });
        }

        const generator = createKnowledgeGenerator({
          storage: this.storage!,
          workspace: this.config.workspace,
          llmProvider,
          llmModelId,
          skipLlm: false,
          onEvent: (event) => { void globalEventBus.emit(event); },
        });
        await generator.regenerateForFiles(normalizedPaths);
      }
    } finally {
      this.indexer?.setGovernorContext(null);
      await lockManager.releaseLock(lockId);
    }
  }

  async forceRebootstrap(): Promise<BootstrapReport> {
    this.ensureReady();

    const bootstrapConfig = createBootstrapConfig(this.config.workspace, {
      ...this.config.bootstrapConfig,
      timeoutMs: this.config.bootstrapTimeoutMs,
      llmProvider: this.config.llmProvider,
      llmModelId: this.config.llmModelId,
      // Real embedding providers (xenova/sentence-transformers) - configured automatically
      embeddingService: this.embeddingService ?? undefined,
    });

    return bootstrapProject(bootstrapConfig, this.storage!);
  }

  async shutdown(): Promise<void> {
    if (this.indexer) {
      await this.indexer.shutdown();
      this.indexer = null;
    }

    if (this.evidenceLedger) {
      disableEventLedgerBridge();
      await this.evidenceLedger.close();
      this.evidenceLedger = null;
    }

    if (this.storage) {
      await this.storage.close();
      this.storage = null;
    }

    this.knowledge = null;
    this.engines?.dispose();
    this.engines = null;
    this.learner = null;
    this.contextSessions = null;

    this.initialized = false;
    this.bootstrapped = false;
  }

  /**
   * Get the storage backend for advanced queries (e.g., graph edges).
   * Returns null if librarian is not initialized.
   */
  getStorage(): LibrarianStorage | null {
    return this.storage;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONA VIEWS - Stakeholder-specific knowledge projections
  // Delegated to LibrarianViewsDelegate per MF4 (file size limits)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get a persona-specific view of an entity's knowledge.
   * Tailored for: programmer, engineer, manager, designer, qa, security, scientist, product
   */
  async getPersonaView(entityId: string, persona: PersonaType): Promise<PersonaView | null> {
    this.ensureReady();
    return this.viewsDelegate!.getPersonaView(entityId, persona);
  }

  /**
   * Get a quick glance card for an entity.
   */
  async getGlanceCard(entityId: string): Promise<GlanceCard | null> {
    this.ensureReady();
    return this.viewsDelegate!.getGlanceCard(entityId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISUALIZATION - Diagrams on demand
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate a Mermaid diagram for visualization.
   */
  async visualize(request: DiagramRequest): Promise<DiagramResult> {
    this.ensureReady();
    return this.viewsDelegate!.visualize(request);
  }

  /**
   * Generate ASCII visualization for terminals without Mermaid support.
   */
  async visualizeASCII(type: 'tree' | 'health_summary', focusPath?: string): Promise<ASCIIResult> {
    this.ensureReady();
    return this.viewsDelegate!.visualizeASCII(type, focusPath);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFEATER VALIDATION - Check if knowledge is still valid
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if knowledge for an entity has any active defeaters.
   */
  async validateKnowledge(entityId: string): Promise<ActivationSummary | null> {
    this.ensureReady();
    return this.viewsDelegate!.validateKnowledge(entityId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECOMMENDATIONS - Actionable improvement guidance
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get refactoring recommendations for a file or directory.
   */
  async getRecommendations(
    scope: string | string[],
    type: 'refactoring' | 'architecture' | 'all' = 'all'
  ): Promise<RefactoringRecommendation[]> {
    this.ensureReady();
    return this.viewsDelegate!.getRecommendations(scope, type);
  }

  private ensureReady(): void {
    if (!this.isReady()) {
      throw new Error(`Librarian not ready. ${this.initialized ? 'Bootstrap not complete.' : 'Call initialize() first.'}`);
    }
  }

  private getContextSessionManager(): ContextAssemblySessionManager {
    if (!this.contextSessions) {
      this.contextSessions = new ContextAssemblySessionManager({
        query: (query) => this.query(query),
      });
    }
    return this.contextSessions;
  }

  private async emitUnderstandingInvalidation(filePath: string, reason: string): Promise<void> {
    if (!this.storage) return;
    const records = await this.storage.getUniversalKnowledgeByFile(filePath);
    for (const record of records) {
      void globalEventBus.emit(createUnderstandingInvalidatedEvent(record.id, record.kind, reason));
    }
  }

  private resolveWorkspacePath(filePath: string): string {
    if (path.isAbsolute(filePath)) return filePath;
    return path.resolve(this.config.workspace, filePath);
  }

  private createGovernorContext(phase: string): GovernorContext {
    return new GovernorContext({ phase, config: this.governorConfig ?? DEFAULT_GOVERNOR_CONFIG });
  }

  private async buildEngineResults(
    query: LibrarianQuery,
    response: LibrarianResponse
  ): Promise<LibrarianEngineResults | null> {
    if (query.includeEngines === false) return null;
    if (!this.engines) return null;
    const scope = this.buildEngineScope(query, response);
    const scopePaths = Array.from(scope.keys());
    const engines: LibrarianEngineResults = {};

    const intent = query.intent?.trim();
    if (intent) {
      engines.relevance = await this.engines.relevance.query({
        intent,
        hints: scopePaths,
        budget: { maxFiles: 20, maxTokens: 50_000, maxDepth: 2 },
        urgency: 'blocking',
      });
    }

    engines.constraints = await this.buildConstraintSummary(scope, scopePaths);
    engines.meta = {
      confidence: await this.engines.meta.getConfidence(scopePaths),
      proceedDecision: await this.engines.meta.shouldProceed(scopePaths),
    };

    return Object.keys(engines).length ? engines : null;
  }

  private buildEngineScope(query: LibrarianQuery, response: LibrarianResponse): Map<string, string> {
    const scope = new Map<string, string>();
    const addEntry = (value: string): void => {
      if (!value) return;
      const absolute = path.isAbsolute(value) ? value : path.resolve(this.config.workspace, value);
      const relative = path.relative(this.config.workspace, absolute).replace(/\\/g, '/');
      if (!relative || relative.startsWith('..')) return;
      scope.set(relative, absolute);
    };

    for (const file of query.affectedFiles ?? []) addEntry(file);
    for (const pack of response.packs) {
      for (const file of pack.relatedFiles) addEntry(file);
    }

    return scope;
  }

  private async buildConstraintSummary(
    scope: Map<string, string>,
    scopePaths: string[]
  ): Promise<EngineConstraintSummary> {
    const engines = this.engines!;
    const applicable = await engines.constraint.getApplicableConstraints(scopePaths);
    const violations: EngineConstraintSummary['violations'] = [];
    const warnings: EngineConstraintSummary['warnings'] = [];
    const inspectionTargets = scopePaths.slice(0, 6);

    for (const target of inspectionTargets) {
      const absolute = scope.get(target);
      if (!absolute) continue;
      let content = null as string | null;
      try {
        content = await fs.readFile(absolute, 'utf8');
      } catch {
        content = null;
      }
      if (!content) continue;
      const result = await engines.constraint.validateChange(target, '', content);
      violations.push(...result.violations);
      warnings.push(...result.warnings);
    }

    const blocking = violations.some((violation) => violation.constraint.severity === 'error');
    return { applicable, violations, warnings, blocking };
  }
}

const QUALITY_TIERS_ORDER: ('mvp' | 'enhanced' | 'full')[] = ['mvp', 'enhanced', 'full'];

export async function createLibrarian(config: LibrarianConfig): Promise<Librarian> {
  const librarian = new Librarian(config);
  await librarian.initialize();
  return librarian;
}

export function createLibrarianSync(config: LibrarianConfig): Librarian {
  return new Librarian({ ...config, autoBootstrap: false });
}
