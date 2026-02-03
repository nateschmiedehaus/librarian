import type { FunctionKnowledge, ModuleKnowledge } from '../storage/types.js';
import type { DetectedPattern, DetectedAntiPattern, PatternQuery, PatternResult, PatternOccurrence } from './patterns.js';

export function analyzeErrorHandlingPatterns(
  functions: FunctionKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];

  const errorHandlers = functions.filter((f) =>
    /error|catch|handle|throw/i.test(f.name) || /try|catch|throw/i.test(f.signature)
  );

  if (errorHandlers.length > 0) {
    patterns.push({
      name: 'Centralized Error Handling',
      type: 'behavioral',
      occurrences: errorHandlers.slice(0, 5).map((f) => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: Math.min(0.9, errorHandlers.length / Math.max(1, functions.length)),
      description: `${errorHandlers.length} dedicated error handling functions`,
    });
  }

  return {
    query,
    patterns,
    summary: `Found ${patterns.length} error handling patterns`,
    recommendations: errorHandlers.length < 3
      ? ['Consider implementing centralized error handling']
      : [],
  };
}

export function analyzeAsyncPatterns(functions: FunctionKnowledge[], query: PatternQuery): PatternResult {
  const patterns: DetectedPattern[] = [];

  const asyncFunctions = functions.filter((f) =>
    f.signature.includes('async') || f.signature.includes('Promise') || f.signature.includes('=>')
  );

  if (asyncFunctions.length > 0) {
    patterns.push({
      name: 'Async/Await',
      type: 'behavioral',
      occurrences: asyncFunctions.slice(0, 5).map((f) => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.signature.substring(0, 50),
      })),
      confidence: asyncFunctions.length / Math.max(1, functions.length),
      description: `${asyncFunctions.length} async functions (${Math.round(asyncFunctions.length / Math.max(1, functions.length) * 100)}%)`,
    });
  }

  return {
    query,
    patterns,
    summary: `${asyncFunctions.length} async functions`,
    recommendations: [],
  };
}

export function analyzeTestingPatterns(functions: FunctionKnowledge[], query: PatternQuery): PatternResult {
  const patterns: DetectedPattern[] = [];
  const testFunctions = functions.filter((f) =>
    f.filePath.includes('.test.') ||
    f.filePath.includes('.spec.') ||
    f.filePath.includes('__tests__')
  );

  const describeFunctions = testFunctions.filter((f) =>
    f.name.toLowerCase() === 'describe' || f.purpose.toLowerCase().includes('describe')
  );
  if (describeFunctions.length > 0 || testFunctions.length > 10) {
    patterns.push({
      name: 'BDD Testing Style',
      type: 'team',
      occurrences: [],
      confidence: 0.9,
      description: 'Uses describe/it pattern for tests',
    });
  }

  const mockFunctions = testFunctions.filter((f) =>
    f.name.toLowerCase().includes('mock') ||
    f.name.toLowerCase().includes('stub') ||
    f.name.toLowerCase().includes('spy')
  );
  if (mockFunctions.length > 0) {
    patterns.push({
      name: 'Mock-Based Testing',
      type: 'team',
      occurrences: mockFunctions.slice(0, 3).map((f) => ({
        file: f.filePath,
        line: f.startLine,
        evidence: f.name,
      })),
      confidence: 0.7,
      description: 'Uses mocks/stubs for test isolation',
    });
  }

  return {
    query,
    patterns,
    summary: `${testFunctions.length} test functions, ${patterns.length} patterns`,
    recommendations: [],
  };
}

// ============================================================================
// T-25: METAPROGRAMMING PATTERNS
// Dynamic metaprogramming detection: decorators, Proxy, Reflect, eval, dynamic imports
// ============================================================================

/**
 * Metaprogramming pattern definitions for detection
 */
