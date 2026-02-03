/**
 * @fileoverview Tests for Code Review Support System
 *
 * Tests the code review functionality for:
 * - Security issue detection
 * - Performance anti-pattern detection
 * - Maintainability analysis
 * - Error handling verification
 * - Type safety checks
 * - Naming convention analysis
 * - Best practices enforcement
 * - Query integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  reviewCode,
  reviewChangeSet,
  quickReview,
  isCodeReviewQuery,
  extractReviewFilePath,
  formatCodeReviewResult,
  CODE_REVIEW_PATTERNS,
  type CodeReviewResult,
  type ReviewIssue,
} from '../code_review.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createTempFile = (content: string, extension = '.ts'): string => {
  const tempDir = os.tmpdir();
  // Use 'review-' prefix to avoid triggering test file detection
  const tempFile = path.join(tempDir, `review-${Date.now()}${extension}`);
  fs.writeFileSync(tempFile, content);
  return tempFile;
};

const cleanupTempFile = (filePath: string): void => {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Ignore cleanup errors
  }
};

// ============================================================================
// SECURITY DETECTION TESTS
// ============================================================================

describe('Security Issue Detection', () => {
  let tempFile: string;

  afterEach(() => {
    if (tempFile) cleanupTempFile(tempFile);
  });

  it('should detect eval() usage', async () => {
    tempFile = createTempFile(`
      function dangerous(code: string) {
        return eval(code);
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'security' &&
      i.severity === 'critical' &&
      i.message.includes('eval')
    )).toBe(true);
  });

  it('should detect SQL injection patterns', async () => {
    tempFile = createTempFile(`
      async function queryUser(userId: string) {
        const query = \`SELECT * FROM users WHERE id = \${userId}\`;
        return db.query(query);
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'security' &&
      i.severity === 'critical' &&
      i.message.includes('SQL injection')
    )).toBe(true);
  });

  it('should detect hardcoded secrets', async () => {
    tempFile = createTempFile(`
      const config = {
        password: "supersecretpassword123",
        apiKey: "sk-1234567890abcdef"
      };
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'security' &&
      i.severity === 'critical' &&
      i.message.includes('hardcoded secret')
    )).toBe(true);
  });

  it('should detect innerHTML XSS risk', async () => {
    tempFile = createTempFile(`
      function setContent(html: string) {
        document.getElementById('content').innerHTML = html;
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'security' &&
      i.message.includes('innerHTML')
    )).toBe(true);
  });

  it('should detect insecure random for secrets', async () => {
    tempFile = createTempFile(`
      function generateToken() {
        return 'token_' + Math.random().toString(36);
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'security' &&
      i.message.includes('Math.random')
    )).toBe(true);
  });
});

// ============================================================================
// PERFORMANCE DETECTION TESTS
// ============================================================================

describe('Performance Issue Detection', () => {
  let tempFile: string;

  afterEach(() => {
    if (tempFile) cleanupTempFile(tempFile);
  });

  it('should detect await in loop', async () => {
    tempFile = createTempFile(`
      async function processAll(items: string[]) {
        for (const item of items) {
          await processItem(item);
        }
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'performance' &&
      i.message.includes('await') &&
      i.message.includes('loop')
    )).toBe(true);
  });

  it('should detect chained filter().map()', async () => {
    tempFile = createTempFile(`
      const result = items.filter(x => x > 0).map(x => x * 2);
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'performance' &&
      i.message.includes('filter') &&
      i.message.includes('map')
    )).toBe(true);
  });

  it('should detect synchronous file operations', async () => {
    tempFile = createTempFile(`
      function loadConfig() {
        const data = fs.readFileSync('config.json', 'utf-8');
        return JSON.parse(data);
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'performance' &&
      i.message.includes('Synchronous')
    )).toBe(true);
  });
});

// ============================================================================
// MAINTAINABILITY DETECTION TESTS
// ============================================================================

describe('Maintainability Issue Detection', () => {
  let tempFile: string;

  afterEach(() => {
    if (tempFile) cleanupTempFile(tempFile);
  });

  it('should detect long files', async () => {
    const longContent = Array(600).fill('const x = 1;').join('\n');
    tempFile = createTempFile(longContent);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'maintainability' &&
      i.message.includes('lines')
    )).toBe(true);
  });

  it('should detect deeply nested code', async () => {
    tempFile = createTempFile(`
      function nested() {
        if (a) {
          if (b) {
            if (c) {
              if (d) {
                if (e) {
                  doSomething();
                }
              }
            }
          }
        }
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'maintainability' &&
      i.message.includes('nested')
    )).toBe(true);
  });
});

// ============================================================================
// ERROR HANDLING DETECTION TESTS
// ============================================================================

describe('Error Handling Issue Detection', () => {
  let tempFile: string;

  afterEach(() => {
    if (tempFile) cleanupTempFile(tempFile);
  });

  it('should detect empty catch blocks', async () => {
    tempFile = createTempFile(`
      try {
        doSomething();
      } catch (e) {}
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'error_handling' &&
      i.severity === 'major' &&
      i.message.includes('Empty catch')
    )).toBe(true);
  });

  it('should detect throwing string literals', async () => {
    tempFile = createTempFile(`
      function validate(input: string) {
        if (!input) {
          throw "Input is required";
        }
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'error_handling' &&
      i.message.includes('string literal')
    )).toBe(true);
  });
});

// ============================================================================
// TYPE SAFETY DETECTION TESTS
// ============================================================================

describe('Type Safety Issue Detection', () => {
  let tempFile: string;

  afterEach(() => {
    if (tempFile) cleanupTempFile(tempFile);
  });

  it('should detect "as any" type assertions', async () => {
    tempFile = createTempFile(`
      const value = unknownValue as any;
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'type_safety' &&
      i.message.includes('any')
    )).toBe(true);
  });

  it('should detect @ts-ignore without explanation', async () => {
    tempFile = createTempFile(`
      // @ts-ignore
      const x = someUntypedValue;
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'type_safety' &&
      i.message.includes('@ts-ignore')
    )).toBe(true);
  });

  it('should allow @ts-ignore with explanation', async () => {
    tempFile = createTempFile(`
      // @ts-ignore: Third-party library has incorrect types
      const x = someUntypedValue;
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.filter(i =>
      i.category === 'type_safety' &&
      i.message.includes('@ts-ignore')
    ).length).toBe(0);
  });

  it('should skip type safety checks for non-TypeScript files', async () => {
    tempFile = createTempFile(`
      const value = unknownValue as any;
    `, '.js');

    const result = await reviewCode(null, tempFile);

    expect(result.issues.filter(i => i.category === 'type_safety').length).toBe(0);
  });
});

// ============================================================================
// NAMING DETECTION TESTS
// ============================================================================

describe('Naming Issue Detection', () => {
  let tempFile: string;

  afterEach(() => {
    if (tempFile) cleanupTempFile(tempFile);
  });

  it('should detect multiple single-letter variable names', async () => {
    tempFile = createTempFile(`
      const a = 1;
      const b = 2;
      const c = 3;
      const d = 4;
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'naming' &&
      i.message.includes('single-letter')
    )).toBe(true);
  });

  it('should allow common single-letter variables', async () => {
    tempFile = createTempFile(`
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          console.log(i, j);
        }
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.filter(i =>
      i.category === 'naming' &&
      i.message.includes('single-letter')
    ).length).toBe(0);
  });
});

// ============================================================================
// BEST PRACTICES DETECTION TESTS
// ============================================================================

describe('Best Practices Issue Detection', () => {
  let tempFile: string;

  afterEach(() => {
    if (tempFile) cleanupTempFile(tempFile);
  });

  it('should detect multiple console.log statements in production code', async () => {
    tempFile = createTempFile(`
      function process() {
        console.log('Starting');
        console.log('Processing');
        console.log('Done');
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'best_practices' &&
      i.message.includes('console')
    )).toBe(true);
  });

  it('should not flag console.log in test files', async () => {
    const tempDir = os.tmpdir();
    tempFile = path.join(tempDir, `test-${Date.now()}.test.ts`);
    fs.writeFileSync(tempFile, `
      describe('test', () => {
        console.log('Debug');
        console.log('Info');
        console.log('More');
      });
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.filter(i =>
      i.category === 'best_practices' &&
      i.message.includes('console')
    ).length).toBe(0);
  });

  it('should detect var usage', async () => {
    tempFile = createTempFile(`
      var oldStyle = "value";
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'best_practices' &&
      i.message.includes('var')
    )).toBe(true);
  });

  it('should detect loose equality', async () => {
    tempFile = createTempFile(`
      if (a == b) {
        doSomething();
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'best_practices' &&
      i.message.includes('loose equality')
    )).toBe(true);
  });

  it('should detect disabled tests', async () => {
    tempFile = createTempFile(`
      describe.skip('disabled suite', () => {
        it.skip('disabled test', () => {});
      });
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.issues.some(i =>
      i.category === 'best_practices' &&
      i.message.includes('disabled test')
    )).toBe(true);
  });
});

// ============================================================================
// SCORING TESTS
// ============================================================================

describe('Scoring', () => {
  let tempFile: string;

  afterEach(() => {
    if (tempFile) cleanupTempFile(tempFile);
  });

  it('should give high score for clean code', async () => {
    tempFile = createTempFile(`
      /**
       * Calculate the sum of two numbers.
       */
      export function add(a: number, b: number): number {
        return a + b;
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.overallScore).toBeGreaterThanOrEqual(90);
  });

  it('should reduce score for critical issues', async () => {
    tempFile = createTempFile(`
      function dangerous(code: string) {
        return eval(code);
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.overallScore).toBeLessThan(90);
  });

  it('should reduce score significantly for multiple critical issues', async () => {
    tempFile = createTempFile(`
      const password = "secret123";
      function dangerous(code: string) {
        return eval(code);
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.overallScore).toBeLessThan(70);
  });
});

