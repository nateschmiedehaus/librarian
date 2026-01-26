/**
 * @fileoverview Integration Tests for Epistemics Pipeline
 *
 * Tests the complete flow through the epistemics system:
 * - Evidence Ledger recording
 * - Calibration tracking
 * - Contract execution
 * - Defeater-ledger integration
 *
 * Uses in-memory SQLite for fast, isolated tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SqliteEvidenceLedger,
  type EvidenceId,
} from '../evidence_ledger.js';
import {
  createCalibrationTracker,
} from '../../measurement/calibration_ledger.js';
import {
  ContractExecutor,
  createPrimitiveId,
  createContractId,
  getContractRegistry,
  resetContractRegistry,
  type PrimitiveContract,
  type ExecutionContext,
} from '../contracts.js';
import { deterministic, bounded, absent } from '../confidence.js';

// ============================================================================
// TEST SETUP
// ============================================================================

async function createTestLedger(): Promise<SqliteEvidenceLedger> {
  const ledger = new SqliteEvidenceLedger(':memory:');
  await ledger.initialize();
  return ledger;
}

function createTestExecutionContext(): ExecutionContext {
  return {
    sessionId: 'test_session_001' as ExecutionContext['sessionId'],
    providers: {
      llm: true,
      embedding: true,
      storage: true,
    },
    now: new Date(),
    budget: {
      tokensRemaining: 10000,
      timeRemainingMs: 30000,
    },
  };
}

// ============================================================================
// EVIDENCE LEDGER INTEGRATION TESTS
// ============================================================================

describe('Epistemics Pipeline Integration', () => {
  let ledger: SqliteEvidenceLedger;

  beforeEach(async () => {
    ledger = await createTestLedger();
    resetContractRegistry();
  });

  afterEach(async () => {
    await ledger.close();
  });

  describe('Evidence Ledger → Calibration Flow', () => {
    it('records predictions and outcomes for calibration analysis', async () => {
      const tracker = createCalibrationTracker(ledger);

      // Record a prediction
      const predictionEntry = await tracker.recordPrediction({
        predictionId: 'pred_001',
        claim: 'Function processData is pure',
        confidence: bounded(0.7, 0.9, 'theoretical', 'static_analysis_model'),
        entityId: 'src/utils.ts::processData',
        category: 'behavior',
        predictedAt: new Date(),
      });

      expect(predictionEntry.id).toBeDefined();
      expect(predictionEntry.kind).toBe('claim');

      // Record the outcome
      const outcomeEntry = await tracker.recordOutcome(predictionEntry, {
        correct: true,
        verificationMethod: 'test_result',
        observation: 'Unit test confirmed purity - no side effects detected',
        observedAt: new Date(),
      });

      expect(outcomeEntry.kind).toBe('outcome');
      expect(outcomeEntry.relatedEntries).toContain(predictionEntry.id);

      // Verify entries are in ledger
      const entries = await ledger.query({ limit: 10 });
      expect(entries.length).toBe(2);
    });

    it('computes calibration from multiple predictions', async () => {
      const tracker = createCalibrationTracker(ledger);

      // Record multiple predictions with varying outcomes
      const predictions = [
        { claim: 'API returns JSON', confidence: 0.9, correct: true },
        { claim: 'File is idempotent', confidence: 0.8, correct: true },
        { claim: 'Cache is invalidated', confidence: 0.7, correct: false },
        { claim: 'Auth is required', confidence: 0.95, correct: true },
        { claim: 'Rate limit enforced', confidence: 0.6, correct: true },
      ];

      for (const p of predictions) {
        const entry = await tracker.recordPrediction({
          predictionId: `pred_${Math.random().toString(36).slice(2)}`,
          claim: p.claim,
          confidence: bounded(p.confidence - 0.05, p.confidence + 0.05, 'theoretical', 'test'),
          predictedAt: new Date(),
        });

        await tracker.recordOutcome(entry, {
          correct: p.correct,
          verificationMethod: 'test_result',
          observation: p.correct ? 'Verified' : 'Failed',
          observedAt: new Date(),
        });
      }

      // Compute calibration
      const { report, entry: calibEntry } = await tracker.computeAndRecordCalibration({
        scope: { kind: 'workspace', paths: [] },
      });

      expect(report.kind).toBe('CalibrationReport.v1');
      expect(report.sampleSize).toBeGreaterThanOrEqual(5);
      expect(calibEntry.kind).toBe('calibration');

      // Check ECE
      const ece = await tracker.getCurrentECE();
      expect(ece).not.toBeNull();
      expect(ece).toBeGreaterThanOrEqual(0);
      expect(ece).toBeLessThanOrEqual(1);
    });

    it('tracks calibration trends over time', async () => {
      const tracker = createCalibrationTracker(ledger);

      // Record multiple calibration events
      for (let i = 0; i < 5; i++) {
        // Record some predictions
        for (let j = 0; j < 3; j++) {
          const entry = await tracker.recordPrediction({
            predictionId: `pred_${i}_${j}`,
            claim: `Claim ${i}_${j}`,
            confidence: bounded(0.7, 0.9, 'theoretical', 'test'),
            predictedAt: new Date(),
          });

          await tracker.recordOutcome(entry, {
            correct: Math.random() > 0.3, // 70% correct
            verificationMethod: 'test_result',
            observation: 'Observed',
            observedAt: new Date(),
          });
        }

        // Compute calibration report
        await tracker.computeAndRecordCalibration({
          scope: { kind: 'workspace', paths: [] },
        });

        // Small delay to ensure different timestamps
        await new Promise((r) => setTimeout(r, 10));
      }

      // Check trend
      const { trend, samples } = await tracker.getCalibrationTrend(5);

      expect(samples).toBeGreaterThanOrEqual(2);
      expect(['improving', 'stable', 'degrading']).toContain(trend);

      // Check history
      const history = await tracker.getCalibrationHistory(5);
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Evidence Ledger → Contract Execution Flow', () => {
    it('executes contracts with ledger recording', async () => {
      const registry = getContractRegistry();

      // Define a simple contract
      const contract: PrimitiveContract<{ input: string }, { output: string }> = {
        id: createContractId('test_contract'),
        name: 'Test Contract',
        primitiveId: createPrimitiveId('test_primitive'),
        preconditions: [
          {
            id: 'input_not_empty',
            description: 'Input must not be empty',
            check: (input) => input.input.length > 0,
            onViolation: 'throw',
            violationMessage: () => 'Input was empty',
            severity: 'critical',
          },
        ],
        postconditions: [
          {
            id: 'output_not_empty',
            description: 'Output must not be empty',
            check: (_input, output) => output.output.length > 0,
            onViolation: 'warn',
            violationMessage: () => 'Output was empty',
          },
        ],
        invariants: [],
        confidenceDerivation: {
          factors: [
            {
              id: 'input_quality',
              source: 'input_confidence',
              baseWeight: 0.5,
            },
            {
              id: 'execution_quality',
              source: 'execution_quality',
              baseWeight: 0.5,
            },
          ],
          combiner: 'weighted_average',
        },
        errorSpec: {
          expectedErrors: [],
          retryPolicy: {
            maxAttempts: 1,
            baseDelayMs: 100,
            backoffMultiplier: 2,
            maxDelayMs: 1000,
          },
          fallback: 'throw',
        },
      };

      registry.register(contract);

      // Create executor
      const executor = new ContractExecutor(registry);

      // Execute with ledger context
      const context = createTestExecutionContext();
      context.ledger = ledger;

      const result = await executor.execute(
        createPrimitiveId('test_primitive'),
        { input: 'hello' },
        async (input) => ({ output: input.input.toUpperCase() }),
        context
      );

      expect(result.output.output).toBe('HELLO');
      expect(result.confidence.type).not.toBe('absent');
      expect(result.verification.preconditionsPassed).toContain('input_not_empty');
    });

    it('records contract violations as evidence', async () => {
      const registry = getContractRegistry();

      // Define a contract that will have a postcondition warning
      const contract: PrimitiveContract<{ input: string }, { output: string }> = {
        id: createContractId('warning_contract'),
        name: 'Warning Contract',
        primitiveId: createPrimitiveId('warning_primitive'),
        preconditions: [],
        postconditions: [
          {
            id: 'output_length_check',
            description: 'Output should be longer than input',
            check: (input, output) => output.output.length > input.input.length,
            onViolation: 'warn',
            violationMessage: () => 'Output shorter than expected',
          },
        ],
        invariants: [],
        confidenceDerivation: {
          factors: [],
          combiner: 'min',
        },
        errorSpec: {
          expectedErrors: [],
          retryPolicy: {
            maxAttempts: 1,
            baseDelayMs: 100,
            backoffMultiplier: 2,
            maxDelayMs: 1000,
          },
          fallback: 'throw',
        },
      };

      registry.register(contract);

      const executor = new ContractExecutor(registry);
      const context = createTestExecutionContext();

      // Execute with output shorter than input (triggers warning)
      const result = await executor.execute(
        createPrimitiveId('warning_primitive'),
        { input: 'hello world' },
        async () => ({ output: 'hi' }),
        context
      );

      expect(result.output.output).toBe('hi');
      expect(result.verification.warnings).toHaveLength(1);
      expect(result.verification.warnings[0].conditionId).toBe('output_length_check');
    });
  });

  describe('Full Pipeline: Evidence → Calibration → Confidence', () => {
    it('derives confidence from historical calibration', async () => {
      const tracker = createCalibrationTracker(ledger);

      // Build up calibration data
      const testPredictions = [
        { confidence: 0.9, correct: true },
        { confidence: 0.9, correct: true },
        { confidence: 0.9, correct: false }, // Overconfident case
        { confidence: 0.7, correct: true },
        { confidence: 0.7, correct: true },
        { confidence: 0.5, correct: false },
        { confidence: 0.5, correct: true },
      ];

      for (const p of testPredictions) {
        const entry = await tracker.recordPrediction({
          predictionId: `cal_pred_${Math.random().toString(36).slice(2)}`,
          claim: 'Test claim',
          confidence: deterministic(true, 'test'), // Using deterministic for tracking
          predictedAt: new Date(),
        });

        await tracker.recordOutcome(entry, {
          correct: p.correct,
          verificationMethod: 'test_result',
          observation: p.correct ? 'Passed' : 'Failed',
          observedAt: new Date(),
        });
      }

      // Compute and verify calibration
      const { report } = await tracker.computeAndRecordCalibration({
        scope: { kind: 'workspace', paths: [] },
      });

      expect(report.sampleSize).toBe(7);
      expect(report.overallCalibrationError).toBeGreaterThanOrEqual(0);
    });

    it('integrates multiple epistemics components', async () => {
      const tracker = createCalibrationTracker(ledger);

      // 1. Record a claim
      const claimEntry = await ledger.append({
        kind: 'claim',
        payload: {
          claim: 'Function calculateTotal is correct',
          category: 'behavior',
          subject: {
            type: 'function',
            identifier: 'calculateTotal',
          },
          supportingEvidence: [],
          knownDefeaters: [],
          confidence: bounded(0.8, 0.95, 'theoretical', 'static_analysis'),
        },
        provenance: {
          source: 'system_observation',
          method: 'static_analysis',
        },
        relatedEntries: [],
        confidence: bounded(0.8, 0.95, 'theoretical', 'static_analysis'),
      });

      // 2. Record verification evidence
      const verificationEntry = await ledger.append({
        kind: 'verification',
        payload: {
          claimId: claimEntry.id,
          method: 'test',
          result: 'verified',
          details: 'All unit tests passed',
        },
        provenance: {
          source: 'system_observation',
          method: 'test_execution',
        },
        relatedEntries: [claimEntry.id],
        confidence: deterministic(true, 'test_result'),
      });

      // 3. Get chain of evidence
      const chain = await ledger.getChain(claimEntry.id);

      expect(chain.root).toBeDefined();
      expect(chain.root.id).toBe(claimEntry.id);

      // 4. Record calibration prediction about the claim
      const predEntry = await tracker.recordPrediction({
        predictionId: `pred_${claimEntry.id}`,
        claim: 'calculateTotal verification will succeed',
        confidence: bounded(0.85, 0.95, 'theoretical', 'model_based'),
        entityId: 'calculateTotal',
        predictedAt: new Date(),
      });

      // 5. Record outcome based on verification
      await tracker.recordOutcome(predEntry, {
        correct: true,
        verificationMethod: 'system_observation',
        observation: 'Verification succeeded as predicted',
        observedAt: new Date(),
      });

      // Verify all entries are in ledger
      const allEntries = await ledger.query({ limit: 100 });
      expect(allEntries.length).toBeGreaterThanOrEqual(4);

      // Verify types are correct
      const kinds = allEntries.map((e) => e.kind);
      expect(kinds).toContain('claim');
      expect(kinds).toContain('verification');
      expect(kinds).toContain('outcome');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles empty calibration data gracefully', async () => {
      const tracker = createCalibrationTracker(ledger);

      const ece = await tracker.getCurrentECE();
      expect(ece).toBeNull();

      const { trend, samples } = await tracker.getCalibrationTrend();
      expect(trend).toBe('stable');
      expect(samples).toBe(0);
    });

    it('handles absent confidence values in predictions', async () => {
      const tracker = createCalibrationTracker(ledger);

      const entry = await tracker.recordPrediction({
        predictionId: 'absent_pred',
        claim: 'Unknown claim',
        confidence: absent('uncalibrated'),
        predictedAt: new Date(),
      });

      expect(entry.kind).toBe('claim');
      expect(entry.confidence?.type).toBe('absent');
    });

    it('maintains data integrity across operations', async () => {
      const tracker = createCalibrationTracker(ledger);

      // Record multiple interleaved operations
      const operations = [];

      for (let i = 0; i < 10; i++) {
        const entry = await tracker.recordPrediction({
          predictionId: `concurrent_${i}`,
          claim: `Concurrent claim ${i}`,
          confidence: bounded(0.5, 0.9, 'theoretical', 'test'),
          predictedAt: new Date(),
        });
        operations.push(entry);
      }

      // All entries should be unique
      const ids = new Set(operations.map((e) => e.id));
      expect(ids.size).toBe(10);

      // All entries should be retrievable
      const entries = await ledger.query({ kinds: ['claim'], limit: 100 });
      expect(entries.length).toBeGreaterThanOrEqual(10);
    });
  });
});
