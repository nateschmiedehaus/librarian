import { logWarning } from '../telemetry/logger.js';

export type ModelProvider = 'claude' | 'codex';

export interface ModelPolicyOptions {
  now?: () => Date;
  forceRefresh?: boolean;
  skipDiscovery?: boolean;
  skipDocsFetch?: boolean;
  discoveryTimeoutMs?: number;
  applyEnv?: boolean;
  defaultProvider?: ModelProvider;
  respectExistingEnv?: boolean;
}

export interface SelectedModelInfo {
  provider: ModelProvider;
  model_id: string;
  name: string;
  context_window?: number;
  max_output?: number;
  cost_per_mtok?: { input: number; output: number };
  capabilities?: string[];
  reasoning_levels?: string[];
  access_method?: 'subscription' | 'api';
  tool_support?: boolean;
  rationale: string;
}

export interface ProviderDocCapture {
  url: string;
  path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface ProviderDocSnapshot {
  urls: string[];
  ids_found: string[];
  errors: string[];
  captures?: ProviderDocCapture[];
}

export interface DailyModelSelection {
  schema_version: number;
  date: string;
  local_date: string;
  timezone_offset_minutes: number;
  generated_at: string;
  providers: {
    claude: SelectedModelInfo | null;
    codex: SelectedModelInfo | null;
  };
  sources: {
    claude: ProviderDocSnapshot;
    codex: ProviderDocSnapshot;
  };
  notes: string[];
}

export interface ModelPolicyProvider {
  ensureDailyModelSelection: (
    workspaceRoot: string,
    options?: ModelPolicyOptions
  ) => Promise<DailyModelSelection>;
}

export interface RegisterModelPolicyProviderOptions {
  force?: boolean;
}

let modelPolicyProvider: ModelPolicyProvider | null = null;

function validateModelPolicyProvider(provider: ModelPolicyProvider): void {
  if (!provider || typeof provider.ensureDailyModelSelection !== 'function') {
    throw new Error(
      'unverified_by_trace(model_policy_invalid): Provider must implement ensureDailyModelSelection.'
    );
  }
}

export function registerModelPolicyProvider(
  provider: ModelPolicyProvider,
  options: RegisterModelPolicyProviderOptions = {}
): void {
  validateModelPolicyProvider(provider);
  if (modelPolicyProvider && !options.force) {
    throw new Error('unverified_by_trace(model_policy_already_registered)');
  }
  modelPolicyProvider = provider;
}

export function clearModelPolicyProvider(): void {
  modelPolicyProvider = null;
}

export async function ensureDailyModelSelection(
  workspaceRoot: string,
  options: ModelPolicyOptions = {}
): Promise<DailyModelSelection | null> {
  if (!modelPolicyProvider) {
    logWarning(
      'unverified_by_trace(model_policy_unavailable): Model policy provider not registered; skipping selection.',
      { workspaceRoot }
    );
    return null;
  }
  return await modelPolicyProvider.ensureDailyModelSelection(workspaceRoot, options);
}