// ============================================================================
// POSITIVE DETECTION TESTS
// ============================================================================

describe('Positive Detection', () => {
  let tempFile: string;

  afterEach(() => {
    if (tempFile) cleanupTempFile(tempFile);
  });

  it('should detect TypeScript types usage', async () => {
    tempFile = createTempFile(`
      export interface User {
        id: string;
        name: string;
      }

      export type UserRole = 'admin' | 'user';
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.positives.some(p =>
      p.includes('TypeScript types')
    )).toBe(true);
  });

  it('should detect error handling', async () => {
    tempFile = createTempFile(`
      async function fetchData() {
        try {
          return await fetch('/api');
        } catch (error) {
          console.error(error);
          throw error;
        }
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.positives.some(p =>
      p.includes('Error handling')
    )).toBe(true);
  });

  it('should detect JSDoc documentation', async () => {
    tempFile = createTempFile(`
      /**
       * Calculate the sum of two numbers.
       * @param a - First number
       * @param b - Second number
       * @returns The sum
       */
      function add(a: number, b: number): number {
        return a + b;
      }
    `);

    const result = await reviewCode(null, tempFile);

    expect(result.positives.some(p =>
      p.includes('JSDoc')
    )).toBe(true);
  });
});

// ============================================================================
// CHANGE SET REVIEW TESTS
// ============================================================================

describe('Change Set Review', () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const file of tempFiles) {
      cleanupTempFile(file);
    }
    tempFiles.length = 0;
  });

  it('should review multiple files', async () => {
    const file1 = createTempFile('const a = 1;');
    const file2 = createTempFile('const b = 2;');
    tempFiles.push(file1, file2);

    const result = await reviewChangeSet(null, [file1, file2]);

    expect(result.fileReviews).toHaveLength(2);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('should aggregate issue counts', async () => {
    const file1 = createTempFile('eval("code");');
    const file2 = createTempFile('eval("more code");');
    tempFiles.push(file1, file2);

    const result = await reviewChangeSet(null, [file1, file2]);

    expect(result.issueCounts.critical).toBeGreaterThanOrEqual(2);
  });

  it('should detect cross-file security concerns', async () => {
    const file1 = createTempFile('eval("code");');
    const file2 = createTempFile('const password = "supersecret123";');
    tempFiles.push(file1, file2);

    const result = await reviewChangeSet(null, [file1, file2]);

    expect(result.crossFileConcerns.some(c =>
      c.includes('Security')
    )).toBe(true);
  });

  it('should skip unreadable files', async () => {
    const file1 = createTempFile('const a = 1;');
    tempFiles.push(file1);

    const result = await reviewChangeSet(null, [file1, '/nonexistent/file.ts']);

    expect(result.fileReviews).toHaveLength(1);
  });
});

