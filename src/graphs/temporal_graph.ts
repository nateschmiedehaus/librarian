import { spawnSync } from 'child_process';

export interface CochangeEdge { fileA: string; fileB: string; changeCount: number; totalChanges: number; strength: number; }
export interface TemporalGraph { edges: CochangeEdge[]; commitCount: number; fileChangeCounts: Record<string, number>; }
export interface TemporalGraphOptions { maxCommits?: number; maxFilesPerCommit?: number; }

const DEFAULT_MAX_COMMITS = 200;
const DEFAULT_MAX_FILES = 50;

export function buildTemporalGraph(workspace: string, options: TemporalGraphOptions = {}): TemporalGraph {
  const maxCommits = options.maxCommits ?? DEFAULT_MAX_COMMITS;
  const maxFilesPerCommit = options.maxFilesPerCommit ?? DEFAULT_MAX_FILES;
  const result = spawnSync('git', ['log', '--name-only', '--pretty=format:%H', '-n', String(maxCommits)], { cwd: workspace, encoding: 'utf8' });
  if (result.status !== 0 || typeof result.stdout !== 'string') return { edges: [], commitCount: 0, fileChangeCounts: {} };
  const lines = result.stdout.split(/\r?\n/);
  const commits: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[0-9a-f]{7,40}$/i.test(trimmed)) { if (current.length) commits.push(current); current = []; continue; }
    current.push(trimmed);
  }
  if (current.length) commits.push(current);
  const pairCounts = new Map<string, number>();
  const fileChangeCounts: Record<string, number> = {};
  for (const filesRaw of commits) {
    const files = Array.from(new Set(filesRaw)).slice(0, maxFilesPerCommit);
    for (const file of files) fileChangeCounts[file] = (fileChangeCounts[file] ?? 0) + 1;
    for (let i = 0; i < files.length; i += 1) {
      for (let j = i + 1; j < files.length; j += 1) {
        const a = files[i] ?? '';
        const b = files[j] ?? '';
        if (!a || !b) continue;
        const key = a < b ? `${a}||${b}` : `${b}||${a}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }
  const commitCount = commits.length;
  const edges: CochangeEdge[] = [];
  for (const [key, count] of pairCounts.entries()) {
    const [fileA, fileB] = key.split('||');
    edges.push({ fileA, fileB, changeCount: count, totalChanges: commitCount, strength: commitCount > 0 ? count / commitCount : 0 });
  }
  return { edges, commitCount, fileChangeCounts };
}
