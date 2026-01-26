/**
 * @fileoverview TDD Presets - World-Class Testing Configurations
 *
 * Comprehensive collection of TDD techniques, methodologies, and preset configurations
 * based on industry best practices from Google, Microsoft, Netflix, Spotify, and others.
 *
 * @see https://testing.googleblog.com - Google Testing Blog
 * @see https://martinfowler.com/articles/practical-test-pyramid.html - Test Pyramid
 */

// ---------------------------------------------------------------------------
// TDD Schools & Methodologies
// ---------------------------------------------------------------------------

/**
 * TDD Schools of Thought
 * Different approaches to Test-Driven Development with distinct philosophies.
 */
export type TddSchool = 'london' | 'chicago' | 'detroit';

export interface TddSchoolDefinition {
  name: string;
  alternateName: string;
  philosophy: string;
  keyPrinciples: string[];
  mockingApproach: 'mockist' | 'classicist';
  testDoubleUsage: 'heavy' | 'minimal';
  designFocus: 'behavior' | 'state';
  advantages: string[];
  disadvantages: string[];
  bestFor: string[];
}

export const TDD_SCHOOLS: Record<TddSchool, TddSchoolDefinition> = {
  london: {
    name: 'London School',
    alternateName: 'Mockist TDD',
    philosophy: 'Test behavior through interactions, mock collaborators',
    keyPrinciples: [
      'Test one object in isolation',
      'Mock all collaborators',
      'Focus on message passing between objects',
      'Design emerges from outside-in',
    ],
    mockingApproach: 'mockist',
    testDoubleUsage: 'heavy',
    designFocus: 'behavior',
    advantages: [
      'Fast tests due to isolation',
      'Forces good separation of concerns',
      'Design emerges from thinking about interfaces first',
      'Easy to pinpoint failures',
    ],
    disadvantages: [
      'Tests can be coupled to implementation',
      'Refactoring may break many tests',
      'Risk of testing mocks instead of real behavior',
    ],
    bestFor: ['Large systems', 'Microservices', 'Teams preferring strict isolation'],
  },

  chicago: {
    name: 'Chicago School',
    alternateName: 'Classical TDD',
    philosophy: 'Test through the public API, minimize mocking',
    keyPrinciples: [
      'Test the whole unit including collaborators',
      'Only mock external systems and slow dependencies',
      'Focus on observable behavior, not implementation',
      'Design emerges from inside-out',
    ],
    mockingApproach: 'classicist',
    testDoubleUsage: 'minimal',
    designFocus: 'state',
    advantages: [
      'Tests are more refactoring-resilient',
      'Tests document actual behavior',
      'Less test maintenance',
      'Catches integration issues earlier',
    ],
    disadvantages: [
      'Slower tests when real dependencies are used',
      'Harder to isolate failure causes',
      'May require more setup',
    ],
    bestFor: ['Smaller systems', 'Teams preferring integration coverage', 'Rapid prototyping'],
  },

  detroit: {
    name: 'Detroit School',
    alternateName: 'State-Based TDD',
    philosophy: 'Hybrid approach focusing on state verification',
    keyPrinciples: [
      'Verify state changes, not interactions',
      'Use real objects where practical',
      'Mock at architectural boundaries',
      'Balance isolation with integration',
    ],
    mockingApproach: 'classicist',
    testDoubleUsage: 'minimal',
    designFocus: 'state',
    advantages: [
      'Balanced approach',
      'Good for brownfield projects',
      'Practical for most team sizes',
    ],
    disadvantages: [
      'Less opinionated, requires judgment',
      'May lack consistency across team',
    ],
    bestFor: ['Mixed codebases', 'Teams transitioning to TDD', 'Pragmatic development'],
  },
};

// ---------------------------------------------------------------------------
// Advanced TDD Techniques
// ---------------------------------------------------------------------------

export interface TddTechnique {
  name: string;
  category: TddTechniqueCategory;
  description: string;
  when: string[];
  howTo: string[];
  example?: string;
  tools?: string[];
  relatedTechniques?: string[];
}

export type TddTechniqueCategory =
  | 'core-tdd'
  | 'bdd'
  | 'property-based'
  | 'contract'
  | 'mutation'
  | 'characterization'
  | 'performance'
  | 'security'
  | 'data-management'
  | 'api'
  | 'ui'
  | 'architecture';