// ============================================================================
// QUICK REVIEW TESTS
// ============================================================================

describe('Quick Review', () => {
  let tempFile: string;

  afterEach(() => {
    if (tempFile) cleanupTempFile(tempFile);
  });

  it('should only return critical and major issues', async () => {
    tempFile = createTempFile(`
      eval("code"); // critical
      var x = 1; // info
    `);

    const result = await quickReview(tempFile);

    expect(result.issues.every(i =>
      i.severity === 'critical' || i.severity === 'major'
    )).toBe(true);
  });
});

// ============================================================================
// QUERY INTEGRATION TESTS
// ============================================================================

describe('Query Integration', () => {
  describe('isCodeReviewQuery', () => {
    it('should detect code review queries', () => {
      expect(isCodeReviewQuery('review this file')).toBe(true);
      expect(isCodeReviewQuery('code review for query.ts')).toBe(true);
      expect(isCodeReviewQuery('check this code for issues')).toBe(true);
      expect(isCodeReviewQuery('analyze code quality')).toBe(true);
      expect(isCodeReviewQuery('find issues in this file')).toBe(true);
      expect(isCodeReviewQuery('security review')).toBe(true);
      expect(isCodeReviewQuery('pre-commit review')).toBe(true);
    });

    it('should not match non-review queries', () => {
      expect(isCodeReviewQuery('what does this function do')).toBe(false);
      expect(isCodeReviewQuery('how does the storage work')).toBe(false);
      expect(isCodeReviewQuery('find all users of this API')).toBe(false);
    });
  });

  describe('extractReviewFilePath', () => {
    it('should extract file paths from queries', () => {
      expect(extractReviewFilePath('review file src/api/query.ts')).toBe('src/api/query.ts');
      expect(extractReviewFilePath('check "src/storage/types.ts"')).toBe('src/storage/types.ts');
      expect(extractReviewFilePath("review 'index.js'")).toBe('index.js');
    });

    it('should return undefined for queries without file paths', () => {
      expect(extractReviewFilePath('review this code')).toBeUndefined();
      expect(extractReviewFilePath('code review')).toBeUndefined();
    });
  });

  describe('formatCodeReviewResult', () => {
    it('should format results as markdown', () => {
      const result: CodeReviewResult = {
        file: 'test.ts',
        overallScore: 75,
        issues: [
          {
            severity: 'major',
            category: 'security',
            line: 10,
            message: 'Security issue found',
            code: 'eval(code)',
            suggestion: 'Avoid eval',
          },
        ],
        suggestions: [
          {
            category: 'testing',
            description: 'Add tests',
            benefit: 'Improve confidence',
            effort: 'medium',
          },
        ],
        positives: ['Good types'],
        summary: 'Some issues found',
        reviewTimeMs: 100,
      };

      const formatted = formatCodeReviewResult(result);

      expect(formatted).toContain('## Code Review: test.ts');
      expect(formatted).toContain('**Score:** 75/100');
      expect(formatted).toContain('[MAJOR]');
      expect(formatted).toContain('security');
      expect(formatted).toContain('Good types');
    });

    it('should include verbose details when requested', () => {
      const result: CodeReviewResult = {
        file: 'test.ts',
        overallScore: 75,
        issues: [
          {
            severity: 'major',
            category: 'security',
            line: 10,
            message: 'Security issue found',
            code: 'eval(code)',
            suggestion: 'Avoid eval',
          },
        ],
        suggestions: [
          {
            category: 'testing',
            description: 'Add tests',
            benefit: 'Improve confidence',
            effort: 'medium',
          },
        ],
        positives: [],
        summary: 'Some issues found',
        reviewTimeMs: 100,
      };

      const formatted = formatCodeReviewResult(result, true);

      expect(formatted).toContain('eval(code)');
      expect(formatted).toContain('Avoid eval');
      expect(formatted).toContain('### Suggestions');
      expect(formatted).toContain('Improve confidence');
    });
  });
});

