/**
 * @fileoverview Calibration Fixtures with Ground Truth
 *
 * Each fixture has:
 * - query: The question to ask
 * - groundTruth: Objectively correct facts that MUST be in the answer
 * - antiTruth: Facts that should NOT be in the answer (would indicate hallucination)
 * - difficulty: How hard this query is (affects expected confidence)
 */

export interface CalibrationFixture {
  id: string;
  query: string;
  groundTruth: GroundTruthFact[];
  antiTruth?: string[];  // Hallucination indicators
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'function' | 'relationship' | 'architecture' | 'usage';
}

export interface GroundTruthFact {
  fact: string;
  required: boolean;  // Must be present for answer to be "correct"
  patterns: RegExp[]; // Patterns that indicate this fact is present
}

/**
 * Calculator module ground truth.
 * These are OBJECTIVELY VERIFIABLE facts from the source code.
 */
export const CALCULATOR_CALIBRATION_FIXTURES: CalibrationFixture[] = [
  // EASY: Direct function purpose questions
  {
    id: 'calc-divide-purpose',
    query: 'What does the divide function do?',
    groundTruth: [
      {
        fact: 'divide takes two numbers and returns their quotient',
        required: true,
        patterns: [
          /divid(e|es|ing)/i,
          /quotient|result of division/i,
          /a\s*\/\s*b|numerator.*denominator/i,
        ],
      },
      {
        fact: 'divide throws an error when divisor is zero',
        required: true,
        patterns: [
          /zero.*error|error.*zero/i,
          /throw|exception/i,
          /b\s*===?\s*0|divisor.*zero/i,
        ],
      },
      {
        fact: 'divide returns a number type',
        required: false,
        patterns: [
          /return.*number|number.*type/i,
        ],
      },
    ],
    antiTruth: [
      'handles negative numbers specially',  // It doesn't
      'rounds the result',                   // It doesn't
      'returns undefined',                   // It throws, not returns undefined
    ],
    difficulty: 'easy',
    category: 'function',
  },
  {
    id: 'calc-add-purpose',
    query: 'What does the add function do?',
    groundTruth: [
      {
        fact: 'add takes two numbers and returns their sum',
        required: true,
        patterns: [
          /add(s|ing)?.*number/i,
          /sum|addition|a\s*\+\s*b/i,
        ],
      },
    ],
    antiTruth: [
      'validates input',      // It doesn't
      'handles strings',      // It doesn't
    ],
    difficulty: 'easy',
    category: 'function',
  },

  // MEDIUM: Relationship questions
  {
    id: 'calc-average-deps',
    query: 'What functions does average() depend on?',
    groundTruth: [
      {
        fact: 'average depends on add from calculator module',
        required: true,
        patterns: [
          /average.*add|add.*average/i,
          /import.*add|uses.*add/i,
          /calculator.*module/i,
        ],
      },
      {
        fact: 'average uses reduce to sum numbers',
        required: false,
        patterns: [
          /reduce/i,
          /sum.*numbers|numbers.*sum/i,
        ],
      },
    ],
    antiTruth: [
      'depends on multiply',   // It doesn't
      'depends on divide',     // It doesn't
      'depends on subtract',   // It doesn't
    ],
    difficulty: 'medium',
    category: 'relationship',
  },
  {
    id: 'calc-factorial-deps',
    query: 'What functions does factorial() depend on?',
    groundTruth: [
      {
        fact: 'factorial depends on multiply from calculator module',
        required: true,
        patterns: [
          /factorial.*multiply|multiply.*factorial/i,
          /import.*multiply|uses.*multiply/i,
        ],
      },
      {
        fact: 'factorial is recursive',
        required: false,
        patterns: [
          /recursive|recursion|calls itself/i,
        ],
      },
    ],
    antiTruth: [
      'depends on add',       // It doesn't
      'uses a loop',          // It's recursive, not iterative
    ],
    difficulty: 'medium',
    category: 'relationship',
  },

  // MEDIUM: Usage questions
  {
    id: 'calc-api-usage',
    query: 'How do I use the calculate API to add two numbers?',
    groundTruth: [
      {
        fact: 'Call handleCalculate with operation "add"',
        required: true,
        patterns: [
          /handleCalculate/i,
          /operation.*add|add.*operation/i,
        ],
      },
      {
        fact: 'Pass a and b as number properties',
        required: true,
        patterns: [
          /\ba\b.*\bb\b|\bb\b.*\ba\b/i,
          /number|numeric/i,
        ],
      },
    ],
    antiTruth: [
      'call add() directly from API',  // API uses handleCalculate
    ],
    difficulty: 'medium',
    category: 'usage',
  },

  // HARD: Architecture/design questions
  {
    id: 'calc-error-handling',
    query: 'How does error handling work in the calculator module?',
    groundTruth: [
      {
        fact: 'divide throws Error for division by zero',
        required: true,
        patterns: [
          /divide.*throw|throw.*divide/i,
          /zero/i,
          /Error/i,
        ],
      },
      {
        fact: 'factorial throws Error for negative numbers',
        required: true,
        patterns: [
          /factorial.*throw|throw.*factorial/i,
          /negative/i,
        ],
      },
      {
        fact: 'API validates operand types',
        required: false,
        patterns: [
          /valid|type.*check|typeof/i,
        ],
      },
    ],
    antiTruth: [
      'uses try-catch internally',  // Functions throw, don't catch
      'returns null on error',       // They throw, not return null
    ],
    difficulty: 'hard',
    category: 'architecture',
  },
];

