/**
 * @fileoverview Component Research & Best Practices Registry
 *
 * Stores and synthesizes research, world-class solutions, and best practices
 * for major codebase components. Agents reference this when working on
 * specific areas to apply proven patterns and avoid reinventing the wheel.
 *
 * Key features:
 * - Component taxonomy (what are the major parts?)
 * - Research synthesis (what are best practices for this domain?)
 * - Reference implementations (what does world-class look like?)
 * - Goals & roadmap context (where is this component going?)
 * - Evolution tracking (how has thinking evolved?)
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * A major component of the codebase that warrants dedicated research.
 * Not every file - only significant subsystems.
 */
export interface CodebaseComponent {
  id: string;                      // e.g., "auth-system", "query-engine"
  name: string;                    // Human-readable name
  description: string;             // What this component does
  category: ComponentCategory;

  // Scope
  paths: string[];                 // File paths/patterns this covers
  entryPoints: string[];           // Main entry files
  publicApi: string[];             // Exported interfaces

  // Ownership
  owners: string[];                // Team/people responsible
  stakeholders: string[];          // Who cares about this

  // Goals
  currentState: string;            // Where we are now
  targetState: string;             // Where we want to be
  roadmapItems: RoadmapItem[];     // Planned changes
  nonGoals: string[];              // What we're NOT trying to do

  // Research
  research: ComponentResearch;     // Best practices & references
  decisions: ArchitecturalDecision[]; // Key decisions made

  // Quality
  qualityGates: QualityGate[];     // Standards this must meet
  knownIssues: string[];           // Current problems
  technicalDebt: string[];         // Accumulated debt

  // Meta
  lastUpdated: string;
  confidence: number;              // How confident are we in this info
}

export type ComponentCategory =
  | 'core'           // Fundamental infrastructure
  | 'api'            // External interfaces
  | 'data'           // Data storage & access
  | 'integration'    // External service integrations
  | 'ui'             // User interface
  | 'cli'            // Command line interface
  | 'agent'          // AI/agent systems
  | 'observability'  // Logging, metrics, tracing
  | 'security'       // Auth, encryption, access control
  | 'testing'        // Test infrastructure
  | 'build'          // Build & deployment
  | 'utility';       // Shared utilities

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'planned' | 'in_progress' | 'blocked' | 'completed';
  blockedBy?: string[];
  targetDate?: string;
}

export interface ArchitecturalDecision {
  id: string;                      // e.g., "ADR-001"
  title: string;
  date: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string;                 // Why was this decision needed?
  decision: string;                // What did we decide?
  consequences: string[];          // What are the implications?
  alternatives: string[];          // What else was considered?
}

export interface QualityGate {
  name: string;
  requirement: string;
  currentValue?: string | number;
  targetValue: string | number;
  met: boolean;
}

// ============================================================================
// RESEARCH & BEST PRACTICES
// ============================================================================

export interface ComponentResearch {
  // Domain expertise
  domainContext: string;           // Background on this problem domain
  keyTerminology: Record<string, string>; // Domain terms and definitions
  commonPatterns: Pattern[];       // Patterns that apply here
  antiPatterns: AntiPattern[];     // What to avoid

  // World-class references
  referenceImplementations: Reference[];  // Best-in-class examples
  academicResearch: Reference[];   // Relevant papers/research
  industryStandards: Reference[];  // Standards to follow

  // Practical guidance
  bestPractices: BestPractice[];   // Synthesized guidance
  commonMistakes: Mistake[];       // What to watch out for
  testingStrategies: string[];     // How to test this well

  // Evolution
  versionHistory: VersionNote[];   // How thinking has evolved
  emergingPatterns: string[];      // New approaches to consider
}

export interface Pattern {
  name: string;
  description: string;
  whenToUse: string;
  example?: string;
  tradeoffs: string[];
}

export interface AntiPattern {
  name: string;
  description: string;
  whyBad: string;
  alternative: string;
}

export interface Reference {
  title: string;
  url?: string;
  source: string;                  // Company, paper, repo
  relevance: string;               // Why this is relevant
  keyTakeaways: string[];          // What to learn from it
}

export interface BestPractice {
  id: string;
  title: string;
  description: string;
  rationale: string;
  implementation: string;          // How to implement
  verification: string;            // How to verify it's done right
  priority: 'essential' | 'recommended' | 'optional';
}

export interface Mistake {
  name: string;
  description: string;
  consequences: string;
  prevention: string;
  detection: string;               // How to detect if it's happening
}