export const ADVANCED_TDD_TECHNIQUES: TddTechnique[] = [
  // Core TDD Techniques
  {
    name: 'Outside-In TDD',
    category: 'core-tdd',
    description: 'Start from acceptance tests, work inward to unit tests',
    when: [
      'Building user-facing features',
      'When requirements are clear',
      'Working on greenfield projects',
    ],
    howTo: [
      'Write failing acceptance test for the feature',
      'Implement just enough to make progress',
      'Write unit tests for components discovered',
      'Refactor and repeat until acceptance test passes',
    ],
    tools: ['Cucumber', 'Playwright', 'Cypress'],
    relatedTechniques: ['BDD', 'ATDD'],
  },
  {
    name: 'Inside-Out TDD',
    category: 'core-tdd',
    description: 'Start from core domain logic, work outward to interfaces',
    when: [
      'Complex domain logic',
      'When exploring design',
      'Building libraries or frameworks',
    ],
    howTo: [
      'Identify core domain concepts',
      'Write tests for domain logic first',
      'Build up from primitives to aggregates',
      'Add interface layers last',
    ],
    relatedTechniques: ['Domain-Driven Design', 'Chicago School'],
  },
  {
    name: 'Transformation Priority Premise',
    category: 'core-tdd',
    description: 'Order code transformations from simple to complex',
    when: [
      'Implementing algorithms',
      'When stuck on next step',
      'Teaching TDD fundamentals',
    ],
    howTo: [
      'Start with nil/null transforms',
      'Progress to constants, then variables',
      'Move to conditionals, then iterations',
      'End with recursion if needed',
    ],
    example: 'null -> constant -> scalar -> gather -> spread -> control-flow',
  },

  // BDD & Specification Techniques
  {
    name: 'Behavior-Driven Development (BDD)',
    category: 'bdd',
    description: 'Describe behavior in natural language, derive tests from specifications',
    when: [
      'Collaborating with non-technical stakeholders',
      'Building user stories',
      'When requirements need clarification',
    ],
    howTo: [
      'Write scenarios in Given-When-Then format',
      'Use ubiquitous language from the domain',
      'Automate scenarios with step definitions',
      'Keep scenarios focused on behavior, not implementation',
    ],
    tools: ['Cucumber', 'SpecFlow', 'Behave', 'jest-cucumber'],
  },
  {
    name: 'Specification by Example',
    category: 'bdd',
    description: 'Use concrete examples as both specification and tests',
    when: [
      'Complex business rules',
      'Edge cases matter',
      'Building shared understanding',
    ],
    howTo: [
      'Gather examples from stakeholders',
      'Identify key examples that define behavior',
      'Express examples as executable tests',
      'Refine examples iteratively',
    ],
    tools: ['Concordion', 'Fitnesse', 'Gauge'],
  },
  {
    name: 'Acceptance Test-Driven Development (ATDD)',
    category: 'bdd',
    description: 'Write acceptance tests before development, involving all roles',
    when: [
      'Agile team collaboration',
      'User story development',
      'When done criteria need clarity',
    ],
    howTo: [
      'Collaborate: Dev, QA, Product define acceptance criteria',
      'Write acceptance tests before coding',
      'Use tests to drive implementation',
      'Demonstrate with passing tests',
    ],
    relatedTechniques: ['BDD', 'Three Amigos'],
  },

  // Property-Based Testing
  {
    name: 'Property-Based Testing',
    category: 'property-based',
    description: 'Define properties that should always hold, generate test cases automatically',
    when: [
      'Testing algorithms',
      'When edge cases are hard to enumerate',
      'Serialization/deserialization code',
      'Mathematical operations',
    ],
    howTo: [
      'Identify invariants (properties that always hold)',
      'Define generators for input data',
      'Let the framework find counterexamples',
      'Shrink failing cases to minimal examples',
    ],
    tools: ['fast-check', 'QuickCheck', 'Hypothesis', 'jqwik'],
    example: 'reverse(reverse(list)) === list',
  },
  {
    name: 'Metamorphic Testing',
    category: 'property-based',
    description: 'Test by transforming inputs and checking output relationships',
    when: [
      'When oracles are hard to define',
      'Testing ML models',
      'Search and ranking systems',
    ],
    howTo: [
      'Identify metamorphic relations (input transforms -> output relations)',
      'Generate pairs of related test inputs',
      'Check that outputs satisfy the relation',
    ],
    example: 'sin(x) = sin(π - x)',
  },

  // Contract Testing
  {
    name: 'Consumer-Driven Contract Testing',
    category: 'contract',
    description: 'Consumers define contracts, providers verify against them',
    when: [
      'Microservices integration',
      'API versioning',
      'Preventing breaking changes',
    ],
    howTo: [
      'Consumer writes contract (expected request/response)',
      'Contract is published to broker',
      'Provider runs contract tests',
      'Deployment depends on contract verification',
    ],
    tools: ['Pact', 'Spring Cloud Contract', 'Specmatic'],
  },
  {
    name: 'Schema Contract Testing',
    category: 'contract',
    description: 'Validate API schemas and data shapes',
    when: [
      'GraphQL APIs',
      'REST APIs with OpenAPI specs',
      'Event-driven systems',
    ],
    howTo: [
      'Define schema (OpenAPI, GraphQL, AsyncAPI)',
      'Generate tests from schema',
      'Validate responses against schema',
      'Track schema evolution',
    ],
    tools: ['Dredd', 'Schemathesis', 'graphql-inspector'],
  },

  // Mutation Testing
  {
    name: 'Mutation Testing',
    category: 'mutation',
    description: 'Introduce bugs (mutants) to verify test effectiveness',
    when: [
      'Assessing test quality',
      'Finding weak tests',
      'Critical code paths',
    ],
    howTo: [
      'Run mutation testing tool',
      'Review survived mutants',
      'Add tests to kill surviving mutants',
      'Set mutation score thresholds',
    ],
    tools: ['Stryker', 'PIT', 'mutmut', 'cosmic-ray'],
  },

  // Characterization Testing
  {
    name: 'Characterization Testing',
    category: 'characterization',
    description: 'Document existing behavior before refactoring',
    when: [
      'Working with legacy code',
      'Before major refactoring',
      'When specs are missing',
    ],
    howTo: [
      'Write tests that assert current behavior',
      'Run tests to verify they pass',
      'Use tests as safety net for refactoring',
      'Update tests when intentional changes are made',
    ],
    relatedTechniques: ['Golden Master', 'Approval Testing'],
  },
  {
    name: 'Golden Master Testing',
    category: 'characterization',
    description: 'Capture output and compare against known-good baseline',
    when: [
      'Complex output validation',
      'Legacy system integration',
      'Report generation',
    ],
    howTo: [
      'Run system and capture output',
      'Save output as golden master',
      'Compare future runs against master',
      'Update master when changes are intentional',
    ],
    tools: ['ApprovalTests', 'Jest snapshots', 'verify'],
  },
  {
    name: 'Approval Testing',
    category: 'characterization',
    description: 'Human-verified test results with diff-based review',
    when: [
      'UI components',
      'Generated documents',
      'Complex data transformations',
    ],
    howTo: [
      'Generate output from test',
      'Review and approve output',
      'Approved becomes expected',
      'Diff changes on future runs',
    ],
    tools: ['ApprovalTests', 'Jest snapshots', 'snapshot-diff'],
  },

  // Performance Testing
  {
    name: 'Performance TDD',
    category: 'performance',
    description: 'Write performance requirements as tests',
    when: [
      'Latency-sensitive code',
      'High-throughput systems',
      'Preventing performance regressions',
    ],
    howTo: [
      'Define performance budgets',
      'Write benchmark tests',
      'Run in controlled environment',
      'Track metrics over time',
    ],
    tools: ['k6', 'Artillery', 'Benchmark.js', 'hyperfine'],
  },
  {
    name: 'Load Testing',
    category: 'performance',
    description: 'Test system behavior under expected and peak load',
    when: [
      'Before major releases',
      'Capacity planning',
      'SLA validation',
    ],
    howTo: [
      'Model expected traffic patterns',
      'Define success criteria',
      'Gradually increase load',
      'Monitor system metrics',
    ],
    tools: ['k6', 'Gatling', 'Locust', 'JMeter'],
  },
  {
    name: 'Chaos Engineering',
    category: 'performance',
    description: 'Intentionally inject failures to test resilience',
    when: [
      'Distributed systems',
      'High-availability requirements',
      'Disaster recovery testing',
    ],
    howTo: [
      'Define steady state',
      'Hypothesize about failure impact',
      'Inject failures in controlled manner',
      'Verify system recovers',
    ],
    tools: ['Chaos Monkey', 'Gremlin', 'LitmusChaos', 'Toxiproxy'],
  },

  // Security Testing
  {
    name: 'Security TDD',
    category: 'security',
    description: 'Write security requirements as tests',
    when: [
      'Authentication/authorization code',
      'Input validation',
      'Cryptographic implementations',
    ],
    howTo: [
      'Identify security requirements',
      'Write tests for security controls',
      'Include negative test cases',
      'Test for common vulnerabilities',
    ],
    tools: ['OWASP ZAP', 'Snyk', 'Semgrep'],
  },
  {
    name: 'Fuzzing',
    category: 'security',
    description: 'Generate random inputs to find crashes and security bugs',
    when: [
      'Parsers and input handlers',
      'Network protocols',
      'Security-critical code',
    ],
    howTo: [
      'Identify input entry points',
      'Set up fuzzing harness',
      'Run with coverage feedback',
      'Analyze and fix crashes',
    ],
    tools: ['AFL++', 'libFuzzer', 'Jazzer', 'go-fuzz'],
  },

  // Data Management
  {
    name: 'Test Data Builder Pattern',
    category: 'data-management',
    description: 'Fluent builders for creating test data',
    when: [
      'Complex domain objects',
      'Many test variations needed',
      'Reducing test setup duplication',
    ],
    howTo: [
      'Create builder class with defaults',
      'Add fluent methods for customization',
      'Use in tests with minimal setup',
      'Share builders across test files',
    ],
    example: 'aUser().withName("test").withRole("admin").build()',
  },
  {
    name: 'Object Mother Pattern',
    category: 'data-management',
    description: 'Factory methods for common test scenarios',
    when: [
      'Standard test scenarios',
      'Consistency across tests',
      'Quick test setup',
    ],
    howTo: [
      'Create factory class',
      'Add methods for common scenarios',
      'Name methods clearly (createValidUser, createExpiredToken)',
      'Use composition with builders',
    ],
  },
  {
    name: 'Parameterized Testing',
    category: 'data-management',
    description: 'Run same test with multiple data sets',
    when: [
      'Testing multiple inputs',
      'Edge case coverage',
      'Validation rules',
    ],
    howTo: [
      'Define test data table',
      'Write single test template',
      'Framework iterates over data',
      'Each row is a test case',
    ],
    tools: ['Jest .each', 'pytest.mark.parametrize', 'JUnit @ParameterizedTest'],
  },

  // API Testing
  {
    name: 'API Contract Testing',
    category: 'api',
    description: 'Test API contracts independently of implementation',
    when: [
      'REST/GraphQL APIs',
      'Service integration',
      'API versioning',
    ],
    howTo: [
      'Define API specification',
      'Generate tests from spec',
      'Run against implementation',
      'Validate request/response schemas',
    ],
    tools: ['Postman', 'Insomnia', 'REST-assured', 'Supertest'],
  },
  {
    name: 'GraphQL Testing',
    category: 'api',
    description: 'Test GraphQL queries, mutations, and subscriptions',
    when: [
      'GraphQL APIs',
      'Schema evolution',
      'Query optimization',
    ],
    howTo: [
      'Test resolver logic in isolation',
      'Integration test full queries',
      'Validate schema changes',
      'Test error handling',
    ],
    tools: ['graphql-tools', 'Apollo testing', 'easygraphql-tester'],
  },

  // UI Testing
  {
    name: 'Component Testing',
    category: 'ui',
    description: 'Test UI components in isolation',
    when: [
      'React/Vue/Angular components',
      'Design system components',
      'Reusable UI elements',
    ],
    howTo: [
      'Render component in isolation',
      'Interact and assert',
      'Test props and events',
      'Avoid testing implementation details',
    ],
    tools: ['React Testing Library', 'Vue Test Utils', 'Storybook'],
  },
  {
    name: 'Visual Regression Testing',
    category: 'ui',
    description: 'Detect unintended visual changes',
    when: [
      'UI component libraries',
      'CSS refactoring',
      'Cross-browser consistency',
    ],
    howTo: [
      'Capture baseline screenshots',
      'Compare on each run',
      'Review and approve changes',
      'Run in consistent environment',
    ],
    tools: ['Percy', 'Chromatic', 'BackstopJS', 'Playwright screenshots'],
  },
  {
    name: 'Accessibility Testing',
    category: 'ui',
    description: 'Test for WCAG compliance and accessibility',
    when: [
      'All user-facing features',
      'Public websites',
      'Compliance requirements',
    ],
    howTo: [
      'Run automated a11y checks',
      'Test keyboard navigation',
      'Test screen reader compatibility',
      'Include manual testing',
    ],
    tools: ['axe-core', 'pa11y', 'Lighthouse', 'WAVE'],
  },

  // Architecture Testing
  {
    name: 'Architecture Testing',
    category: 'architecture',
    description: 'Enforce architectural rules through tests',
    when: [
      'Large codebases',
      'Team conventions',
      'Dependency management',
    ],
    howTo: [
      'Define architecture rules',
      'Write tests that check rules',
      'Run in CI to catch violations',
      'Document rules alongside tests',
    ],
    tools: ['ArchUnit', 'dependency-cruiser', 'ts-arch'],
  },
  {
    name: 'Hexagonal/Ports-and-Adapters Testing',
    category: 'architecture',
    description: 'Test domain logic independently of infrastructure',
    when: [
      'Clean architecture projects',
      'Domain-driven design',
      'Portable business logic',
    ],
    howTo: [
      'Test domain in isolation (no I/O)',
      'Use fake adapters for port tests',
      'Integration test real adapters',
      'Keep domain pure',
    ],
  },
];

