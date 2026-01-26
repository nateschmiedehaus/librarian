import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  applyEpistemicPolicy,
  loadEpistemicPolicy,
  DEFAULT_EPISTEMIC_POLICY,
} from '../epistemic_policy.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lcl-policy-'));
});

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe('epistemic policy', () => {
  it('loads default policy when config is missing', async () => {
    const policy = await loadEpistemicPolicy(tempDir);
    expect(policy).toEqual(DEFAULT_EPISTEMIC_POLICY);
  });

  it('rejects claims below the confidence threshold', () => {
    const policy = { ...DEFAULT_EPISTEMIC_POLICY, claimThreshold: 0.8 };
    const allowed = applyEpistemicPolicy({ evidence: ['proof'] }, 0.5, policy);
    expect(allowed).toBe(false);
  });

  it('requires evidence when configured', () => {
    const policy = { ...DEFAULT_EPISTEMIC_POLICY, evidenceRequired: true, claimThreshold: 0.4 };
    const allowed = applyEpistemicPolicy({}, 0.6, policy);
    expect(allowed).toBe(false);
  });

  it('allows claims when evidence and confidence are sufficient', () => {
    const policy = { ...DEFAULT_EPISTEMIC_POLICY, claimThreshold: 0.4 };
    const allowed = applyEpistemicPolicy({ evidence: { source: 'ast' } }, 0.6, policy);
    expect(allowed).toBe(true);
  });
});
