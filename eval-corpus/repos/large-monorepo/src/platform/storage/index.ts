import type { Job, JobResult } from '../../core/types';
import { getStore } from './memory';

export function saveJob(job: Job): void {
  getStore().jobs.set(job.id, job);
}

export function saveResult(result: JobResult): void {
  getStore().results.set(result.jobId, result);
}

export function findJob(id: string): Job | undefined {
  return getStore().jobs.get(id);
}