// ---------------------------------------------------------------------------
// World-Class Preset Configurations
// ---------------------------------------------------------------------------

export interface TddPreset {
  name: string;
  description: string;
  origin: string;
  philosophy: string;
  testPyramid: TestPyramidConfig;
  techniques: string[];
  coverageTargets: CoverageTargets;
  ciConfig: CiConfig;
  toolRecommendations: ToolRecommendation[];
  antiPatterns: string[];
  bestPractices: string[];
}

export interface TestPyramidConfig {
  unit: { percentage: number; characteristics: string[] };
  integration: { percentage: number; characteristics: string[] };
  e2e: { percentage: number; characteristics: string[] };
  manual?: { percentage: number; characteristics: string[] };
}

export interface CoverageTargets {
  line: number;
  branch: number;
  function: number;
  mutation?: number;
}

export interface CiConfig {
  runOnPush: boolean;
  runOnPr: boolean;
  parallelization: boolean;
  cacheStrategy: string;
  failFast: boolean;
  retries: number;
}

export interface ToolRecommendation {
  category: string;
  tools: string[];
  preferred?: string;
}

export const TDD_PRESETS: Record<string, TddPreset> = {
  google: {
    name: 'Google Testing',
    description: 'Based on Google Testing Blog and internal practices',
    origin: 'Google',
    philosophy: 'Test behavior, not implementation. Small tests should dominate.',
    testPyramid: {
      unit: {
        percentage: 70,
        characteristics: [
          'Fast (<100ms)',
          'Isolated',
          'Deterministic',
          'No network/disk I/O',
        ],
      },
      integration: {
        percentage: 20,
        characteristics: [
          'Test component integration',
          'May use real databases',
          'Slower but more realistic',
        ],
      },
      e2e: {
        percentage: 10,
        characteristics: [
          'Full system tests',
          'Used sparingly',
          'Focus on critical paths',
        ],
      },
    },
    techniques: [
      'Behavior-Driven Development',
      'Test Data Builder Pattern',
      'Property-Based Testing',
      'Mutation Testing',
    ],
    coverageTargets: {
      line: 80,
      branch: 75,
      function: 85,
      mutation: 60,
    },
    ciConfig: {
      runOnPush: true,
      runOnPr: true,
      parallelization: true,
      cacheStrategy: 'aggressive',
      failFast: true,
      retries: 2,
    },
    toolRecommendations: [
      { category: 'unit', tools: ['Jest', 'Vitest', 'Mocha'], preferred: 'Vitest' },
      { category: 'integration', tools: ['Testcontainers', 'Jest'] },
      { category: 'e2e', tools: ['Playwright', 'Cypress'], preferred: 'Playwright' },
      { category: 'mutation', tools: ['Stryker', 'PIT'] },
    ],
    antiPatterns: [
      'Flaky tests that pass/fail randomly',
      'Tests coupled to implementation details',
      'Slow test suites blocking development',
      'Testing private methods directly',
    ],
    bestPractices: [
      'Write small, focused tests',
      'Use test doubles sparingly',
      'Make test failures actionable',
      'Keep tests deterministic',
    ],
  },

  microsoft: {
    name: 'Microsoft Testing',
    description: 'Based on Microsoft engineering practices and documentation',
    origin: 'Microsoft',
    philosophy: 'Quality gates with comprehensive coverage and shift-left testing.',
    testPyramid: {
      unit: {
        percentage: 65,
        characteristics: [
          'High isolation',
          'Mock external dependencies',
          'Run in milliseconds',
        ],
      },
      integration: {
        percentage: 25,
        characteristics: [
          'Test service boundaries',
          'Use test doubles for external services',
          'May be slower',
        ],
      },
      e2e: {
        percentage: 10,
        characteristics: [
          'Automated UI tests',
          'Critical user journeys',
          'Cross-browser testing',
        ],
      },
    },
    techniques: [
      'Contract Testing',
      'Characterization Testing',
      'Performance TDD',
      'Security Testing',
    ],
    coverageTargets: {
      line: 85,
      branch: 80,
      function: 90,
    },
    ciConfig: {
      runOnPush: true,
      runOnPr: true,
      parallelization: true,
      cacheStrategy: 'moderate',
      failFast: false,
      retries: 3,
    },
    toolRecommendations: [
      { category: 'unit', tools: ['Jest', 'MSTest', 'xUnit'] },
      { category: 'integration', tools: ['Playwright', 'Selenium'] },
      { category: 'api', tools: ['REST-assured', 'Postman'] },
      { category: 'security', tools: ['OWASP ZAP', 'Snyk'] },
    ],
    antiPatterns: [
      'Skipping tests to meet deadlines',
      'Ignoring test warnings',
      'Manual testing for everything',
    ],
    bestPractices: [
      'Shift-left testing - test early',
      'Automate quality gates',
      'Use feature flags for safe deployment',
      'Maintain test environment parity',
    ],
  },

  netflix: {
    name: 'Netflix Chaos Testing',
    description: 'Resilience-focused testing with chaos engineering principles',
    origin: 'Netflix',
    philosophy: 'Test in production, embrace failure, build resilience.',
    testPyramid: {
      unit: {
        percentage: 50,
        characteristics: [
          'Fast feedback',
          'Core business logic',
          'Algorithms and calculations',
        ],
      },
      integration: {
        percentage: 30,
        characteristics: [
          'Service-to-service communication',
          'Contract verification',
          'Circuit breaker testing',
        ],
      },
      e2e: {
        percentage: 15,
        characteristics: [
          'Canary deployments',
          'A/B testing validation',
          'Production traffic testing',
        ],
      },
      manual: {
        percentage: 5,
        characteristics: [
          'Gameday exercises',
          'Chaos experiments',
          'User experience validation',
        ],
      },
    },
    techniques: [
      'Chaos Engineering',
      'Contract Testing',
      'Canary Testing',
      'Production Testing',
    ],
    coverageTargets: {
      line: 70,
      branch: 65,
      function: 80,
    },
    ciConfig: {
      runOnPush: true,
      runOnPr: true,
      parallelization: true,
      cacheStrategy: 'minimal',
      failFast: true,
      retries: 1,
    },
    toolRecommendations: [
      { category: 'chaos', tools: ['Chaos Monkey', 'Gremlin', 'LitmusChaos'] },
      { category: 'monitoring', tools: ['Atlas', 'Spectator'] },
      { category: 'contract', tools: ['Pact', 'Spring Cloud Contract'] },
      { category: 'load', tools: ['Gatling', 'k6'] },
    ],
    antiPatterns: [
      'Testing only happy paths',
      'Ignoring network partitions',
      'No retry/fallback testing',
      'Assuming dependencies are reliable',
    ],
    bestPractices: [
      'Design for failure',
      'Test circuit breakers',
      'Run chaos experiments in production',
      'Monitor and alert on anomalies',
    ],
  },

  spotify: {
    name: 'Spotify Squad Testing',
    description: 'Autonomous squad-based testing with focus on speed and quality',
    origin: 'Spotify',
    philosophy: 'Squads own quality, fast feedback, trunk-based development.',
    testPyramid: {
      unit: {
        percentage: 60,
        characteristics: [
          'Owned by developers',
          'Run on every commit',
          'Sub-second feedback',
        ],
      },
      integration: {
        percentage: 30,
        characteristics: [
          'Service contracts',
          'Database integration',
          'Event-driven testing',
        ],
      },
      e2e: {
        percentage: 10,
        characteristics: [
          'Smoke tests only',
          'Critical user flows',
          'Minimal maintenance',
        ],
      },
    },
    techniques: [
      'Trunk-Based Development',
      'Feature Flags',
      'Contract Testing',
      'A/B Testing',
    ],
    coverageTargets: {
      line: 75,
      branch: 70,
      function: 80,
    },
    ciConfig: {
      runOnPush: true,
      runOnPr: true,
      parallelization: true,
      cacheStrategy: 'aggressive',
      failFast: true,
      retries: 0,
    },
    toolRecommendations: [
      { category: 'unit', tools: ['Jest', 'Vitest', 'pytest'] },
      { category: 'integration', tools: ['Testcontainers'] },
      { category: 'feature-flags', tools: ['LaunchDarkly', 'Unleash'] },
    ],
    antiPatterns: [
      'Long-running feature branches',
      'Slow CI pipelines',
      'Handoffs between teams',
    ],
    bestPractices: [
      'Deploy multiple times per day',
      'Use feature flags for gradual rollout',
      'Squad owns entire lifecycle',
      'Fast feedback is priority',
    ],
  },

  thoughtworks: {
    name: 'ThoughtWorks Continuous Testing',
    description: 'Continuous delivery with comprehensive test automation',
    origin: 'ThoughtWorks',
    philosophy: 'Every commit is releasable, test automation is non-negotiable.',
    testPyramid: {
      unit: {
        percentage: 70,
        characteristics: [
          'High coverage',
          'TDD required',
          'Pair programming encouraged',
        ],
      },
      integration: {
        percentage: 20,
        characteristics: [
          'Service virtualization',
          'Consumer-driven contracts',
          'Database tests with rollback',
        ],
      },
      e2e: {
        percentage: 10,
        characteristics: [
          'Journey tests',
          'Cross-functional requirements',
          'Acceptance criteria validation',
        ],
      },
    },
    techniques: [
      'Test-Driven Development',
      'Consumer-Driven Contract Testing',
      'Continuous Integration',
      'Infrastructure as Code Testing',
    ],
    coverageTargets: {
      line: 85,
      branch: 80,
      function: 90,
      mutation: 70,
    },
    ciConfig: {
      runOnPush: true,
      runOnPr: true,
      parallelization: true,
      cacheStrategy: 'moderate',
      failFast: true,
      retries: 1,
    },
    toolRecommendations: [
      { category: 'tdd', tools: ['Jest', 'Vitest', 'RSpec'] },
      { category: 'bdd', tools: ['Cucumber', 'SpecFlow'] },
      { category: 'contract', tools: ['Pact'], preferred: 'Pact' },
      { category: 'infra', tools: ['Terratest', 'Kitchen-Terraform'] },
    ],
    antiPatterns: [
      'Manual testing gates',
      'Code review without tests',
      'Deployment without automation',
    ],
    bestPractices: [
      'TDD is default practice',
      'Pair programming for complex code',
      'Continuous integration is mandatory',
      'Automate everything possible',
    ],
  },

  facebook: {
    name: 'Meta Testing',
    description: 'Scale-focused testing with emphasis on developer velocity',
    origin: 'Meta (Facebook)',
    philosophy: 'Move fast with stable infrastructure, test at scale.',
    testPyramid: {
      unit: {
        percentage: 55,
        characteristics: [
          'Sandcastle for test isolation',
          'Jest for JavaScript',
          'High parallelization',
        ],
      },
      integration: {
        percentage: 35,
        characteristics: [
          'Service integration',
          'API testing',
          'Cross-platform mobile testing',
        ],
      },
      e2e: {
        percentage: 10,
        characteristics: [
          'Automated regression',
          'Visual regression',
          'Accessibility testing',
        ],
      },
    },
    techniques: [
      'Snapshot Testing',
      'Visual Regression Testing',
      'Property-Based Testing',
      'Differential Testing',
    ],
    coverageTargets: {
      line: 80,
      branch: 75,
      function: 85,
    },
    ciConfig: {
      runOnPush: true,
      runOnPr: true,
      parallelization: true,
      cacheStrategy: 'aggressive',
      failFast: false,
      retries: 2,
    },
    toolRecommendations: [
      { category: 'unit', tools: ['Jest'], preferred: 'Jest' },
      { category: 'snapshot', tools: ['Jest snapshots'] },
      { category: 'visual', tools: ['Percy', 'Chromatic'] },
      { category: 'mobile', tools: ['Detox', 'Appium'] },
    ],
    antiPatterns: [
      'Flaky tests blocking deployment',
      'Slow test suites',
      'Tests without clear ownership',
    ],
    bestPractices: [
      'Snapshot testing for UI consistency',
      'Parallelize everything',
      'Fix flaky tests immediately',
      'Test infrastructure as important as product',
    ],
  },

  amazon: {
    name: 'Amazon Two-Pizza Testing',
    description: 'Service-oriented testing with ownership and operational excellence',
    origin: 'Amazon',
    philosophy: 'You build it, you run it, you test it.',
    testPyramid: {
      unit: {
        percentage: 60,
        characteristics: [
          'Service-specific',
          'Fast execution',
          'High isolation',
        ],
      },
      integration: {
        percentage: 30,
        characteristics: [
          'API contracts',
          'Cross-service testing',
          'Event-driven testing',
        ],
      },
      e2e: {
        percentage: 10,
        characteristics: [
          'Customer-facing flows',
          'Critical path testing',
          'Operational runbooks',
        ],
      },
    },
    techniques: [
      'Contract Testing',
      'Chaos Engineering',
      'Load Testing',
      'Operational Excellence Testing',
    ],
    coverageTargets: {
      line: 80,
      branch: 75,
      function: 85,
    },
    ciConfig: {
      runOnPush: true,
      runOnPr: true,
      parallelization: true,
      cacheStrategy: 'moderate',
      failFast: true,
      retries: 2,
    },
    toolRecommendations: [
      { category: 'unit', tools: ['JUnit', 'pytest', 'Jest'] },
      { category: 'chaos', tools: ['AWS Fault Injection Simulator'] },
      { category: 'load', tools: ['Gatling', 'Locust'] },
      { category: 'monitoring', tools: ['CloudWatch', 'X-Ray'] },
    ],
    antiPatterns: [
      'Cross-team test dependencies',
      'Shared test environments',
      'Manual operational procedures',
    ],
    bestPractices: [
      'Team owns entire service lifecycle',
      'Automate operational procedures',
      'Test rollback procedures',
      'Monitor everything',
    ],
  },
};

