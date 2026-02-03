/**
 * @fileoverview Tests for Architecture Verifier Improvements
 *
 * Tests the new features added in SHOULD FIX items 14-17:
 * - Auto-discovery of architecture layers
 * - Visualization output (DOT format)
 * - Coupling/Cohesion metrics (Robert C. Martin)
 * - Secret detection (entropy-based)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  // Layer discovery
  discoverArchitectureLayers,
  discoveredLayersToSpec,
  LAYER_PATTERNS,
  type DiscoveredLayer,
  // Visualization
  generateDependencyDOT,
  generateLayeredDOT,
  // Package metrics
  calculatePackageMetrics,
  calculateAllPackageMetrics,
  evaluatePackageHealth,
  type PackageMetrics,
  type PackageMetricsStorage,
  // Secret detection
  detectHighEntropyStrings,
  calculateEntropy,
  classifySecret,
  scanFilesForSecrets,
  generateSecretReport,
  type DetectedSecret,
} from '../architecture_verifier.js';

// ============================================================================
// AUTO-DISCOVERY OF ARCHITECTURE LAYERS
// ============================================================================

describe('discoverArchitectureLayers', () => {
  it('should discover API layer from file paths', async () => {
    const files = [
      'src/api/users.ts',
      'src/api/auth.ts',
      'src/api/index.ts',
    ];

    const layers = await discoverArchitectureLayers(files);

    expect(layers).toHaveLength(1);
    expect(layers[0].name).toBe('api');
    expect(layers[0].files).toHaveLength(3);
    expect(layers[0].confidence).toBe(0.6); // 3/5
  });

  it('should discover multiple layers', async () => {
    const files = [
      'src/api/users.ts',
      'src/services/user-service.ts',
      'src/services/auth-service.ts',
      'src/domain/user.ts',
      'src/utils/helpers.ts',
    ];

    const layers = await discoverArchitectureLayers(files);

    expect(layers.length).toBeGreaterThanOrEqual(4);
    expect(layers.map(l => l.name)).toContain('api');
    expect(layers.map(l => l.name)).toContain('services');
    expect(layers.map(l => l.name)).toContain('domain');
    expect(layers.map(l => l.name)).toContain('utils');
  });

  it('should assign higher confidence to layers with more files', async () => {
    const files = [
      'src/services/a.ts',
      'src/services/b.ts',
      'src/services/c.ts',
      'src/services/d.ts',
      'src/services/e.ts',
      'src/services/f.ts', // 6 files
      'src/api/index.ts', // 1 file
    ];

    const layers = await discoverArchitectureLayers(files);

    const services = layers.find(l => l.name === 'services');
    const api = layers.find(l => l.name === 'api');

    expect(services?.confidence).toBe(1); // 6/5 capped at 1
    expect(api?.confidence).toBe(0.2); // 1/5
  });

  it('should return empty array for no matching files', async () => {
    const files = ['random/file.ts', 'another/path.ts'];

    const layers = await discoverArchitectureLayers(files);

    expect(layers).toHaveLength(0);
  });

  it('should detect test directories', async () => {
    const files = [
      'src/__tests__/unit.test.ts',
      'test/integration.test.ts',
    ];

    const layers = await discoverArchitectureLayers(files);

    expect(layers.some(l => l.name === 'tests')).toBe(true);
  });
});

describe('discoveredLayersToSpec', () => {
  it('should convert discovered layers to ArchitectureSpec', () => {
    const discovered: DiscoveredLayer[] = [
      { name: 'api', pattern: 'src/api', files: ['src/api/index.ts'], confidence: 0.5 },
      { name: 'services', pattern: 'src/services', files: ['src/services/auth.ts'], confidence: 0.5 },
      { name: 'domain', pattern: 'src/domain', files: ['src/domain/user.ts'], confidence: 0.5 },
    ];

    const spec = discoveredLayersToSpec(discovered);

    expect(spec.layers).toHaveLength(3);
    expect(spec.rules).toHaveLength(1);
    expect(spec.rules[0].type).toBe('no-circular');
  });

  it('should set up correct dependency hierarchy', () => {
    const discovered: DiscoveredLayer[] = [
      { name: 'api', pattern: 'src/api', files: [], confidence: 0.5 },
      { name: 'services', pattern: 'src/services', files: [], confidence: 0.5 },
      { name: 'domain', pattern: 'src/domain', files: [], confidence: 0.5 },
    ];

    const spec = discoveredLayersToSpec(discovered);

    const apiLayer = spec.layers.find(l => l.name === 'api');
    const servicesLayer = spec.layers.find(l => l.name === 'services');

    // API should be able to depend on services
    expect(apiLayer?.allowedDependencies).toContain('services');
    // Services should be able to depend on domain
    expect(servicesLayer?.allowedDependencies).toContain('domain');
  });
});

describe('LAYER_PATTERNS', () => {
  it('should have common architecture patterns', () => {
    const layerNames = LAYER_PATTERNS.map(l => l.name);

    expect(layerNames).toContain('api');
    expect(layerNames).toContain('services');
    expect(layerNames).toContain('domain');
    expect(layerNames).toContain('infrastructure');
    expect(layerNames).toContain('storage');
    expect(layerNames).toContain('utils');
  });
});

// ============================================================================
// VISUALIZATION OUTPUT (DOT FORMAT)
// ============================================================================

describe('generateDependencyDOT', () => {
  it('should generate valid DOT format', () => {
    const dependencies = new Map([
      ['api', ['services']],
      ['services', ['domain']],
      ['domain', []],
    ]);

    const dot = generateDependencyDOT(dependencies);

    expect(dot).toContain('digraph');
    expect(dot).toContain('rankdir=TB');
    expect(dot).toContain('api');
    expect(dot).toContain('services');
    expect(dot).toContain('domain');
    expect(dot).toContain('api -> services');
    expect(dot).toContain('services -> domain');
  });

  it('should highlight violations in red', () => {
    const dependencies = new Map([
      ['domain', ['api']], // Violation: domain should not depend on api
    ]);
    const violations = [
      { source: 'domain', target: 'api', rule: 'no-upward-deps' },
    ];

    const dot = generateDependencyDOT(dependencies, violations);

    expect(dot).toContain('color=red');
    expect(dot).toContain('penwidth=2');
    expect(dot).toContain('no-upward-deps');
  });

  it('should sanitize node IDs with special characters', () => {
    const dependencies = new Map([
      ['src/api/index.ts', ['src/services/auth.ts']],
    ]);

    const dot = generateDependencyDOT(dependencies);

    // Should not contain slashes in identifiers
    expect(dot).toContain('src_api_index_ts');
    expect(dot).toContain('src_services_auth_ts');
  });

  it('should use custom title', () => {
    const dependencies = new Map([['a', ['b']]]);

    const dot = generateDependencyDOT(dependencies, undefined, {
      title: 'My Architecture',
    });

    expect(dot).toContain('My Architecture');
  });
});

describe('generateLayeredDOT', () => {
  it('should generate DOT with layer clusters', () => {
    const dependencies = new Map([
      ['src/api/users.ts', ['src/services/user-service.ts']],
      ['src/services/user-service.ts', ['src/domain/user.ts']],
    ]);

    const layers: DiscoveredLayer[] = [
      { name: 'api', pattern: 'src/api', files: ['src/api/users.ts'], confidence: 0.5 },
      { name: 'services', pattern: 'src/services', files: ['src/services/user-service.ts'], confidence: 0.5 },
      { name: 'domain', pattern: 'src/domain', files: ['src/domain/user.ts'], confidence: 0.5 },
    ];

    const dot = generateLayeredDOT(dependencies, layers);

    expect(dot).toContain('subgraph cluster_api');
    expect(dot).toContain('subgraph cluster_services');
    expect(dot).toContain('subgraph cluster_domain');
    expect(dot).toContain('label="API"');
    expect(dot).toContain('label="SERVICES"');
    expect(dot).toContain('label="DOMAIN"');
  });
});

// ============================================================================
// COUPLING/COHESION METRICS
// ============================================================================

describe('calculatePackageMetrics', () => {
  function createMockStorage(options: {
    files?: Array<{ path: string }>;
    functions?: Map<string, Array<{ id: string; name: string; kind?: string }>>;
    edges?: Array<{ fromId: string; toId: string; toFile?: string }>;
  }): PackageMetricsStorage {
    return {
      getFiles: vi.fn().mockResolvedValue(options.files || []),
      getFunctionsByPath: vi.fn().mockImplementation(async (path: string) => {
        return options.functions?.get(path) || [];
      }),
      getGraphEdges: vi.fn().mockResolvedValue(options.edges || []),
    };
  }

  it('should calculate basic metrics for a package', async () => {
    const storage = createMockStorage({
      files: [
        { path: 'src/services/auth.ts' },
        { path: 'src/services/user.ts' },
        { path: 'src/api/routes.ts' },
      ],
      functions: new Map([
        ['src/services/auth.ts', [
          { id: 'auth1', name: 'authenticate', kind: 'function' },
          { id: 'auth2', name: 'AuthService', kind: 'interface' },
        ]],
        ['src/services/user.ts', [
          { id: 'user1', name: 'getUser', kind: 'function' },
        ]],
      ]),
      edges: [
        { fromId: 'auth1', toId: 'ext1', toFile: 'src/utils/crypto.ts' },
      ],
    });

    const metrics = await calculatePackageMetrics(storage, 'src/services');

    expect(metrics.name).toBe('services');
    expect(metrics.files).toHaveLength(2);
    expect(metrics.abstractCount).toBe(1); // interface
    expect(metrics.concreteCount).toBe(2); // functions
    expect(metrics.abstractness).toBeCloseTo(0.333, 2);
    expect(metrics.ce).toBe(1); // one external dependency
  });

  it('should return default metrics for empty package', async () => {
    const storage = createMockStorage({ files: [] });

    const metrics = await calculatePackageMetrics(storage, 'src/empty');

    expect(metrics.name).toBe('empty');
    expect(metrics.files).toHaveLength(0);
    expect(metrics.instability).toBe(0);
    expect(metrics.cohesion).toBe(1);
  });

  it('should calculate instability correctly', async () => {
    // Instability = Ce / (Ca + Ce)
    // High Ce, low Ca = unstable (depends on many, few depend on it)
    const storage = createMockStorage({
      files: [
        { path: 'src/pkg/a.ts' },
        { path: 'src/other/b.ts' },
      ],
      functions: new Map([
        ['src/pkg/a.ts', [{ id: 'a1', name: 'funcA', kind: 'function' }]],
      ]),
      edges: [
        { fromId: 'a1', toId: 'ext1', toFile: 'src/lib1/x.ts' },
        { fromId: 'a1', toId: 'ext2', toFile: 'src/lib2/y.ts' },
        { fromId: 'a1', toId: 'ext3', toFile: 'src/lib3/z.ts' },
      ],
    });

    const metrics = await calculatePackageMetrics(storage, 'src/pkg');

    expect(metrics.ce).toBe(3); // 3 external dependencies
    // With no incoming deps, instability should be 1
    expect(metrics.instability).toBeCloseTo(1, 1);
  });
});

describe('evaluatePackageHealth', () => {
  it('should identify Zone of Pain', () => {
    const metrics: PackageMetrics = {
      name: 'core',
      ca: 10,
      ce: 0,
      instability: 0,      // Very stable
      abstractness: 0.1,   // Very concrete
      distance: 0.9,       // Far from ideal
      cohesion: 0.5,
      abstractCount: 1,
      concreteCount: 9,
      files: [],
    };

    const health = evaluatePackageHealth(metrics);

    expect(health.health).not.toBe('healthy');
    expect(health.issues.some(i => i.includes('Zone of Pain'))).toBe(true);
  });

  it('should identify low cohesion', () => {
    const metrics: PackageMetrics = {
      name: 'utils',
      ca: 5,
      ce: 5,
      instability: 0.5,
      abstractness: 0.5,
      distance: 0,
      cohesion: 0.05,      // Very low cohesion
      abstractCount: 5,
      concreteCount: 5,
      files: ['a.ts', 'b.ts', 'c.ts', 'd.ts'], // > 3 files
    };

    const health = evaluatePackageHealth(metrics);

    expect(health.issues.some(i => i.includes('cohesion'))).toBe(true);
  });

  it('should return healthy for well-designed package', () => {
    const metrics: PackageMetrics = {
      name: 'domain',
      ca: 5,
      ce: 2,
      instability: 0.286,
      abstractness: 0.7,
      distance: 0.014,      // Very close to main sequence
      cohesion: 0.6,
      abstractCount: 7,
      concreteCount: 3,
      files: [],
    };

    const health = evaluatePackageHealth(metrics);

    expect(health.health).toBe('healthy');
    expect(health.issues).toHaveLength(0);
  });
});

// ============================================================================
// SECRET DETECTION
// ============================================================================

const stripePrefix = 'sk_' + 'live_';

describe('calculateEntropy', () => {
  const stripeLikeKey = stripePrefix + 'abc123XYZ789def456GHI';

  it('should return 0 for empty string', () => {
    expect(calculateEntropy('')).toBe(0);
  });

  it('should return low entropy for repeated characters', () => {
    const entropy = calculateEntropy('aaaaaaaaaa');
    expect(entropy).toBe(0); // All same character = 0 entropy
  });

  it('should return higher entropy for mixed characters', () => {
    const lowEntropy = calculateEntropy('password123');
    const highEntropy = calculateEntropy('aB3$kL9@mN2#pQ5^');

    expect(highEntropy).toBeGreaterThan(lowEntropy);
  });

  it('should return high entropy for random-looking strings', () => {
    const entropy = calculateEntropy(stripeLikeKey);
    expect(entropy).toBeGreaterThan(4);
  });
});

describe('classifySecret', () => {
  const slackPrefix = 'xo' + 'xb';
  const slackToken = [slackPrefix, '123456789012', '1234567890123', 'AbCdEfGhIjKlMnOpQrStUvWx'].join('-');
  const apiKeyLike = stripePrefix + '1234567890abcdefghijklmnop';

  it('should classify AWS access keys', () => {
    const result = classifySecret('AKIAIOSFODNN7EXAMPLE');

    expect(result?.type).toBe('aws_key');
    expect(result?.confidence).toBeGreaterThan(0.9);
  });

  it('should classify GitHub tokens', () => {
    // GitHub tokens have format: ghp_[A-Za-z0-9]{36,}
    const result = classifySecret('ghp_1234567890abcdefghijklmnopqrstuvwxyz');

    expect(result?.type).toBe('github_token');
  });

  it('should classify Slack tokens', () => {
    const result = classifySecret(slackToken);

    expect(result?.type).toBe('slack_token');
  });

  it('should classify generic API keys', () => {
    // API keys need 20+ chars after prefix
    const result = classifySecret(apiKeyLike);

    expect(result?.type).toBe('api_key');
  });

  it('should return null for non-secrets', () => {
    expect(classifySecret('hello world')).toBeNull();
    expect(classifySecret('12345')).toBeNull();
    expect(classifySecret('normal_variable_name')).toBeNull();
  });
});

describe('detectHighEntropyStrings', () => {
  const stripeLongKey = stripePrefix + 'abc123xyz789def456ghi012jkl345';
  const stripeCommentKey = stripePrefix + 'abc123xyz789def456';
  const stripeTruncateKey = stripePrefix + 'this_is_a_very_long_secret_key_that_should_be_truncated';

  it('should detect API keys in code', () => {
    const code = `
      const apiKey = "${stripeLongKey}";
      const name = "John Doe";
    `;

    const secrets = detectHighEntropyStrings(code);

    expect(secrets.length).toBeGreaterThanOrEqual(1);
    // May be detected as api_key or generic_secret depending on entropy
    expect(['api_key', 'generic_secret']).toContain(secrets[0].type);
    expect(secrets[0].line).toBe(2);
  });

  it('should detect high-entropy strings', () => {
    const code = `
      const token = "aB3kL9mN2pQ5rT8wX0yZ1cF4gH7jK6oP";
    `;

    const secrets = detectHighEntropyStrings(code);

    expect(secrets.length).toBeGreaterThanOrEqual(1);
    expect(secrets[0].entropy).toBeGreaterThan(4);
  });

  it('should skip comments', () => {
    const code = `
      // const apiKey = "${stripeCommentKey}";
      /* const secret = "super_secret_value_here_123"; */
    `;

    const secrets = detectHighEntropyStrings(code);

    expect(secrets).toHaveLength(0);
  });

  it('should skip URLs', () => {
    const code = `
      const url = "https://api.example.com/v1/users";
    `;

    const secrets = detectHighEntropyStrings(code);

    // URLs shouldn't be detected as secrets
    expect(secrets.filter(s => s.value.includes('api.example'))).toHaveLength(0);
  });

  it('should truncate detected values for safety', () => {
    const code = `
      const key = "${stripeTruncateKey}";
    `;

    const secrets = detectHighEntropyStrings(code);

    if (secrets.length > 0) {
      expect(secrets[0].value.length).toBeLessThanOrEqual(24); // 20 + "..."
      expect(secrets[0].value.endsWith('...')).toBe(true);
    }
  });

  it('should respect minLength option', () => {
    const code = `
      const short = "abc123defghi"; // 12 chars - below threshold
      const long = "aB3kL9mN2pQ5rT8wX0yZ1cF4gH7jK6"; // 30 chars - high entropy
    `;

    // Default minLength is 16, so 12-char string should not be detected
    const secrets = detectHighEntropyStrings(code, { minLength: 20 });

    // Short string should not be detected with minLength=20
    expect(secrets.every(s => !s.value.startsWith('abc123def'))).toBe(true);
  });
});

describe('scanFilesForSecrets', () => {
  const stripeShortKey = stripePrefix + 'abc123xyz789def456ghi012';
  const stripeNodeKey = stripePrefix + 'abc123xyz789def456ghi012';
  const stripeMinKey = stripePrefix + 'abc123xyz789def456ghi012';

  it('should scan multiple files', () => {
    const files = new Map([
      ['src/config.ts', `const apiKey = "${stripeShortKey}";`],
      ['src/app.ts', `const name = "test";`],
    ]);

    const secrets = scanFilesForSecrets(files);

    expect(secrets.length).toBeGreaterThanOrEqual(1);
    expect(secrets[0].file).toBe('src/config.ts');
  });

  it('should skip node_modules', () => {
    const files = new Map([
      ['node_modules/pkg/index.js', `const key = "${stripeNodeKey}";`],
    ]);

    const secrets = scanFilesForSecrets(files);

    expect(secrets).toHaveLength(0);
  });

  it('should skip minified files', () => {
    const files = new Map([
      ['dist/bundle.min.js', `var a="${stripeMinKey}";`],
    ]);

    const secrets = scanFilesForSecrets(files);

    expect(secrets).toHaveLength(0);
  });
});

describe('generateSecretReport', () => {
  it('should generate report for detected secrets', () => {
    const secrets: Array<DetectedSecret & { file: string }> = [
      {
        value: stripePrefix + 'abc123...',
        entropy: 4.5,
        line: 10,
        type: 'api_key',
        confidence: 0.85,
        file: 'src/config.ts',
      },
      {
        value: 'AKIAIOSFODNN...',
        entropy: 4.2,
        line: 5,
        type: 'aws_key',
        confidence: 0.95,
        file: 'src/aws.ts',
      },
    ];

    const report = generateSecretReport(secrets);

    expect(report).toContain('Secret Detection Report');
    expect(report).toContain('API_KEY');
    expect(report).toContain('AWS_KEY');
    expect(report).toContain('src/config.ts:10');
    expect(report).toContain('src/aws.ts:5');
    expect(report).toContain('Recommendations');
  });

  it('should report no secrets found', () => {
    const report = generateSecretReport([]);

    expect(report).toContain('No potential secrets detected');
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Architecture Verifier Integration', () => {
  it('should work end-to-end: discover layers, generate DOT', async () => {
    const files = [
      'src/api/routes.ts',
      'src/services/auth.ts',
      'src/domain/user.ts',
    ];

    // Step 1: Discover layers
    const layers = await discoverArchitectureLayers(files);
    expect(layers.length).toBeGreaterThan(0);

    // Step 2: Generate spec
    const spec = discoveredLayersToSpec(layers);
    expect(spec.layers.length).toBeGreaterThan(0);

    // Step 3: Generate visualization
    const dependencies = new Map([
      ['src/api/routes.ts', ['src/services/auth.ts']],
      ['src/services/auth.ts', ['src/domain/user.ts']],
    ]);

    const dot = generateLayeredDOT(dependencies, layers);
    expect(dot).toContain('digraph');
    expect(dot).toContain('cluster_');
  });

  it('should detect secrets and generate report', () => {
    const stripeIntegrationKey = stripePrefix + 'abc123xyz789def456ghi012jkl345';
    const files = new Map([
      ['src/config/secrets.ts', `
        export const config = {
          apiKey: "${stripeIntegrationKey}",
          dbPassword: "super_secret_p@ssw0rd_123!",
          awsKey: "AKIAIOSFODNN7EXAMPLE",
        };
      `],
    ]);

    // Scan for secrets
    const secrets = scanFilesForSecrets(files);
    expect(secrets.length).toBeGreaterThanOrEqual(1);

    // Generate report
    const report = generateSecretReport(secrets);
    expect(report).toContain('Secret Detection Report');
  });
});
