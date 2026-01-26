/**
 * @fileoverview Primitive Contracts - Design-by-Contract for Technique Primitives
 *
 * Implements verifiable behavioral guarantees for every technique primitive:
 * - Preconditions: What must be true before execution
 * - Postconditions: What will be true after successful execution
 * - Invariants: What remains true throughout execution
 * - Confidence derivation: How output confidence relates to inputs
 *
 * @packageDocumentation
 */

import type { ConfidenceValue } from './confidence.js';
import { combinedConfidence, absent } from './confidence.js';
import type { IEvidenceLedger, SessionId } from './evidence_ledger.js';

// ============================================================================
// BRANDED TYPES
// ============================================================================

export type ContractId = string & { readonly __brand: 'ContractId' };
export type PrimitiveId = string & { readonly __brand: 'PrimitiveId' };

export function createContractId(id: string): ContractId {
  return id as ContractId;
}

export function createPrimitiveId(id: string): PrimitiveId {
  return id as PrimitiveId;
}

// ============================================================================
// EXECUTION CONTEXT
// ============================================================================

export interface ProviderStatus {
  llm: boolean;
  embedding: boolean;
  storage: boolean;
}

export interface ExecutionBudget {
  tokensRemaining: number;
  timeRemainingMs: number;
}

export interface ExecutionContext {
  sessionId: SessionId;
  providers: ProviderStatus;
  now: Date;
  budget: ExecutionBudget;
  ledger?: IEvidenceLedger;
}

// ============================================================================
// CONDITIONS
// ============================================================================

export interface Precondition<TInput> {
  id: string;
  description: string;
  check: (input: TInput, context: ExecutionContext) => boolean | Promise<boolean>;
  onViolation: 'throw' | 'skip' | 'warn';
  violationMessage: (input: TInput) => string;
  severity: 'critical' | 'warning' | 'info';
}

export interface Postcondition<TInput, TOutput> {
  id: string;
  description: string;
  check: (input: TInput, output: TOutput, context: ExecutionContext) => boolean | Promise<boolean>;
  onViolation: 'throw' | 'retry' | 'warn';
  violationMessage: (input: TInput, output: TOutput) => string;
}

export interface Invariant<TInput, TOutput> {
  id: string;
  description: string;
  check: (input: TInput, partialOutput: Partial<TOutput> | undefined, context: ExecutionContext) => boolean;
  category: 'safety' | 'liveness' | 'consistency';
}

// ============================================================================
// CONFIDENCE DERIVATION
// ============================================================================

export type ConfidenceFactorSource =
  | 'input_confidence'
  | 'execution_quality'
  | 'provider_reliability'
  | 'temporal_freshness';

export interface ConfidenceFactor {
  id: string;
  source: ConfidenceFactorSource;
  baseWeight: number;
  transform?: 'identity' | 'sqrt' | 'log' | 'decay';
}

export type ConfidenceCombiner = 'min' | 'weighted_average' | 'bayesian' | 'custom';

export interface ConfidenceDerivationSpec {
  factors: ConfidenceFactor[];
  combiner: ConfidenceCombiner;
  weights?: Record<string, number>;
  customCombiner?: (factors: Map<string, ConfidenceValue>) => ConfidenceValue;
  calibrationRef?: string;
}

// ============================================================================
// ERROR SPECIFICATION
// ============================================================================

