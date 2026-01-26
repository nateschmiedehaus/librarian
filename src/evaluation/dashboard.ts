/**
 * @fileoverview Quality dashboard builder for evaluation reports.
 */

import type {
  AggregateMetric,
  EvaluationReport,
  MetricType,
} from './harness.js';

export interface DashboardSummary {
  totalCases: number;
  suiteCount: number;
  qualityGrade?: EvaluationReport['summary']['qualityGrade'];
  qualityScore?: number;
  findings?: string[];
  recommendations?: string[];
}

export type MetricAggregateMap = Partial<Record<MetricType, AggregateMetric>>;

export interface QualityDashboard {
  summary: DashboardSummary;
  metrics: {
    retrieval: MetricAggregateMap | null;
    synthesis: MetricAggregateMap | null;
    citation: MetricAggregateMap | null;
    hallucination: MetricAggregateMap | null;
  };
  slices: Record<string, { metrics: MetricAggregateMap }>;
  markdown?: string;
}

export function buildQualityDashboard(
  report: EvaluationReport,
  opts: { includeMarkdown?: boolean } = {}
): QualityDashboard {
  const totalCases = report.queryCount ?? report.queryResults.length ?? 0;
  const suiteCount = Object.keys(report.byTag ?? {}).length;

  const summary: DashboardSummary = {
    totalCases,
    suiteCount,
    qualityGrade: report.summary?.qualityGrade,
    qualityScore: report.summary?.qualityScore,
    findings: report.summary?.findings,
    recommendations: report.summary?.recommendations,
  };

  const metrics = {
    retrieval: report.aggregateMetrics ? { ...report.aggregateMetrics } : null,
    synthesis: null,
    citation: null,
    hallucination: null,
  };

  const slices: QualityDashboard['slices'] = {};
  if (report.byTag) {
    for (const [tag, tagMetrics] of Object.entries(report.byTag)) {
      slices[tag] = { metrics: { ...tagMetrics } };
    }
  }

  const dashboard: QualityDashboard = {
    summary,
    metrics,
    slices,
  };

  if (opts.includeMarkdown) {
    dashboard.markdown = renderQualityDashboardMarkdown(dashboard);
  }

  return dashboard;
}

export function renderQualityDashboardMarkdown(dashboard: QualityDashboard): string {
  const lines: string[] = [];
  lines.push('# Quality Dashboard', '');
  lines.push('## Summary');
  lines.push(`- Total cases: ${dashboard.summary.totalCases}`);
  lines.push(`- Suite count: ${dashboard.summary.suiteCount}`);

  if (dashboard.summary.qualityGrade) {
    lines.push(`- Quality grade: ${dashboard.summary.qualityGrade}`);
  }
  if (typeof dashboard.summary.qualityScore === 'number') {
    lines.push(`- Quality score: ${dashboard.summary.qualityScore}`);
  }

  const retrievalMetrics = dashboard.metrics.retrieval;
  if (retrievalMetrics && Object.keys(retrievalMetrics).length > 0) {
    lines.push('', '## Metrics', '### Retrieval');
    for (const [metric, aggregate] of Object.entries(retrievalMetrics)) {
      const value = aggregate?.mean;
      const formatted = typeof value === 'number' ? value.toFixed(3) : 'n/a';
      lines.push(`- ${metric}: ${formatted}`);
    }
  }

  const suiteEntries = Object.entries(dashboard.slices);
  if (suiteEntries.length > 0) {
    lines.push('', '## Suites');
    for (const [suite, slice] of suiteEntries) {
      const metricSummary = summarizeMetrics(slice.metrics);
      lines.push(`- ${suite}: ${metricSummary}`);
    }
  }

  return lines.join('\n');
}

function summarizeMetrics(metrics: MetricAggregateMap): string {
  const entries = Object.entries(metrics);
  if (entries.length === 0) return 'no metrics';
  return entries
    .map(([metric, aggregate]) => {
      const value = aggregate?.mean;
      const formatted = typeof value === 'number' ? value.toFixed(3) : 'n/a';
      return `${metric}=${formatted}`;
    })
    .join(', ');
}