export interface VersionNote {
  version: string;
  date: string;
  summary: string;
  breakingChanges?: string[];
  newCapabilities?: string[];
}

// ============================================================================
// COMPONENT REGISTRY
// ============================================================================

export class ComponentRegistry {
  private components: Map<string, CodebaseComponent> = new Map();
  private componentsByPath: Map<string, string> = new Map(); // path -> componentId

  constructor(private storage: any, private workspace: string) {}

  /**
   * Initialize from storage
   */
  async initialize(): Promise<void> {
    const stored = await this.storage.getMetadata?.('component_registry');
    if (stored) {
      const parsed = JSON.parse(stored);
      for (const comp of parsed.components || []) {
        this.components.set(comp.id, comp);
        for (const path of comp.paths) {
          this.componentsByPath.set(path, comp.id);
        }
      }
    }
  }

  /**
   * Save to storage
   */
  async persist(): Promise<void> {
    const data = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      components: Array.from(this.components.values()),
    };
    await this.storage.setMetadata?.('component_registry', JSON.stringify(data));
  }

  // -------------------------------------------------------------------------
  // COMPONENT MANAGEMENT
  // -------------------------------------------------------------------------

  registerComponent(component: CodebaseComponent): void {
    this.components.set(component.id, component);
    for (const path of component.paths) {
      this.componentsByPath.set(path, component.id);
    }
  }

  getComponent(id: string): CodebaseComponent | undefined {
    return this.components.get(id);
  }

  getComponentForPath(filePath: string): CodebaseComponent | undefined {
    // Check exact match
    if (this.componentsByPath.has(filePath)) {
      return this.components.get(this.componentsByPath.get(filePath)!);
    }

    // Check pattern matches
    for (const [pattern, compId] of this.componentsByPath) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        if (regex.test(filePath)) {
          return this.components.get(compId);
        }
      } else if (filePath.startsWith(pattern)) {
        return this.components.get(compId);
      }
    }

    return undefined;
  }

  getAllComponents(): CodebaseComponent[] {
    return Array.from(this.components.values());
  }

  getComponentsByCategory(category: ComponentCategory): CodebaseComponent[] {
    return Array.from(this.components.values()).filter(c => c.category === category);
  }

  // -------------------------------------------------------------------------
  // RESEARCH ACCESS
  // -------------------------------------------------------------------------

  /**
   * Get all research relevant to a file being edited
   */
  getResearchForFile(filePath: string): ComponentResearch | undefined {
    const component = this.getComponentForPath(filePath);
    return component?.research;
  }

  /**
   * Get best practices relevant to a task
   */
  getBestPracticesForTask(taskDescription: string): BestPractice[] {
    const practices: BestPractice[] = [];
    const keywords = taskDescription.toLowerCase().split(/\s+/);

    for (const component of this.components.values()) {
      for (const practice of component.research.bestPractices) {
        const text = `${practice.title} ${practice.description}`.toLowerCase();
        if (keywords.some(kw => text.includes(kw))) {
          practices.push(practice);
        }
      }
    }

    // Sort by priority
    const priorityOrder = { essential: 0, recommended: 1, optional: 2 };
    return practices.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Get patterns applicable to a problem domain
   */
  getPatternsForDomain(domain: string): Pattern[] {
    const patterns: Pattern[] = [];
    const keywords = domain.toLowerCase().split(/\s+/);

    for (const component of this.components.values()) {
      for (const pattern of component.research.commonPatterns) {
        const text = `${pattern.name} ${pattern.description} ${pattern.whenToUse}`.toLowerCase();
        if (keywords.some(kw => text.includes(kw))) {
          patterns.push(pattern);
        }
      }
    }

    return patterns;
  }

  /**
   * Get anti-patterns to avoid
   */
  getAntiPatternsForDomain(domain: string): AntiPattern[] {
    const antiPatterns: AntiPattern[] = [];
    const keywords = domain.toLowerCase().split(/\s+/);

    for (const component of this.components.values()) {
      for (const antiPattern of component.research.antiPatterns) {
        const text = `${antiPattern.name} ${antiPattern.description}`.toLowerCase();
        if (keywords.some(kw => text.includes(kw))) {
          antiPatterns.push(antiPattern);
        }
      }
    }

    return antiPatterns;
  }

  /**
   * Get reference implementations for a component type
   */
  getReferencesForComponent(componentId: string): Reference[] {
    const component = this.components.get(componentId);
    if (!component) return [];

    return [
      ...component.research.referenceImplementations,
      ...component.research.academicResearch,
      ...component.research.industryStandards,
    ];
  }

  // -------------------------------------------------------------------------
  // AGENT CONTEXT GENERATION
  // -------------------------------------------------------------------------

  /**
   * Generate context prompt for an agent working on a file
   */
  generateAgentContext(filePath: string): string {
    const component = this.getComponentForPath(filePath);
    if (!component) {
      return ''; // No specific context for this file
    }

    let context = `## Component Context: ${component.name}\n\n`;
    context += `**Description**: ${component.description}\n\n`;

    // Goals
    context += `### Goals\n`;
    context += `**Current State**: ${component.currentState}\n`;
    context += `**Target State**: ${component.targetState}\n`;
    if (component.nonGoals.length > 0) {
      context += `**Non-Goals**: ${component.nonGoals.join(', ')}\n`;
    }
    context += `\n`;

    // Key decisions
    if (component.decisions.length > 0) {
      context += `### Key Decisions\n`;
      for (const decision of component.decisions.filter(d => d.status === 'accepted').slice(0, 3)) {
        context += `- **${decision.title}**: ${decision.decision}\n`;
      }
      context += `\n`;
    }

    // Best practices
    const essentialPractices = component.research.bestPractices.filter(p => p.priority === 'essential');
    if (essentialPractices.length > 0) {
      context += `### Essential Best Practices\n`;
      for (const practice of essentialPractices) {
        context += `- **${practice.title}**: ${practice.description}\n`;
      }
      context += `\n`;
    }

    // Anti-patterns
    if (component.research.antiPatterns.length > 0) {
      context += `### Avoid These Anti-Patterns\n`;
      for (const ap of component.research.antiPatterns.slice(0, 3)) {
        context += `- **${ap.name}**: ${ap.whyBad} → ${ap.alternative}\n`;
      }
      context += `\n`;
    }

    // Quality gates
    const unmetGates = component.qualityGates.filter(g => !g.met);
    if (unmetGates.length > 0) {
      context += `### Quality Gates (Not Yet Met)\n`;
      for (const gate of unmetGates) {
        context += `- ${gate.name}: Current=${gate.currentValue}, Target=${gate.targetValue}\n`;
      }
      context += `\n`;
    }

    // Known issues
    if (component.knownIssues.length > 0) {
      context += `### Known Issues\n`;
      for (const issue of component.knownIssues.slice(0, 5)) {
        context += `- ${issue}\n`;
      }
      context += `\n`;
    }

    return context;
  }

  /**
   * Generate research context for a specific problem domain
   */
  generateResearchContext(domain: string): string {
    const patterns = this.getPatternsForDomain(domain);
    const antiPatterns = this.getAntiPatternsForDomain(domain);
    const practices = this.getBestPracticesForTask(domain);

    if (patterns.length === 0 && antiPatterns.length === 0 && practices.length === 0) {
      return '';
    }

    let context = `## Research Context: ${domain}\n\n`;

    if (patterns.length > 0) {
      context += `### Applicable Patterns\n`;
      for (const p of patterns.slice(0, 5)) {
        context += `- **${p.name}**: ${p.description}\n`;
        context += `  When to use: ${p.whenToUse}\n`;
      }
      context += `\n`;
    }

    if (antiPatterns.length > 0) {
      context += `### Anti-Patterns to Avoid\n`;
      for (const ap of antiPatterns.slice(0, 3)) {
        context += `- **${ap.name}**: ${ap.whyBad}\n`;
        context += `  Instead: ${ap.alternative}\n`;
      }
      context += `\n`;
    }

    if (practices.length > 0) {
      context += `### Best Practices\n`;
      for (const p of practices.filter(p => p.priority !== 'optional').slice(0, 5)) {
        context += `- **${p.title}** [${p.priority}]: ${p.description}\n`;
      }
      context += `\n`;
    }

    return context;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

let registryInstance: ComponentRegistry | null = null;

export async function getComponentRegistry(
  storage: any,
  workspace: string,
): Promise<ComponentRegistry> {
  if (!registryInstance) {
    registryInstance = new ComponentRegistry(storage, workspace);
    await registryInstance.initialize();
  }
  return registryInstance;
}

export function resetComponentRegistry(): void {
  registryInstance = null;
}

// ============================================================================
// TEMPLATE RESEARCH (Common domains)
// ============================================================================

/**
 * Pre-built research for common software domains.
 * Use these as starting points when setting up component research.
 */
export const DOMAIN_RESEARCH_TEMPLATES: Record<string, Partial<ComponentResearch>> = {

  authentication: {
    domainContext: 'Authentication verifies user identity. It must be secure, user-friendly, and performant.',
    keyTerminology: {
      'JWT': 'JSON Web Token - stateless, signed token for claims',
      'OAuth2': 'Authorization framework for delegated access',
      'OIDC': 'OpenID Connect - identity layer on OAuth2',
      'MFA': 'Multi-factor authentication',
      'Session': 'Server-side state tied to a cookie',
    },
    commonPatterns: [
      {
        name: 'Token-based Auth',
        description: 'Use JWTs for stateless authentication',
        whenToUse: 'APIs, microservices, mobile apps',
        tradeoffs: ['Stateless (+scalable)', 'Can\'t revoke easily (-security)'],
      },
      {
        name: 'Session-based Auth',
        description: 'Server-side sessions with cookies',
        whenToUse: 'Web apps with server rendering',
        tradeoffs: ['Revocable (+security)', 'Requires session store (-complexity)'],
      },
    ],
    antiPatterns: [
      {
        name: 'Storing passwords in plain text',
        description: 'Never store or log plain text passwords',
        whyBad: 'Catastrophic if database is breached',
        alternative: 'Use bcrypt, Argon2, or scrypt for password hashing',
      },
      {
        name: 'Long-lived tokens without refresh',
        description: 'Tokens that never expire',
        whyBad: 'If stolen, attacker has permanent access',
        alternative: 'Short-lived access tokens + refresh token rotation',
      },
    ],
    bestPractices: [
      {
        id: 'AUTH-001',
        title: 'Use strong password hashing',
        description: 'Always use bcrypt, Argon2, or scrypt for password storage',
        rationale: 'These algorithms are designed to be slow, making brute force attacks impractical',
        implementation: 'npm install bcrypt; const hash = await bcrypt.hash(password, 12)',
        verification: 'Verify hash format starts with $2b$ (bcrypt)',
        priority: 'essential',
      },
      {
        id: 'AUTH-002',
        title: 'Implement rate limiting',
        description: 'Limit login attempts to prevent brute force attacks',
        rationale: 'Attackers can try millions of passwords without rate limiting',
        implementation: 'Use express-rate-limit or similar middleware',
        verification: 'Test that 10+ rapid requests are blocked',
        priority: 'essential',
      },
    ],
    referenceImplementations: [
      {
        title: 'Auth.js (NextAuth)',
        url: 'https://authjs.dev/',
        source: 'Open Source',
        relevance: 'Best-in-class auth for Next.js/React apps',
        keyTakeaways: ['Provider abstraction', 'Session management', 'CSRF protection'],
      },
    ],
  },

  api_design: {
    domainContext: 'API design affects usability, performance, and evolvability. Good APIs are intuitive and consistent.',
    keyTerminology: {
      'REST': 'Representational State Transfer - resource-based API style',
      'GraphQL': 'Query language for flexible data fetching',
      'OpenAPI': 'Specification for describing REST APIs',
      'Idempotency': 'Same request produces same result',
      'HATEOAS': 'Hypermedia as the Engine of Application State',
    },
    commonPatterns: [
      {
        name: 'Resource-oriented design',
        description: 'Model APIs around resources (nouns), not actions (verbs)',
        whenToUse: 'CRUD operations, RESTful APIs',
        tradeoffs: ['Intuitive (+usability)', 'May not fit all use cases'],
      },
      {
        name: 'Pagination',
        description: 'Return data in pages with cursor or offset',
        whenToUse: 'Any list endpoint that could return many items',
        tradeoffs: ['Scalable (+performance)', 'More complex client logic'],
      },
    ],
    antiPatterns: [
      {
        name: 'Verb-based URLs',
        description: 'URLs like /getUser or /createOrder',
        whyBad: 'Redundant with HTTP methods, inconsistent',
        alternative: 'Use nouns: GET /users/{id}, POST /orders',
      },
      {
        name: 'Nested resources too deep',
        description: '/users/{id}/orders/{id}/items/{id}/reviews',
        whyBad: 'Hard to navigate, fragile if structure changes',
        alternative: 'Flatten: /reviews?orderId=X or /order-items/{id}',
      },
    ],
    bestPractices: [
      {
        id: 'API-001',
        title: 'Use consistent naming',
        description: 'Choose one convention (camelCase or snake_case) and stick to it',
        rationale: 'Consistency reduces cognitive load for API consumers',
        implementation: 'Define naming convention in API style guide',
        verification: 'Lint API schemas for naming consistency',
        priority: 'essential',
      },
      {
        id: 'API-002',
        title: 'Version your API',
        description: 'Include version in URL (/v1/) or header',
        rationale: 'Allows breaking changes without breaking existing clients',
        implementation: 'URL: /api/v1/users or Header: Accept-Version: 1',
        verification: 'Test that v1 and v2 can coexist',
        priority: 'essential',
      },
    ],
    referenceImplementations: [
      {
        title: 'Stripe API',
        url: 'https://stripe.com/docs/api',
        source: 'Stripe',
        relevance: 'Gold standard for API design',
        keyTakeaways: ['Consistent patterns', 'Excellent error messages', 'Idempotency keys'],
      },
    ],
  },

  error_handling: {
    domainContext: 'Error handling determines how gracefully software fails and how debuggable it is.',
    keyTerminology: {
      'Exception': 'Thrown error that interrupts normal flow',
      'Error boundary': 'Component that catches and handles child errors',
      'Circuit breaker': 'Pattern to fail fast when downstream is unhealthy',
      'Retry': 'Attempting operation again after failure',
    },
    commonPatterns: [
      {
        name: 'Fail fast',
        description: 'Validate early and fail immediately if invalid',
        whenToUse: 'Input validation, precondition checks',
        tradeoffs: ['Clear errors (+debugging)', 'Must handle at boundaries'],
      },
      {
        name: 'Error wrapping',
        description: 'Catch, add context, re-throw',
        whenToUse: 'When crossing abstraction layers',
        tradeoffs: ['Better stack traces (+debugging)', 'More code'],
      },
    ],
    antiPatterns: [
      {
        name: 'Swallowing errors',
        description: 'catch (e) { /* ignore */ }',
        whyBad: 'Hides failures, makes debugging impossible',
        alternative: 'Log, handle specifically, or re-throw with context',
      },
      {
        name: 'Generic error messages',
        description: '"An error occurred"',
        whyBad: 'Provides no actionable information',
        alternative: 'Include what failed, why, and how to fix',
      },
    ],
    bestPractices: [
      {
        id: 'ERR-001',
        title: 'Use typed errors',
        description: 'Define specific error classes for different failure modes',
        rationale: 'Allows callers to handle different errors differently',
        implementation: 'class ValidationError extends Error { constructor(public field: string) {...} }',
        verification: 'Test that specific errors are thrown for specific conditions',
        priority: 'recommended',
      },
    ],
  },

  testing: {
    domainContext: 'Testing verifies correctness and prevents regressions. Good tests are fast, reliable, and maintainable.',
    keyTerminology: {
      'Unit test': 'Tests a single function/class in isolation',
      'Integration test': 'Tests multiple components working together',
      'E2E test': 'Tests the full system from user perspective',
      'Mocking': 'Replacing dependencies with test doubles',
      'Coverage': 'Percentage of code exercised by tests',
    },
    commonPatterns: [
      {
        name: 'AAA pattern',
        description: 'Arrange, Act, Assert - structure for readable tests',
        whenToUse: 'All unit tests',
        tradeoffs: ['Readable (+maintainability)', 'Slightly more verbose'],
      },
      {
        name: 'Test pyramid',
        description: 'Many unit tests, fewer integration, few E2E',
        whenToUse: 'Planning test strategy',
        tradeoffs: ['Fast feedback (+speed)', 'May miss integration issues'],
      },
    ],
    antiPatterns: [
      {
        name: 'Testing implementation details',
        description: 'Asserting on internal state or private methods',
        whyBad: 'Tests break when refactoring, even if behavior is unchanged',
        alternative: 'Test public behavior and outputs',
      },
      {
        name: 'Flaky tests',
        description: 'Tests that sometimes pass, sometimes fail',
        whyBad: 'Erodes trust in test suite, wastes time',
        alternative: 'Fix or delete; never ignore',
      },
    ],
    bestPractices: [
      {
        id: 'TEST-001',
        title: 'One assertion per test (or one concept)',
        description: 'Each test should verify one specific behavior',
        rationale: 'Clear failure messages, easier debugging',
        implementation: 'Split multi-assertion tests into separate it() blocks',
        verification: 'Review test names - each should describe a specific behavior',
        priority: 'recommended',
      },
    ],
  },
};
