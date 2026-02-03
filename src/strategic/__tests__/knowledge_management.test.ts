import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  // Types
  type KnowledgeItem,
  type KnowledgeType,
  type StalenessInfo,
  type FeedbackStats,
  type DecisionAlternative,
  type RunbookStep,
  type KnowledgeRelation,
  type KnowledgeGapItem,
  type KnowledgeImprovement,
  type Contradiction,
  type SearchResult,
  type SearchOptions,
  type DecisionKnowledge,
  type OperationalKnowledge,
  type DomainKnowledge,
  type GlossaryKnowledge,
  type KnowledgeGraph,
  type LearningSystem,

  // Factory functions
  createDefaultStalenessInfo,
  createDefaultFeedbackStats,
  isKnowledgeStale,
  computeRefreshPriority,
  createKnowledgeId,
  createDecisionKnowledge,
  createOperationalKnowledge,
  createDomainKnowledge,
  createGlossaryKnowledge,
  createKnowledgeGraph,
  createLearningSystem,

  // Type guards
  isDecisionKnowledge,
  isOperationalKnowledge,
  isDomainKnowledge,
  isGlossaryKnowledge,

  // Classes
  InMemoryKnowledgeGraph,
  InMemoryLearningSystem,
} from '../knowledge_management.js';

import { absent, bounded, deterministic, getNumericValue } from '../../epistemics/confidence.js';

