/**
 * @fileoverview Calibration curve computation from outcome samples (Track F C2).
 *
 * Computes bucketed calibration curves, Expected Calibration Error (ECE),
 * and Maximum Calibration Error (MCE) from outcome data.
 */

export interface CalibrationSample {
  confidence: number;
  outcome: number;
}

export interface CalibrationBucket {
  /** Upper bound for the bucket (e.g., 0.1, 0.2, ..., 1.0) */
  confidenceBucket: number;
  /** Confidence range [min, max) */
  range: [number, number];
  /** Mean stated confidence in this bucket */
  statedMean: number;
  /** Empirical accuracy in this bucket */
  empiricalAccuracy: number;
  /** Number of samples in this bucket */
  sampleSize: number;
  /** Standard error of the empirical accuracy */
  standardError: number;
  /** |statedMean - empiricalAccuracy| */
  calibrationError: number;
}

export interface CalibrationCurve {
  buckets: CalibrationBucket[];
  ece: number;
  mce: number;
  overconfidenceRatio: number;
  sampleSize: number;
}

export interface CalibrationReport {
  datasetId: string;
  computedAt: string;
  calibrationCurve: Map<number, number>;
  expectedCalibrationError: number;
  maximumCalibrationError: number;
  adjustments: Map<string, { raw: number; calibrated: number }>;
  buckets: CalibrationBucket[];
  sampleSize: number;
  overconfidenceRatio: number;
}

export interface CalibrationReportSnapshot {
  id: string;
  datasetId: string;
  computedAt: string;
  expectedCalibrationError: number;
  maximumCalibrationError: number;
  overconfidenceRatio: number;
  sampleSize: number;
  bucketCount: number;
  buckets: CalibrationBucket[];
  calibrationCurve: Array<{ bucket: number; accuracy: number }>;
  adjustments: Array<{ bucket: string; raw: number; calibrated: number }>;
  claimType?: string;
  category?: string;
}

export interface CalibrationCurveOptions {
  bucketCount?: number;
  minConfidence?: number;
  maxConfidence?: number;
}

export interface CalibrationAdjustmentOptions {
  minSamplesForAdjustment?: number;
  minSamplesForFullWeight?: number;
  clamp?: [number, number];
}

export interface CalibrationAdjustmentResult {
  raw: number;
  calibrated: number;
  weight: number;
  bucket?: CalibrationBucket;
}

export function computeCalibrationCurve(
  samples: CalibrationSample[],
  options: CalibrationCurveOptions = {}
): CalibrationCurve {
  const bucketCount = options.bucketCount ?? 10;
  const minConfidence = options.minConfidence ?? 0;
  const maxConfidence = options.maxConfidence ?? 1;

  if (bucketCount <= 0) {
    throw new Error('calibration_bucket_count_invalid');
  }

  const width = (maxConfidence - minConfidence) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const lower = roundTo(minConfidence + index * width, 4);
    const upper = index === bucketCount - 1
      ? roundTo(maxConfidence, 4)
      : roundTo(minConfidence + (index + 1) * width, 4);
    return {
      range: [lower, upper] as [number, number],
      label: upper,
      count: 0,
      sumConfidence: 0,
      sumOutcome: 0,
      sumOutcomeSquares: 0,
    };
  });

  let totalSamples = 0;
  let overconfidenceCount = 0;

  for (const sample of samples) {
    const confidence = clamp(sample.confidence, minConfidence, maxConfidence);
    const outcome = clamp(sample.outcome, 0, 1);
    const bucketIndex = confidence >= maxConfidence
      ? bucketCount - 1
      : Math.min(bucketCount - 1, Math.max(0, Math.floor((confidence - minConfidence) / width)));
    const bucket = buckets[bucketIndex];

    bucket.count += 1;
    bucket.sumConfidence += confidence;
    bucket.sumOutcome += outcome;
    bucket.sumOutcomeSquares += outcome * outcome;
    totalSamples += 1;

    if (confidence > outcome) {
      overconfidenceCount += 1;
    }
  }

  let eceSum = 0;
  let mce = 0;

  const bucketReports: CalibrationBucket[] = buckets.map((bucket) => {
    if (bucket.count === 0) {
      return {
        confidenceBucket: bucket.label,
        range: bucket.range,
        statedMean: 0,
        empiricalAccuracy: 0,
        sampleSize: 0,
        standardError: 0,
        calibrationError: 0,
      };
    }

    const statedMean = bucket.sumConfidence / bucket.count;
    const empiricalAccuracy = bucket.sumOutcome / bucket.count;
    const meanSquare = bucket.sumOutcomeSquares / bucket.count;
    const variance = Math.max(0, meanSquare - empiricalAccuracy * empiricalAccuracy);
    const standardError = Math.sqrt(variance / bucket.count);
    const calibrationError = Math.abs(statedMean - empiricalAccuracy);

    eceSum += bucket.count * calibrationError;
    mce = Math.max(mce, calibrationError);

    return {
      confidenceBucket: bucket.label,
      range: bucket.range,
      statedMean,
      empiricalAccuracy,
      sampleSize: bucket.count,
      standardError,
      calibrationError,
    };
  });

  const ece = totalSamples > 0 ? eceSum / totalSamples : 0;
  const overconfidenceRatio = totalSamples > 0 ? overconfidenceCount / totalSamples : 0;

  return {
    buckets: bucketReports,
    ece,
    mce,
    overconfidenceRatio,
    sampleSize: totalSamples,
  };
}

