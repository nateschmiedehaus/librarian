import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../ingest/docs_indexer.js';

describe('docs_indexer', () => {
  it('parses headings, links, and code blocks', () => {
    const content = [
      '# Title',
      'Intro with [link](https://example.com).',
      '## Section',
      '```ts',
      'const value = 42;',
      '```',
    ].join('\n');

    const result = parseMarkdown(content);

    expect(result.headings).toHaveLength(2);
    expect(result.headings[0]?.text).toBe('Title');
    expect(result.links).toHaveLength(1);
    expect(result.links[0]?.url).toBe('https://example.com');
    expect(result.codeBlocks).toHaveLength(1);
    expect(result.codeBlocks[0]?.language).toBe('ts');
    expect(result.codeBlocks[0]?.content).toContain('const value = 42;');
  });
});
