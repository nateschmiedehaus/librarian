import type { WatchHealth } from '../state/watch_health.js';
import type { WatchState } from '../state/watch_state.js';

export interface SelfDiagnosis {
  status: 'ok' | 'unsafe';
  issues: string[];
  stopReason: string | null;
  headSha: string | null;
  watchCursorSha: string | null;
}

export function deriveSelfDiagnosis(options: {
  headSha: string | null;
  watchState: WatchState | null;
  watchHealth: WatchHealth | null;
}): SelfDiagnosis {
  const issues: string[] = [];
  const headSha = options.headSha ?? null;
  const watchCursorSha =
    options.watchState?.cursor?.kind === 'git' ? options.watchState.cursor.lastIndexedCommitSha ?? null : null;

  if (options.watchHealth?.suspectedDead) {
    issues.push('watch_suspected_dead');
  }
  if (options.watchState?.needs_catchup) {
    issues.push('watch_needs_catchup');
  }
  if (options.watchState?.storage_attached === false) {
    issues.push('watch_storage_detached');
  }
  if (headSha && watchCursorSha && headSha !== watchCursorSha) {
    issues.push('watch_cursor_stale');
  }

  return {
    status: issues.length === 0 ? 'ok' : 'unsafe',
    issues,
    stopReason: issues.length === 0 ? null : 'self_drift_detected',
    headSha,
    watchCursorSha,
  };
}