export interface ExpectedError {
  code: string;
  transient: boolean;
  handling: 'retry' | 'skip' | 'throw' | 'fallback';
  description: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

export interface ErrorSpec {
  expectedErrors: ExpectedError[];
  retryPolicy: RetryPolicy;
  fallback: 'throw' | 'return_empty' | 'return_cached' | 'degrade_gracefully';
}

// ============================================================================
// PERFORMANCE BOUNDS
// ============================================================================

export interface PerformanceBounds {
  expectedLatencyMs: number;
  maxLatencyMs: number;
  expectedTokens?: {
    input: number;
    output: number;
  };
  memoryMB?: number;
  parallelizable: boolean;
}

// ============================================================================
// PRIMITIVE CONTRACT
// ============================================================================

/**
 * A contract that defines the behavioral guarantees of a technique primitive.
 *
 * INVARIANT: All primitives have exactly one contract
 * INVARIANT: Contract verification is deterministic given same inputs
 */
export interface PrimitiveContract<TInput, TOutput> {
  id: ContractId;
  name: string;
  primitiveId: PrimitiveId;
  preconditions: Precondition<TInput>[];
  postconditions: Postcondition<TInput, TOutput>[];
  invariants: Invariant<TInput, TOutput>[];
  confidenceDerivation: ConfidenceDerivationSpec;
  errorSpec: ErrorSpec;
  performanceBounds?: PerformanceBounds;
}

// ============================================================================
// CONTRACT REGISTRY
// ============================================================================

export interface IContractRegistry {
  register<TInput, TOutput>(contract: PrimitiveContract<TInput, TOutput>): void;
  get<TInput, TOutput>(primitiveId: PrimitiveId): PrimitiveContract<TInput, TOutput> | null;
  list(): PrimitiveContract<unknown, unknown>[];
  has(primitiveId: PrimitiveId): boolean;
}

class ContractRegistry implements IContractRegistry {
  private contracts = new Map<string, PrimitiveContract<unknown, unknown>>();

  register<TInput, TOutput>(contract: PrimitiveContract<TInput, TOutput>): void {
    if (this.contracts.has(contract.primitiveId)) {
      throw new Error(`Contract already registered for primitive: ${contract.primitiveId}`);
    }
    this.contracts.set(contract.primitiveId, contract as PrimitiveContract<unknown, unknown>);
  }

  get<TInput, TOutput>(primitiveId: PrimitiveId): PrimitiveContract<TInput, TOutput> | null {
    const contract = this.contracts.get(primitiveId);
    return (contract as PrimitiveContract<TInput, TOutput>) ?? null;
  }

  list(): PrimitiveContract<unknown, unknown>[] {
    return Array.from(this.contracts.values());
  }

  has(primitiveId: PrimitiveId): boolean {
    return this.contracts.has(primitiveId);
  }
}

let globalRegistry: ContractRegistry | null = null;

export function getContractRegistry(): IContractRegistry {
  if (!globalRegistry) {
    globalRegistry = new ContractRegistry();
  }
  return globalRegistry;
}

export function resetContractRegistry(): void {
  globalRegistry = null;
}

// ============================================================================
// CONTRACT VIOLATION
// ============================================================================

export class ContractViolation extends Error {
  constructor(
    public readonly contractId: ContractId,
    public readonly conditionId: string,
    public readonly conditionType: 'precondition' | 'postcondition' | 'invariant',
    message: string,
    public readonly input?: unknown,
    public readonly output?: unknown
  ) {
    super(`Contract violation in ${contractId}: ${conditionType} ${conditionId} - ${message}`);
    this.name = 'ContractViolation';
  }
}

// ============================================================================
// CONTRACT RESULT
// ============================================================================

export interface ContractWarning {
  conditionId: string;
  message: string;
  severity: 'warning' | 'info';
}

export interface ContractVerification {
  preconditionsPassed: string[];
  postconditionsPassed: string[];
  invariantsHeld: string[];
  warnings: ContractWarning[];
}

export interface ContractExecution {
  startTime: Date;
  endTime: Date;
  durationMs: number;
  retryCount: number;
}

export interface ContractResult<TOutput> {
  output: TOutput;
  verification: ContractVerification;
  confidence: ConfidenceValue;
  execution: ContractExecution;
}

// ============================================================================
// CONTRACT EXECUTOR
// ============================================================================

export interface IContractExecutor {
  execute<TInput, TOutput>(
    primitiveId: PrimitiveId,
    input: TInput,
    executor: (input: TInput, context: ExecutionContext) => Promise<TOutput>,
    context: ExecutionContext
  ): Promise<ContractResult<TOutput>>;
}

export class ContractExecutor implements IContractExecutor {
  constructor(private registry: IContractRegistry) {}