describe('knowledge_management', () => {
  describe('StalenessInfo', () => {
    it('creates default staleness info with current timestamp', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));

      const staleness = createDefaultStalenessInfo();

      expect(staleness.lastVerified.toISOString()).toBe('2026-01-20T10:00:00.000Z');
      expect(staleness.maxAgeDays).toBe(90);
      expect(staleness.isStale).toBe(false);
      expect(staleness.refreshPriority).toBe('low');

      vi.useRealTimers();
    });

    it('accepts custom maxAgeDays', () => {
      const staleness = createDefaultStalenessInfo(30);
      expect(staleness.maxAgeDays).toBe(30);
    });
  });

  describe('FeedbackStats', () => {
    it('creates default feedback stats with zero counts', () => {
      const stats = createDefaultFeedbackStats();

      expect(stats.helpfulCount).toBe(0);
      expect(stats.unhelpfulCount).toBe(0);
      expect(stats.accessCount).toBe(0);
      expect(stats.averageRating).toBeUndefined();
      expect(stats.lastFeedbackAt).toBeUndefined();
    });
  });

  describe('isKnowledgeStale', () => {
    it('returns false for fresh knowledge', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));

      const item: KnowledgeItem = {
        id: 'test-1',
        type: 'technical',
        title: 'Test Item',
        content: 'Test content',
        tags: [],
        confidence: absent('uncalibrated'),
        evidenceRefs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'test',
        staleness: {
          lastVerified: new Date('2026-01-15T10:00:00.000Z'), // 5 days ago
          maxAgeDays: 30,
          isStale: false,
          refreshPriority: 'low',
        },
        feedback: createDefaultFeedbackStats(),
      };

      expect(isKnowledgeStale(item)).toBe(false);

      vi.useRealTimers();
    });

    it('returns true for stale knowledge', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));

      const item: KnowledgeItem = {
        id: 'test-1',
        type: 'technical',
        title: 'Test Item',
        content: 'Test content',
        tags: [],
        confidence: absent('uncalibrated'),
        evidenceRefs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'test',
        staleness: {
          lastVerified: new Date('2025-11-20T10:00:00.000Z'), // 61 days ago
          maxAgeDays: 30,
          isStale: false,
          refreshPriority: 'low',
        },
        feedback: createDefaultFeedbackStats(),
      };

      expect(isKnowledgeStale(item)).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('computeRefreshPriority', () => {
    it('returns high for stale and heavily used items', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));

      const item: KnowledgeItem = {
        id: 'test-1',
        type: 'technical',
        title: 'Test Item',
        content: 'Test content',
        tags: [],
        confidence: deterministic(true, 'test'),
        evidenceRefs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'test',
        staleness: {
          lastVerified: new Date('2025-11-20T10:00:00.000Z'), // stale
          maxAgeDays: 30,
          isStale: true,
          refreshPriority: 'low',
        },
        feedback: {
          helpfulCount: 10,
          unhelpfulCount: 2,
          accessCount: 50, // heavily used
        },
      };

      expect(computeRefreshPriority(item)).toBe('high');

      vi.useRealTimers();
    });

    it('returns high for low confidence items', () => {
      const item: KnowledgeItem = {
        id: 'test-1',
        type: 'technical',
        title: 'Test Item',
        content: 'Test content',
        tags: [],
        confidence: bounded(0.1, 0.2, 'theoretical', 'test'),
        evidenceRefs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'test',
        staleness: createDefaultStalenessInfo(),
        feedback: createDefaultFeedbackStats(),
      };

      expect(computeRefreshPriority(item)).toBe('high');
    });

    it('returns high for items with many unhelpful votes', () => {
      const item: KnowledgeItem = {
        id: 'test-1',
        type: 'technical',
        title: 'Test Item',
        content: 'Test content',
        tags: [],
        confidence: deterministic(true, 'test'),
        evidenceRefs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'test',
        staleness: createDefaultStalenessInfo(),
        feedback: {
          helpfulCount: 2,
          unhelpfulCount: 8, // 80% unhelpful
          accessCount: 10,
        },
      };

      expect(computeRefreshPriority(item)).toBe('high');
    });

    it('returns low for fresh, high-confidence, well-liked items', () => {
      const item: KnowledgeItem = {
        id: 'test-1',
        type: 'technical',
        title: 'Test Item',
        content: 'Test content',
        tags: [],
        confidence: deterministic(true, 'verified'),
        evidenceRefs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'test',
        staleness: createDefaultStalenessInfo(),
        feedback: {
          helpfulCount: 20,
          unhelpfulCount: 2,
          accessCount: 100,
        },
      };

      expect(computeRefreshPriority(item)).toBe('low');
    });
  });

  describe('createKnowledgeId', () => {
    it('creates unique IDs with default prefix', () => {
      const id1 = createKnowledgeId();
      const id2 = createKnowledgeId();

      expect(id1).toMatch(/^kn_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^kn_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('uses custom prefix', () => {
      const id = createKnowledgeId('decision');
      expect(id).toMatch(/^decision_\d+_[a-z0-9]+$/);
    });
  });

  describe('Knowledge Item Factories', () => {
    describe('createDecisionKnowledge', () => {
      it('creates a decision knowledge item with required fields', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));

        const alternatives: DecisionAlternative[] = [
          {
            name: 'Option A',
            description: 'First option',
            pros: ['Simple'],
            cons: ['Limited'],
            whyRejected: 'Too limited for our needs',
          },
        ];

        const decision = createDecisionKnowledge(
          {
            title: 'Use TypeScript',
            content: 'We decided to use TypeScript for type safety',
            author: 'alice',
          },
          'We needed to improve code quality',
          alternatives
        );

        expect(decision.type).toBe('decision');
        expect(decision.title).toBe('Use TypeScript');
        expect(decision.content).toBe('We decided to use TypeScript for type safety');
        expect(decision.author).toBe('alice');
        expect(decision.decisionContext).toBe('We needed to improve code quality');
        expect(decision.alternatives).toEqual(alternatives);
        expect(decision.staleness.maxAgeDays).toBe(180); // Decisions have longer validity
        expect(decision.id).toMatch(/^decision_/);

        vi.useRealTimers();
      });

      it('accepts custom options', () => {
        const decision = createDecisionKnowledge(
          {
            id: 'custom-id',
            title: 'Custom Decision',
            content: 'Content',
            author: 'bob',
            tags: ['architecture', 'important'],
            confidence: deterministic(true, 'approved'),
            maxAgeDays: 365,
          },
          'Context',
          []
        );

        expect(decision.id).toBe('custom-id');
        expect(decision.tags).toEqual(['architecture', 'important']);
        expect(decision.confidence.type).toBe('deterministic');
        expect(decision.staleness.maxAgeDays).toBe(365);
      });
    });

    describe('createOperationalKnowledge', () => {
      it('creates an operational knowledge item with runbook steps', () => {
        const steps: RunbookStep[] = [
          {
            order: 1,
            action: 'Check service status',
            expectedOutcome: 'Service is responding',
            rollback: 'Restart service',
            warnings: ['May take up to 30 seconds'],
          },
          {
            order: 2,
            action: 'Deploy new version',
            expectedOutcome: 'Deployment successful',
          },
        ];

        const runbook = createOperationalKnowledge(
          {
            title: 'Deployment Runbook',
            content: 'Steps to deploy the application',
            author: 'ops-team',
          },
          steps
        );

        expect(runbook.type).toBe('operational');
        expect(runbook.runbookSteps).toEqual(steps);
        expect(runbook.staleness.maxAgeDays).toBe(30); // Runbooks need frequent verification
        expect(runbook.id).toMatch(/^runbook_/);
      });
    });

    describe('createDomainKnowledge', () => {
      it('creates a domain knowledge item', () => {
        const domain = createDomainKnowledge(
          {
            title: 'Customer',
            content: 'A customer is a person or organization that purchases our products',
            author: 'product-team',
          },
          ['User', 'Account', 'Order'],
          'Sales'
        );

        expect(domain.type).toBe('domain');
        expect(domain.relatedTerms).toEqual(['User', 'Account', 'Order']);
        expect(domain.boundedContext).toBe('Sales');
        expect(domain.id).toMatch(/^domain_/);
      });
    });

    describe('createGlossaryKnowledge', () => {
      it('creates a glossary knowledge item', () => {
        const glossary = createGlossaryKnowledge(
          {
            title: 'API',
            content: 'Application Programming Interface - a set of protocols for building software',
            author: 'tech-writing',
          },
          'API',
          ['REST API', 'GraphQL'],
          ['Our REST API supports JSON responses', 'Call the API with a valid token']
        );

        expect(glossary.type).toBe('glossary');
        expect(glossary.term).toBe('API');
        expect(glossary.aliases).toEqual(['REST API', 'GraphQL']);
        expect(glossary.usageExamples).toHaveLength(2);
        expect(glossary.notToBe).toEqual([]);
        expect(glossary.staleness.maxAgeDays).toBe(365); // Glossary terms are stable
        expect(glossary.id).toMatch(/^glossary_/);
      });
    });
  });

  describe('Type Guards', () => {
    let decision: DecisionKnowledge;
    let operational: OperationalKnowledge;
    let domain: DomainKnowledge;
    let glossary: GlossaryKnowledge;

    beforeEach(() => {
      decision = createDecisionKnowledge(
        { title: 'Decision', content: 'Content', author: 'author' },
        'Context',
        []
      );
      operational = createOperationalKnowledge(
        { title: 'Runbook', content: 'Content', author: 'author' },
        []
      );
      domain = createDomainKnowledge(
        { title: 'Domain', content: 'Content', author: 'author' },
        []
      );
      glossary = createGlossaryKnowledge(
        { title: 'Term', content: 'Content', author: 'author' },
        'Term'
      );
    });

    it('isDecisionKnowledge correctly identifies decision items', () => {
      expect(isDecisionKnowledge(decision)).toBe(true);
      expect(isDecisionKnowledge(operational)).toBe(false);
      expect(isDecisionKnowledge(domain)).toBe(false);
      expect(isDecisionKnowledge(glossary)).toBe(false);
    });

    it('isOperationalKnowledge correctly identifies operational items', () => {
      expect(isOperationalKnowledge(decision)).toBe(false);
      expect(isOperationalKnowledge(operational)).toBe(true);
      expect(isOperationalKnowledge(domain)).toBe(false);
      expect(isOperationalKnowledge(glossary)).toBe(false);
    });

    it('isDomainKnowledge correctly identifies domain items', () => {
      expect(isDomainKnowledge(decision)).toBe(false);
      expect(isDomainKnowledge(operational)).toBe(false);
      expect(isDomainKnowledge(domain)).toBe(true);
      expect(isDomainKnowledge(glossary)).toBe(false);
    });

    it('isGlossaryKnowledge correctly identifies glossary items', () => {
      expect(isGlossaryKnowledge(decision)).toBe(false);
      expect(isGlossaryKnowledge(operational)).toBe(false);
      expect(isGlossaryKnowledge(domain)).toBe(false);
      expect(isGlossaryKnowledge(glossary)).toBe(true);
    });
  });

  describe('InMemoryKnowledgeGraph', () => {
    let graph: KnowledgeGraph;

    beforeEach(() => {
      graph = createKnowledgeGraph();
    });

    describe('Basic CRUD operations', () => {
      it('adds and retrieves items', () => {
        const item = createDomainKnowledge(
          { title: 'Test', content: 'Content', author: 'author' },
          []
        );

        graph.addItem(item);

        expect(graph.items).toHaveLength(1);
        expect(graph.getItem(item.id)).toEqual(item);
      });

      it('removes items', () => {
        const item = createDomainKnowledge(
          { title: 'Test', content: 'Content', author: 'author' },
          []
        );

        graph.addItem(item);
        expect(graph.items).toHaveLength(1);

        graph.removeItem(item.id);
        expect(graph.items).toHaveLength(0);
        expect(graph.getItem(item.id)).toBeUndefined();
      });

      it('updates items', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));

        const item = createDomainKnowledge(
          { title: 'Test', content: 'Original', author: 'author' },
          []
        );

        graph.addItem(item);

        vi.setSystemTime(new Date('2026-01-21T10:00:00.000Z'));

        graph.updateItem(item.id, { content: 'Updated' });

        const updated = graph.getItem(item.id);
        expect(updated?.content).toBe('Updated');
        expect(updated?.updatedAt.toISOString()).toBe('2026-01-21T10:00:00.000Z');

        vi.useRealTimers();
      });

      it('returns undefined for non-existent items', () => {
        expect(graph.getItem('non-existent')).toBeUndefined();
      });
    });

    describe('Relations', () => {
      it('adds relations between items', () => {
        const item1 = createDomainKnowledge(
          { id: 'item-1', title: 'Item 1', content: 'Content', author: 'author' },
          []
        );
        const item2 = createDomainKnowledge(
          { id: 'item-2', title: 'Item 2', content: 'Content', author: 'author' },
          []
        );

        graph.addItem(item1);
        graph.addItem(item2);

        graph.addRelation({
          fromId: 'item-1',
          toId: 'item-2',
          type: 'relates_to',
        });

        expect(graph.relations).toHaveLength(1);
        expect(graph.relations[0].fromId).toBe('item-1');
        expect(graph.relations[0].toId).toBe('item-2');
      });

      it('does not add relations for non-existent items', () => {
        const item1 = createDomainKnowledge(
          { id: 'item-1', title: 'Item 1', content: 'Content', author: 'author' },
          []
        );

        graph.addItem(item1);

        graph.addRelation({
          fromId: 'item-1',
          toId: 'non-existent',
          type: 'relates_to',
        });

        expect(graph.relations).toHaveLength(0);
      });

      it('does not add duplicate relations', () => {
        const item1 = createDomainKnowledge(
          { id: 'item-1', title: 'Item 1', content: 'Content', author: 'author' },
          []
        );
        const item2 = createDomainKnowledge(
          { id: 'item-2', title: 'Item 2', content: 'Content', author: 'author' },
          []
        );

        graph.addItem(item1);
        graph.addItem(item2);

        graph.addRelation({ fromId: 'item-1', toId: 'item-2', type: 'relates_to' });
        graph.addRelation({ fromId: 'item-1', toId: 'item-2', type: 'relates_to' });

        expect(graph.relations).toHaveLength(1);
      });

      it('removes relations when item is removed', () => {
        const item1 = createDomainKnowledge(
          { id: 'item-1', title: 'Item 1', content: 'Content', author: 'author' },
          []
        );
        const item2 = createDomainKnowledge(
          { id: 'item-2', title: 'Item 2', content: 'Content', author: 'author' },
          []
        );

        graph.addItem(item1);
        graph.addItem(item2);
        graph.addRelation({ fromId: 'item-1', toId: 'item-2', type: 'relates_to' });

        expect(graph.relations).toHaveLength(1);

        graph.removeItem('item-1');

        expect(graph.relations).toHaveLength(0);
      });

      it('gets related items', () => {
        const item1 = createDomainKnowledge(
          { id: 'item-1', title: 'Item 1', content: 'Content', author: 'author' },
          []
        );
        const item2 = createDomainKnowledge(
          { id: 'item-2', title: 'Item 2', content: 'Content', author: 'author' },
          []
        );
        const item3 = createDomainKnowledge(
          { id: 'item-3', title: 'Item 3', content: 'Content', author: 'author' },
          []
        );

        graph.addItem(item1);
        graph.addItem(item2);
        graph.addItem(item3);

        graph.addRelation({ fromId: 'item-1', toId: 'item-2', type: 'relates_to' });
        graph.addRelation({ fromId: 'item-1', toId: 'item-3', type: 'depends_on' });

        const related = graph.getRelated('item-1');
        expect(related).toHaveLength(2);

        const relatedByType = graph.getRelated('item-1', ['depends_on']);
        expect(relatedByType).toHaveLength(1);
        expect(relatedByType[0].id).toBe('item-3');
      });
    });

    describe('Search', () => {
      beforeEach(() => {
        graph.addItem(
          createDomainKnowledge(
            {
              id: 'auth-1',
              title: 'Authentication Overview',
              content: 'How authentication works in our system',
              author: 'alice',
              tags: ['security', 'auth'],
            },
            ['login', 'token']
          )
        );
        graph.addItem(
          createDomainKnowledge(
            {
              id: 'auth-2',
              title: 'OAuth Integration',
              content: 'OAuth2 authentication flow with external providers',
              author: 'bob',
              tags: ['security', 'oauth', 'integration'],
            },
            ['token', 'provider']
          )
        );
        graph.addItem(
          createOperationalKnowledge(
            {
              id: 'deploy-1',
              title: 'Deployment Guide',
              content: 'How to deploy the application to production',
              author: 'ops',
              tags: ['deployment', 'ops'],
            },
            []
          )
        );
      });

      it('searches by query in title', () => {
        const results = graph.search('authentication');

        expect(results).toHaveLength(2);
        expect(results[0].item.id).toBe('auth-1'); // Title match ranks higher
      });

      it('searches by query in content', () => {
        const results = graph.search('OAuth2');

        expect(results).toHaveLength(1);
        expect(results[0].item.id).toBe('auth-2');
      });

      it('searches by query in tags', () => {
        const results = graph.search('integration');

        expect(results).toHaveLength(1);
        expect(results[0].item.id).toBe('auth-2');
      });

      it('filters by type', () => {
        const results = graph.search('', { types: ['operational'] });

        expect(results).toHaveLength(1);
        expect(results[0].item.id).toBe('deploy-1');
      });

      it('filters by tags', () => {
        const results = graph.search('', { tags: ['security'] });

        expect(results).toHaveLength(2);
      });

      it('filters by author', () => {
        const results = graph.search('', { author: 'alice' });

        expect(results).toHaveLength(1);
        expect(results[0].item.id).toBe('auth-1');
      });

      it('respects limit', () => {
        const results = graph.search('', { limit: 1 });

        expect(results).toHaveLength(1);
      });

      it('returns relevance scores', () => {
        const results = graph.search('authentication');

        expect(results[0].relevanceScore).toBeGreaterThan(0);
        expect(results[0].relevanceScore).toBeLessThanOrEqual(1);
      });

      it('returns matched terms', () => {
        const results = graph.search('authentication oauth');

        expect(results[0].matchedTerms.length).toBeGreaterThan(0);
      });

      it('returns snippet around match', () => {
        const results = graph.search('OAuth2');

        expect(results[0].snippet).toContain('OAuth2');
      });
    });

    describe('Gap Detection', () => {
      it('detects stale knowledge gaps', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));

        // Add items with different staleness
        for (let i = 0; i < 5; i++) {
          const item = createDomainKnowledge(
            {
              id: `stale-${i}`,
              title: `Stale Item ${i}`,
              content: 'Content',
              author: 'author',
              maxAgeDays: 30,
            },
            []
          );
          // Make items stale
          item.staleness.lastVerified = new Date('2025-11-01T00:00:00.000Z');
          graph.addItem(item);
        }

        // Add one fresh item
        graph.addItem(
          createDomainKnowledge(
            {
              id: 'fresh-1',
              title: 'Fresh Item',
              content: 'Content',
              author: 'author',
            },
            []
          )
        );

        const gaps = graph.detectGaps();

        const stalenessGap = gaps.find((g) => g.area === 'domain knowledge');
        expect(stalenessGap).toBeDefined();
        expect(stalenessGap?.importance).toBe('high');

        vi.useRealTimers();
      });

      it('detects isolated items gap', () => {
        // Add many items without relations
        for (let i = 0; i < 10; i++) {
          graph.addItem(
            createDomainKnowledge(
              {
                id: `isolated-${i}`,
                title: `Isolated Item ${i}`,
                content: 'Content',
                author: 'author',
              },
              []
            )
          );
        }

        const gaps = graph.detectGaps();

        const connectivityGap = gaps.find((g) => g.area === 'Knowledge connectivity');
        expect(connectivityGap).toBeDefined();
        expect(connectivityGap?.importance).toBe('medium');
      });

      it('detects low confidence gap', () => {
        for (let i = 0; i < 5; i++) {
          const item = createDomainKnowledge(
            {
              id: `low-conf-${i}`,
              title: `Low Confidence Item ${i}`,
              content: 'Content',
              author: 'author',
              confidence: bounded(0.1, 0.3, 'theoretical', 'uncertain'),
            },
            []
          );
          graph.addItem(item);
        }

        const gaps = graph.detectGaps();

        const confidenceGap = gaps.find((g) => g.area === 'Knowledge confidence');
        expect(confidenceGap).toBeDefined();
        expect(confidenceGap?.importance).toBe('high');
      });
    });

    describe('Staleness Refresh', () => {
      it('returns stale items sorted by refresh priority', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-20T10:00:00.000Z'));

        // High priority: stale + heavily used
        const highPriority = createDomainKnowledge(
          { id: 'high', title: 'High Priority', content: 'Content', author: 'author' },
          []
        );
        highPriority.staleness.lastVerified = new Date('2025-10-01T00:00:00.000Z');
        highPriority.staleness.maxAgeDays = 30;
        highPriority.feedback.accessCount = 50;
        graph.addItem(highPriority);

        // Low priority: stale but unused
        const lowPriority = createDomainKnowledge(
          { id: 'low', title: 'Low Priority', content: 'Content', author: 'author' },
          []
        );
        lowPriority.staleness.lastVerified = new Date('2025-10-01T00:00:00.000Z');
        lowPriority.staleness.maxAgeDays = 30;
        lowPriority.feedback.accessCount = 0;
        graph.addItem(lowPriority);

        // Not stale
        const fresh = createDomainKnowledge(
          { id: 'fresh', title: 'Fresh', content: 'Content', author: 'author' },
          []
        );
        graph.addItem(fresh);

        const staleItems = graph.refreshStale();

        expect(staleItems).toHaveLength(2);
        expect(staleItems[0].id).toBe('high');
        expect(staleItems[0].staleness.refreshPriority).toBe('high');
        expect(staleItems[1].id).toBe('low');
        expect(staleItems[1].staleness.refreshPriority).toBe('medium');

        vi.useRealTimers();
      });
    });
  });

  describe('InMemoryLearningSystem', () => {
    let graph: KnowledgeGraph;
    let learningSystem: LearningSystem;

    beforeEach(() => {
      graph = createKnowledgeGraph();
      learningSystem = createLearningSystem(graph);

      graph.addItem(
        createDomainKnowledge(
          { id: 'item-1', title: 'Item 1', content: 'Content', author: 'author' },
          []
        )
      );
    });

    describe('Feedback', () => {
      it('records positive feedback', () => {
        learningSystem.recordFeedback('item-1', true, 'Very helpful!');

        const item = graph.getItem('item-1');
        expect(item?.feedback.helpfulCount).toBe(1);
        expect(item?.feedback.unhelpfulCount).toBe(0);
        expect(item?.feedback.lastFeedbackAt).toBeDefined();

        const history = learningSystem.getFeedbackHistory('item-1');
        expect(history).toHaveLength(1);
        expect(history[0].helpful).toBe(true);
        expect(history[0].comment).toBe('Very helpful!');
      });

      it('records negative feedback', () => {
        learningSystem.recordFeedback('item-1', false, 'Outdated');

        const item = graph.getItem('item-1');
        expect(item?.feedback.helpfulCount).toBe(0);
        expect(item?.feedback.unhelpfulCount).toBe(1);
      });

      it('accumulates feedback counts', () => {
        learningSystem.recordFeedback('item-1', true);
        learningSystem.recordFeedback('item-1', true);
        learningSystem.recordFeedback('item-1', false);

        const item = graph.getItem('item-1');
        expect(item?.feedback.helpfulCount).toBe(2);
        expect(item?.feedback.unhelpfulCount).toBe(1);

        const history = learningSystem.getFeedbackHistory('item-1');
        expect(history).toHaveLength(3);
      });
    });

    describe('Usage Tracking', () => {
      it('tracks usage and increments access count', () => {
        learningSystem.trackUsage('item-1');
        learningSystem.trackUsage('item-1');
        learningSystem.trackUsage('item-1');

        const item = graph.getItem('item-1');
        expect(item?.feedback.accessCount).toBe(3);
      });

      it('provides usage statistics', () => {
        learningSystem.trackUsage('item-1');
        learningSystem.trackUsage('item-1');

        const stats = learningSystem.getUsageStats('item-1');

        expect(stats.totalAccesses).toBe(2);
        expect(stats.lastAccessed).toBeDefined();
      });

      it('returns stable trend for consistent usage', () => {
        const stats = learningSystem.getUsageStats('item-1');
        expect(stats.accessTrend).toBe('stable');
      });
    });

    describe('Improvement Suggestions', () => {
      it('suggests updates for items with high unhelpful ratio', () => {
        // Add feedback with high unhelpful ratio
        for (let i = 0; i < 3; i++) {
          learningSystem.recordFeedback('item-1', true);
        }
        for (let i = 0; i < 7; i++) {
          learningSystem.recordFeedback('item-1', false);
        }

        const improvements = learningSystem.suggestImprovements();

        const updateSuggestion = improvements.find(
          (i) => i.itemId === 'item-1' && i.improvementType === 'update'
        );
        expect(updateSuggestion).toBeDefined();
        expect(updateSuggestion?.reason).toBe('High unhelpful feedback ratio');
      });

      it('suggests elaboration for low confidence items', () => {
        const lowConfItem = createDomainKnowledge(
          {
            id: 'low-conf',
            title: 'Low Confidence',
            content: 'Content',
            author: 'author',
            confidence: bounded(0.2, 0.4, 'theoretical', 'uncertain'),
          },
          []
        );
        graph.addItem(lowConfItem);

        const improvements = learningSystem.suggestImprovements();

        const elaborateSuggestion = improvements.find(
          (i) => i.itemId === 'low-conf' && i.improvementType === 'elaborate'
        );
        expect(elaborateSuggestion).toBeDefined();
        expect(elaborateSuggestion?.reason).toBe('Low confidence score');
      });

      it('sorts suggestions by priority', () => {
        // Add multiple items with different issues
        const highPriority = createDomainKnowledge(
          {
            id: 'high-priority',
            title: 'High Priority',
            content: 'Content',
            author: 'author',
            confidence: bounded(0.1, 0.2, 'theoretical', 'very uncertain'),
          },
          []
        );
        graph.addItem(highPriority);

        const mediumPriority = createDomainKnowledge(
          {
            id: 'medium-priority',
            title: 'Medium Priority',
            content: 'Content',
            author: 'author',
            confidence: bounded(0.4, 0.5, 'theoretical', 'somewhat uncertain'),
          },
          []
        );
        graph.addItem(mediumPriority);

        const improvements = learningSystem.suggestImprovements();

        // High priority items should come first
        const highIdx = improvements.findIndex((i) => i.itemId === 'high-priority');
        const mediumIdx = improvements.findIndex((i) => i.itemId === 'medium-priority');

        if (highIdx >= 0 && mediumIdx >= 0) {
          expect(highIdx).toBeLessThan(mediumIdx);
        }
      });
    });

    describe('Contradiction Detection', () => {
      it('detects explicit contradiction relations', () => {
        const item2 = createDomainKnowledge(
          { id: 'item-2', title: 'Item 2', content: 'Content', author: 'author' },
          []
        );
        graph.addItem(item2);

        graph.addRelation({
          fromId: 'item-1',
          toId: 'item-2',
          type: 'contradicts',
          description: 'These items have conflicting information',
        });

        const contradictions = learningSystem.detectContradictions();

        expect(contradictions).toHaveLength(1);
        expect(contradictions[0].itemAId).toBe('item-1');
        expect(contradictions[0].itemBId).toBe('item-2');
        expect(contradictions[0].severity).toBe('significant');
      });

      it('detects superseded decisions that are still being used', () => {
        const oldDecision = createDecisionKnowledge(
          {
            id: 'old-decision',
            title: 'Old Decision',
            content: 'Content',
            author: 'author',
          },
          'Context',
          []
        );
        oldDecision.supersededBy = 'new-decision';
        graph.addItem(oldDecision);

        const newDecision = createDecisionKnowledge(
          {
            id: 'new-decision',
            title: 'New Decision',
            content: 'Content',
            author: 'author',
          },
          'Updated context',
          []
        );
        graph.addItem(newDecision);

        // Simulate heavy usage of old decision
        for (let i = 0; i < 20; i++) {
          learningSystem.trackUsage('old-decision');
        }

        const contradictions = learningSystem.detectContradictions();

        const supersededContradiction = contradictions.find(
          (c) => c.itemAId === 'old-decision' && c.itemBId === 'new-decision'
        );
        expect(supersededContradiction).toBeDefined();
        expect(supersededContradiction?.severity).toBe('minor');
      });
    });
  });
});
