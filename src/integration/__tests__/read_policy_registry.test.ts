import { beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  clearReadPolicyContext,
  configureReadPolicyRegistry,
  listReadPolicyContexts,
  registerReadPolicyContext,
  resetReadPolicyRegistry,
  resolveReadPolicyContext,
} from '../read_policy_registry.js';

const makeWorkspace = () => realpathSync(mkdtempSync(path.join(tmpdir(), 'wvo-read-policy-')));

describe('read_policy_registry', () => {
  beforeEach(() => {
    resetReadPolicyRegistry();
  });

  it('registers and resolves by taskId and agentId', () => {
    const workspaceRoot = makeWorkspace();
    const entry = registerReadPolicyContext({
      taskId: 'TASK-1',
      agentId: 'agent-1',
      workspaceRoot,
      providedFiles: ['src/index.ts', 'src/index.ts', 'README.md'],
      gaps: [{ description: 'missing tests' }],
    });

    expect(entry.taskId).toBe('TASK-1');
    expect(entry.agentId).toBe('agent-1');
    expect(entry.providedFiles.length).toBe(2);
    expect(entry.providedFiles.every((file) => file.startsWith(workspaceRoot))).toBe(true);

    const resolvedByTask = resolveReadPolicyContext({ taskId: 'TASK-1' });
    expect(resolvedByTask?.agentId).toBe('agent-1');
    expect(resolvedByTask?.gaps).toEqual([{ description: 'missing tests' }]);

    const resolvedByAgent = resolveReadPolicyContext({ agentId: 'agent-1' });
    expect(resolvedByAgent?.taskId).toBe('TASK-1');
  });

  it('merges updates for the same task', () => {
    const workspaceRoot = makeWorkspace();
    registerReadPolicyContext({
      taskId: 'TASK-merge',
      agentId: 'agent-merge',
      workspaceRoot,
      providedFiles: ['src/alpha.ts'],
      gaps: [{ description: 'gap-a' }],
    });

    const updated = registerReadPolicyContext({
      taskId: 'TASK-merge',
      workspaceRoot,
      providedFiles: ['src/beta.ts'],
      gaps: [{ description: 'gap-b' }],
    });

    expect(updated.providedFiles).toHaveLength(2);
    expect(updated.gaps.map((gap) => gap.description)).toEqual(['gap-a', 'gap-b']);
  });

  it('updates agent mapping when agentId changes', () => {
    registerReadPolicyContext({ taskId: 'TASK-agent', agentId: 'agent-a', providedFiles: [] });
    registerReadPolicyContext({ taskId: 'TASK-agent', agentId: 'agent-b', providedFiles: [] });

    expect(resolveReadPolicyContext({ agentId: 'agent-a' })).toBeNull();
    expect(resolveReadPolicyContext({ agentId: 'agent-b' })?.taskId).toBe('TASK-agent');
  });

  it('rejects paths that escape the workspace', () => {
    const workspaceRoot = makeWorkspace();
    expect(() =>
      registerReadPolicyContext({
        taskId: 'TASK-bad',
        workspaceRoot,
        providedFiles: ['../outside.txt'],
      })
    ).toThrow('Path escapes workspace root');
  });

  it('rejects symlink escapes outside the workspace', () => {
    const workspaceRoot = makeWorkspace();
    const externalRoot = makeWorkspace();
    const linkPath = path.join(workspaceRoot, 'linked');
    symlinkSync(externalRoot, linkPath, 'dir');
    writeFileSync(path.join(externalRoot, 'secret.txt'), 'secret', 'utf8');

    expect(() =>
      registerReadPolicyContext({
        taskId: 'TASK-link',
        workspaceRoot,
        providedFiles: ['linked/secret.txt'],
      })
    ).toThrow('Path escapes workspace root');
  });

  it('clears entries by taskId or agentId and rejects mismatched identifiers', () => {
    const workspaceRoot = makeWorkspace();
    registerReadPolicyContext({
      taskId: 'TASK-clear',
      agentId: 'agent-clear',
      workspaceRoot,
      providedFiles: ['src/index.ts'],
    });

    clearReadPolicyContext({ agentId: 'agent-clear' });
    expect(resolveReadPolicyContext({ taskId: 'TASK-clear' })).toBeNull();

    registerReadPolicyContext({
      taskId: 'TASK-clear',
      agentId: 'agent-clear',
      workspaceRoot,
      providedFiles: ['src/index.ts'],
    });
    clearReadPolicyContext({ taskId: 'TASK-clear' });
    expect(resolveReadPolicyContext({ agentId: 'agent-clear' })).toBeNull();

    registerReadPolicyContext({
      taskId: 'TASK-clear',
      agentId: 'agent-clear',
      workspaceRoot,
      providedFiles: ['src/index.ts'],
    });
    registerReadPolicyContext({
      taskId: 'TASK-other',
      agentId: 'agent-other',
      workspaceRoot,
      providedFiles: ['src/index.ts'],
    });
    expect(() => clearReadPolicyContext({ taskId: 'TASK-clear', agentId: 'agent-other' })).toThrow('agentId does not match taskId');
  });

  it('expires contexts based on ttl and enforces max entries', () => {
    let now = new Date('2025-01-01T00:00:00.000Z');
    configureReadPolicyRegistry({
      ttlMs: 500,
      maxEntries: 2,
      now: () => now,
    });

    registerReadPolicyContext({ taskId: 'TASK-1', providedFiles: [] });
    now = new Date('2025-01-01T00:00:00.100Z');
    registerReadPolicyContext({ taskId: 'TASK-2', providedFiles: [] });
    now = new Date('2025-01-01T00:00:00.200Z');
    registerReadPolicyContext({ taskId: 'TASK-3', providedFiles: [] });

    const list = listReadPolicyContexts();
    expect(list.map((entry) => entry.taskId)).toEqual(['TASK-2', 'TASK-3']);

    now = new Date('2025-01-01T00:00:01.000Z');
    listReadPolicyContexts();
    expect(resolveReadPolicyContext({ taskId: 'TASK-2' })).toBeNull();
    expect(resolveReadPolicyContext({ taskId: 'TASK-3' })).toBeNull();
  });

  it('evicts oldest entries when maxEntries is exceeded', () => {
    let now = new Date('2025-01-01T00:00:00.000Z');
    configureReadPolicyRegistry({ maxEntries: 1, now: () => now });

    registerReadPolicyContext({ taskId: 'TASK-old', providedFiles: [] });
    now = new Date('2025-01-01T00:00:01.000Z');
    registerReadPolicyContext({ taskId: 'TASK-new', providedFiles: [] });

    expect(resolveReadPolicyContext({ taskId: 'TASK-old' })).toBeNull();
    expect(resolveReadPolicyContext({ taskId: 'TASK-new' })?.taskId).toBe('TASK-new');
  });

  it('updates updatedAt on resolve', () => {
    let now = new Date('2025-01-01T00:00:00.000Z');
    configureReadPolicyRegistry({ now: () => now });
    const entry = registerReadPolicyContext({ taskId: 'TASK-time', providedFiles: [] });
    now = new Date('2025-01-01T00:00:01.000Z');
    const resolved = resolveReadPolicyContext({ taskId: 'TASK-time' });
    expect(resolved?.updatedAt).toBe(now.toISOString());
    expect(resolved?.updatedAt).not.toBe(entry.updatedAt);
  });

  it('returns copies of contexts to avoid mutation', () => {
    registerReadPolicyContext({
      taskId: 'TASK-copy',
      providedFiles: ['file.ts'],
      gaps: [{ description: 'gap' }],
    });

    const listed = listReadPolicyContexts();
    listed[0]?.providedFiles.push('extra.ts');

    const resolved = resolveReadPolicyContext({ taskId: 'TASK-copy' });
    expect(resolved?.providedFiles).toEqual([path.resolve('file.ts')]);
  });
});