export function buildCalibrationReport(
  datasetId: string,
  curve: CalibrationCurve,
  computedAt: Date = new Date()
): CalibrationReport {
  const calibrationCurve = new Map<number, number>();
  const adjustments = new Map<string, { raw: number; calibrated: number }>();

  for (const bucket of curve.buckets) {
    calibrationCurve.set(bucket.confidenceBucket, bucket.empiricalAccuracy);
    const range = formatBucketRange(bucket.range);
    adjustments.set(range, { raw: bucket.statedMean, calibrated: bucket.empiricalAccuracy });
  }

  return {
    datasetId,
    computedAt: computedAt.toISOString(),
    calibrationCurve,
    expectedCalibrationError: curve.ece,
    maximumCalibrationError: curve.mce,
    adjustments,
    buckets: curve.buckets,
    sampleSize: curve.sampleSize,
    overconfidenceRatio: curve.overconfidenceRatio,
  };
}

export function snapshotCalibrationReport(
  report: CalibrationReport,
  options: { id: string; bucketCount: number; claimType?: string; category?: string }
): CalibrationReportSnapshot {
  return {
    id: options.id,
    datasetId: report.datasetId,
    computedAt: report.computedAt,
    expectedCalibrationError: report.expectedCalibrationError,
    maximumCalibrationError: report.maximumCalibrationError,
    overconfidenceRatio: report.overconfidenceRatio,
    sampleSize: report.sampleSize,
    bucketCount: options.bucketCount,
    buckets: report.buckets,
    calibrationCurve: Array.from(report.calibrationCurve.entries()).map(([bucket, accuracy]) => ({
      bucket,
      accuracy,
    })),
    adjustments: Array.from(report.adjustments.entries()).map(([bucket, values]) => ({
      bucket,
      raw: values.raw,
      calibrated: values.calibrated,
    })),
    claimType: options.claimType,
    category: options.category,
  };
}

export function restoreCalibrationReport(snapshot: CalibrationReportSnapshot): CalibrationReport {
  const calibrationCurve = new Map<number, number>(
    snapshot.calibrationCurve.map((entry) => [entry.bucket, entry.accuracy])
  );
  const adjustments = new Map<string, { raw: number; calibrated: number }>(
    snapshot.adjustments.map((entry) => [entry.bucket, { raw: entry.raw, calibrated: entry.calibrated }])
  );

  return {
    datasetId: snapshot.datasetId,
    computedAt: snapshot.computedAt,
    calibrationCurve,
    expectedCalibrationError: snapshot.expectedCalibrationError,
    maximumCalibrationError: snapshot.maximumCalibrationError,
    adjustments,
    buckets: snapshot.buckets,
    sampleSize: snapshot.sampleSize,
    overconfidenceRatio: snapshot.overconfidenceRatio,
  };
}

export function adjustConfidenceScore(
  rawConfidence: number,
  report: CalibrationReport,
  options: CalibrationAdjustmentOptions = {}
): CalibrationAdjustmentResult {
  const clampBounds = options.clamp ?? [0, 1];
  const clamped = clamp(rawConfidence, clampBounds[0], clampBounds[1]);
  if (report.buckets.length === 0) {
    return { raw: clamped, calibrated: clamped, weight: 0 };
  }

  const bucket = findBucketForConfidence(report.buckets, clamped);
  if (!bucket) {
    return { raw: clamped, calibrated: clamped, weight: 0 };
  }

  const minSamplesForAdjustment = options.minSamplesForAdjustment ?? 3;
  if (bucket.sampleSize < minSamplesForAdjustment) {
    return { raw: clamped, calibrated: clamped, weight: 0, bucket };
  }

  const minSamplesForFullWeight = options.minSamplesForFullWeight ?? 20;
  const weight = Math.min(1, bucket.sampleSize / minSamplesForFullWeight);
  const calibrated = clamp(
    bucket.empiricalAccuracy * weight + clamped * (1 - weight),
    clampBounds[0],
    clampBounds[1]
  );

  return { raw: clamped, calibrated, weight, bucket };
}

function formatBucketRange(range: [number, number]): string {
  const [low, high] = range;
  return `[${low.toFixed(2)}, ${high.toFixed(2)})`;
}

function findBucketForConfidence(
  buckets: CalibrationBucket[],
  confidence: number
): CalibrationBucket | undefined {
  if (buckets.length === 0) return undefined;
  const lastIndex = buckets.length - 1;
  return buckets.find((bucket, index) => {
    const [min, max] = bucket.range;
    if (index === lastIndex) {
      return confidence >= min && confidence <= max;
    }
    return confidence >= min && confidence < max;
  });
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
