export interface Job {
  id: string;
  kind: string;
  payload: string;
  createdAt: string;
  attempts: number;
}

export interface JobResult {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  detail?: string;
}
