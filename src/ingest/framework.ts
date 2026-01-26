import { getErrorMessage } from '../utils/errors.js';
import type { IngestionContext, IngestionItem, IngestionResult, IngestionRunResult, IngestionSource } from './types.js';

// Default timeout per source: 30 seconds
const DEFAULT_SOURCE_TIMEOUT_MS = 30_000;

// Helper to wrap a promise with timeout
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[${label}] timed out after ${ms}ms`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export class IngestionFramework {
  private sources = new Map<string, IngestionSource>();
  private sourceTimeoutMs: number;

  constructor(options?: { sourceTimeoutMs?: number }) {
    this.sourceTimeoutMs = options?.sourceTimeoutMs ?? DEFAULT_SOURCE_TIMEOUT_MS;
  }

  registerSource(source: IngestionSource): void {
    if (!source.type || !source.version) throw new Error('Ingestion source must include type and version');
    this.sources.set(source.type, source);
  }

  listSources(): IngestionSource[] {
    return Array.from(this.sources.values());
  }

  async ingestAll(ctx: IngestionContext): Promise<IngestionRunResult> {
    const items: IngestionItem[] = []; const errors: string[] = []; const sources: IngestionRunResult['sources'] = [];
    for (const source of this.sources.values()) {
      let result: IngestionResult;
      try {
        result = await withTimeout(source.ingest(ctx), this.sourceTimeoutMs, source.type);
      } catch (error: unknown) {
        errors.push(`[${source.type}] ${getErrorMessage(error)}`);
        sources.push({ type: source.type, version: source.version, itemCount: 0 });
        continue;
      }
      if (result.errors.length) errors.push(...result.errors.map((entry) => `[${source.type}] ${entry}`));
      let accepted = 0;
      for (const item of result.items) {
        const normalized: IngestionItem = {
          ...item,
          sourceType: item.sourceType || source.type,
          sourceVersion: item.sourceVersion || source.version,
          ingestedAt: item.ingestedAt || ctx.now(),
        };
        const itemId = normalized.id ? normalized.id : 'unknown';
        if (!source.validate(normalized)) { errors.push(`[${source.type}] invalid item ${itemId}`); continue; }
        items.push(normalized); accepted += 1;
      }
      sources.push({ type: source.type, version: source.version, itemCount: accepted });
    }
    return { items, errors, sources };
  }
}

export function createIngestionContext(workspace: string, now: () => string = () => new Date().toISOString()): IngestionContext {
  return { workspace, now };
}
