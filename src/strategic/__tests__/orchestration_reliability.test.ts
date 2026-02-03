import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  // Types
  type ProgressMetrics,
  type ResourceUsage,
  type AgentState,
  type AgentStatus,
  type Checkpoint,
  type CheckpointReason,
  type ResumeResult,
  type PartialResult,
  type GracefulDegradation,
  type ManualInterventionRequest,
  type Change,
  type CommitValidationResult,
  type ValidationCheck,
  type ValidationIssue,
  type TestResult,
  type GateResult,
  type Output,
  type ConfidenceCheck,
  type CompletenessResult,
  type AgentAction,
  type Decision,
  type DecisionFactor,
  type Outcome,
  type AuditExport,
  type TimeoutAction,
  type OrchestrationReliabilityConfig,

  // Interfaces
  type AgentHealthMonitor,
  type FailureRecovery,
  type QAHooks,
  type OrchestrationAudit,

  // Implementations
  InMemoryAgentHealthMonitor,
  InMemoryFailureRecovery,
  DefaultQAHooks,
  InMemoryOrchestrationAudit,
  OrchestrationReliabilityFramework,

  // Factory Functions
  createAgentHealthMonitor,
  createFailureRecovery,
  createQAHooks,
  createOrchestrationAudit,
  createOrchestrationReliabilityFramework,

  // Validators
  validateProgressMetrics,
  validateAgentState,
  validateCheckpoint,
} from '../orchestration_reliability.js';

import { STANDARD_ORCHESTRATION, STRICT_ORCHESTRATION } from '../work_presets.js';

