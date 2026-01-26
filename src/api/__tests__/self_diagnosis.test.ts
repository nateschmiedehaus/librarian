import { describe, it, expect } from 'vitest';
import { deriveSelfDiagnosis } from '../self_diagnosis.js';

describe('deriveSelfDiagnosis', () => {
  it('returns ok when no issues', () => {
    const diagnosis = deriveSelfDiagnosis({
      headSha: 'abc123',
      watchState: { schema_version: 1, workspace_root: '/tmp/workspace' },
      watchHealth: { suspectedDead: false, heartbeatAgeMs: 1000, eventAgeMs: 1000, reindexAgeMs: 1000, stalenessMs: 1000 },
    });

    expect(diagnosis.status).toBe('ok');
    expect(diagnosis.issues).toHaveLength(0);
  });

  it('flags cursor drift when head does not match', () => {
    const diagnosis = deriveSelfDiagnosis({
      headSha: 'def456',
      watchState: {
        schema_version: 1,
        workspace_root: '/tmp/workspace',
        cursor: { kind: 'git', lastIndexedCommitSha: 'abc123' },
      },
      watchHealth: null,
    });

    expect(diagnosis.status).toBe('unsafe');
    expect(diagnosis.issues).toContain('watch_cursor_stale');
  });

  it('flags suspected dead watcher', () => {
    const diagnosis = deriveSelfDiagnosis({
      headSha: 'abc123',
      watchState: { schema_version: 1, workspace_root: '/tmp/workspace' },
      watchHealth: { suspectedDead: true, heartbeatAgeMs: 60000, eventAgeMs: null, reindexAgeMs: null, stalenessMs: null },
    });

    expect(diagnosis.status).toBe('unsafe');
    expect(diagnosis.issues).toContain('watch_suspected_dead');
  });
});
