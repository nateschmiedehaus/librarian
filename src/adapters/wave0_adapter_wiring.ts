import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logWarning } from '../telemetry/logger.js';
import { createCliLlmServiceFactory } from './cli_llm_service.js';
import { setDefaultLlmServiceFactory } from './llm_service.js';
import { registerModelPolicyProvider } from './model_policy.js';

const LLM_SERVICE_RELATIVE_PATHS = [
  path.join('dist', 'soma', 'providers', 'llm_service.js'),
  path.join('src', 'soma', 'providers', 'llm_service.js'),
  path.join('src', 'soma', 'providers', 'llm_service.ts'),
];

const MODEL_POLICY_RELATIVE_PATHS = [
  path.join('dist', 'models', 'model_policy.js'),
  path.join('src', 'models', 'model_policy.js'),
  path.join('src', 'models', 'model_policy.ts'),
];

const attemptedRoots = new Set<string>();

function resolveExistingPath(workspaceRoot: string, candidates: string[]): string | null {
  for (const relative of candidates) {
    const candidate = path.join(workspaceRoot, relative);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export async function ensureWave0AdapterRegistration(workspaceRoot: string): Promise<void> {
  const resolvedRoot = path.resolve(workspaceRoot);
  if (attemptedRoots.has(resolvedRoot)) return;
  attemptedRoots.add(resolvedRoot);

  const llmPath = resolveExistingPath(resolvedRoot, LLM_SERVICE_RELATIVE_PATHS);
  let llmRegistered = false;
  if (llmPath) {
    try {
      const module = await import(pathToFileURL(llmPath).href);
      if (typeof module.LLMService !== 'function') {
        throw new Error('unverified_by_trace(llm_adapter_unavailable): LLMService export missing.');
      }
      setDefaultLlmServiceFactory(async () => new module.LLMService(), { force: false });
      llmRegistered = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('llm_adapter_default_factory_already_registered')) {
        logWarning('Wave0 LLM adapter registration failed', { error: message, llmPath });
      }
    }
  }
  if (!llmRegistered) {
    try {
      setDefaultLlmServiceFactory(createCliLlmServiceFactory(), { force: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('llm_adapter_default_factory_already_registered')) {
        logWarning('Standalone CLI LLM adapter registration failed', { error: message });
      }
    }
  }

  const policyPath = resolveExistingPath(resolvedRoot, MODEL_POLICY_RELATIVE_PATHS);
  if (policyPath) {
    try {
      const module = await import(pathToFileURL(policyPath).href);
      if (typeof module.ensureDailyModelSelection !== 'function') {
        throw new Error('unverified_by_trace(model_policy_unavailable): Provider export missing.');
      }
      registerModelPolicyProvider({ ensureDailyModelSelection: module.ensureDailyModelSelection }, { force: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('model_policy_already_registered')) {
        logWarning('Wave0 model policy registration failed', { error: message, policyPath });
      }
    }
  }
}
