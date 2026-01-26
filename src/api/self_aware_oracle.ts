export type UndecidabilityClass =
  | 'decidable'
  | 'oracle_dependent'
  | 'formally_undecidable'
  | 'practically_undecidable';

export interface UndecidabilityClassification {
  question: string;
  classification: UndecidabilityClass;
  algorithm?: string;
  oracleRequirements?: string[];
  reduction?: {
    targetProblem: 'halting' | 'rice_theorem' | 'post_correspondence' | 'other';
    proofSketch: string;
  };
  resourceBounds?: {
    timeComplexity: string;
    spaceComplexity: string;
    estimatedForThisCodebase: string;
  };
  enablingConditions?: string[];
}

export interface OracleContextEntity {
  id?: string;
  type?: 'function' | 'module' | 'file' | 'snippet';
  name?: string;
  path?: string;
  content?: string;
}

export interface OracleUncertaintyEstimate {
  confidenceInterval: [number, number];
  calibrationBasis: string;
}

type QuestionIntent =
  | 'termination'
  | 'equivalence'
  | 'complexity'
  | 'existence'
  | 'safety'
  | 'unknown';

type ContextAnalysis = {
  hasLoops: boolean;
  hasRecursion: boolean;
  hasDynamicExec: boolean;
  hasLargeScope: boolean;
};

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;
const MAX_QUESTION_LENGTH = 2000;

export class TuringOracleClassifier {
  async classify(
    question: string,
    codeContext: OracleContextEntity[] = []
  ): Promise<UndecidabilityClassification> {
    const normalized = normalizeQuestion(question);
    if (!normalized) {
      throw new Error('unverified_by_trace(question_invalid)');
    }
    if (normalized.length > MAX_QUESTION_LENGTH) {
      throw new Error('unverified_by_trace(question_too_long)');
    }

    const intent = inferQuestionIntent(normalized);
    const analysis = analyzeContext(codeContext);

    if (intent === 'existence') {
      return {
        question: normalized,
        classification: 'decidable',
        algorithm: 'static scan over the provided code context',
        enablingConditions: [
          'Code context must include all relevant files/modules',
        ],
      };
    }

    if (intent === 'termination') {
      if (analysis.hasLoops || analysis.hasRecursion) {
        return {
          question: normalized,
          classification: 'formally_undecidable',
          reduction: {
            targetProblem: 'halting',
            proofSketch: 'The question reduces to the halting problem when unbounded loops or recursion are present.',
          },
          enablingConditions: [
            'Restrict to bounded loops only',
            'Provide loop invariants or termination metrics',
            'Limit input domain to finite sets',
          ],
        };
      }
      return {
        question: normalized,
        classification: 'oracle_dependent',
        oracleRequirements: [
          'Clarify termination conditions',
          'Provide input constraints or loop invariants',
        ],
        enablingConditions: [
          'Annotate termination proofs or add explicit bounds',
        ],
      };
    }

    if (intent === 'equivalence') {
      if (analysis.hasDynamicExec || analysis.hasLargeScope) {
        return {
          question: normalized,
          classification: 'practically_undecidable',
          resourceBounds: {
            timeComplexity: 'exponential in program size',
            spaceComplexity: 'exponential in program size',
            estimatedForThisCodebase: 'prohibitive for full-program equivalence checks',
          },
          enablingConditions: [
            'Scope to a bounded subset of functions',
            'Provide formal specifications for equivalence',
          ],
        };
      }
      return {
        question: normalized,
        classification: 'oracle_dependent',
        oracleRequirements: [
          'Requires semantic understanding of code paths',
          'Needs domain-specific invariants',
        ],
        enablingConditions: [
          'Provide explicit pre/post-conditions for equivalence',
        ],
      };
    }

    if (intent === 'complexity' || intent === 'safety') {
      return {
        question: normalized,
        classification: 'practically_undecidable',
        resourceBounds: {
          timeComplexity: 'super-polynomial analysis for full precision',
          spaceComplexity: 'super-polynomial analysis for full precision',
          estimatedForThisCodebase: 'requires bounded models or static approximations',
        },
        enablingConditions: [
          'Provide a reduced scope or instrumentation data',
          'Allow approximate bounds',
        ],
      };
    }

    return {
      question: normalized,
      classification: 'oracle_dependent',
      oracleRequirements: [
        'Clarify the question intent or constraints',
        'Provide relevant code context',
      ],
      enablingConditions: [
        'Specify the exact scope and evidence requirements',
      ],
    };
  }

  async estimateOracleUncertainty(question: string): Promise<OracleUncertaintyEstimate> {
    const normalized = normalizeQuestion(question);
    if (!normalized) {
      throw new Error('unverified_by_trace(question_invalid)');
    }
    return {
      confidenceInterval: [0, 1],
      calibrationBasis: 'unverified_by_trace(calibration_missing): placeholder interval',
    };
  }
}

function normalizeQuestion(question: string): string {
  if (typeof question !== 'string') return '';
  return question.replace(CONTROL_CHAR_PATTERN, ' ').trim();
}

function inferQuestionIntent(question: string): QuestionIntent {
  const normalized = question.toLowerCase();
  if (/(terminate|halts?|infinite loop|non[- ]terminating)/.test(normalized)) {
    return 'termination';
  }
  if (/(equivalent|same behavior|preserve semantics|refactor.*preserve)/.test(normalized)) {
    return 'equivalence';
  }
  if (/(time complexity|big[- ]o|worst[- ]case|performance bound)/.test(normalized)) {
    return 'complexity';
  }
  if (/(does .* (exist|contain|include)|is there .* (function|class|file))/.test(normalized)) {
    return 'existence';
  }
  if (/(always|never|guarantee|for all inputs|safety)/.test(normalized)) {
    return 'safety';
  }
  return 'unknown';
}

function analyzeContext(context: OracleContextEntity[]): ContextAnalysis {
  let hasLoops = false;
  let hasRecursion = false;
  let hasDynamicExec = false;
  let hasLargeScope = context.length > 25;

  for (const entity of context) {
    const content = entity.content ?? '';
    const name = entity.name ?? '';
    const normalized = content.toLowerCase();
    if (/\b(while|for|do)\b/.test(normalized)) {
      hasLoops = true;
    }
    if (/\b(eval|new Function|setTimeout|setInterval)\b/.test(normalized)) {
      hasDynamicExec = true;
    }
    if (name && content.includes(name)) {
      hasRecursion = true;
    }
    if (hasLoops && hasRecursion && hasDynamicExec) {
      break;
    }
  }

  return {
    hasLoops,
    hasRecursion,
    hasDynamicExec,
    hasLargeScope,
  };
}
