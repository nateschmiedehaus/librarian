import type { Job } from './types';

const registry = new Map<string, Job>();

export function registerJob(job: Job): void {
  registry.set(job.id, job);
}

export function getJob(id: string): Job | undefined {
  return registry.get(id);
}

export function listJobs(): Job[] {
  return Array.from(registry.values());
}
