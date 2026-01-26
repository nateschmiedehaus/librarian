import type { Job, JobResult } from '../../core/types';

export interface MemoryStore {
  jobs: Map<string, Job>;
  results: Map<string, JobResult>;
}

const store: MemoryStore = {
  jobs: new Map(),
  results: new Map(),
};

export function getStore(): MemoryStore {
  return store;
}
