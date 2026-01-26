/**
 * @fileoverview Pre-flight Module
 *
 * Early problem detection for major operations.
 *
 * @packageDocumentation
 */

export {
  runPreflightChecks,
  printPreflightReport,
  type PreflightCheckResult,
  type PreflightReport,
  type PreflightOptions,
  type CheckSeverity,
  type CheckCategory,
} from './checks.js';

export {
  runPreconditionGates,
  runPostconditionGates,
  hasFatalFailure,
  getFailureMessages,
  printValidationResults,
  type ValidationGateResult,
  type ValidationGateContext,
} from './validation_gates.js';
