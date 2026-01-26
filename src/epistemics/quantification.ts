export type QuantificationSource =
  | { type: 'derived'; formula: string; inputs: string[] }
  | { type: 'calibrated'; datasetId: string; sampleSize: number; measuredValue: number }
  | { type: 'configurable'; default: number; range: [number, number]; rationale: string }
  | { type: 'placeholder'; trackedIn: string; targetCalibrationDate?: string };

export interface QuantifiedValue {
  value: number;
  source: QuantificationSource;
  uncalibratedWarning?: string;
}

export type QuantifiedValueLike = number | QuantifiedValue;

export function isQuantifiedValue(value: unknown): value is QuantifiedValue {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { value?: unknown; source?: { type?: unknown } };
  return typeof candidate.value === 'number' && typeof candidate.source?.type === 'string';
}

export function resolveQuantifiedValue(value: QuantifiedValueLike): number {
  return isQuantifiedValue(value) ? value.value : value;
}

export function placeholder(
  value: number,
  trackedIn: string,
  options: { targetCalibrationDate?: string; warning?: string } = {}
): QuantifiedValue {
  if (!Number.isFinite(value)) {
    throw new Error('unverified_by_trace(quantified_value_invalid)');
  }
  const warning = options.warning ?? `UNCALIBRATED: tracked in ${trackedIn}`;
  return {
    value,
    source: {
      type: 'placeholder',
      trackedIn,
      targetCalibrationDate: options.targetCalibrationDate,
    },
    uncalibratedWarning: warning,
  };
}

export function configurable(
  defaultValue: number,
  range: [number, number],
  rationale: string
): QuantifiedValue {
  if (!Number.isFinite(defaultValue)) {
    throw new Error('unverified_by_trace(quantified_value_invalid)');
  }
  if (!Array.isArray(range) || range.length !== 2) {
    throw new Error('unverified_by_trace(quantified_range_invalid)');
  }
  const [min, max] = range;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new Error('unverified_by_trace(quantified_range_invalid)');
  }
  if (defaultValue < min || defaultValue > max) {
    throw new Error('unverified_by_trace(quantified_range_invalid)');
  }
  return {
    value: defaultValue,
    source: {
      type: 'configurable',
      default: defaultValue,
      range,
      rationale,
    },
  };
}

export function calibrated(
  datasetId: string,
  measuredValue: number,
  sampleSize: number
): QuantifiedValue {
  if (!Number.isFinite(measuredValue)) {
    throw new Error('unverified_by_trace(quantified_value_invalid)');
  }
  if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
    throw new Error('unverified_by_trace(quantified_sample_invalid)');
  }
  return {
    value: measuredValue,
    source: {
      type: 'calibrated',
      datasetId,
      sampleSize,
      measuredValue,
    },
  };
}

export function derived(
  value: number,
  formula: string,
  inputs: string[]
): QuantifiedValue {
  if (!Number.isFinite(value)) {
    throw new Error('unverified_by_trace(quantified_value_invalid)');
  }
  return {
    value,
    source: {
      type: 'derived',
      formula,
      inputs,
    },
  };
}
