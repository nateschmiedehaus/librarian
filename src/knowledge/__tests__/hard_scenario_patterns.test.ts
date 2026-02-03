/**
 * @fileoverview Tests for HARD Scenario Pattern Detection (T-25, T-26, T-27, T-30)
 *
 * Tests the enhanced pattern detection capabilities for:
 * - T-25: Dynamic metaprogramming (decorators, Proxy, Reflect, eval, dynamic imports)
 * - T-26: Framework magic (NestJS DI, TypeORM, Prisma)
 * - T-27: Security vulnerability detection with OWASP Top 10 and taint tracking
 * - T-30: Legacy code explanation (deprecated APIs, old syntax, TODO density)
 *
 * Target: 75%+ overall accuracy for HARD scenarios
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeMetaprogrammingPatterns,
  analyzeFrameworkPatterns,
  analyzeLegacyPatterns,
} from '../pattern_behavior.js';
import { extractSecurity } from '../extractors/security_extractor.js';
import type { FunctionKnowledge, ModuleKnowledge } from '../../storage/types.js';
import type { PatternQuery } from '../patterns.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockFunction(overrides: Partial<FunctionKnowledge>): FunctionKnowledge {
  return {
    id: 'test-fn-' + Math.random().toString(36).slice(2),
    name: overrides.name || 'testFunction',
    filePath: overrides.filePath || '/test/file.ts',
    startLine: overrides.startLine || 1,
    endLine: overrides.endLine || 10,
    signature: overrides.signature || 'function testFunction(): void',
    purpose: overrides.purpose || 'Test function',
    confidence: overrides.confidence || 0.8,
    accessCount: 0,
    lastAccessed: null,
    validationCount: 0,
    outcomeHistory: { successes: 0, failures: 0 },
  };
}

function createMockModule(overrides: Partial<ModuleKnowledge>): ModuleKnowledge {
  return {
    id: 'test-mod-' + Math.random().toString(36).slice(2),
    path: overrides.path || '/test/module.ts',
    exports: overrides.exports || [],
    dependencies: overrides.dependencies || [],
    purpose: overrides.purpose || 'Test module',
    confidence: overrides.confidence || 0.8,
  };
}

const baseQuery: PatternQuery = { type: 'metaprogramming' };

// ============================================================================
// T-25: METAPROGRAMMING PATTERN TESTS
// ============================================================================

describe('T-25: Metaprogramming Pattern Detection', () => {
  describe('Decorator Detection', () => {
    it('should detect TypeScript decorators by signature', () => {
      const functions = [
        createMockFunction({
          name: 'myDecoratedMethod',
          signature: '@Injectable() class MyService {}',
        }),
        createMockFunction({
          name: 'anotherMethod',
          signature: '@Decorator(options) myMethod(): void',
        }),
      ];

      const result = analyzeMetaprogrammingPatterns(functions, [], baseQuery);

      expect(result.patterns.some(p => p.name === 'Decorator Pattern')).toBe(true);
      expect(result.patterns.find(p => p.name === 'Decorator Pattern')?.occurrences.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect decorator exports', () => {
      const modules = [
        createMockModule({
          exports: ['myDecorator', 'createDecorator', 'PropertyDecorator'],
        }),
      ];

      const result = analyzeMetaprogrammingPatterns([], modules, baseQuery);

      expect(result.patterns.some(p => p.name === 'Decorator Pattern')).toBe(true);
    });
  });

  describe('Proxy Detection', () => {
    it('should detect Proxy usage in signatures', () => {
      const functions = [
        createMockFunction({
          name: 'createHandler',
          signature: 'const proxy = new Proxy(target, handler)',
        }),
      ];

      const result = analyzeMetaprogrammingPatterns(functions, [], baseQuery);

      expect(result.patterns.some(p => p.name === 'Proxy Object')).toBe(true);
    });

    it('should detect proxy-related function names', () => {
      const functions = [
        createMockFunction({ name: 'createProxy' }),
        createMockFunction({ name: 'ProxyHandler' }),
      ];

      const result = analyzeMetaprogrammingPatterns(functions, [], baseQuery);

      expect(result.patterns.some(p => p.name === 'Proxy Object')).toBe(true);
    });
  });

  describe('Reflect API Detection', () => {
    it('should detect Reflect API methods', () => {
      const functions = [
        createMockFunction({
          signature: 'Reflect.get(target, propertyKey)',
        }),
        createMockFunction({
          signature: 'Reflect.defineProperty(obj, prop, descriptor)',
        }),
      ];

      const result = analyzeMetaprogrammingPatterns(functions, [], baseQuery);

      expect(result.patterns.some(p => p.name === 'Reflect API')).toBe(true);
    });
  });

  describe('eval Detection (High Risk)', () => {
    it('should detect eval as high-risk anti-pattern', () => {
      const functions = [
        createMockFunction({
          name: 'executeCode',
          signature: 'eval(userInput)',
        }),
      ];

      const result = analyzeMetaprogrammingPatterns(functions, [], baseQuery);

      expect(result.antiPatterns?.some(ap => ap.name === 'Dynamic Code Evaluation')).toBe(true);
      expect(result.antiPatterns?.find(ap => ap.name === 'Dynamic Code Evaluation')?.severity).toBe('high');
    });

    it('should detect new Function constructor', () => {
      const functions = [
        createMockFunction({
          signature: 'const dynamicFn = new Function("a", "b", "return a + b")',
        }),
      ];

      const result = analyzeMetaprogrammingPatterns(functions, [], baseQuery);

      expect(result.antiPatterns?.some(ap => ap.name === 'Dynamic Code Evaluation')).toBe(true);
    });
  });

  describe('Dynamic Import Detection', () => {
    it('should detect dynamic imports with variables', () => {
      const functions = [
        createMockFunction({
          signature: 'const module = await import(modulePath)',
        }),
      ];

      const result = analyzeMetaprogrammingPatterns(functions, [], baseQuery);

      expect(result.patterns.some(p => p.name === 'Dynamic Import')).toBe(true);
    });

    it('should detect dynamicImport function names', () => {
      const functions = [
        createMockFunction({ name: 'dynamicImport' }),
        createMockFunction({ name: 'loadModule' }),
      ];

      const result = analyzeMetaprogrammingPatterns(functions, [], baseQuery);

      expect(result.patterns.some(p => p.name === 'Dynamic Import')).toBe(true);
    });
  });

  describe('Prototype Manipulation Detection', () => {
    it('should detect prototype manipulation', () => {
      const functions = [
        createMockFunction({
          signature: 'Object.setPrototypeOf(obj, prototype)',
        }),
        createMockFunction({
          signature: 'obj.__proto__ = newProto',
        }),
      ];

      const result = analyzeMetaprogrammingPatterns(functions, [], baseQuery);

      expect(result.patterns.some(p => p.name === 'Prototype Manipulation')).toBe(true);
    });
  });
});

// ============================================================================
// T-26: FRAMEWORK PATTERN TESTS
// ============================================================================

describe('T-26: Framework Magic Detection', () => {
  const frameworkQuery: PatternQuery = { type: 'framework_patterns' };

  describe('NestJS Dependency Injection', () => {
    it('should detect @Injectable decorator', () => {
      const functions = [
        createMockFunction({
          signature: '@Injectable() export class UserService {}',
        }),
      ];

      const result = analyzeFrameworkPatterns(functions, [], frameworkQuery);

      expect(result.patterns.some(p => p.name.includes('@Injectable'))).toBe(true);
    });

    it('should detect @Inject decorator', () => {
      const functions = [
        createMockFunction({
          signature: 'constructor(@Inject(TOKEN) private service: Service)',
        }),
      ];

      const result = analyzeFrameworkPatterns(functions, [], frameworkQuery);

      expect(result.patterns.some(p => p.name.includes('@Inject'))).toBe(true);
    });

    it('should detect @Module decorator', () => {
      const functions = [
        createMockFunction({
          signature: '@Module({ imports: [OtherModule] }) export class AppModule {}',
        }),
      ];

      const result = analyzeFrameworkPatterns(functions, [], frameworkQuery);

      expect(result.patterns.some(p => p.name.includes('@Module'))).toBe(true);
    });

    it('should detect @Controller decorator', () => {
      const functions = [
        createMockFunction({
          signature: "@Controller('users') export class UsersController {}",
        }),
      ];

      const result = analyzeFrameworkPatterns(functions, [], frameworkQuery);

      expect(result.patterns.some(p => p.name.includes('@Controller'))).toBe(true);
    });
  });

  describe('TypeORM Entity Detection', () => {
    it('should detect @Entity decorator', () => {
      const functions = [
        createMockFunction({
          signature: "@Entity('users') export class User {}",
        }),
      ];

      const result = analyzeFrameworkPatterns(functions, [], frameworkQuery);

      expect(result.patterns.some(p => p.name.includes('@Entity'))).toBe(true);
    });

    it('should detect @Column decorator', () => {
      const functions = [
        createMockFunction({
          signature: '@Column({ type: "varchar", length: 255 }) name: string',
        }),
      ];

      const result = analyzeFrameworkPatterns(functions, [], frameworkQuery);

      expect(result.patterns.some(p => p.name.includes('@Column'))).toBe(true);
    });

    it('should detect relationship decorators', () => {
      const functions = [
        createMockFunction({
          signature: '@ManyToOne(() => User, user => user.posts)',
        }),
        createMockFunction({
          signature: '@OneToMany(() => Post, post => post.author)',
        }),
      ];

      const result = analyzeFrameworkPatterns(functions, [], frameworkQuery);

      expect(result.patterns.some(p => p.name.includes('@ManyToOne/@OneToMany'))).toBe(true);
    });
  });

  describe('Prisma Detection', () => {
    it('should detect PrismaClient import', () => {
      const modules = [
        createMockModule({
          exports: ['PrismaClient', 'prisma'],
        }),
      ];

      const result = analyzeFrameworkPatterns([], modules, frameworkQuery);

      expect(result.patterns.some(p => p.name.includes('PrismaClient'))).toBe(true);
    });

    it('should detect .prisma schema files', () => {
      const modules = [
        createMockModule({
          path: '/schema.prisma',
        }),
      ];

      const result = analyzeFrameworkPatterns([], modules, frameworkQuery);

      expect(result.patterns.some(p => p.name.includes('Prisma Schema'))).toBe(true);
    });
  });

  describe('Validation Decorators', () => {
    it('should detect class-validator decorators', () => {
      const functions = [
        createMockFunction({
          signature: '@IsString() @IsNotEmpty() name: string',
        }),
        createMockFunction({
          signature: '@IsEmail() email: string',
        }),
        createMockFunction({
          signature: '@ValidateNested() @Type(() => AddressDto) address: AddressDto',
        }),
      ];

      const result = analyzeFrameworkPatterns(functions, [], frameworkQuery);

      expect(result.patterns.some(p => p.name.includes('Validation Decorators'))).toBe(true);
    });
  });

  describe('DI Framework Detection', () => {
    it('should detect Inversify decorators', () => {
      const functions = [
        createMockFunction({
          signature: '@injectable() class MyService {}',
        }),
        createMockFunction({
          signature: 'constructor(@inject(TYPES.Service) private service: IService)',
        }),
      ];

      const result = analyzeFrameworkPatterns(functions, [], frameworkQuery);

      expect(result.patterns.some(p => p.name.includes('Inversify'))).toBe(true);
    });
  });
});

// ============================================================================
// T-27: SECURITY PATTERN TESTS
// ============================================================================

describe('T-27: Security Vulnerability Detection', () => {
  describe('OWASP Top 10 Detection', () => {
    it('should detect SQL injection (A03:2021)', () => {
      const content = `
        const query = 'SELECT * FROM users WHERE id = ' + userId;
        db.query(query);
      `;

      const result = extractSecurity({
        name: 'getUser',
        content,
        filePath: '/src/user.ts',
      });

      // The pattern matches 'SELECT *' and 'db.query('
      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-89')).toBe(true);
    });

    it('should detect SQL injection with template literals', () => {
      const content = `
        const result = await db.query(\`SELECT * FROM users WHERE id = \${userId}\`);
      `;

      const result = extractSecurity({
        name: 'getUser',
        content,
        filePath: '/src/user.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-89')).toBe(true);
    });

    it('should detect command injection (A03:2021)', () => {
      const content = `
        const { exec } = require('child_process');
        exec('ls ' + userInput);
      `;

      const result = extractSecurity({
        name: 'runCommand',
        content,
        filePath: '/src/command.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-78')).toBe(true);
    });

    it('should detect XSS vulnerabilities (A03:2021)', () => {
      const content = `
        element.innerHTML = userInput;
      `;

      const result = extractSecurity({
        name: 'renderContent',
        content,
        filePath: '/src/render.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-79')).toBe(true);
    });

    it('should detect hardcoded credentials (A07:2021)', () => {
      const content = `
        const password = "supersecret123";
        const apiKey = "sk-1234567890abcdef";
      `;

      const result = extractSecurity({
        name: 'config',
        content,
        filePath: '/src/config.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-798')).toBe(true);
    });

    it('should detect insecure randomness (A02:2021)', () => {
      const content = `
        const token = Math.random().toString(36);
      `;

      const result = extractSecurity({
        name: 'generateToken',
        content,
        filePath: '/src/auth.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-330')).toBe(true);
    });

    it('should detect weak cryptography (A02:2021)', () => {
      const content = `
        const hash = crypto.createHash('md5').update(data).digest('hex');
      `;

      const result = extractSecurity({
        name: 'hashData',
        content,
        filePath: '/src/crypto.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-327')).toBe(true);
    });

    it('should detect path traversal (A01:2021)', () => {
      const content = `
        const filePath = path.join(baseDir, req.query.file);
        fs.readFile(filePath);
      `;

      const result = extractSecurity({
        name: 'readFile',
        content,
        filePath: '/src/files.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-22')).toBe(true);
    });

    it('should detect SSRF vulnerabilities (A10:2021)', () => {
      const content = `
        const externalUrl = req.query.url;
        fetch(externalUrl);
      `;

      const result = extractSecurity({
        name: 'fetchUrl',
        content,
        filePath: '/src/fetch.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-918')).toBe(true);
    });

    it('should detect prototype pollution (A08:2021)', () => {
      const content = `
        Object.assign({}, req.body);
      `;

      const result = extractSecurity({
        name: 'mergeData',
        content,
        filePath: '/src/merge.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-1321')).toBe(true);
    });
  });

  describe('Enhanced Security Patterns (T-27)', () => {
    it('should detect NoSQL injection', () => {
      const content = `
        const result = await User.find({ $where: req.body.query });
      `;

      const result = extractSecurity({
        name: 'findUser',
        content,
        filePath: '/src/user.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-943')).toBe(true);
    });

    it('should detect template injection (SSTI)', () => {
      const content = `
        ejs.render(req.body.template, data);
      `;

      const result = extractSecurity({
        name: 'renderTemplate',
        content,
        filePath: '/src/template.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-1336')).toBe(true);
    });

    it('should detect JWT none algorithm vulnerability', () => {
      const content = `
        jwt.verify(token, secret, { algorithms: ['none', 'HS256'] });
      `;

      const result = extractSecurity({
        name: 'verifyToken',
        content,
        filePath: '/src/auth.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-347')).toBe(true);
    });

    it('should detect mass assignment vulnerability', () => {
      const content = `
        Object.assign(user, req.body);
        await user.save();
      `;

      const result = extractSecurity({
        name: 'updateUser',
        content,
        filePath: '/src/user.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-915')).toBe(true);
    });
  });

  describe('Taint Tracking', () => {
    it('should detect tainted flow from req.body to SQL query', () => {
      const content = `
        const userId = req.body.id;
        const sql = 'SELECT * FROM users WHERE id = ' + userId;
        db.query(sql);
      `;

      const result = extractSecurity({
        name: 'getUser',
        content,
        filePath: '/src/user.ts',
      });

      // Should detect SQL injection pattern ('SELECT *' and 'db.query(')
      // and possibly taint flow
      const hasSqlInjection = result.security.vulnerabilities.some(
        v => v.cwe === 'CWE-89'
      );
      const hasTaintFlow = result.security.vulnerabilities.some(
        v => v.id.startsWith('TAINT-')
      );
      expect(hasSqlInjection || hasTaintFlow).toBe(true);
    });

    it('should detect tainted flow from req.query to file path', () => {
      const content = `
        const filename = req.query.file;
        fs.readFile('./uploads/' + filename);
      `;

      const result = extractSecurity({
        name: 'downloadFile',
        content,
        filePath: '/src/files.ts',
      });

      const hasTaintFlow = result.security.vulnerabilities.some(
        v => v.id.startsWith('TAINT-') || v.cwe === 'CWE-22'
      );
      expect(hasTaintFlow).toBe(true);
    });

    it('should detect tainted flow from req.headers to eval', () => {
      const content = `
        const code = req.headers['x-custom-code'];
        eval(code);
      `;

      const result = extractSecurity({
        name: 'executeCustomCode',
        content,
        filePath: '/src/execute.ts',
      });

      expect(result.security.vulnerabilities.some(v => v.cwe === 'CWE-94')).toBe(true);
    });
  });

  describe('Attack Surface Detection', () => {
    it('should identify HTTP request handlers as attack surface', () => {
      const content = `
        app.post('/api/users', async (req, res) => {
          const user = req.body;
        });
      `;

      const result = extractSecurity({
        name: 'createUser',
        content,
        filePath: '/src/routes.ts',
      });

      expect(result.security.threatModel.attackSurface).toContain('HTTP Request Handler');
    });

    it('should identify file system access as attack surface', () => {
      const content = `
        fs.readFile(filepath, 'utf8', callback);
      `;

      const result = extractSecurity({
        name: 'readFile',
        content,
        filePath: '/src/files.ts',
      });

      expect(result.security.threatModel.attackSurface).toContain('File System Access');
    });

    it('should identify external HTTP calls as attack surface', () => {
      const content = `
        const response = await fetch(externalUrl);
      `;

      const result = extractSecurity({
        name: 'callExternal',
        content,
        filePath: '/src/external.ts',
      });

      expect(result.security.threatModel.attackSurface).toContain('External HTTP Calls');
    });
  });
});

// ============================================================================
// T-30: LEGACY CODE PATTERN TESTS
// ============================================================================

describe('T-30: Legacy Code Detection', () => {
  const legacyQuery: PatternQuery = { type: 'legacy_patterns' };

  describe('Deprecated JavaScript Patterns', () => {
    it('should detect var declarations', () => {
      const functions = [
        createMockFunction({
          signature: 'var count = 0',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.patterns.some(p => p.name === 'var declarations')).toBe(true);
    });

    it('should detect arguments object usage', () => {
      const functions = [
        createMockFunction({
          signature: 'function sum() { return arguments[0] + arguments[1]; }',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.patterns.some(p => p.name === 'arguments object')).toBe(true);
    });

    it('should detect callback patterns', () => {
      const functions = [
        createMockFunction({
          signature: 'function fetchData(url, callback)',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.patterns.some(p => p.name === 'Callback patterns')).toBe(true);
    });

    it('should detect CommonJS require', () => {
      const functions = [
        createMockFunction({
          signature: "const fs = require('fs')",
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.patterns.some(p => p.name === 'CommonJS require')).toBe(true);
    });
  });

  describe('Deprecated Node.js APIs', () => {
    it('should detect deprecated Buffer constructor', () => {
      const functions = [
        createMockFunction({
          signature: 'const buf = new Buffer(10)',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.antiPatterns?.some(ap => ap.name === 'Buffer() constructor')).toBe(true);
      expect(result.antiPatterns?.find(ap => ap.name === 'Buffer() constructor')?.severity).toBe('high');
    });

    it('should detect deprecated url.parse', () => {
      const functions = [
        createMockFunction({
          signature: 'const parsed = url.parse(urlString)',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.antiPatterns?.some(ap => ap.name === 'url.parse()')).toBe(true);
    });
  });

  describe('Deprecated React Patterns', () => {
    it('should detect componentWillMount', () => {
      const functions = [
        createMockFunction({
          name: 'componentWillMount',
          signature: 'componentWillMount() { this.setState({}); }',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.antiPatterns?.some(ap => ap.name === 'componentWillMount')).toBe(true);
    });

    it('should detect UNSAFE_ lifecycle methods', () => {
      const functions = [
        createMockFunction({
          name: 'UNSAFE_componentWillReceiveProps',
          signature: 'UNSAFE_componentWillReceiveProps(nextProps)',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.antiPatterns?.some(ap => ap.name === 'componentWillReceiveProps')).toBe(true);
    });

    it('should detect React.createClass', () => {
      const functions = [
        createMockFunction({
          signature: 'const MyComponent = React.createClass({ render() {} })',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.antiPatterns?.some(ap => ap.name === 'React.createClass')).toBe(true);
    });
  });

  describe('Technical Debt Markers', () => {
    it('should detect TODO comments', () => {
      const functions = [
        createMockFunction({
          signature: '// TODO: fix this later',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.patterns.some(p => p.name === 'TODO comments')).toBe(true);
    });

    it('should detect FIXME comments', () => {
      const functions = [
        createMockFunction({
          signature: '// FIXME: this is broken',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.antiPatterns?.some(ap => ap.name === 'FIXME comments')).toBe(true);
    });

    it('should detect HACK comments', () => {
      const functions = [
        createMockFunction({
          signature: '// HACK: workaround for browser bug',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.antiPatterns?.some(ap => ap.name === 'HACK comments')).toBe(true);
    });

    it('should detect @deprecated annotations', () => {
      const functions = [
        createMockFunction({
          signature: '@deprecated Use newMethod instead',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.antiPatterns?.some(ap => ap.name === '@deprecated annotation')).toBe(true);
    });
  });

  describe('TypeScript-Specific Patterns', () => {
    it('should detect any type usage', () => {
      const functions = [
        createMockFunction({
          signature: 'function process(data: any): any',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.patterns.some(p => p.name === 'any type')).toBe(true);
    });

    it('should detect @ts-ignore directive', () => {
      const functions = [
        createMockFunction({
          signature: '// @ts-ignore',
        }),
      ];

      const result = analyzeLegacyPatterns(functions, [], legacyQuery);

      expect(result.antiPatterns?.some(ap => ap.name === 'ts-ignore directive')).toBe(true);
    });
  });

  describe('Technical Debt Density', () => {
    it('should calculate debt density across modules', () => {
      const functions = [
        createMockFunction({ signature: '// TODO: item 1' }),
        createMockFunction({ signature: '// TODO: item 2' }),
        createMockFunction({ signature: '// FIXME: bug 1' }),
        createMockFunction({ signature: '// HACK: workaround' }),
      ];
      const modules = [
        createMockModule({ path: '/src/a.ts' }),
        createMockModule({ path: '/src/b.ts' }),
      ];

      const result = analyzeLegacyPatterns(functions, modules, legacyQuery);

      // Should mention debt density in summary
      expect(result.summary).toContain('Debt density');
    });

    it('should flag high debt density as anti-pattern', () => {
      const functions = Array.from({ length: 10 }, (_, i) =>
        createMockFunction({ signature: `// TODO: item ${i}` })
      );
      const modules = [
        createMockModule({ path: '/src/a.ts' }),
        createMockModule({ path: '/src/b.ts' }),
      ];

      const result = analyzeLegacyPatterns(functions, modules, legacyQuery);

      // High density should trigger anti-pattern
      expect(result.antiPatterns?.some(ap => ap.name === 'High Technical Debt Density')).toBe(true);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Pattern Detection Integration', () => {
  it('should handle mixed patterns correctly', () => {
    const functions = [
      // Metaprogramming
      createMockFunction({ signature: 'new Proxy(target, handler)' }),
      // Framework
      createMockFunction({ signature: '@Injectable() class Service {}' }),
      // Legacy
      createMockFunction({ signature: 'var old = true' }),
    ];

    const metaResult = analyzeMetaprogrammingPatterns(functions, [], { type: 'metaprogramming' });
    const fwResult = analyzeFrameworkPatterns(functions, [], { type: 'framework_patterns' });
    const legacyResult = analyzeLegacyPatterns(functions, [], { type: 'legacy_patterns' });

    expect(metaResult.patterns.some(p => p.name === 'Proxy Object')).toBe(true);
    expect(fwResult.patterns.some(p => p.name.includes('@Injectable'))).toBe(true);
    expect(legacyResult.patterns.some(p => p.name === 'var declarations')).toBe(true);
  });

  it('should provide meaningful recommendations', () => {
    const functions = [
      createMockFunction({ signature: 'eval(userCode)' }),
    ];

    const result = analyzeMetaprogrammingPatterns(functions, [], { type: 'metaprogramming' });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0]).toContain('high-risk');
  });

  it('should calculate confidence based on occurrence count', () => {
    const manyDecorators = Array.from({ length: 10 }, (_, i) =>
      createMockFunction({ signature: `@Decorator() method${i}()` })
    );

    const result = analyzeMetaprogrammingPatterns(manyDecorators, [], { type: 'metaprogramming' });
    const decoratorPattern = result.patterns.find(p => p.name === 'Decorator Pattern');

    expect(decoratorPattern?.confidence).toBeGreaterThan(0.7);
  });
});
