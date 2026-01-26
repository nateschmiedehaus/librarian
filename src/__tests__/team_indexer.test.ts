import { describe, it, expect } from 'vitest';
import { parseCodeowners } from '../ingest/team_indexer.js';

describe('team_indexer', () => {
  it('parses CODEOWNERS entries', () => {
    const content = [
      '# comment',
      '* @core-team',
      '/docs/ @docs-team @reviewer',
      '',
      'src/** @dev1',
    ].join('\n');

    const entries = parseCodeowners(content);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ pattern: '*', owners: ['@core-team'] });
    expect(entries[1]).toEqual({ pattern: '/docs/', owners: ['@docs-team', '@reviewer'] });
    expect(entries[2]).toEqual({ pattern: 'src/**', owners: ['@dev1'] });
  });
});