// ============================================================================
// REVIEW OPTIONS TESTS
// ============================================================================

describe('Review Options', () => {
  let tempFile: string;

  afterEach(() => {
    if (tempFile) cleanupTempFile(tempFile);
  });

  it('should filter by categories', async () => {
    tempFile = createTempFile(`
      eval("code"); // security
      var x = 1; // best_practices
    `);

    const result = await reviewCode(null, tempFile, {
      categories: ['security'],
    });

    expect(result.issues.every(i => i.category === 'security')).toBe(true);
    expect(result.issues.some(i => i.message.includes('eval'))).toBe(true);
  });

  it('should filter by minimum severity', async () => {
    tempFile = createTempFile(`
      eval("code"); // critical
      const a = 1; // minor naming
      var x = 1; // info best_practices
    `);

    const result = await reviewCode(null, tempFile, {
      minSeverity: 'major',
    });

    expect(result.issues.every(i =>
      i.severity === 'critical' || i.severity === 'major'
    )).toBe(true);
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling', () => {
  it('should throw for non-existent files', async () => {
    await expect(reviewCode(null, '/nonexistent/path.ts'))
      .rejects.toThrow('Cannot read file');
  });
});

// ============================================================================
// PATTERN COVERAGE TESTS
// ============================================================================

describe('CODE_REVIEW_PATTERNS', () => {
  it('should have comprehensive patterns', () => {
    expect(CODE_REVIEW_PATTERNS.length).toBeGreaterThan(5);
  });

  it('should match various review query formats', () => {
    const testQueries = [
      'review this file',
      'code review',
      'check this code for issues',
      'analyze code quality',
      'find issues in this file',
      'quality check',
      'pre-commit review',
      'what issues are in this file',
      'security review',
    ];

    for (const query of testQueries) {
      expect(CODE_REVIEW_PATTERNS.some(p => p.test(query))).toBe(true);
    }
  });
});
