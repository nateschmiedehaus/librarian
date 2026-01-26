export interface IngestionContext {
  workspace: string;
  now: () => string;
}

export interface IngestionItem {
  id: string;
  sourceType: string;
  sourceVersion: string;
  ingestedAt: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface IngestionResult {
  items: IngestionItem[];
  errors: string[];
}

export interface IngestionSource {
  type: string;
  version: string;
  ingest(ctx: IngestionContext): Promise<IngestionResult>;
  validate(data: unknown): boolean;
}

export interface IngestionRunResult {
  items: IngestionItem[];
  errors: string[];
  sources: Array<{ type: string; version: string; itemCount: number }>;
}
