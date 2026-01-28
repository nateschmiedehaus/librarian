/**
 * @fileoverview Property-Based Tests for Calibration and Confidence Algebraic Laws
 *
 * This test file uses property-based testing to verify algebraic laws for
 * confidence operations. Instead of testing specific values, we generate
 * many random inputs and verify that invariants hold for all of them.
 *
 * Property-based testing catches edge cases that handwritten tests miss by
 * exploring the input space systematically with random generation.
 *
 * Laws Verified:
 * - Semilattice laws: associativity, commutativity, idempotence
 * - Identity elements: deterministic(1.0) for meet, deterministic(0.0)/absent for join
 * - Absorption laws: meet(a, join(a, b)) = a
 * - Bounded lattice properties: annihilator, distributivity
 * - Calibration status preservation rules
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import {
  type ConfidenceValue,
  type CalibrationStatus,
  measuredConfidence,
  deterministic,
  bounded,
  absent,
  getNumericValue,
  andConfidence,
  orConfidence,
  sequenceConfidence,
  parallelAllConfidence,
  parallelAnyConfidence,
  deriveSequentialConfidence,
  deriveParallelConfidence,
  computeCalibrationStatus,
} from '../confidence.js';
import {
  confidenceEquals,
  checkAssociativity,
  checkCommutativity,
  checkIdempotence,
  checkIdentity,
  checkAbsorption,
} from '../calibration_laws.js';

// ============================================================================
// SIMPLE PROPERTY-BASED TESTING FRAMEWORK
// ============================================================================

/**
 * Seeded pseudo-random number generator (Mulberry32).
 * Ensures deterministic, reproducible tests.
 */