// ---------------------------------------------------------------------------
// Domain-Specific Presets
// ---------------------------------------------------------------------------

export interface DomainPreset {
  domain: string;
  description: string;
  criticalAreas: string[];
  testingFocus: string[];
  specialTechniques: string[];
  regulatoryRequirements?: string[];
  tools: string[];
}

export const DOMAIN_PRESETS: Record<string, DomainPreset> = {
  fintech: {
    domain: 'Financial Technology',
    description: 'Testing for financial systems with regulatory compliance',
    criticalAreas: [
      'Transaction processing',
      'Balance calculations',
      'Security and encryption',
      'Audit trails',
    ],
    testingFocus: [
      'Precision arithmetic (no floating point)',
      'Concurrency and race conditions',
      'Idempotency',
      'Regulatory compliance',
    ],
    specialTechniques: [
      'Property-Based Testing for calculations',
      'Mutation Testing for critical paths',
      'Security Testing (OWASP)',
      'Compliance Testing',
    ],
    regulatoryRequirements: ['PCI-DSS', 'SOX', 'GDPR'],
    tools: ['Jest', 'big.js for precision', 'OWASP ZAP', 'Snyk'],
  },

  healthcare: {
    domain: 'Healthcare & Medical',
    description: 'Testing for healthcare systems with patient safety focus',
    criticalAreas: [
      'Patient data privacy',
      'Drug interaction checking',
      'Appointment scheduling',
      'Medical device integration',
    ],
    testingFocus: [
      'Data privacy (HIPAA)',
      'Accuracy of medical calculations',
      'Interoperability (HL7, FHIR)',
      'Fail-safe behavior',
    ],
    specialTechniques: [
      'Mutation Testing for safety-critical code',
      'Fuzz Testing for input validation',
      'Contract Testing for APIs',
      'Compliance Testing',
    ],
    regulatoryRequirements: ['HIPAA', 'FDA 21 CFR Part 11', 'IEC 62304'],
    tools: ['Jest', 'HAPI FHIR', 'Semgrep', 'Compliance scanners'],
  },

  ecommerce: {
    domain: 'E-Commerce',
    description: 'Testing for retail and commerce platforms',
    criticalAreas: [
      'Shopping cart',
      'Checkout flow',
      'Inventory management',
      'Payment processing',
    ],
    testingFocus: [
      'Transaction integrity',
      'Price calculations',
      'Concurrent updates',
      'Performance under load',
    ],
    specialTechniques: [
      'Load Testing for peak traffic',
      'A/B Testing validation',
      'Visual Regression for UI',
      'Contract Testing for payment gateways',
    ],
    tools: ['Playwright', 'k6', 'Percy', 'Pact'],
  },

  embedded: {
    domain: 'Embedded Systems',
    description: 'Testing for embedded and IoT devices',
    criticalAreas: [
      'Hardware abstraction',
      'Real-time constraints',
      'Memory management',
      'Power consumption',
    ],
    testingFocus: [
      'Timing constraints',
      'Resource limits',
      'Hardware simulation',
      'Protocol compliance',
    ],
    specialTechniques: [
      'Hardware-in-the-loop testing',
      'Fuzzing for protocols',
      'Static analysis',
      'Memory leak detection',
    ],
    tools: ['Ceedling', 'Unity', 'QEMU', 'Valgrind'],
  },

  gamedev: {
    domain: 'Game Development',
    description: 'Testing for games and interactive media',
    criticalAreas: [
      'Game logic',
      'Physics simulation',
      'Asset loading',
      'Multiplayer synchronization',
    ],
    testingFocus: [
      'Deterministic behavior',
      'Performance (frame rate)',
      'Platform compatibility',
      'Replay/record testing',
    ],
    specialTechniques: [
      'Replay Testing',
      'Visual Regression',
      'Performance Profiling',
      'Automated Playtesting',
    ],
    tools: ['Unity Test Framework', 'Unreal Automation', 'Gauntlet'],
  },

  ml_ai: {
    domain: 'Machine Learning / AI',
    description: 'Testing for ML models and AI systems',
    criticalAreas: [
      'Model accuracy',
      'Data pipeline integrity',
      'Bias detection',
      'Model versioning',
    ],
    testingFocus: [
      'Data quality',
      'Model performance metrics',
      'Reproducibility',
      'Fairness and bias',
    ],
    specialTechniques: [
      'Metamorphic Testing',
      'Data Validation',
      'Model Drift Detection',
      'Adversarial Testing',
    ],
    tools: ['Great Expectations', 'MLflow', 'Evidently AI', 'TensorFlow Testing'],
  },
};

