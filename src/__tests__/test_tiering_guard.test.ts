/**
 * @fileoverview Tiering guardrails (mechanical, deterministic)
 *
 * Prevents "test theater" where provider-dependent tests accidentally run in
 * `LIBRARIAN_TEST_MODE=unit` (Tier-0) by slipping into plain `*.test.ts` files.
 *
 * Rule: Any test file that calls `checkAllProviders` / `requireProviders` must
 * be named `*.integration.test.ts`, `*.system.test.ts`, or `*.live.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const TIERED_SUFFIX_RE = /\.(integration|system|live)\.test\.ts$/;
const PLAIN_TEST_RE = /\.test\.ts$/;

describe('Test tiering guardrails', () => {
  it('keeps provider checks out of plain *.test.ts files', async () => {
    const testDir = import.meta.dirname;
    const entries = await fs.readdir(testDir, { withFileTypes: true });
    const offenders: Array<{ file: string; hits: string[] }> = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!PLAIN_TEST_RE.test(entry.name)) continue;
      if (TIERED_SUFFIX_RE.test(entry.name)) continue;
      if (entry.name === 'test_tiering_guard.test.ts') continue;

      const fullPath = path.join(testDir, entry.name);
      const text = await fs.readFile(fullPath, 'utf8');
      const hits: string[] = [];

      // These identifiers should only exist in integration/system/live tests.
      if (/\bcheckAllProviders\b/.test(text)) hits.push('checkAllProviders');
      if (/\brequireProviders\b/.test(text)) hits.push('requireProviders');

      if (hits.length) offenders.push({ file: entry.name, hits });
    }

    expect(offenders, `Provider checks found in Tier-0 tests:\n${JSON.stringify(offenders, null, 2)}`).toEqual([]);
  });
});