describe('orchestration_reliability', () => {
  // ============================================================================
  // AGENT HEALTH MONITOR TESTS
  // ============================================================================

  describe('AgentHealthMonitor', () => {
    let monitor: InMemoryAgentHealthMonitor;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));
      monitor = new InMemoryAgentHealthMonitor();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('trackProgress', () => {
      it('tracks progress for an agent', () => {
        const metrics: ProgressMetrics = {
          tokensUsed: 1000,
          toolCalls: 5,
          elapsedMs: 30000,
          lastActivityAt: new Date(),
        };

        monitor.trackProgress('agent-1', metrics);

        expect(monitor.getTrackedAgents()).toContain('agent-1');
        expect(monitor.getStatus('agent-1')).toBe('running');
      });

      it('updates existing agent metrics', () => {
        const initialMetrics: ProgressMetrics = {
          tokensUsed: 500,
          toolCalls: 2,
          elapsedMs: 15000,
          lastActivityAt: new Date(),
        };

        const updatedMetrics: ProgressMetrics = {
          tokensUsed: 1500,
          toolCalls: 8,
          elapsedMs: 45000,
          lastActivityAt: new Date(),
        };

        monitor.trackProgress('agent-1', initialMetrics);
        monitor.trackProgress('agent-1', updatedMetrics);

        expect(monitor.getTrackedAgents().filter((a) => a === 'agent-1')).toHaveLength(1);
      });

      it('tracks multiple agents independently', () => {
        monitor.trackProgress('agent-1', {
          tokensUsed: 100,
          toolCalls: 1,
          elapsedMs: 1000,
          lastActivityAt: new Date(),
        });

        monitor.trackProgress('agent-2', {
          tokensUsed: 200,
          toolCalls: 2,
          elapsedMs: 2000,
          lastActivityAt: new Date(),
        });

        expect(monitor.getTrackedAgents()).toHaveLength(2);
        expect(monitor.getTrackedAgents()).toContain('agent-1');
        expect(monitor.getTrackedAgents()).toContain('agent-2');
      });
    });

    describe('detectStall', () => {
      it('detects stalled agent when activity exceeds threshold', () => {
        const metrics: ProgressMetrics = {
          tokensUsed: 1000,
          toolCalls: 5,
          elapsedMs: 30000,
          lastActivityAt: new Date('2026-01-29T12:00:00.000Z'),
        };

        monitor.trackProgress('agent-1', metrics);

        // Advance time beyond threshold
        vi.setSystemTime(new Date('2026-01-29T12:02:00.000Z')); // 2 minutes later

        const isStalled = monitor.detectStall('agent-1', 60000); // 1 minute threshold

        expect(isStalled).toBe(true);
        expect(monitor.getStatus('agent-1')).toBe('stalled');
      });

      it('does not detect stall when activity is recent', () => {
        const metrics: ProgressMetrics = {
          tokensUsed: 1000,
          toolCalls: 5,
          elapsedMs: 30000,
          lastActivityAt: new Date('2026-01-29T12:00:00.000Z'),
        };

        monitor.trackProgress('agent-1', metrics);

        // Only 30 seconds later
        vi.setSystemTime(new Date('2026-01-29T12:00:30.000Z'));

        const isStalled = monitor.detectStall('agent-1', 60000);

        expect(isStalled).toBe(false);
        expect(monitor.getStatus('agent-1')).toBe('running');
      });

      it('returns false for untracked agent', () => {
        const isStalled = monitor.detectStall('nonexistent', 60000);
        expect(isStalled).toBe(false);
      });
    });

    describe('getResourceUsage', () => {
      it('returns default values for untracked agent', () => {
        const usage = monitor.getResourceUsage('nonexistent');

        expect(usage.memoryBytes).toBe(0);
        expect(usage.cpuMs).toBe(0);
        expect(usage.networkBytes).toBe(0);
        expect(usage.fileOperations).toBe(0);
        expect(usage.peakConcurrency).toBe(0);
      });

      it('returns updated resource usage', () => {
        monitor.updateResourceUsage('agent-1', {
          memoryBytes: 1024 * 1024,
          cpuMs: 5000,
          networkBytes: 10240,
        });

        const usage = monitor.getResourceUsage('agent-1');

        expect(usage.memoryBytes).toBe(1024 * 1024);
        expect(usage.cpuMs).toBe(5000);
        expect(usage.networkBytes).toBe(10240);
      });
    });

    describe('handleTimeout', () => {
      it('sets agent status to timeout', () => {
        monitor.trackProgress('agent-1', {
          tokensUsed: 100,
          toolCalls: 1,
          elapsedMs: 1000,
          lastActivityAt: new Date(),
        });

        monitor.handleTimeout('agent-1', 'terminate');

        expect(monitor.getStatus('agent-1')).toBe('timeout');
      });

      it('handles different timeout actions', () => {
        const actions: TimeoutAction[] = ['terminate', 'checkpoint', 'extend', 'escalate'];

        for (const action of actions) {
          monitor.trackProgress(`agent-${action}`, {
            tokensUsed: 100,
            toolCalls: 1,
            elapsedMs: 1000,
            lastActivityAt: new Date(),
          });

          monitor.handleTimeout(`agent-${action}`, action);

          expect(monitor.getStatus(`agent-${action}`)).toBe('timeout');
        }
      });
    });

    describe('getStatus', () => {
      it('returns idle for untracked agent', () => {
        expect(monitor.getStatus('nonexistent')).toBe('idle');
      });

      it('returns correct status after state changes', () => {
        monitor.trackProgress('agent-1', {
          tokensUsed: 100,
          toolCalls: 1,
          elapsedMs: 1000,
          lastActivityAt: new Date(),
        });

        expect(monitor.getStatus('agent-1')).toBe('running');

        monitor.setStatus('agent-1', 'completed');
        expect(monitor.getStatus('agent-1')).toBe('completed');
      });
    });

    describe('clear', () => {
      it('clears tracking data for an agent', () => {
        monitor.trackProgress('agent-1', {
          tokensUsed: 100,
          toolCalls: 1,
          elapsedMs: 1000,
          lastActivityAt: new Date(),
        });

        monitor.clear('agent-1');

        expect(monitor.getTrackedAgents()).not.toContain('agent-1');
        expect(monitor.getStatus('agent-1')).toBe('idle');
      });
    });

    describe('clearAll', () => {
      it('clears all tracking data', () => {
        monitor.trackProgress('agent-1', {
          tokensUsed: 100,
          toolCalls: 1,
          elapsedMs: 1000,
          lastActivityAt: new Date(),
        });

        monitor.trackProgress('agent-2', {
          tokensUsed: 200,
          toolCalls: 2,
          elapsedMs: 2000,
          lastActivityAt: new Date(),
        });

        monitor.clearAll();

        expect(monitor.getTrackedAgents()).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // FAILURE RECOVERY TESTS
  // ============================================================================

  describe('FailureRecovery', () => {
    let recovery: InMemoryFailureRecovery;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));
      recovery = new InMemoryFailureRecovery();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const createTestState = (agentId: string): AgentState => ({
      agentId,
      status: 'running',
      currentTask: 'test-task',
      metrics: {
        tokensUsed: 1000,
        toolCalls: 5,
        elapsedMs: 30000,
        lastActivityAt: new Date(),
      },
      context: { key: 'value' },
      pendingOperations: [
        {
          id: 'op-1',
          type: 'fetch',
          startedAt: new Date(),
          params: { url: 'https://example.com' },
          retryCount: 0,
        },
      ],
      completedOperations: [
        {
          id: 'op-0',
          type: 'init',
          completedAt: new Date(),
          success: true,
          result: 'initialized',
          durationMs: 100,
        },
      ],
      config: { timeout: 60000 },
    });

    describe('createCheckpoint', () => {
      it('creates a checkpoint with valid state', () => {
        const state = createTestState('agent-1');
        const checkpoint = recovery.createCheckpoint('agent-1', state);

        expect(checkpoint.id).toMatch(/^checkpoint_\d+$/);
        expect(checkpoint.agentId).toBe('agent-1');
        expect(checkpoint.state).toEqual(state);
        expect(checkpoint.resumable).toBe(true);
        expect(checkpoint.stateHash).toBeDefined();
      });

      it('creates multiple checkpoints for same agent', () => {
        const state1 = createTestState('agent-1');
        const state2 = { ...createTestState('agent-1'), currentTask: 'task-2' };

        recovery.createCheckpoint('agent-1', state1);
        recovery.createCheckpoint('agent-1', state2);

        const checkpoints = recovery.getCheckpoints('agent-1');
        expect(checkpoints).toHaveLength(2);
      });

      it('generates unique checkpoint IDs', () => {
        const state = createTestState('agent-1');

        const cp1 = recovery.createCheckpoint('agent-1', state);
        const cp2 = recovery.createCheckpoint('agent-1', state);

        expect(cp1.id).not.toBe(cp2.id);
      });
    });

    describe('createCheckpointWithReason', () => {
      it('creates checkpoint with specified reason', () => {
        const state = createTestState('agent-1');
        const reasons: CheckpointReason[] = [
          'scheduled',
          'timeout',
          'error',
          'manual',
          'phase_transition',
          'resource_limit',
        ];

        for (const reason of reasons) {
          const checkpoint = recovery.createCheckpointWithReason('agent-1', state, reason);
          expect(checkpoint.reason).toBe(reason);
        }
      });
    });

    describe('resumeFromCheckpoint', () => {
      it('successfully resumes from valid checkpoint', () => {
        const state = createTestState('agent-1');
        const checkpoint = recovery.createCheckpoint('agent-1', state);

        const result = recovery.resumeFromCheckpoint(checkpoint);

        expect(result.success).toBe(true);
        expect(result.newState).toBeDefined();
        expect(result.newState?.status).toBe('running');
        expect(result.recoveredOperations).toContain('op-1');
        expect(result.lostOperations).toHaveLength(0);
      });

      it('fails to resume from non-resumable checkpoint', () => {
        const state = createTestState('agent-1');
        const checkpoint = recovery.createCheckpoint('agent-1', state);
        checkpoint.resumable = false;

        const result = recovery.resumeFromCheckpoint(checkpoint);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not resumable');
        expect(result.lostOperations).toContain('op-1');
      });

      it('fails when state hash does not match', () => {
        const state = createTestState('agent-1');
        const checkpoint = recovery.createCheckpoint('agent-1', state);

        // Corrupt the state hash
        checkpoint.stateHash = 'corrupted_hash';

        const result = recovery.resumeFromCheckpoint(checkpoint);

        expect(result.success).toBe(false);
        expect(result.error).toContain('integrity verification failed');
      });
    });

    describe('salvagePartialResults', () => {
      it('returns empty array when no results', () => {
        const results = recovery.salvagePartialResults('agent-1');
        expect(results).toHaveLength(0);
      });

      it('returns added partial results', () => {
        const partialResults: PartialResult[] = [
          {
            id: 'result-1',
            type: 'data_extraction',
            data: { items: [1, 2, 3] },
            completeness: 75,
            confidence: { type: 'derived', value: 0.8, formula: 'test', inputs: [] },
            missing: ['item4', 'item5'],
            usable: true,
          },
        ];

        recovery.addPartialResults('agent-1', partialResults);

        const results = recovery.salvagePartialResults('agent-1');
        expect(results).toHaveLength(1);
        expect(results[0].completeness).toBe(75);
      });
    });

    describe('triggerManualIntervention', () => {
      it('creates intervention request', () => {
        const state = createTestState('agent-1');
        recovery.createCheckpoint('agent-1', state);

        recovery.triggerManualIntervention('agent-1', 'Agent stalled during critical operation');

        const interventions = recovery.getPendingInterventions();
        expect(interventions).toHaveLength(1);
        expect(interventions[0].agentId).toBe('agent-1');
        expect(interventions[0].reason).toContain('stalled');
      });

      it('determines correct priority based on reason', () => {
        recovery.triggerManualIntervention('agent-1', 'security vulnerability detected');
        recovery.triggerManualIntervention('agent-2', 'error occurred');
        recovery.triggerManualIntervention('agent-3', 'timeout reached');
        recovery.triggerManualIntervention('agent-4', 'routine check');

        const interventions = recovery.getPendingInterventions();

        const securityIntervention = interventions.find((i) => i.agentId === 'agent-1');
        const errorIntervention = interventions.find((i) => i.agentId === 'agent-2');
        const timeoutIntervention = interventions.find((i) => i.agentId === 'agent-3');
        const routineIntervention = interventions.find((i) => i.agentId === 'agent-4');

        expect(securityIntervention?.priority).toBe('critical');
        expect(errorIntervention?.priority).toBe('high');
        expect(timeoutIntervention?.priority).toBe('medium');
        expect(routineIntervention?.priority).toBe('low');
      });

      it('generates suggested actions based on reason', () => {
        recovery.triggerManualIntervention('agent-1', 'timeout during operation');

        const interventions = recovery.getPendingInterventions();
        expect(interventions[0].suggestedActions).toContain('Increase timeout threshold');
      });
    });

    describe('resolveIntervention', () => {
      it('removes intervention from pending list', () => {
        recovery.triggerManualIntervention('agent-1', 'test intervention');

        const before = recovery.getPendingInterventions();
        expect(before).toHaveLength(1);

        recovery.resolveIntervention(before[0].id);

        const after = recovery.getPendingInterventions();
        expect(after).toHaveLength(0);
      });
    });

    describe('getCheckpoints', () => {
      it('returns empty array for unknown agent', () => {
        const checkpoints = recovery.getCheckpoints('nonexistent');
        expect(checkpoints).toHaveLength(0);
      });

      it('returns checkpoints in order', () => {
        const state = createTestState('agent-1');

        recovery.createCheckpoint('agent-1', state);
        vi.setSystemTime(new Date('2026-01-29T12:01:00.000Z'));
        recovery.createCheckpoint('agent-1', { ...state, currentTask: 'task-2' });

        const checkpoints = recovery.getCheckpoints('agent-1');
        expect(checkpoints).toHaveLength(2);
        expect(checkpoints[0].createdAt < checkpoints[1].createdAt).toBe(true);
      });
    });

    describe('clearAll', () => {
      it('clears all data', () => {
        const state = createTestState('agent-1');
        recovery.createCheckpoint('agent-1', state);
        recovery.triggerManualIntervention('agent-1', 'test');

        recovery.clearAll();

        expect(recovery.getCheckpoints('agent-1')).toHaveLength(0);
        expect(recovery.getPendingInterventions()).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // QA HOOKS TESTS
  // ============================================================================

  describe('QAHooks', () => {
    let qaHooks: DefaultQAHooks;

    beforeEach(() => {
      qaHooks = new DefaultQAHooks();
    });

    describe('preCommitValidation', () => {
      it('allows commit with valid changes', () => {
        const changes: Change[] = [
          {
            filePath: 'src/test.ts',
            type: 'modify',
            linesAdded: 50,
            linesRemoved: 20,
          },
        ];

        const result = qaHooks.preCommitValidation(changes);

        expect(result.allowed).toBe(true);
        expect(result.blockingIssues).toHaveLength(0);
      });

      it('warns about large changes', () => {
        const changes: Change[] = [
          {
            filePath: 'src/large-file.ts',
            type: 'modify',
            linesAdded: 600,
            linesRemoved: 50,
          },
        ];

        const result = qaHooks.preCommitValidation(changes);

        expect(result.allowed).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].type).toBe('large_change');
      });

      it('warns about file deletions', () => {
        const changes: Change[] = [
          {
            filePath: 'src/deprecated.ts',
            type: 'delete',
            linesAdded: 0,
            linesRemoved: 100,
          },
        ];

        const result = qaHooks.preCommitValidation(changes);

        expect(result.allowed).toBe(true);
        expect(result.warnings.some((w) => w.type === 'file_deletion')).toBe(true);
      });

      it('suggests splitting when many changes', () => {
        const changes: Change[] = Array.from({ length: 15 }, (_, i) => ({
          filePath: `src/file${i}.ts`,
          type: 'modify' as const,
          linesAdded: 10,
          linesRemoved: 5,
        }));

        const result = qaHooks.preCommitValidation(changes);

        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions.some((s) => s.includes('splitting'))).toBe(true);
      });
    });

    describe('testExecutionGate', () => {
      it('passes when all tests pass', () => {
        const testResults: TestResult[] = [
          { name: 'test1', file: 'test.ts', status: 'passed', durationMs: 100 },
          { name: 'test2', file: 'test.ts', status: 'passed', durationMs: 150 },
        ];

        const result = qaHooks.testExecutionGate(testResults);

        expect(result.passed).toBe(true);
        expect(result.passedTests).toBe(2);
        expect(result.failedTests).toBe(0);
      });

      it('fails when tests fail', () => {
        const testResults: TestResult[] = [
          { name: 'test1', file: 'test.ts', status: 'passed', durationMs: 100 },
          { name: 'test2', file: 'test.ts', status: 'failed', durationMs: 150, error: 'assertion failed' },
        ];

        const result = qaHooks.testExecutionGate(testResults);

        expect(result.passed).toBe(false);
        expect(result.passedTests).toBe(1);
        expect(result.failedTests).toBe(1);
        expect(result.failures).toHaveLength(1);
      });

      it('counts skipped tests correctly', () => {
        const testResults: TestResult[] = [
          { name: 'test1', file: 'test.ts', status: 'passed', durationMs: 100 },
          { name: 'test2', file: 'test.ts', status: 'skipped', durationMs: 0 },
        ];

        const result = qaHooks.testExecutionGate(testResults);

        expect(result.passed).toBe(true);
        expect(result.skippedTests).toBe(1);
        expect(result.totalTests).toBe(2);
      });
    });

    describe('confidenceVerification', () => {
      it('reports well-calibrated outputs', () => {
        const outputs: Output[] = [
          {
            id: 'out-1',
            type: 'prediction',
            content: 'result',
            statedConfidence: { type: 'derived', value: 0.7, formula: 'test', inputs: [] },
            source: 'model',
            evidenceRefs: ['ev-1', 'ev-2', 'ev-3'],
          },
        ];

        const result = qaHooks.confidenceVerification(outputs);

        expect(result.wellCalibrated).toBe(true);
        expect(result.overconfident).toHaveLength(0);
        expect(result.underconfident).toHaveLength(0);
      });

      it('detects overconfident outputs', () => {
        const outputs: Output[] = [
          {
            id: 'out-1',
            type: 'prediction',
            content: 'result',
            statedConfidence: { type: 'derived', value: 0.95, formula: 'test', inputs: [] },
            source: 'model',
            evidenceRefs: ['ev-1'], // Only 1 evidence for 95% confidence
          },
        ];

        const result = qaHooks.confidenceVerification(outputs);

        expect(result.wellCalibrated).toBe(false);
        expect(result.overconfident).toHaveLength(1);
        expect(result.recommendations.some((r) => r.includes('overconfident'))).toBe(true);
      });

      it('detects underconfident outputs', () => {
        const outputs: Output[] = [
          {
            id: 'out-1',
            type: 'prediction',
            content: 'result',
            statedConfidence: { type: 'derived', value: 0.3, formula: 'test', inputs: [] },
            source: 'model',
            evidenceRefs: ['ev-1', 'ev-2', 'ev-3', 'ev-4', 'ev-5', 'ev-6'], // Many evidence for low confidence
          },
        ];

        const result = qaHooks.confidenceVerification(outputs);

        expect(result.wellCalibrated).toBe(false);
        expect(result.underconfident).toHaveLength(1);
      });

      it('calculates average confidence', () => {
        const outputs: Output[] = [
          {
            id: 'out-1',
            type: 'prediction',
            content: 'result1',
            statedConfidence: { type: 'derived', value: 0.6, formula: 'test', inputs: [] },
            source: 'model',
            evidenceRefs: ['ev-1', 'ev-2'],
          },
          {
            id: 'out-2',
            type: 'prediction',
            content: 'result2',
            statedConfidence: { type: 'derived', value: 0.8, formula: 'test', inputs: [] },
            source: 'model',
            evidenceRefs: ['ev-3', 'ev-4'],
          },
        ];

        const result = qaHooks.confidenceVerification(outputs);

        expect(result.averageStatedConfidence).toBe(0.7);
      });
    });

    describe('evidenceCompletenessCheck', () => {
      it('reports complete evidence', () => {
        const refs = ['ev-1', 'ev-2', 'ev-3'];
        const result = qaHooks.evidenceCompletenessCheck(refs);

        expect(result.complete).toBe(true);
        expect(result.completenessPercentage).toBe(100);
        expect(result.missingRefs).toHaveLength(0);
        expect(result.brokenLinks).toHaveLength(0);
      });

      it('detects missing references', () => {
        const refs = ['ev-1', 'missing_ev-2', 'ev-3'];
        const result = qaHooks.evidenceCompletenessCheck(refs);

        expect(result.complete).toBe(false);
        expect(result.missingRefs).toContain('missing_ev-2');
      });

      it('detects broken links', () => {
        const refs = ['ev-1', 'broken_ev-2', 'ev-3'];
        const result = qaHooks.evidenceCompletenessCheck(refs);

        expect(result.complete).toBe(false);
        expect(result.brokenLinks).toContain('broken_ev-2');
      });

      it('identifies stale evidence', () => {
        const refs = ['ev-1', 'stale_ev-2'];
        const result = qaHooks.evidenceCompletenessCheck(refs);

        expect(result.qualityIssues).toHaveLength(1);
        expect(result.qualityIssues[0].issue).toBe('stale');
      });

      it('handles empty array', () => {
        const result = qaHooks.evidenceCompletenessCheck([]);
        expect(result.complete).toBe(true);
        expect(result.completenessPercentage).toBe(100);
      });
    });
  });

  // ============================================================================
  // ORCHESTRATION AUDIT TESTS
  // ============================================================================

  describe('OrchestrationAudit', () => {
    let audit: InMemoryOrchestrationAudit;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));
      audit = new InMemoryOrchestrationAudit();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('logAction', () => {
      it('logs agent actions', () => {
        const action: AgentAction = {
          type: 'file_read',
          target: 'src/test.ts',
          params: { encoding: 'utf-8' },
          timestamp: new Date(),
          durationMs: 50,
          success: true,
          result: 'content',
        };

        audit.logAction('agent-1', action);

        const history = audit.getActionHistory('agent-1');
        expect(history).toHaveLength(1);
        expect(history[0].type).toBe('file_read');
      });

      it('maintains separate history for each agent', () => {
        audit.logAction('agent-1', {
          type: 'action1',
          target: 'target1',
          params: {},
          timestamp: new Date(),
          durationMs: 10,
          success: true,
        });

        audit.logAction('agent-2', {
          type: 'action2',
          target: 'target2',
          params: {},
          timestamp: new Date(),
          durationMs: 20,
          success: true,
        });

        expect(audit.getActionHistory('agent-1')).toHaveLength(1);
        expect(audit.getActionHistory('agent-2')).toHaveLength(1);
        expect(audit.getActionHistory('agent-1')[0].type).toBe('action1');
        expect(audit.getActionHistory('agent-2')[0].type).toBe('action2');
      });
    });

    describe('recordDecision', () => {
      it('records decisions with rationale', () => {
        const decision: Decision = {
          id: 'decision-1',
          type: 'routing',
          options: ['agent-a', 'agent-b', 'agent-c'],
          chosen: 'agent-b',
          factors: [
            { name: 'workload', value: 0.3, weight: 0.5, influence: 'positive' },
            { name: 'expertise', value: 0.8, weight: 0.5, influence: 'positive' },
          ],
          confidence: { type: 'derived', value: 0.85, formula: 'weighted_sum', inputs: [] },
        };

        audit.recordDecision(decision, 'Agent-b has expertise in this domain');

        const decisions = audit.getDecisions();
        expect(decisions).toHaveLength(1);
        expect(decisions[0].decision.chosen).toBe('agent-b');
        expect(decisions[0].rationale).toContain('expertise');
      });
    });

    describe('trackOutcome', () => {
      it('tracks task outcomes', () => {
        const outcome: Outcome = {
          status: 'success',
          achieved: ['goal-1', 'goal-2'],
          notAchieved: [],
          metrics: {
            tokensUsed: 500,
            toolCalls: 3,
            elapsedMs: 15000,
            lastActivityAt: new Date(),
          },
          durationMs: 15000,
          artifacts: ['report.md'],
          followUpActions: [],
        };

        audit.trackOutcome('task-1', outcome);

        const auditExport = audit.exportForReproducibility();
        expect(auditExport.outcomes).toHaveLength(1);
        expect(auditExport.outcomes[0].outcome.status).toBe('success');
      });
    });

    describe('exportForReproducibility', () => {
      it('generates comprehensive export', () => {
        // Log some actions
        audit.logAction('agent-1', {
          type: 'init',
          target: 'system',
          params: {},
          timestamp: new Date('2026-01-29T12:00:00.000Z'),
          durationMs: 100,
          success: true,
        });

        vi.setSystemTime(new Date('2026-01-29T12:05:00.000Z'));

        audit.logAction('agent-1', {
          type: 'complete',
          target: 'system',
          params: {},
          timestamp: new Date('2026-01-29T12:05:00.000Z'),
          durationMs: 50,
          success: true,
        });

        // Record a decision
        audit.recordDecision(
          {
            id: 'dec-1',
            type: 'routing',
            options: ['a', 'b'],
            chosen: 'a',
            factors: [],
            confidence: { type: 'deterministic', value: 1, reason: 'test' },
          },
          'Test decision'
        );

        // Track an outcome
        audit.trackOutcome('task-1', {
          status: 'success',
          achieved: ['goal'],
          notAchieved: [],
          metrics: {
            tokensUsed: 100,
            toolCalls: 1,
            elapsedMs: 1000,
            lastActivityAt: new Date(),
          },
          durationMs: 1000,
          artifacts: [],
          followUpActions: [],
        });

        const auditExport = audit.exportForReproducibility();

        expect(auditExport.id).toMatch(/^audit_export_/);
        expect(auditExport.version).toBe('1.0.0');
        expect(auditExport.actions).toHaveLength(2);
        expect(auditExport.decisions).toHaveLength(1);
        expect(auditExport.outcomes).toHaveLength(1);
        expect(auditExport.summary.totalActions).toBe(2);
        expect(auditExport.summary.successfulActions).toBe(2);
        expect(auditExport.summary.successRate).toBe(1);
        expect(auditExport.summary.uniqueAgents).toContain('agent-1');
      });

      it('calculates correct success rate with failures', () => {
        audit.logAction('agent-1', {
          type: 'success',
          target: 'target',
          params: {},
          timestamp: new Date(),
          durationMs: 10,
          success: true,
        });

        audit.logAction('agent-1', {
          type: 'fail',
          target: 'target',
          params: {},
          timestamp: new Date(),
          durationMs: 10,
          success: false,
          error: 'something failed',
        });

        const auditExport = audit.exportForReproducibility();

        expect(auditExport.summary.successfulActions).toBe(1);
        expect(auditExport.summary.failedActions).toBe(1);
        expect(auditExport.summary.successRate).toBe(0.5);
      });

      it('calculates average duration', () => {
        audit.logAction('agent-1', {
          type: 'fast',
          target: 'target',
          params: {},
          timestamp: new Date(),
          durationMs: 100,
          success: true,
        });

        audit.logAction('agent-1', {
          type: 'slow',
          target: 'target',
          params: {},
          timestamp: new Date(),
          durationMs: 300,
          success: true,
        });

        const auditExport = audit.exportForReproducibility();

        expect(auditExport.summary.averageActionDurationMs).toBe(200);
      });
    });

    describe('clearAll', () => {
      it('clears all audit data', () => {
        audit.logAction('agent-1', {
          type: 'test',
          target: 'target',
          params: {},
          timestamp: new Date(),
          durationMs: 10,
          success: true,
        });

        audit.recordDecision(
          {
            id: 'dec-1',
            type: 'routing',
            options: [],
            chosen: 'a',
            factors: [],
            confidence: { type: 'deterministic', value: 1, reason: 'test' },
          },
          'test'
        );

        audit.clearAll();

        const auditExport = audit.exportForReproducibility();
        expect(auditExport.actions).toHaveLength(0);
        expect(auditExport.decisions).toHaveLength(0);
        expect(auditExport.outcomes).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // ORCHESTRATION RELIABILITY FRAMEWORK TESTS
  // ============================================================================

  describe('OrchestrationReliabilityFramework', () => {
    let framework: OrchestrationReliabilityFramework;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));
    });

    afterEach(() => {
      if (framework) {
        framework.stop();
      }
      vi.useRealTimers();
    });

    it('initializes all components', () => {
      framework = new OrchestrationReliabilityFramework({
        preset: STANDARD_ORCHESTRATION,
      });

      expect(framework.healthMonitor).toBeDefined();
      expect(framework.failureRecovery).toBeDefined();
      expect(framework.qaHooks).toBeDefined();
      expect(framework.audit).toBeDefined();
    });

    it('integrates with all components', () => {
      framework = new OrchestrationReliabilityFramework({
        preset: STANDARD_ORCHESTRATION,
      });

      // Use health monitor
      framework.healthMonitor.trackProgress('agent-1', {
        tokensUsed: 100,
        toolCalls: 1,
        elapsedMs: 1000,
        lastActivityAt: new Date(),
      });

      // Use failure recovery
      const checkpoint = (framework.failureRecovery as InMemoryFailureRecovery).createCheckpoint('agent-1', {
        agentId: 'agent-1',
        status: 'running',
        currentTask: 'test',
        metrics: {
          tokensUsed: 100,
          toolCalls: 1,
          elapsedMs: 1000,
          lastActivityAt: new Date(),
        },
        context: {},
        pendingOperations: [],
        completedOperations: [],
        config: {},
      });

      // Use QA hooks
      const validationResult = framework.qaHooks.preCommitValidation([
        { filePath: 'test.ts', type: 'modify', linesAdded: 10, linesRemoved: 5 },
      ]);

      // Use audit
      framework.audit.logAction('agent-1', {
        type: 'test',
        target: 'target',
        params: {},
        timestamp: new Date(),
        durationMs: 10,
        success: true,
      });

      // Verify integration
      expect(framework.healthMonitor.getTrackedAgents()).toContain('agent-1');
      expect(framework.failureRecovery.getCheckpoints('agent-1')).toHaveLength(1);
      expect(validationResult.allowed).toBe(true);
      expect(framework.audit.getActionHistory('agent-1')).toHaveLength(1);
    });

    it('exports audit and cleans up', () => {
      framework = new OrchestrationReliabilityFramework({
        preset: STANDARD_ORCHESTRATION,
      });

      framework.audit.logAction('agent-1', {
        type: 'test',
        target: 'target',
        params: {},
        timestamp: new Date(),
        durationMs: 10,
        success: true,
      });

      const auditExport = framework.exportAndCleanup();

      expect(auditExport.actions).toHaveLength(1);
    });
  });

  // ============================================================================
  // FACTORY FUNCTION TESTS
  // ============================================================================

  describe('factory functions', () => {
    describe('createAgentHealthMonitor', () => {
      it('creates a health monitor', () => {
        const monitor = createAgentHealthMonitor();
        expect(monitor).toBeDefined();
        expect(typeof monitor.trackProgress).toBe('function');
        expect(typeof monitor.detectStall).toBe('function');
      });
    });

    describe('createFailureRecovery', () => {
      it('creates a failure recovery handler', () => {
        const recovery = createFailureRecovery();
        expect(recovery).toBeDefined();
        expect(typeof recovery.createCheckpoint).toBe('function');
        expect(typeof recovery.resumeFromCheckpoint).toBe('function');
      });
    });

    describe('createQAHooks', () => {
      it('creates QA hooks', () => {
        const hooks = createQAHooks();
        expect(hooks).toBeDefined();
        expect(typeof hooks.preCommitValidation).toBe('function');
        expect(typeof hooks.testExecutionGate).toBe('function');
      });
    });

    describe('createOrchestrationAudit', () => {
      it('creates an orchestration audit logger', () => {
        const audit = createOrchestrationAudit();
        expect(audit).toBeDefined();
        expect(typeof audit.logAction).toBe('function');
        expect(typeof audit.recordDecision).toBe('function');
      });
    });

    describe('createOrchestrationReliabilityFramework', () => {
      afterEach(() => {
        vi.useRealTimers();
      });

      it('creates a complete framework', () => {
        vi.useFakeTimers();
        const framework = createOrchestrationReliabilityFramework({
          preset: STANDARD_ORCHESTRATION,
        });

        expect(framework).toBeDefined();
        expect(framework.healthMonitor).toBeDefined();
        expect(framework.failureRecovery).toBeDefined();
        expect(framework.qaHooks).toBeDefined();
        expect(framework.audit).toBeDefined();

        framework.stop();
      });
    });
  });

  // ============================================================================
  // VALIDATOR TESTS
  // ============================================================================

  describe('validators', () => {
    describe('validateProgressMetrics', () => {
      it('validates valid metrics', () => {
        const metrics: ProgressMetrics = {
          tokensUsed: 1000,
          toolCalls: 5,
          elapsedMs: 30000,
          lastActivityAt: new Date(),
          progressPercentage: 50,
        };

        const result = validateProgressMetrics(metrics);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('rejects negative tokensUsed', () => {
        const metrics: ProgressMetrics = {
          tokensUsed: -100,
          toolCalls: 5,
          elapsedMs: 30000,
          lastActivityAt: new Date(),
        };

        const result = validateProgressMetrics(metrics);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('invalid_tokens_used');
      });

      it('rejects negative toolCalls', () => {
        const metrics: ProgressMetrics = {
          tokensUsed: 1000,
          toolCalls: -1,
          elapsedMs: 30000,
          lastActivityAt: new Date(),
        };

        const result = validateProgressMetrics(metrics);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('invalid_tool_calls');
      });

      it('rejects negative elapsedMs', () => {
        const metrics: ProgressMetrics = {
          tokensUsed: 1000,
          toolCalls: 5,
          elapsedMs: -1000,
          lastActivityAt: new Date(),
        };

        const result = validateProgressMetrics(metrics);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('invalid_elapsed_ms');
      });

      it('rejects invalid progressPercentage', () => {
        const metrics: ProgressMetrics = {
          tokensUsed: 1000,
          toolCalls: 5,
          elapsedMs: 30000,
          lastActivityAt: new Date(),
          progressPercentage: 150,
        };

        const result = validateProgressMetrics(metrics);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('invalid_progress_percentage');
      });
    });

    describe('validateAgentState', () => {
      it('validates valid state', () => {
        const state: AgentState = {
          agentId: 'agent-1',
          status: 'running',
          currentTask: 'test-task',
          metrics: {
            tokensUsed: 1000,
            toolCalls: 5,
            elapsedMs: 30000,
            lastActivityAt: new Date(),
          },
          context: {},
          pendingOperations: [],
          completedOperations: [],
          config: {},
        };

        const result = validateAgentState(state);
        expect(result.valid).toBe(true);
      });

      it('rejects missing agentId', () => {
        const state: AgentState = {
          agentId: '',
          status: 'running',
          currentTask: 'test-task',
          metrics: {
            tokensUsed: 1000,
            toolCalls: 5,
            elapsedMs: 30000,
            lastActivityAt: new Date(),
          },
          context: {},
          pendingOperations: [],
          completedOperations: [],
          config: {},
        };

        const result = validateAgentState(state);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('missing_agent_id');
      });

      it('warns about empty currentTask', () => {
        const state: AgentState = {
          agentId: 'agent-1',
          status: 'running',
          currentTask: '',
          metrics: {
            tokensUsed: 1000,
            toolCalls: 5,
            elapsedMs: 30000,
            lastActivityAt: new Date(),
          },
          context: {},
          pendingOperations: [],
          completedOperations: [],
          config: {},
        };

        const result = validateAgentState(state);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it('propagates metrics validation errors', () => {
        const state: AgentState = {
          agentId: 'agent-1',
          status: 'running',
          currentTask: 'test-task',
          metrics: {
            tokensUsed: -100,
            toolCalls: 5,
            elapsedMs: 30000,
            lastActivityAt: new Date(),
          },
          context: {},
          pendingOperations: [],
          completedOperations: [],
          config: {},
        };

        const result = validateAgentState(state);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.path.includes('metrics'))).toBe(true);
      });
    });

    describe('validateCheckpoint', () => {
      it('validates valid checkpoint', () => {
        const checkpoint: Checkpoint = {
          id: 'checkpoint-1',
          agentId: 'agent-1',
          createdAt: new Date(),
          state: {
            agentId: 'agent-1',
            status: 'running',
            currentTask: 'test-task',
            metrics: {
              tokensUsed: 1000,
              toolCalls: 5,
              elapsedMs: 30000,
              lastActivityAt: new Date(),
            },
            context: {},
            pendingOperations: [],
            completedOperations: [],
            config: {},
          },
          reason: 'manual',
          stateHash: 'abc123',
          resumable: true,
        };

        const result = validateCheckpoint(checkpoint);
        expect(result.valid).toBe(true);
      });

      it('rejects missing id', () => {
        const checkpoint: Checkpoint = {
          id: '',
          agentId: 'agent-1',
          createdAt: new Date(),
          state: {
            agentId: 'agent-1',
            status: 'running',
            currentTask: 'test-task',
            metrics: {
              tokensUsed: 1000,
              toolCalls: 5,
              elapsedMs: 30000,
              lastActivityAt: new Date(),
            },
            context: {},
            pendingOperations: [],
            completedOperations: [],
            config: {},
          },
          reason: 'manual',
          stateHash: 'abc123',
          resumable: true,
        };

        const result = validateCheckpoint(checkpoint);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('missing_id');
      });

      it('rejects missing stateHash', () => {
        const checkpoint: Checkpoint = {
          id: 'checkpoint-1',
          agentId: 'agent-1',
          createdAt: new Date(),
          state: {
            agentId: 'agent-1',
            status: 'running',
            currentTask: 'test-task',
            metrics: {
              tokensUsed: 1000,
              toolCalls: 5,
              elapsedMs: 30000,
              lastActivityAt: new Date(),
            },
            context: {},
            pendingOperations: [],
            completedOperations: [],
            config: {},
          },
          reason: 'manual',
          stateHash: '',
          resumable: true,
        };

        const result = validateCheckpoint(checkpoint);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('missing_state_hash');
      });

      it('propagates state validation errors', () => {
        const checkpoint: Checkpoint = {
          id: 'checkpoint-1',
          agentId: 'agent-1',
          createdAt: new Date(),
          state: {
            agentId: '',
            status: 'running',
            currentTask: 'test-task',
            metrics: {
              tokensUsed: 1000,
              toolCalls: 5,
              elapsedMs: 30000,
              lastActivityAt: new Date(),
            },
            context: {},
            pendingOperations: [],
            completedOperations: [],
            config: {},
          },
          reason: 'manual',
          stateHash: 'abc123',
          resumable: true,
        };

        const result = validateCheckpoint(checkpoint);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.path.includes('state'))).toBe(true);
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('integration scenarios', () => {
    let monitor: InMemoryAgentHealthMonitor;
    let recovery: InMemoryFailureRecovery;
    let qaHooks: DefaultQAHooks;
    let audit: InMemoryOrchestrationAudit;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));

      monitor = new InMemoryAgentHealthMonitor();
      recovery = new InMemoryFailureRecovery();
      qaHooks = new DefaultQAHooks();
      audit = new InMemoryOrchestrationAudit();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('handles complete agent lifecycle', () => {
      // 1. Start tracking agent
      monitor.trackProgress('agent-1', {
        tokensUsed: 100,
        toolCalls: 1,
        elapsedMs: 1000,
        lastActivityAt: new Date(),
      });

      audit.logAction('agent-1', {
        type: 'start',
        target: 'task-1',
        params: {},
        timestamp: new Date(),
        durationMs: 0,
        success: true,
      });

      // 2. Create checkpoint
      const checkpoint = recovery.createCheckpoint('agent-1', {
        agentId: 'agent-1',
        status: 'running',
        currentTask: 'task-1',
        metrics: {
          tokensUsed: 100,
          toolCalls: 1,
          elapsedMs: 1000,
          lastActivityAt: new Date(),
        },
        context: { step: 1 },
        pendingOperations: [],
        completedOperations: [],
        config: {},
      });

      expect(checkpoint.resumable).toBe(true);

      // 3. Update progress
      vi.setSystemTime(new Date('2026-01-29T12:01:00.000Z'));
      monitor.trackProgress('agent-1', {
        tokensUsed: 500,
        toolCalls: 5,
        elapsedMs: 60000,
        lastActivityAt: new Date(),
      });

      // 4. Complete task
      monitor.setStatus('agent-1', 'completed');

      audit.trackOutcome('task-1', {
        status: 'success',
        achieved: ['goal-1'],
        notAchieved: [],
        metrics: {
          tokensUsed: 500,
          toolCalls: 5,
          elapsedMs: 60000,
          lastActivityAt: new Date(),
        },
        durationMs: 60000,
        artifacts: [],
        followUpActions: [],
      });

      // 5. Verify state
      expect(monitor.getStatus('agent-1')).toBe('completed');

      const auditExport = audit.exportForReproducibility();
      expect(auditExport.outcomes).toHaveLength(1);
      expect(auditExport.outcomes[0].outcome.status).toBe('success');
    });

    it('handles failure and recovery', () => {
      // 1. Start agent
      monitor.trackProgress('agent-1', {
        tokensUsed: 100,
        toolCalls: 1,
        elapsedMs: 1000,
        lastActivityAt: new Date(),
      });

      // 2. Create checkpoint before risky operation
      const state: AgentState = {
        agentId: 'agent-1',
        status: 'running',
        currentTask: 'risky-task',
        metrics: {
          tokensUsed: 100,
          toolCalls: 1,
          elapsedMs: 1000,
          lastActivityAt: new Date(),
        },
        context: { data: 'important' },
        pendingOperations: [
          {
            id: 'op-1',
            type: 'risky',
            startedAt: new Date(),
            params: {},
            retryCount: 0,
          },
        ],
        completedOperations: [],
        config: {},
      };

      const checkpoint = recovery.createCheckpointWithReason('agent-1', state, 'manual');

      // 3. Simulate failure
      monitor.setStatus('agent-1', 'failed');

      audit.logAction('agent-1', {
        type: 'risky_operation',
        target: 'target',
        params: {},
        timestamp: new Date(),
        durationMs: 100,
        success: false,
        error: 'Operation failed',
      });

      // 4. Salvage partial results
      recovery.addPartialResults('agent-1', [
        {
          id: 'result-1',
          type: 'partial_data',
          data: { partial: true },
          completeness: 50,
          confidence: { type: 'derived', value: 0.6, formula: 'test', inputs: [] },
          missing: ['more_data'],
          usable: true,
        },
      ]);

      const partialResults = recovery.salvagePartialResults('agent-1');
      expect(partialResults).toHaveLength(1);
      expect(partialResults[0].completeness).toBe(50);

      // 5. Resume from checkpoint
      const resumeResult = recovery.resumeFromCheckpoint(checkpoint);

      expect(resumeResult.success).toBe(true);
      expect(resumeResult.newState?.status).toBe('running');
      expect(resumeResult.recoveredOperations).toContain('op-1');

      // 6. Record recovery decision
      audit.recordDecision(
        {
          id: 'decision-recovery',
          type: 'retry',
          options: ['skip', 'retry', 'escalate'],
          chosen: 'retry',
          factors: [
            { name: 'checkpoint_available', value: true, weight: 1, influence: 'positive' },
          ],
          confidence: { type: 'deterministic', value: 0.9, reason: 'checkpoint_verified' },
        },
        'Resumed from checkpoint after failure'
      );

      // 7. Verify audit trail
      const auditExport = audit.exportForReproducibility();
      expect(auditExport.decisions).toHaveLength(1);
      expect(auditExport.decisions[0].decision.type).toBe('retry');
    });

    it('validates changes before commit', () => {
      const changes: Change[] = [
        {
          filePath: 'src/module.ts',
          type: 'modify',
          linesAdded: 100,
          linesRemoved: 20,
        },
        {
          filePath: 'src/test.ts',
          type: 'add',
          linesAdded: 50,
          linesRemoved: 0,
        },
      ];

      // 1. Pre-commit validation
      const validationResult = qaHooks.preCommitValidation(changes);
      expect(validationResult.allowed).toBe(true);

      // 2. Run tests
      const testResults: TestResult[] = [
        { name: 'test1', file: 'test.ts', status: 'passed', durationMs: 100 },
        { name: 'test2', file: 'test.ts', status: 'passed', durationMs: 150 },
      ];

      const gateResult = qaHooks.testExecutionGate(testResults);
      expect(gateResult.passed).toBe(true);

      // 3. Verify confidence
      const outputs: Output[] = [
        {
          id: 'output-1',
          type: 'code',
          content: 'new code',
          statedConfidence: { type: 'derived', value: 0.85, formula: 'test', inputs: [] },
          source: 'agent-1',
          evidenceRefs: ['test-1', 'test-2', 'analysis-1'],
        },
      ];

      const confidenceCheck = qaHooks.confidenceVerification(outputs);
      expect(confidenceCheck.wellCalibrated).toBe(true);

      // 4. Check evidence completeness
      const evidenceRefs = ['ev-1', 'ev-2', 'ev-3'];
      const completenessResult = qaHooks.evidenceCompletenessCheck(evidenceRefs);
      expect(completenessResult.complete).toBe(true);

      // 5. Log the commit action
      audit.logAction('agent-1', {
        type: 'commit',
        target: 'repository',
        params: { files: changes.map((c) => c.filePath) },
        timestamp: new Date(),
        durationMs: 500,
        success: true,
      });

      const auditExport = audit.exportForReproducibility();
      expect(auditExport.summary.successfulActions).toBe(1);
    });
  });
});
