import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, '..');

const CLAIM_SURFACE_FILES = [
  'epistemics/types.ts',
  'epistemics/defeater_ledger.ts',
  'api/zero_knowledge_bootstrap.ts',
];

const NUMERIC_CONFIDENCE_PATTERN = /\bconfidence\s*:\s*-?\d+(?:\.\d+)?\b/g;

function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, (line) => line.replace(/./g, ' '));
}

describe('claim confidence surfaces', () => {
  it('do not expose raw numeric confidence values', () => {
    const failures: string[] = [];

    for (const relativePath of CLAIM_SURFACE_FILES) {
      const fullPath = path.resolve(srcRoot, relativePath);
      const raw = readFileSync(fullPath, 'utf8');
      const content = stripComments(raw);
      const matches = content.match(NUMERIC_CONFIDENCE_PATTERN);
      if (matches && matches.length > 0) {
        failures.push(`${relativePath}: ${matches.join(', ')}`);
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });
});