/**
 * Evaluate whether an answer is correct given ground truth.
 * Returns a score from 0 to 1.
 */
export function evaluateAnswer(
  answer: string,
  fixture: CalibrationFixture
): CorrectnessResult {
  const answerLower = answer.toLowerCase();

  // Check required facts
  const requiredFacts = fixture.groundTruth.filter(f => f.required);
  const optionalFacts = fixture.groundTruth.filter(f => !f.required);

  let requiredMatched = 0;
  let optionalMatched = 0;
  const matchedFacts: string[] = [];
  const missingFacts: string[] = [];

  for (const fact of requiredFacts) {
    const matched = fact.patterns.some(p => p.test(answer));
    if (matched) {
      requiredMatched++;
      matchedFacts.push(fact.fact);
    } else {
      missingFacts.push(fact.fact);
    }
  }

  for (const fact of optionalFacts) {
    const matched = fact.patterns.some(p => p.test(answer));
    if (matched) {
      optionalMatched++;
      matchedFacts.push(fact.fact);
    }
  }

  // Check for hallucinations (anti-truth)
  const hallucinations: string[] = [];
  if (fixture.antiTruth) {
    for (const anti of fixture.antiTruth) {
      if (answerLower.includes(anti.toLowerCase())) {
        hallucinations.push(anti);
      }
    }
  }

  // Calculate correctness score
  // Required facts: 70% weight
  // Optional facts: 20% weight
  // No hallucinations: 10% weight
  const requiredScore = requiredFacts.length > 0
    ? requiredMatched / requiredFacts.length
    : 1;
  const optionalScore = optionalFacts.length > 0
    ? optionalMatched / optionalFacts.length
    : 1;
  const hallucinationPenalty = hallucinations.length > 0 ? 0 : 1;

  const correctness = (requiredScore * 0.7) + (optionalScore * 0.2) + (hallucinationPenalty * 0.1);

  // Binary correct/incorrect based on required facts
  const isCorrect = requiredMatched === requiredFacts.length && hallucinations.length === 0;

  return {
    isCorrect,
    correctness,
    requiredMatched,
    requiredTotal: requiredFacts.length,
    optionalMatched,
    optionalTotal: optionalFacts.length,
    matchedFacts,
    missingFacts,
    hallucinations,
  };
}

export interface CorrectnessResult {
  isCorrect: boolean;         // Binary: all required facts present, no hallucinations
  correctness: number;        // 0-1 score
  requiredMatched: number;
  requiredTotal: number;
  optionalMatched: number;
  optionalTotal: number;
  matchedFacts: string[];
  missingFacts: string[];
  hallucinations: string[];
}

/**
 * Calculate calibration metrics.
 *
 * A well-calibrated system has:
 * - Predictions with confidence 0.8 should be correct ~80% of the time
 * - Expected Calibration Error (ECE) should be low
 */
export function calculateCalibration(
  predictions: Array<{ confidence: number; isCorrect: boolean }>
): CalibrationMetrics {
  if (predictions.length === 0) {
    return {
      expectedCalibrationError: 0,
      buckets: [],
      overconfident: false,
      underconfident: false,
      meanConfidence: 0,
      accuracy: 0,
    };
  }

  // Bucket predictions by confidence (10 buckets: 0-0.1, 0.1-0.2, etc.)
  const buckets: CalibrationBucket[] = [];
  for (let i = 0; i < 10; i++) {
    const lower = i / 10;
    const upper = (i + 1) / 10;
    const inBucket = predictions.filter(p => p.confidence >= lower && p.confidence < upper);

    if (inBucket.length > 0) {
      const avgConfidence = inBucket.reduce((sum, p) => sum + p.confidence, 0) / inBucket.length;
      const accuracy = inBucket.filter(p => p.isCorrect).length / inBucket.length;

      buckets.push({
        range: `${(lower * 100).toFixed(0)}-${(upper * 100).toFixed(0)}%`,
        count: inBucket.length,
        avgConfidence,
        accuracy,
        gap: Math.abs(avgConfidence - accuracy),
      });
    }
  }

  // Calculate Expected Calibration Error (ECE)
  // ECE = sum over buckets of (bucket_size / total) * |accuracy - confidence|
  const total = predictions.length;
  const ece = buckets.reduce((sum, b) => sum + (b.count / total) * b.gap, 0);

  // Overall metrics
  const meanConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / total;
  const accuracy = predictions.filter(p => p.isCorrect).length / total;

  return {
    expectedCalibrationError: ece,
    buckets,
    overconfident: meanConfidence > accuracy + 0.1,
    underconfident: meanConfidence < accuracy - 0.1,
    meanConfidence,
    accuracy,
  };
}

export interface CalibrationBucket {
  range: string;
  count: number;
  avgConfidence: number;
  accuracy: number;
  gap: number;  // |confidence - accuracy|
}

export interface CalibrationMetrics {
  expectedCalibrationError: number;  // Lower is better, 0 = perfect calibration
  buckets: CalibrationBucket[];
  overconfident: boolean;  // System thinks it's better than it is
  underconfident: boolean; // System undersells itself
  meanConfidence: number;
  accuracy: number;
}
