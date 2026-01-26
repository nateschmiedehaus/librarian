import { DEFAULT_CONFIG, IngestConfig } from "./config";

export type RawRecord = {
  id: string;
  payload: string;
  source: string;
};

export type IngestBatch = {
  batchId: string;
  records: RawRecord[];
};

const LINE_SPLIT = /\r?\n/;

export function sanitizeLine(line: string): string {
  return line.replace(/\u0000/g, "").trim();
}

export function parseCsv(input: string): RawRecord[] {
  const rows = input.split(LINE_SPLIT).filter(Boolean);
  return rows.map((row) => {
    const [id, payload, source] = row.split(",");
    return { id: id.trim(), payload: payload.trim(), source: source.trim() };
  });
}

export function validatePayloadSize(records: RawRecord[], config: IngestConfig): void {
  const payloadBytes = records.reduce((total, record) => total + record.payload.length, 0);
  if (payloadBytes > config.maxPayloadBytes) {
    throw new Error("payload too large");
  }
}

export function buildBatches(
  records: RawRecord[],
  config: IngestConfig = DEFAULT_CONFIG
): IngestBatch[] {
  validatePayloadSize(records, config);
  const batches: IngestBatch[] = [];
  for (let i = 0; i < records.length; i += config.batchSize) {
    batches.push({
      batchId: `batch-${i / config.batchSize + 1}`,
      records: records.slice(i, i + config.batchSize),
    });
  }
  return batches;
}

export function dedupeRecords(records: RawRecord[], allowDuplicateIds: boolean): RawRecord[] {
  if (allowDuplicateIds) {
    return records;
  }
  const seen = new Set<string>();
  const result: RawRecord[] = [];
  for (const record of records) {
    if (!seen.has(record.id)) {
      seen.add(record.id);
      result.push(record);
    }
  }
  return result;
}