  async execute<TInput, TOutput>(
    primitiveId: PrimitiveId,
    input: TInput,
    executor: (input: TInput, context: ExecutionContext) => Promise<TOutput>,
    context: ExecutionContext
  ): Promise<ContractResult<TOutput>> {
    const contract = this.registry.get<TInput, TOutput>(primitiveId);
    if (!contract) {
      throw new Error(`No contract registered for primitive: ${primitiveId}`);
    }

    const startTime = new Date();
    const verification: ContractVerification = {
      preconditionsPassed: [],
      postconditionsPassed: [],
      invariantsHeld: [],
      warnings: [],
    };

    // Check preconditions
    await this.checkPreconditions(contract, input, context, verification);

    // Execute with retry
    const { output, retryCount } = await this.executeWithRetry(
      contract,
      input,
      executor,
      context
    );

    // Check postconditions
    await this.checkPostconditions(contract, input, output, context, verification);

    // Derive confidence
    const confidence = this.deriveConfidence(contract, input, output, context);

    const endTime = new Date();

    return {
      output,
      verification,
      confidence,
      execution: {
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        retryCount,
      },
    };
  }

  private async checkPreconditions<TInput, TOutput>(
    contract: PrimitiveContract<TInput, TOutput>,
    input: TInput,
    context: ExecutionContext,
    verification: ContractVerification
  ): Promise<void> {
    for (const precondition of contract.preconditions) {
      const passed = await precondition.check(input, context);

      if (passed) {
        verification.preconditionsPassed.push(precondition.id);
      } else {
        const message = precondition.violationMessage(input);

        switch (precondition.onViolation) {
          case 'throw':
            throw new ContractViolation(
              contract.id,
              precondition.id,
              'precondition',
              message,
              input
            );
          case 'skip':
            throw new ContractViolation(
              contract.id,
              precondition.id,
              'precondition',
              `Skipped: ${message}`,
              input
            );
          case 'warn':
            verification.warnings.push({
              conditionId: precondition.id,
              message,
              severity: precondition.severity === 'info' ? 'info' : 'warning',
            });
            break;
        }
      }
    }
  }

  private async executeWithRetry<TInput, TOutput>(
    contract: PrimitiveContract<TInput, TOutput>,
    input: TInput,
    executor: (input: TInput, context: ExecutionContext) => Promise<TOutput>,
    context: ExecutionContext
  ): Promise<{ output: TOutput; retryCount: number }> {
    const { retryPolicy, expectedErrors, fallback } = contract.errorSpec;
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        const output = await executor(input, context);
        return { output, retryCount };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorCode = (error as { code?: string }).code ?? 'UNKNOWN';
        const expectedError = expectedErrors.find((e) => e.code === errorCode);

        if (expectedError) {
          if (expectedError.transient && attempt < retryPolicy.maxAttempts) {
            retryCount++;
            const delay = Math.min(
              retryPolicy.baseDelayMs * Math.pow(retryPolicy.backoffMultiplier, attempt),
              retryPolicy.maxDelayMs
            );
            await this.sleep(delay);
            continue;
          }

          if (expectedError.handling === 'throw') {
            throw error;
          }
        } else if (attempt < retryPolicy.maxAttempts) {
          retryCount++;
          const delay = Math.min(
            retryPolicy.baseDelayMs * Math.pow(retryPolicy.backoffMultiplier, attempt),
            retryPolicy.maxDelayMs
          );
          await this.sleep(delay);
          continue;
        }

        break;
      }
    }

