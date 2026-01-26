import type { FileReadDecision, FileReadPolicy, FileReadRequest } from './file_read_policy.js';

export interface FileReadLogEntry {
  timestamp: string;
  request: FileReadRequest;
  decision: FileReadDecision;
}

const readLogs = new Map<string, FileReadLogEntry[]>();

function record(entry: FileReadLogEntry): void {
  const key = entry.request.taskId || 'unknown';
  const existing = readLogs.get(key) ?? [];
  existing.push(entry);
  readLogs.set(key, existing);
}

export async function interceptFileRead(request: FileReadRequest, policy: FileReadPolicy): Promise<FileReadDecision> {
  const decision = await policy.evaluate(request);
  record({ timestamp: new Date().toISOString(), request, decision });
  return decision;
}

export function getReadLog(taskId: string): FileReadLogEntry[] {
  return readLogs.get(taskId) ?? [];
}

export function clearReadLog(taskId?: string): void {
  if (taskId) readLogs.delete(taskId); else readLogs.clear();
}