function mulberry32(seed: number): () => number {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Property test configuration.
 */
interface PropertyConfig {
  /** Number of random inputs to generate (default: 100) */
  numRuns?: number;
  /** Random seed for reproducibility (default: 42) */
  seed?: number;
}

/**
 * Result of a property test run.
 */
interface PropertyResult<T> {
  /** Whether the property held for all inputs */
  passed: boolean;
  /** Number of successful runs */
  successfulRuns: number;
  /** Total number of runs attempted */
  totalRuns: number;
  /** Counterexample if property failed */
  counterexample?: {
    input: T;
    error?: string;
  };
  /** Seed used for reproducibility */
  seed: number;
}

/**
 * Run a property-based test with generated inputs.
 *
 * @param generator - Function to generate random inputs
 * @param property - Property that should hold for all inputs
 * @param config - Test configuration
 * @returns Result indicating whether property held
 */
function property<T>(
  generator: (random: () => number) => T,
  propertyFn: (input: T) => boolean,
  config: PropertyConfig = {}
): PropertyResult<T> {
  const numRuns = config.numRuns ?? 100;
  const seed = config.seed ?? 42;
  const random = mulberry32(seed);

  let successfulRuns = 0;
  let counterexample: { input: T; error?: string } | undefined;

  for (let i = 0; i < numRuns; i++) {
    const input = generator(random);
    try {
      if (propertyFn(input)) {
        successfulRuns++;
      } else {
        counterexample = { input };
        break;
      }
    } catch (err) {
      counterexample = {
        input,
        error: err instanceof Error ? err.message : String(err),
      };
      break;
    }
  }

  return {
    passed: successfulRuns === numRuns,
    successfulRuns,
    totalRuns: numRuns,
    counterexample,
    seed,
  };
}

/**
 * Assert a property holds, with nice error messages.
 */
function assertProperty<T>(
  name: string,
  generator: (random: () => number) => T,
  propertyFn: (input: T) => boolean,
  config: PropertyConfig = {}
): void {
  const result = property(generator, propertyFn, config);
  if (!result.passed) {
    const inputStr = JSON.stringify(result.counterexample?.input, (_, v) => {
      if (typeof v === 'object' && v !== null && 'type' in v) {
        // Simplify ConfidenceValue display
        const conf = v as ConfidenceValue;
        return `${conf.type}(${getNumericValue(conf)})`;
      }
      return v;
    }, 2);
    const errMsg = result.counterexample?.error ? `\nError: ${result.counterexample.error}` : '';
    throw new Error(
      `Property "${name}" failed after ${result.successfulRuns}/${result.totalRuns} runs.\n` +
      `Seed: ${result.seed}\n` +
      `Counterexample: ${inputStr}${errMsg}`
    );
  }
}

// ============================================================================
// ARBITRARY GENERATORS FOR CONFIDENCEVALUE
// ============================================================================

/**
 * Generate a random float in [0, 1].
 */
function genFloat01(random: () => number): number {
  return random();
}

/**
 * Generate a random float in [min, max].
 */
function genFloatRange(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

/**
 * Generate a deterministic confidence (1.0 or 0.0).
 */
function genDeterministic(random: () => number): ConfidenceValue {
  return deterministic(random() < 0.5, `prop_test_${Math.floor(random() * 1000)}`);
}

/**
 * Generate a measured confidence with random accuracy.
 */
function genMeasured(random: () => number): ConfidenceValue {
  const accuracy = genFloat01(random);
  const halfWidth = Math.min(accuracy, 1 - accuracy, 0.1) * random();
  return measuredConfidence({
    datasetId: `prop_test_${Math.floor(random() * 10000)}`,
    sampleSize: Math.floor(random() * 1000) + 10,
    accuracy,
    ci95: [Math.max(0, accuracy - halfWidth), Math.min(1, accuracy + halfWidth)],
  });
}

/**
 * Generate a bounded confidence with random low/high.
 */
function genBounded(random: () => number): ConfidenceValue {
  const low = genFloatRange(random, 0, 0.5);
  const high = genFloatRange(random, low + 0.01, 1.0);
  const bases = ['theoretical', 'literature', 'formal_analysis'] as const;
  const basis = bases[Math.floor(random() * bases.length)];
  return bounded(low, high, basis, `prop_test_citation_${Math.floor(random() * 1000)}`);
}

/**
 * Generate an absent confidence.
 */
function genAbsent(random: () => number): ConfidenceValue {
  const reasons = ['uncalibrated', 'insufficient_data', 'not_applicable'] as const;
  return absent(reasons[Math.floor(random() * reasons.length)]);
}

/**
 * Generate any ConfidenceValue type randomly.
 */
function genConfidence(random: () => number): ConfidenceValue {
  const typeChoice = random();
  if (typeChoice < 0.2) {
    return genDeterministic(random);
  } else if (typeChoice < 0.6) {
    return genMeasured(random);
  } else if (typeChoice < 0.8) {
    return genBounded(random);
  } else {
    return genAbsent(random);
  }
}

/**
 * Generate a non-absent ConfidenceValue (for operations requiring numeric values).
 */
function genNonAbsentConfidence(random: () => number): ConfidenceValue {
  const typeChoice = random();
  if (typeChoice < 0.25) {
    return genDeterministic(random);
  } else if (typeChoice < 0.75) {
    return genMeasured(random);
  } else {
    return genBounded(random);
  }
}

/**
 * Generate a pair of ConfidenceValues.
 */
function genPair(random: () => number): [ConfidenceValue, ConfidenceValue] {
  return [genNonAbsentConfidence(random), genNonAbsentConfidence(random)];
}

/**
 * Generate a triple of ConfidenceValues.
 */
function genTriple(random: () => number): [ConfidenceValue, ConfidenceValue, ConfidenceValue] {
  return [genNonAbsentConfidence(random), genNonAbsentConfidence(random), genNonAbsentConfidence(random)];
}

/**
 * Generate an array of ConfidenceValues.
 */
function genArray(random: () => number, minLen: number = 1, maxLen: number = 5): ConfidenceValue[] {
  const len = Math.floor(random() * (maxLen - minLen + 1)) + minLen;
  return Array.from({ length: len }, () => genNonAbsentConfidence(random));
}

/**
 * Generate boundary values (0.0, 1.0, very close values).
 */
function genBoundaryConfidence(random: () => number): ConfidenceValue {
  const choice = random();
  if (choice < 0.2) {
    return deterministic(true, 'boundary_test'); // 1.0
  } else if (choice < 0.4) {
    return deterministic(false, 'boundary_test'); // 0.0
  } else if (choice < 0.6) {
    // Very close to 0.5
    const epsilon = (random() - 0.5) * 0.00001;
    return measuredConfidence({
      datasetId: 'boundary',
      sampleSize: 100,
      accuracy: 0.5 + epsilon,
      ci95: [0.45, 0.55],
    });
  } else if (choice < 0.8) {
    // Very small value
    return measuredConfidence({
      datasetId: 'boundary',
      sampleSize: 100,
      accuracy: random() * 0.001,
      ci95: [0, 0.01],
    });
  } else {
    // Very close to 1.0
    return measuredConfidence({
      datasetId: 'boundary',
      sampleSize: 100,
      accuracy: 1 - random() * 0.001,
      ci95: [0.99, 1.0],
    });
  }
}

// ============================================================================
// TOLERANCE-AWARE EQUALITY
// ============================================================================

const EPSILON = 1e-9;

/**
 * Check if two numeric values are approximately equal.
 */
function approxEqual(a: number | null, b: number | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < EPSILON;
}

// ============================================================================
// SEMILATTICE PROPERTIES FOR andConfidence (meet)
// ============================================================================

describe('Property: andConfidence Semilattice Laws', () => {
  const numRuns = 100;
  const seed = 12345;

  it('andConfidence is associative: (a AND b) AND c = a AND (b AND c)', () => {
    assertProperty(
      'andConfidence associativity',
      genTriple,
      ([a, b, c]) => {
        const left = andConfidence(andConfidence(a, b), c);
        const right = andConfidence(a, andConfidence(b, c));
        return confidenceEquals(left, right);
      },
      { numRuns, seed }
    );
  });

  it('andConfidence is commutative: a AND b = b AND a', () => {
    assertProperty(
      'andConfidence commutativity',
      genPair,
      ([a, b]) => {
        const left = andConfidence(a, b);
        const right = andConfidence(b, a);
        return confidenceEquals(left, right);
      },
      { numRuns, seed }
    );
  });

  it('andConfidence is idempotent: a AND a = a', () => {
    assertProperty(
      'andConfidence idempotence',
      genNonAbsentConfidence,
      (a) => {
        const result = andConfidence(a, a);
        return confidenceEquals(result, a);
      },
      { numRuns, seed }
    );
  });

  it('andConfidence has identity element deterministic(true): a AND 1 = a', () => {
    const identity = deterministic(true, 'identity');
    assertProperty(
      'andConfidence identity',
      genNonAbsentConfidence,
      (a) => {
        const result = andConfidence(a, identity);
        return confidenceEquals(result, a);
      },
      { numRuns, seed }
    );
  });

  it('andConfidence has annihilator deterministic(false): a AND 0 = 0', () => {
    const zero = deterministic(false, 'annihilator');
    assertProperty(
      'andConfidence annihilator',
      genNonAbsentConfidence,
      (a) => {
        const result = andConfidence(a, zero);
        return approxEqual(getNumericValue(result), 0);
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// SEMILATTICE PROPERTIES FOR orConfidence (join)
// ============================================================================

describe('Property: orConfidence Semilattice Laws', () => {
  const numRuns = 100;
  const seed = 23456;

  it('orConfidence is associative: (a OR b) OR c = a OR (b OR c)', () => {
    assertProperty(
      'orConfidence associativity',
      genTriple,
      ([a, b, c]) => {
        const left = orConfidence(orConfidence(a, b), c);
        const right = orConfidence(a, orConfidence(b, c));
        return confidenceEquals(left, right);
      },
      { numRuns, seed }
    );
  });

  it('orConfidence is commutative: a OR b = b OR a', () => {
    assertProperty(
      'orConfidence commutativity',
      genPair,
      ([a, b]) => {
        const left = orConfidence(a, b);
        const right = orConfidence(b, a);
        return confidenceEquals(left, right);
      },
      { numRuns, seed }
    );
  });

  it('orConfidence is idempotent: a OR a = a', () => {
    assertProperty(
      'orConfidence idempotence',
      genNonAbsentConfidence,
      (a) => {
        const result = orConfidence(a, a);
        return confidenceEquals(result, a);
      },
      { numRuns, seed }
    );
  });

  it('orConfidence has identity element deterministic(false): a OR 0 = a', () => {
    const identity = deterministic(false, 'identity');
    assertProperty(
      'orConfidence identity',
      genNonAbsentConfidence,
      (a) => {
        const result = orConfidence(a, identity);
        return confidenceEquals(result, a);
      },
      { numRuns, seed }
    );
  });

  it('orConfidence has annihilator deterministic(true): a OR 1 = 1', () => {
    const one = deterministic(true, 'annihilator');
    assertProperty(
      'orConfidence annihilator',
      genNonAbsentConfidence,
      (a) => {
        const result = orConfidence(a, one);
        return approxEqual(getNumericValue(result), 1);
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// ABSORPTION LAWS
// ============================================================================

describe('Property: Absorption Laws', () => {
  const numRuns = 100;
  const seed = 34567;

  it('meet absorbs join: a AND (a OR b) = a', () => {
    assertProperty(
      'absorption (meet over join)',
      genPair,
      ([a, b]) => {
        const joinResult = orConfidence(a, b);
        const result = andConfidence(a, joinResult);
        return confidenceEquals(result, a);
      },
      { numRuns, seed }
    );
  });

  it('join absorbs meet: a OR (a AND b) = a', () => {
    assertProperty(
      'absorption (join over meet)',
      genPair,
      ([a, b]) => {
        const meetResult = andConfidence(a, b);
        const result = orConfidence(a, meetResult);
        return confidenceEquals(result, a);
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// DISTRIBUTIVE LATTICE PROPERTIES
// ============================================================================

describe('Property: Distributive Lattice Laws', () => {
  const numRuns = 100;
  const seed = 45678;

  it('meet distributes over join: a AND (b OR c) = (a AND b) OR (a AND c)', () => {
    assertProperty(
      'distributivity (meet over join)',
      genTriple,
      ([a, b, c]) => {
        const left = andConfidence(a, orConfidence(b, c));
        const right = orConfidence(andConfidence(a, b), andConfidence(a, c));
        return confidenceEquals(left, right);
      },
      { numRuns, seed }
    );
  });

  it('join distributes over meet: a OR (b AND c) = (a OR b) AND (a OR c)', () => {
    assertProperty(
      'distributivity (join over meet)',
      genTriple,
      ([a, b, c]) => {
        const left = orConfidence(a, andConfidence(b, c));
        const right = andConfidence(orConfidence(a, b), orConfidence(a, c));
        return confidenceEquals(left, right);
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// SEQUENCE CONFIDENCE PROPERTIES
// ============================================================================

describe('Property: sequenceConfidence Laws', () => {
  const numRuns = 100;
  const seed = 56789;

  it('sequenceConfidence is associative: seq([a, b, c]) = seq([a, seq([b, c])])', () => {
    assertProperty(
      'sequenceConfidence associativity',
      genTriple,
      ([a, b, c]) => {
        const flat = sequenceConfidence([a, b, c]);
        const nested = sequenceConfidence([a, sequenceConfidence([b, c])]);
        // Both should yield min(a, b, c)
        const flatVal = getNumericValue(flat);
        const nestedVal = getNumericValue(nested);
        return approxEqual(flatVal, nestedVal);
      },
      { numRuns, seed }
    );
  });

  it('sequenceConfidence equals minimum: seq([a, b]) = min(a, b)', () => {
    assertProperty(
      'sequenceConfidence equals min',
      genPair,
      ([a, b]) => {
        const seqResult = sequenceConfidence([a, b]);
        const minResult = andConfidence(a, b);
        return confidenceEquals(seqResult, minResult);
      },
      { numRuns, seed }
    );
  });

  it('sequenceConfidence with single element returns that element', () => {
    assertProperty(
      'sequenceConfidence single element',
      genNonAbsentConfidence,
      (a) => {
        const result = sequenceConfidence([a]);
        return approxEqual(getNumericValue(result), getNumericValue(a));
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// PARALLEL CONFIDENCE PROPERTIES
// ============================================================================

describe('Property: parallelAllConfidence Laws', () => {
  const numRuns = 100;
  const seed = 67890;

  it('parallelAllConfidence is associative: par([a, b, c]) = par([a, par([b, c])])', () => {
    assertProperty(
      'parallelAllConfidence associativity',
      genTriple,
      ([a, b, c]) => {
        const flat = parallelAllConfidence([a, b, c]);
        const nested = parallelAllConfidence([a, parallelAllConfidence([b, c])]);
        // Product is associative: a*b*c = a*(b*c)
        const flatVal = getNumericValue(flat);
        const nestedVal = getNumericValue(nested);
        return approxEqual(flatVal, nestedVal);
      },
      { numRuns, seed }
    );
  });

  it('parallelAllConfidence is commutative: par([a, b]) = par([b, a])', () => {
    assertProperty(
      'parallelAllConfidence commutativity',
      genPair,
      ([a, b]) => {
        const result1 = parallelAllConfidence([a, b]);
        const result2 = parallelAllConfidence([b, a]);
        return approxEqual(getNumericValue(result1), getNumericValue(result2));
      },
      { numRuns, seed }
    );
  });

  it('parallelAllConfidence equals product: par([a, b]) = a * b', () => {
    assertProperty(
      'parallelAllConfidence equals product',
      genPair,
      ([a, b]) => {
        const parResult = parallelAllConfidence([a, b]);
        const aVal = getNumericValue(a);
        const bVal = getNumericValue(b);
        if (aVal === null || bVal === null) return true; // Skip if absent
        const expected = aVal * bVal;
        return approxEqual(getNumericValue(parResult), expected);
      },
      { numRuns, seed }
    );
  });

  it('parallelAllConfidence with identity 1: par([a, 1]) = a', () => {
    const identity = deterministic(true, 'identity');
    assertProperty(
      'parallelAllConfidence identity',
      genNonAbsentConfidence,
      (a) => {
        const result = parallelAllConfidence([a, identity]);
        return approxEqual(getNumericValue(result), getNumericValue(a));
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// PARALLEL ANY CONFIDENCE PROPERTIES
// ============================================================================

describe('Property: parallelAnyConfidence Laws', () => {
  const numRuns = 100;
  const seed = 78901;

  it('parallelAnyConfidence is commutative: parAny([a, b]) = parAny([b, a])', () => {
    assertProperty(
      'parallelAnyConfidence commutativity',
      genPair,
      ([a, b]) => {
        const result1 = parallelAnyConfidence([a, b]);
        const result2 = parallelAnyConfidence([b, a]);
        return approxEqual(getNumericValue(result1), getNumericValue(result2));
      },
      { numRuns, seed }
    );
  });

  it('parallelAnyConfidence equals noisy-or: parAny([a, b]) = 1 - (1-a)*(1-b)', () => {
    assertProperty(
      'parallelAnyConfidence equals noisy-or',
      genPair,
      ([a, b]) => {
        const parResult = parallelAnyConfidence([a, b]);
        const aVal = getNumericValue(a);
        const bVal = getNumericValue(b);
        if (aVal === null || bVal === null) return true; // Skip if absent
        const expected = 1 - (1 - aVal) * (1 - bVal);
        return approxEqual(getNumericValue(parResult), expected);
      },
      { numRuns, seed }
    );
  });

  it('parallelAnyConfidence with identity 0: parAny([a, 0]) = a', () => {
    const identity = deterministic(false, 'identity');
    assertProperty(
      'parallelAnyConfidence identity',
      genNonAbsentConfidence,
      (a) => {
        const result = parallelAnyConfidence([a, identity]);
        return approxEqual(getNumericValue(result), getNumericValue(a));
      },
      { numRuns, seed }
    );
  });

  it('parallelAnyConfidence with annihilator 1: parAny([a, 1]) = 1', () => {
    const one = deterministic(true, 'annihilator');
    assertProperty(
      'parallelAnyConfidence annihilator',
      genNonAbsentConfidence,
      (a) => {
        const result = parallelAnyConfidence([a, one]);
        return approxEqual(getNumericValue(result), 1);
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// ABSENT VALUE PROPERTIES
// ============================================================================

describe('Property: Absent Value Handling', () => {
  const numRuns = 100;
  const seed = 89012;

  it('andConfidence with absent returns absent: a AND absent = absent', () => {
    const absentVal = absent('uncalibrated');
    assertProperty(
      'andConfidence with absent',
      genNonAbsentConfidence,
      (a) => {
        const result = andConfidence(a, absentVal);
        return result.type === 'absent';
      },
      { numRuns, seed }
    );
  });

  it('orConfidence with absent returns other: a OR absent = a', () => {
    const absentVal = absent('uncalibrated');
    assertProperty(
      'orConfidence with absent returns other',
      genNonAbsentConfidence,
      (a) => {
        const result = orConfidence(a, absentVal);
        // orConfidence returns the non-absent value
        return approxEqual(getNumericValue(result), getNumericValue(a));
      },
      { numRuns, seed }
    );
  });

  it('sequenceConfidence with absent returns absent', () => {
    assertProperty(
      'sequenceConfidence with absent',
      (random) => [genNonAbsentConfidence(random), genAbsent(random)] as [ConfidenceValue, ConfidenceValue],
      ([a, abs]) => {
        const result = sequenceConfidence([a, abs]);
        return result.type === 'absent';
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// CALIBRATION STATUS PROPERTIES
// ============================================================================

describe('Property: Calibration Status Preservation', () => {
  const numRuns = 100;
  const seed = 90123;

  it('deriveSequentialConfidence preserves calibration with measured inputs', () => {
    assertProperty(
      'sequential preserves calibration',
      (random) => [genMeasured(random), genMeasured(random)],
      (inputs) => {
        const result = deriveSequentialConfidence(inputs);
        if (result.type !== 'derived') return true; // Skip non-derived results
        return result.calibrationStatus === 'preserved';
      },
      { numRuns, seed }
    );
  });

  it('deriveParallelConfidence preserves calibration with measured inputs', () => {
    assertProperty(
      'parallel preserves calibration',
      (random) => [genMeasured(random), genMeasured(random)],
      (inputs) => {
        const result = deriveParallelConfidence(inputs);
        if (result.type !== 'derived') return true; // Skip non-derived results
        return result.calibrationStatus === 'preserved';
      },
      { numRuns, seed }
    );
  });

  it('deriveSequentialConfidence degrades with bounded inputs', () => {
    assertProperty(
      'sequential degrades with bounded',
      (random) => [genMeasured(random), genBounded(random)],
      (inputs) => {
        const result = deriveSequentialConfidence(inputs);
        if (result.type !== 'derived') return true; // Skip non-derived results
        return result.calibrationStatus === 'degraded';
      },
      { numRuns, seed }
    );
  });

  it('computeCalibrationStatus returns preserved for all measured/deterministic', () => {
    assertProperty(
      'computeCalibrationStatus preserved',
      (random) => [genMeasured(random), genDeterministic(random)],
      (inputs) => {
        const status = computeCalibrationStatus(inputs);
        return status === 'preserved';
      },
      { numRuns, seed }
    );
  });

  it('computeCalibrationStatus returns degraded with bounded', () => {
    assertProperty(
      'computeCalibrationStatus degraded with bounded',
      (random) => [genMeasured(random), genBounded(random)],
      (inputs) => {
        const status = computeCalibrationStatus(inputs);
        return status === 'degraded';
      },
      { numRuns, seed }
    );
  });

  it('computeCalibrationStatus returns degraded with absent', () => {
    assertProperty(
      'computeCalibrationStatus degraded with absent',
      (random) => [genMeasured(random), genAbsent(random)],
      (inputs) => {
        const status = computeCalibrationStatus(inputs);
        return status === 'degraded';
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// BOUNDARY VALUE PROPERTIES
// ============================================================================

describe('Property: Boundary Values', () => {
  const numRuns = 100;
  const seed = 1234;

  it('andConfidence with boundary values satisfies semilattice laws', () => {
    assertProperty(
      'andConfidence boundary associativity',
      (random) => [
        genBoundaryConfidence(random),
        genBoundaryConfidence(random),
        genBoundaryConfidence(random),
      ] as [ConfidenceValue, ConfidenceValue, ConfidenceValue],
      ([a, b, c]) => {
        const left = andConfidence(andConfidence(a, b), c);
        const right = andConfidence(a, andConfidence(b, c));
        return confidenceEquals(left, right);
      },
      { numRuns, seed }
    );
  });

  it('orConfidence with boundary values satisfies semilattice laws', () => {
    assertProperty(
      'orConfidence boundary associativity',
      (random) => [
        genBoundaryConfidence(random),
        genBoundaryConfidence(random),
        genBoundaryConfidence(random),
      ] as [ConfidenceValue, ConfidenceValue, ConfidenceValue],
      ([a, b, c]) => {
        const left = orConfidence(orConfidence(a, b), c);
        const right = orConfidence(a, orConfidence(b, c));
        return confidenceEquals(left, right);
      },
      { numRuns, seed }
    );
  });

  it('very close values compare correctly', () => {
    assertProperty(
      'close values comparison',
      (random) => {
        const base = 0.5;
        const epsilon1 = (random() - 0.5) * 0.000001;
        const epsilon2 = (random() - 0.5) * 0.000001;
        return [
          measuredConfidence({ datasetId: 'a', sampleSize: 100, accuracy: base + epsilon1, ci95: [0.4, 0.6] }),
          measuredConfidence({ datasetId: 'b', sampleSize: 100, accuracy: base + epsilon2, ci95: [0.4, 0.6] }),
        ] as [ConfidenceValue, ConfidenceValue];
      },
      ([a, b]) => {
        // Both close to 0.5, operations should still satisfy laws
        const andResult = andConfidence(a, b);
        const orResult = orConfidence(a, b);
        const aVal = getNumericValue(a)!;
        const bVal = getNumericValue(b)!;
        const expectedAnd = Math.min(aVal, bVal);
        const expectedOr = Math.max(aVal, bVal);
        return approxEqual(getNumericValue(andResult), expectedAnd) &&
               approxEqual(getNumericValue(orResult), expectedOr);
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// MONOTONICITY PROPERTIES
// ============================================================================

describe('Property: Monotonicity', () => {
  const numRuns = 100;
  const seed = 2345;

  it('andConfidence is monotonic: if a <= b then a AND c <= b AND c', () => {
    assertProperty(
      'andConfidence monotonicity',
      (random) => {
        const val1 = random();
        const val2 = random();
        const [low, high] = val1 < val2 ? [val1, val2] : [val2, val1];
        return {
          a: measuredConfidence({ datasetId: 'a', sampleSize: 100, accuracy: low, ci95: [0, 1] }),
          b: measuredConfidence({ datasetId: 'b', sampleSize: 100, accuracy: high, ci95: [0, 1] }),
          c: genNonAbsentConfidence(random),
        };
      },
      ({ a, b, c }) => {
        const acVal = getNumericValue(andConfidence(a, c));
        const bcVal = getNumericValue(andConfidence(b, c));
        if (acVal === null || bcVal === null) return true;
        return acVal <= bcVal + EPSILON; // a <= b implies a AND c <= b AND c
      },
      { numRuns, seed }
    );
  });

  it('orConfidence is monotonic: if a <= b then a OR c <= b OR c', () => {
    assertProperty(
      'orConfidence monotonicity',
      (random) => {
        const val1 = random();
        const val2 = random();
        const [low, high] = val1 < val2 ? [val1, val2] : [val2, val1];
        return {
          a: measuredConfidence({ datasetId: 'a', sampleSize: 100, accuracy: low, ci95: [0, 1] }),
          b: measuredConfidence({ datasetId: 'b', sampleSize: 100, accuracy: high, ci95: [0, 1] }),
          c: genNonAbsentConfidence(random),
        };
      },
      ({ a, b, c }) => {
        const acVal = getNumericValue(orConfidence(a, c));
        const bcVal = getNumericValue(orConfidence(b, c));
        if (acVal === null || bcVal === null) return true;
        return acVal <= bcVal + EPSILON; // a <= b implies a OR c <= b OR c
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// VALUE RANGE PROPERTIES
// ============================================================================

describe('Property: Value Ranges', () => {
  const numRuns = 100;
  const seed = 3456;

  it('andConfidence result is in [0, 1]', () => {
    assertProperty(
      'andConfidence range',
      genPair,
      ([a, b]) => {
        const result = andConfidence(a, b);
        const val = getNumericValue(result);
        if (val === null) return true;
        return val >= 0 && val <= 1;
      },
      { numRuns, seed }
    );
  });

  it('orConfidence result is in [0, 1]', () => {
    assertProperty(
      'orConfidence range',
      genPair,
      ([a, b]) => {
        const result = orConfidence(a, b);
        const val = getNumericValue(result);
        if (val === null) return true;
        return val >= 0 && val <= 1;
      },
      { numRuns, seed }
    );
  });

  it('sequenceConfidence result is in [0, 1]', () => {
    assertProperty(
      'sequenceConfidence range',
      (random) => genArray(random, 1, 5),
      (inputs) => {
        const result = sequenceConfidence(inputs);
        const val = getNumericValue(result);
        if (val === null) return true;
        return val >= 0 && val <= 1;
      },
      { numRuns, seed }
    );
  });

  it('parallelAllConfidence result is in [0, 1]', () => {
    assertProperty(
      'parallelAllConfidence range',
      (random) => genArray(random, 1, 5),
      (inputs) => {
        const result = parallelAllConfidence(inputs);
        const val = getNumericValue(result);
        if (val === null) return true;
        return val >= 0 && val <= 1;
      },
      { numRuns, seed }
    );
  });

  it('parallelAnyConfidence result is in [0, 1]', () => {
    assertProperty(
      'parallelAnyConfidence range',
      (random) => genArray(random, 1, 5),
      (inputs) => {
        const result = parallelAnyConfidence(inputs);
        const val = getNumericValue(result);
        if (val === null) return true;
        return val >= 0 && val <= 1;
      },
      { numRuns, seed }
    );
  });

  it('andConfidence(a, b) <= min(a, b)', () => {
    assertProperty(
      'andConfidence upper bound',
      genPair,
      ([a, b]) => {
        const result = andConfidence(a, b);
        const resultVal = getNumericValue(result);
        const aVal = getNumericValue(a);
        const bVal = getNumericValue(b);
        if (resultVal === null || aVal === null || bVal === null) return true;
        return resultVal <= Math.min(aVal, bVal) + EPSILON;
      },
      { numRuns, seed }
    );
  });

  it('orConfidence(a, b) >= max(a, b)', () => {
    assertProperty(
      'orConfidence lower bound',
      genPair,
      ([a, b]) => {
        const result = orConfidence(a, b);
        const resultVal = getNumericValue(result);
        const aVal = getNumericValue(a);
        const bVal = getNumericValue(b);
        if (resultVal === null || aVal === null || bVal === null) return true;
        return resultVal >= Math.max(aVal, bVal) - EPSILON;
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// INTEGRATION WITH LAW VERIFICATION FUNCTIONS
// ============================================================================

describe('Property: Integration with checkLaw Functions', () => {
  const numRuns = 50;
  const seed = 4567;

  it('checkAssociativity returns satisfied for andConfidence', () => {
    assertProperty(
      'checkAssociativity for andConfidence',
      (random) => Array.from({ length: 5 }, () => genNonAbsentConfidence(random)),
      (values) => {
        const result = checkAssociativity(andConfidence, values, confidenceEquals);
        return result.satisfied === true;
      },
      { numRuns, seed }
    );
  });

  it('checkCommutativity returns satisfied for andConfidence', () => {
    assertProperty(
      'checkCommutativity for andConfidence',
      (random) => Array.from({ length: 5 }, () => genNonAbsentConfidence(random)),
      (values) => {
        const result = checkCommutativity(andConfidence, values, confidenceEquals);
        return result.satisfied === true;
      },
      { numRuns, seed }
    );
  });

  it('checkIdempotence returns satisfied for andConfidence', () => {
    assertProperty(
      'checkIdempotence for andConfidence',
      (random) => Array.from({ length: 5 }, () => genNonAbsentConfidence(random)),
      (values) => {
        const result = checkIdempotence(andConfidence, values, confidenceEquals);
        return result.satisfied === true;
      },
      { numRuns, seed }
    );
  });

  it('checkIdentity returns satisfied for andConfidence with deterministic(true)', () => {
    const identity = deterministic(true, 'identity');
    assertProperty(
      'checkIdentity for andConfidence',
      (random) => Array.from({ length: 5 }, () => genNonAbsentConfidence(random)),
      (values) => {
        const result = checkIdentity(andConfidence, values, identity, confidenceEquals);
        return result.satisfied === true;
      },
      { numRuns, seed }
    );
  });

  it('checkAbsorption returns satisfied for andConfidence/orConfidence', () => {
    assertProperty(
      'checkAbsorption for and/or',
      (random) => Array.from({ length: 4 }, () => genNonAbsentConfidence(random)),
      (values) => {
        const result = checkAbsorption(andConfidence, orConfidence, values, confidenceEquals);
        return result.satisfied === true;
      },
      { numRuns, seed }
    );
  });
});

// ============================================================================
// MIXED TYPE PROPERTIES
// ============================================================================

describe('Property: Mixed ConfidenceValue Types', () => {
  const numRuns = 100;
  const seed = 5678;

  it('operations preserve semilattice laws across mixed types', () => {
    assertProperty(
      'mixed types associativity',
      (random) => [
        genDeterministic(random),
        genMeasured(random),
        genBounded(random),
      ] as [ConfidenceValue, ConfidenceValue, ConfidenceValue],
      ([a, b, c]) => {
        const left = andConfidence(andConfidence(a, b), c);
        const right = andConfidence(a, andConfidence(b, c));
        return confidenceEquals(left, right);
      },
      { numRuns, seed }
    );
  });

  it('orConfidence works correctly with mixed deterministic/measured', () => {
    assertProperty(
      'orConfidence mixed types',
      (random) => [genDeterministic(random), genMeasured(random)] as [ConfidenceValue, ConfidenceValue],
      ([a, b]) => {
        const result = orConfidence(a, b);
        const aVal = getNumericValue(a)!;
        const bVal = getNumericValue(b)!;
        const expected = Math.max(aVal, bVal);
        return approxEqual(getNumericValue(result), expected);
      },
      { numRuns, seed }
    );
  });
});
