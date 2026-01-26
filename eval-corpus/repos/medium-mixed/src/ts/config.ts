export type IngestConfig = {
  batchSize: number;
  allowDuplicateIds: boolean;
  maxPayloadBytes: number;
};

export const DEFAULT_CONFIG: IngestConfig = {
  batchSize: 50,
  allowDuplicateIds: false,
  maxPayloadBytes: 1024 * 256,
};