// ---------------------------------------------------------------------------
// Preset Selection Helper
// ---------------------------------------------------------------------------

export interface PresetRecommendation {
  preset: string;
  confidence: number;
  reason: string;
  techniques: string[];
}

export function recommendPreset(context: {
  projectType?: string;
  teamSize?: number;
  deploymentFrequency?: string;
  domain?: string;
  existingTools?: string[];
}): PresetRecommendation[] {
  const recommendations: PresetRecommendation[] = [];

  // Domain-specific recommendations
  if (context.domain && DOMAIN_PRESETS[context.domain]) {
    const domainPreset = DOMAIN_PRESETS[context.domain];
    recommendations.push({
      preset: context.domain,
      confidence: 0.9,
      reason: `Domain-specific preset for ${domainPreset.domain}`,
      techniques: domainPreset.specialTechniques,
    });
  }

  // Team size recommendations
  if (context.teamSize !== undefined) {
    if (context.teamSize <= 5) {
      recommendations.push({
        preset: 'spotify',
        confidence: 0.8,
        reason: 'Small team benefits from squad-based autonomous testing',
        techniques: TDD_PRESETS.spotify.techniques,
      });
    } else if (context.teamSize > 50) {
      recommendations.push({
        preset: 'google',
        confidence: 0.85,
        reason: 'Large teams need consistent, scalable testing practices',
        techniques: TDD_PRESETS.google.techniques,
      });
    }
  }

  // Deployment frequency recommendations
  if (context.deploymentFrequency === 'multiple-daily') {
    recommendations.push({
      preset: 'thoughtworks',
      confidence: 0.85,
      reason: 'Continuous delivery requires comprehensive test automation',
      techniques: TDD_PRESETS.thoughtworks.techniques,
    });
  }

  // Default recommendation
  if (recommendations.length === 0) {
    recommendations.push({
      preset: 'google',
      confidence: 0.7,
      reason: 'Google preset is a solid default for most projects',
      techniques: TDD_PRESETS.google.techniques,
    });
  }

  return recommendations.sort((a, b) => b.confidence - a.confidence);
}