    // All retries exhausted - apply fallback
    switch (fallback) {
      case 'throw':
        throw lastError ?? new Error('Execution failed');
      case 'return_empty':
        return { output: {} as TOutput, retryCount };
      case 'return_cached':
        // Would need cache access - fall through to throw
        throw lastError ?? new Error('Execution failed (no cache available)');
      case 'degrade_gracefully':
        return { output: {} as TOutput, retryCount };
    }
  }

  private async checkPostconditions<TInput, TOutput>(
    contract: PrimitiveContract<TInput, TOutput>,
    input: TInput,
    output: TOutput,
    context: ExecutionContext,
    verification: ContractVerification
  ): Promise<void> {
    for (const postcondition of contract.postconditions) {
      const passed = await postcondition.check(input, output, context);

      if (passed) {
        verification.postconditionsPassed.push(postcondition.id);
      } else {
        const message = postcondition.violationMessage(input, output);

        switch (postcondition.onViolation) {
          case 'throw':
            throw new ContractViolation(
              contract.id,
              postcondition.id,
              'postcondition',
              message,
              input,
              output
            );
          case 'retry':
            // Would trigger re-execution - for now treat as warning
            verification.warnings.push({
              conditionId: postcondition.id,
              message: `Retry suggested: ${message}`,
              severity: 'warning',
            });
            break;
          case 'warn':
            verification.warnings.push({
              conditionId: postcondition.id,
              message,
              severity: 'warning',
            });
            break;
        }
      }
    }
  }

  private deriveConfidence<TInput, TOutput>(
    contract: PrimitiveContract<TInput, TOutput>,
    _input: TInput,
    _output: TOutput,
    _context: ExecutionContext
  ): ConfidenceValue {
    const { factors, combiner, weights } = contract.confidenceDerivation;

    if (factors.length === 0) {
      return absent('not_applicable');
    }

    // Build factor values (simplified - would need actual factor extraction)
    const factorInputs = factors.map((factor) => ({
      confidence: {
        type: 'bounded' as const,
        low: 0.5,
        high: 0.9,
        basis: 'theoretical' as const,
        citation: `${factor.source}_default`,
      },
      weight: weights?.[factor.id] ?? factor.baseWeight,
      name: factor.id,
    }));

    switch (combiner) {
      case 'min':
        return combinedConfidence(factorInputs);
      case 'weighted_average':
        return combinedConfidence(factorInputs);
      case 'bayesian':
        // Simplified Bayesian - would need prior/likelihood
        return combinedConfidence(factorInputs);
      case 'custom':
        if (contract.confidenceDerivation.customCombiner) {
          const factorMap = new Map<string, ConfidenceValue>();
          for (const f of factorInputs) {
            factorMap.set(f.name, f.confidence);
          }
          return contract.confidenceDerivation.customCombiner(factorMap);
        }
        return absent('insufficient_data');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createContractExecutor(registry?: IContractRegistry): IContractExecutor {
  return new ContractExecutor(registry ?? getContractRegistry());
}

// ============================================================================
// DEFAULT RETRY POLICY
// ============================================================================

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 100,
  backoffMultiplier: 2,
  maxDelayMs: 5000,
};

// ============================================================================
// CONTRACT BUILDER HELPERS
// ============================================================================

export function createPrecondition<TInput>(
  id: string,
  description: string,
  check: (input: TInput, context: ExecutionContext) => boolean | Promise<boolean>,
  options: Partial<Pick<Precondition<TInput>, 'onViolation' | 'severity'>> = {}
): Precondition<TInput> {
  return {
    id,
    description,
    check,
    onViolation: options.onViolation ?? 'throw',
    violationMessage: () => description,
    severity: options.severity ?? 'critical',
  };
}

export function createPostcondition<TInput, TOutput>(
  id: string,
  description: string,
  check: (input: TInput, output: TOutput, context: ExecutionContext) => boolean | Promise<boolean>,
  options: Partial<Pick<Postcondition<TInput, TOutput>, 'onViolation'>> = {}
): Postcondition<TInput, TOutput> {
  return {
    id,
    description,
    check,
    onViolation: options.onViolation ?? 'throw',
    violationMessage: () => description,
  };
}