interface MetaprogrammingPattern {
  name: string;
  signaturePattern?: RegExp;
  namePattern?: RegExp;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

const METAPROGRAMMING_PATTERNS: MetaprogrammingPattern[] = [
  // Decorator patterns
  {
    name: 'Decorator Pattern',
    signaturePattern: /@\w+\s*\(/,
    namePattern: /decorator|Decorator/,
    description: 'Uses TypeScript/ES decorators for metaprogramming',
    risk: 'low',
  },
  // Proxy patterns
  {
    name: 'Proxy Object',
    signaturePattern: /new\s+Proxy\s*\(/,
    namePattern: /proxy|Proxy|createProxy/i,
    description: 'Uses JavaScript Proxy for object interception',
    risk: 'medium',
  },
  // Reflect API
  {
    name: 'Reflect API',
    signaturePattern: /Reflect\.(get|set|has|apply|construct|defineProperty|deleteProperty|getOwnPropertyDescriptor|getPrototypeOf|isExtensible|ownKeys|preventExtensions|setPrototypeOf)/,
    namePattern: /reflect|Reflect/,
    description: 'Uses Reflect API for metaprogramming operations',
    risk: 'low',
  },
  // Dynamic property access
  {
    name: 'Dynamic Property Access',
    signaturePattern: /\[(?:key|prop|name|attr|field)\]/,
    description: 'Uses dynamic property access patterns',
    risk: 'low',
  },
  // eval and Function constructor (high risk)
  {
    name: 'Dynamic Code Evaluation',
    signaturePattern: /\beval\s*\(|new\s+Function\s*\(/,
    description: 'Uses eval() or Function constructor for dynamic code execution',
    risk: 'high',
  },
  // Dynamic imports
  {
    name: 'Dynamic Import',
    signaturePattern: /import\s*\(\s*[^'"]/,
    namePattern: /dynamicImport|loadModule/i,
    description: 'Uses dynamic imports for code splitting or lazy loading',
    risk: 'low',
  },
  // Object.defineProperty
  {
    name: 'Property Definition',
    signaturePattern: /Object\.(defineProperty|defineProperties|create)\s*\(/,
    description: 'Uses Object.defineProperty for dynamic property configuration',
    risk: 'low',
  },
  // Symbol usage
  {
    name: 'Symbol Metaprogramming',
    signaturePattern: /Symbol\.(for|keyFor|iterator|asyncIterator|hasInstance|isConcatSpreadable|match|replace|search|species|split|toPrimitive|toStringTag|unscopables)/,
    description: 'Uses well-known Symbols for metaprogramming',
    risk: 'low',
  },
  // Prototype manipulation
  {
    name: 'Prototype Manipulation',
    signaturePattern: /Object\.(getPrototypeOf|setPrototypeOf)\s*\(|__proto__|prototype\s*=/,
    description: 'Manipulates object prototypes directly',
    risk: 'medium',
  },
  // with statement (deprecated but detected)
  {
    name: 'With Statement',
    signaturePattern: /\bwith\s*\(/,
    description: 'Uses deprecated with statement for scope manipulation',
    risk: 'high',
  },
];

export function analyzeMetaprogrammingPatterns(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];
  const minOccurrences = query.minOccurrences ?? 1;

  for (const metaPattern of METAPROGRAMMING_PATTERNS) {
    const occurrences: PatternOccurrence[] = [];

    // Check functions
    for (const fn of functions) {
      const sigMatch = metaPattern.signaturePattern?.test(fn.signature);
      const nameMatch = metaPattern.namePattern?.test(fn.name);

      if (sigMatch || nameMatch) {
        occurrences.push({
          file: fn.filePath,
          line: fn.startLine,
          evidence: sigMatch ? 'signature match' : 'name match',
        });
      }
    }

    // Check module exports for pattern names
    for (const mod of modules) {
      if (metaPattern.namePattern) {
        const matchingExports = mod.exports.filter(e => metaPattern.namePattern!.test(e));
        for (const exp of matchingExports) {
          occurrences.push({
            file: mod.path,
            evidence: `export: ${exp}`,
          });
        }
      }
    }

    if (occurrences.length >= minOccurrences) {
      // High-risk patterns go to antiPatterns
      if (metaPattern.risk === 'high') {
        antiPatterns.push({
          name: metaPattern.name,
          severity: 'high',
          occurrences: occurrences.slice(0, 10),
          description: metaPattern.description,
          remediation: metaPattern.name === 'Dynamic Code Evaluation'
            ? 'Replace eval/Function with safer alternatives like JSON.parse, template literals, or proper parsing'
            : 'Consider refactoring to avoid this deprecated pattern',
        });
      } else {
        patterns.push({
          name: metaPattern.name,
          type: 'behavioral',
          occurrences: occurrences.slice(0, 10),
          confidence: Math.min(0.9, 0.5 + (occurrences.length * 0.1)),
          description: metaPattern.description,
        });
      }
    }
  }

  const recommendations: string[] = [];
  if (antiPatterns.length > 0) {
    recommendations.push('Review high-risk metaprogramming patterns for security implications');
  }
  if (patterns.some(p => p.name === 'Proxy Object')) {
    recommendations.push('Document Proxy usage patterns for maintainability');
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `Detected ${patterns.length} metaprogramming patterns, ${antiPatterns.length} high-risk patterns`,
    recommendations,
  };
}

// ============================================================================
// T-26: FRAMEWORK-SPECIFIC PATTERNS
// NestJS DI, TypeORM, Prisma, and other framework magic detection
// ============================================================================

interface FrameworkPattern {
  framework: string;
  name: string;
  decoratorPattern?: RegExp;
  importPattern?: RegExp;
  exportPattern?: RegExp;
  filePattern?: RegExp;
  description: string;
  category: 'di' | 'orm' | 'schema' | 'routing' | 'validation' | 'security';
}

const FRAMEWORK_PATTERNS: FrameworkPattern[] = [
  // NestJS Dependency Injection
  {
    framework: 'NestJS',
    name: '@Injectable',
    decoratorPattern: /@Injectable\s*\(/,
    importPattern: /from\s+['"]@nestjs\/common['"]/,
    description: 'NestJS injectable service for dependency injection',
    category: 'di',
  },
  {
    framework: 'NestJS',
    name: '@Inject',
    decoratorPattern: /@Inject\s*\(/,
    importPattern: /from\s+['"]@nestjs\/common['"]/,
    description: 'NestJS dependency injection token',
    category: 'di',
  },
  {
    framework: 'NestJS',
    name: '@Module',
    decoratorPattern: /@Module\s*\(/,
    importPattern: /from\s+['"]@nestjs\/common['"]/,
    description: 'NestJS module definition',
    category: 'di',
  },
  {
    framework: 'NestJS',
    name: '@Controller',
    decoratorPattern: /@Controller\s*\(/,
    importPattern: /from\s+['"]@nestjs\/common['"]/,
    description: 'NestJS HTTP controller',
    category: 'routing',
  },
  {
    framework: 'NestJS',
    name: '@Guard',
    decoratorPattern: /@(UseGuards|CanActivate)/,
    importPattern: /from\s+['"]@nestjs\/common['"]/,
    description: 'NestJS route guard for authorization',
    category: 'security',
  },

  // TypeORM Entity Patterns
  {
    framework: 'TypeORM',
    name: '@Entity',
    decoratorPattern: /@Entity\s*\(/,
    importPattern: /from\s+['"]typeorm['"]/,
    description: 'TypeORM entity definition',
    category: 'orm',
  },
  {
    framework: 'TypeORM',
    name: '@Column',
    decoratorPattern: /@Column\s*\(/,
    importPattern: /from\s+['"]typeorm['"]/,
    description: 'TypeORM column definition',
    category: 'orm',
  },
  {
    framework: 'TypeORM',
    name: '@PrimaryGeneratedColumn',
    decoratorPattern: /@PrimaryGeneratedColumn\s*\(/,
    importPattern: /from\s+['"]typeorm['"]/,
    description: 'TypeORM auto-generated primary key',
    category: 'orm',
  },
  {
    framework: 'TypeORM',
    name: '@ManyToOne/@OneToMany',
    decoratorPattern: /@(ManyToOne|OneToMany|ManyToMany|OneToOne)\s*\(/,
    importPattern: /from\s+['"]typeorm['"]/,
    description: 'TypeORM relationship mapping',
    category: 'orm',
  },
  {
    framework: 'TypeORM',
    name: '@Repository',
    decoratorPattern: /@(EntityRepository|InjectRepository)/,
    importPattern: /from\s+['"]typeorm['"]/,
    description: 'TypeORM repository pattern',
    category: 'orm',
  },

  // Prisma Schema Patterns
  {
    framework: 'Prisma',
    name: 'PrismaClient',
    importPattern: /from\s+['"]@prisma\/client['"]/,
    exportPattern: /PrismaClient/,
    description: 'Prisma ORM client',
    category: 'orm',
  },
  {
    framework: 'Prisma',
    name: 'Prisma Schema',
    filePattern: /\.prisma$/,
    description: 'Prisma schema definition file',
    category: 'schema',
  },

  // Sequelize Patterns
  {
    framework: 'Sequelize',
    name: '@Table/@Column',
    decoratorPattern: /@(Table|Column|Model)\s*\(/,
    importPattern: /from\s+['"]sequelize-typescript['"]/,
    description: 'Sequelize TypeScript model definition',
    category: 'orm',
  },

  // class-validator patterns
  {
    framework: 'class-validator',
    name: 'Validation Decorators',
    decoratorPattern: /@(IsString|IsNumber|IsEmail|IsNotEmpty|Min|Max|Length|Matches|ValidateNested)/,
    importPattern: /from\s+['"]class-validator['"]/,
    description: 'Runtime validation using class-validator decorators',
    category: 'validation',
  },

  // class-transformer patterns
  {
    framework: 'class-transformer',
    name: 'Transform Decorators',
    decoratorPattern: /@(Transform|Expose|Exclude|Type)\s*\(/,
    importPattern: /from\s+['"]class-transformer['"]/,
    description: 'Object transformation decorators',
    category: 'validation',
  },

  // Express/Fastify routing decorators (various libraries)
  {
    framework: 'Routing Controllers',
    name: 'HTTP Method Decorators',
    decoratorPattern: /@(Get|Post|Put|Delete|Patch|Head|Options)\s*\(/,
    importPattern: /from\s+['"]routing-controllers['"]/,
    description: 'HTTP routing decorators',
    category: 'routing',
  },

  // Inversify DI
  {
    framework: 'Inversify',
    name: '@injectable/@inject',
    decoratorPattern: /@(injectable|inject|multiInject)\s*\(/,
    importPattern: /from\s+['"]inversify['"]/,
    description: 'Inversify dependency injection',
    category: 'di',
  },

  // TypeDI
  {
    framework: 'TypeDI',
    name: '@Service/@Inject',
    decoratorPattern: /@(Service|Inject|Container)\s*\(/,
    importPattern: /from\s+['"]typedi['"]/,
    description: 'TypeDI dependency injection',
    category: 'di',
  },
];

export function analyzeFrameworkPatterns(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const frameworkUsage = new Map<string, PatternOccurrence[]>();
  const minOccurrences = query.minOccurrences ?? 1;

  for (const fwPattern of FRAMEWORK_PATTERNS) {
    const occurrences: PatternOccurrence[] = [];

    // Check functions for decorator patterns
    for (const fn of functions) {
      if (fwPattern.decoratorPattern?.test(fn.signature)) {
        occurrences.push({
          file: fn.filePath,
          line: fn.startLine,
          evidence: `decorator: ${fwPattern.name}`,
        });
      }
    }

    // Check modules for import patterns
    for (const mod of modules) {
      // Check file pattern
      if (fwPattern.filePattern?.test(mod.path)) {
        occurrences.push({
          file: mod.path,
          evidence: `file matches: ${fwPattern.filePattern.source}`,
        });
      }

      // Check exports for framework patterns
      if (fwPattern.exportPattern) {
        const matchingExports = mod.exports.filter(e => fwPattern.exportPattern!.test(e));
        for (const exp of matchingExports) {
          occurrences.push({
            file: mod.path,
            evidence: `export: ${exp}`,
          });
        }
      }

      // Check dependencies for framework imports
      if (fwPattern.importPattern) {
        const matchingDeps = mod.dependencies.filter(d => fwPattern.importPattern!.test(d));
        if (matchingDeps.length > 0) {
          occurrences.push({
            file: mod.path,
            evidence: `import: ${matchingDeps[0]}`,
          });
        }
      }
    }

    if (occurrences.length >= minOccurrences) {
      // Track framework usage
      const existing = frameworkUsage.get(fwPattern.framework) || [];
      frameworkUsage.set(fwPattern.framework, [...existing, ...occurrences]);

      patterns.push({
        name: `${fwPattern.framework}: ${fwPattern.name}`,
        type: 'structural',
        occurrences: occurrences.slice(0, 10),
        confidence: Math.min(0.9, 0.6 + (occurrences.length * 0.05)),
        description: fwPattern.description,
      });
    }
  }

  // Build summary by framework
  const frameworkSummary = [...frameworkUsage.entries()]
    .map(([fw, occs]) => `${fw} (${occs.length} patterns)`)
    .join(', ');

  const recommendations: string[] = [];
  if (frameworkUsage.has('TypeORM') || frameworkUsage.has('Prisma')) {
    recommendations.push('Ensure ORM queries are optimized and N+1 queries are avoided');
  }
  if (frameworkUsage.has('NestJS')) {
    recommendations.push('Document module dependencies and injection scopes');
  }
  if (frameworkUsage.has('class-validator')) {
    recommendations.push('Ensure all DTOs have proper validation decorators');
  }

  return {
    query,
    patterns,
    summary: frameworkSummary || 'No framework patterns detected',
    recommendations,
  };
}

// ============================================================================
// T-30: LEGACY CODE PATTERNS
// Deprecated APIs, old syntax, TODO/FIXME density, technical debt markers
// ============================================================================

interface LegacyMarker {
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high';
  description: string;
  remediation: string;
}

const LEGACY_MARKERS: LegacyMarker[] = [
  // Deprecated JavaScript/TypeScript patterns
  {
    name: 'var declarations',
    pattern: /\bvar\s+\w+/,
    severity: 'low',
    description: 'Uses var instead of let/const',
    remediation: 'Replace var with let or const for proper scoping',
  },
  {
    name: 'arguments object',
    pattern: /\barguments\[|arguments\.length/,
    severity: 'low',
    description: 'Uses arguments object instead of rest parameters',
    remediation: 'Use rest parameters (...args) instead',
  },
  {
    name: 'Callback patterns',
    pattern: /function\s*\([^)]*callback[^)]*\)|,\s*callback\s*\)/i,
    severity: 'low',
    description: 'Uses callback-based async instead of Promises/async-await',
    remediation: 'Refactor to use Promises or async/await',
  },
  {
    name: 'CommonJS require',
    pattern: /\brequire\s*\(\s*['"][^'"]+['"]\s*\)/,
    severity: 'low',
    description: 'Uses CommonJS require instead of ES modules',
    remediation: 'Migrate to ES module imports when possible',
  },
  {
    name: 'module.exports',
    pattern: /\bmodule\.exports\s*=/,
    severity: 'low',
    description: 'Uses CommonJS exports',
    remediation: 'Migrate to ES module export syntax',
  },

  // Deprecated Node.js APIs
  {
    name: 'Buffer() constructor',
    pattern: /new\s+Buffer\s*\(/,
    severity: 'high',
    description: 'Uses deprecated Buffer constructor (security risk)',
    remediation: 'Use Buffer.from(), Buffer.alloc(), or Buffer.allocUnsafe()',
  },
  {
    name: 'url.parse()',
    pattern: /url\.parse\s*\(/,
    severity: 'medium',
    description: 'Uses deprecated url.parse()',
    remediation: 'Use new URL() constructor instead',
  },
  {
    name: 'path.exists/existsSync',
    pattern: /path\.(exists|existsSync)\s*\(/,
    severity: 'medium',
    description: 'Uses deprecated path.exists',
    remediation: 'Use fs.existsSync or fs.access instead',
  },

  // Deprecated React patterns
  {
    name: 'componentWillMount',
    pattern: /componentWillMount\s*\(|UNSAFE_componentWillMount/,
    severity: 'high',
    description: 'Uses deprecated componentWillMount lifecycle',
    remediation: 'Use componentDidMount or useEffect hook',
  },
  {
    name: 'componentWillReceiveProps',
    pattern: /componentWillReceiveProps\s*\(|UNSAFE_componentWillReceiveProps/,
    severity: 'high',
    description: 'Uses deprecated componentWillReceiveProps',
    remediation: 'Use getDerivedStateFromProps or componentDidUpdate',
  },
  {
    name: 'React.createClass',
    pattern: /React\.createClass\s*\(/,
    severity: 'high',
    description: 'Uses deprecated React.createClass',
    remediation: 'Use ES6 class components or function components with hooks',
  },
  {
    name: 'PropTypes from React',
    pattern: /React\.PropTypes\./,
    severity: 'medium',
    description: 'Uses deprecated React.PropTypes',
    remediation: "Import PropTypes from 'prop-types' package",
  },

  // Technical debt markers
  {
    name: 'TODO comments',
    pattern: /\/\/\s*TODO:|\/\*\s*TODO:/i,
    severity: 'low',
    description: 'Contains TODO comments indicating incomplete work',
    remediation: 'Address TODO items or convert to tracked issues',
  },
  {
    name: 'FIXME comments',
    pattern: /\/\/\s*FIXME:|\/\*\s*FIXME:/i,
    severity: 'medium',
    description: 'Contains FIXME comments indicating known bugs',
    remediation: 'Fix the underlying issue or create bug ticket',
  },
  {
    name: 'HACK comments',
    pattern: /\/\/\s*HACK:|\/\*\s*HACK:/i,
    severity: 'medium',
    description: 'Contains HACK comments indicating workarounds',
    remediation: 'Plan to replace hack with proper solution',
  },
  {
    name: 'XXX comments',
    pattern: /\/\/\s*XXX:|\/\*\s*XXX:/i,
    severity: 'medium',
    description: 'Contains XXX comments indicating problem areas',
    remediation: 'Investigate and address flagged code',
  },

  // Deprecated annotations
  {
    name: '@deprecated annotation',
    pattern: /@deprecated/i,
    severity: 'medium',
    description: 'Code marked as deprecated',
    remediation: 'Replace with recommended alternative or remove',
  },

  // Old testing patterns
  {
    name: 'Mocha/Jasmine globals',
    pattern: /\b(describe|it|beforeEach|afterEach)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*function\s*\(/,
    severity: 'low',
    description: 'Uses old function syntax in tests instead of arrow functions',
    remediation: 'Use arrow functions for cleaner test syntax',
  },

  // TypeScript specific
  {
    name: 'any type',
    pattern: /:\s*any\b|<any>/,
    severity: 'low',
    description: 'Uses any type bypassing type safety',
    remediation: 'Replace with specific types or unknown',
  },
  {
    name: 'ts-ignore directive',
    pattern: /@ts-ignore/,
    severity: 'medium',
    description: 'Uses @ts-ignore to suppress type errors',
    remediation: 'Fix the underlying type issue or use @ts-expect-error with explanation',
  },
  {
    name: 'Triple-slash reference',
    pattern: /\/\/\/\s*<reference/,
    severity: 'low',
    description: 'Uses triple-slash reference directives',
    remediation: 'Use module imports or tsconfig include patterns instead',
  },
];

export function analyzeLegacyPatterns(
  functions: FunctionKnowledge[],
  modules: ModuleKnowledge[],
  query: PatternQuery
): PatternResult {
  const patterns: DetectedPattern[] = [];
  const antiPatterns: DetectedAntiPattern[] = [];
  const minOccurrences = query.minOccurrences ?? 1;

  // Track TODO/FIXME density
  let todoCount = 0;
  let fixmeCount = 0;
  let hackCount = 0;
  let totalFiles = modules.length;

  for (const marker of LEGACY_MARKERS) {
    const occurrences: PatternOccurrence[] = [];

    // Check functions
    for (const fn of functions) {
      if (marker.pattern.test(fn.signature) || marker.pattern.test(fn.name)) {
        occurrences.push({
          file: fn.filePath,
          line: fn.startLine,
          evidence: fn.name,
        });
      }
    }

    // Track technical debt markers
    if (marker.name === 'TODO comments') {
      todoCount = occurrences.length;
    } else if (marker.name === 'FIXME comments') {
      fixmeCount = occurrences.length;
    } else if (marker.name === 'HACK comments') {
      hackCount = occurrences.length;
    }

    if (occurrences.length >= minOccurrences) {
      if (marker.severity === 'high') {
        antiPatterns.push({
          name: marker.name,
          severity: 'high',
          occurrences: occurrences.slice(0, 10),
          description: marker.description,
          remediation: marker.remediation,
        });
      } else if (marker.severity === 'medium') {
        antiPatterns.push({
          name: marker.name,
          severity: 'medium',
          occurrences: occurrences.slice(0, 10),
          description: marker.description,
          remediation: marker.remediation,
        });
      } else {
        patterns.push({
          name: marker.name,
          type: 'team',
          occurrences: occurrences.slice(0, 10),
          confidence: Math.min(0.8, 0.5 + (occurrences.length * 0.05)),
          description: marker.description,
        });
      }
    }
  }

  // Calculate technical debt density
  const debtDensity = totalFiles > 0
    ? (todoCount + fixmeCount + hackCount) / totalFiles
    : 0;

  // Add debt density pattern
  if (debtDensity > 0.5) {
    antiPatterns.push({
      name: 'High Technical Debt Density',
      severity: debtDensity > 2 ? 'high' : 'medium',
      occurrences: [{
        file: 'codebase',
        evidence: `${todoCount} TODOs, ${fixmeCount} FIXMEs, ${hackCount} HACKs across ${totalFiles} files (${debtDensity.toFixed(2)} per file)`,
      }],
      description: 'High density of technical debt markers',
      remediation: 'Create sprint to address technical debt backlog',
    });
  }

  const recommendations: string[] = [];
  if (antiPatterns.some(ap => ap.name.includes('deprecated'))) {
    recommendations.push('Schedule migration from deprecated APIs');
  }
  if (debtDensity > 1) {
    recommendations.push('Consider a technical debt sprint to address accumulated issues');
  }
  if (patterns.some(p => p.name === 'CommonJS require')) {
    recommendations.push('Plan migration to ES modules for better tree-shaking');
  }
  if (antiPatterns.some(ap => ap.name.includes('Buffer()'))) {
    recommendations.push('SECURITY: Urgently replace deprecated Buffer constructor usage');
  }

  return {
    query,
    patterns,
    antiPatterns,
    summary: `Found ${patterns.length} legacy patterns, ${antiPatterns.length} deprecated/problematic patterns. Debt density: ${debtDensity.toFixed(2)}/file`,
    recommendations,
  };
}