// ---------------------------------------------------------------------------
// Technique Selection Helper
// ---------------------------------------------------------------------------

export function getTechniquesForContext(context: {
  codeType?: 'algorithm' | 'api' | 'ui' | 'infrastructure' | 'general';
  concern?: 'security' | 'performance' | 'correctness' | 'maintainability';
  phase?: 'greenfield' | 'brownfield' | 'legacy';
}): TddTechnique[] {
  const { codeType, concern, phase } = context;
  const techniques: TddTechnique[] = [];

  // Code type specific
  if (codeType === 'algorithm') {
    techniques.push(
      ...ADVANCED_TDD_TECHNIQUES.filter(t =>
        t.category === 'property-based' || t.name.includes('Transformation')
      )
    );
  } else if (codeType === 'api') {
    techniques.push(
      ...ADVANCED_TDD_TECHNIQUES.filter(t => t.category === 'api' || t.category === 'contract')
    );
  } else if (codeType === 'ui') {
    techniques.push(
      ...ADVANCED_TDD_TECHNIQUES.filter(t => t.category === 'ui')
    );
  }

  // Concern specific
  if (concern === 'security') {
    techniques.push(
      ...ADVANCED_TDD_TECHNIQUES.filter(t => t.category === 'security')
    );
  } else if (concern === 'performance') {
    techniques.push(
      ...ADVANCED_TDD_TECHNIQUES.filter(t => t.category === 'performance')
    );
  }

  // Phase specific
  if (phase === 'legacy' || phase === 'brownfield') {
    techniques.push(
      ...ADVANCED_TDD_TECHNIQUES.filter(t => t.category === 'characterization')
    );
  }

  // Always include core TDD
  techniques.push(
    ...ADVANCED_TDD_TECHNIQUES.filter(t => t.category === 'core-tdd')
  );

  // Deduplicate
  const seen = new Set<string>();
  return techniques.filter(t => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });
}
