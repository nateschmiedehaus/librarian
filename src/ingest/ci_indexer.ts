import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';
import YAML from 'yaml';
import { getErrorMessage } from '../utils/errors.js';
import type { TaxonomyItem } from '../api/taxonomy.js';
import type { IngestionContext, IngestionItem, IngestionResult, IngestionSource } from './types.js';
import { emptyArray } from '../api/empty_values.js';

export interface CiJobSummary {
  id: string;
  name: string;
  runsOn: string | null;
  needs: string[];
  steps: string[];
}

export interface CiIngestionOptions {
  include?: string[];
  exclude?: string[];
  maxFileBytes?: number;
}

const DEFAULT_CI_GLOBS = [
  '.github/workflows/**/*.{yml,yaml}',
  'Jenkinsfile',
  'azure-pipelines.yml',
  '.gitlab-ci.yml',
];
const DEFAULT_MAX_BYTES = 256_000;
const CI_TAXONOMY: TaxonomyItem[] = [
  'build_pipeline_entrypoints',
  'deployment_pipeline',
  'runtime_entrypoints',
  'performance_budgets',
  'observability_dashboards',
];

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>);
  return emptyArray<string>();
}

function extractJobs(workflow: Record<string, unknown>): CiJobSummary[] {
  const jobs = workflow.jobs && typeof workflow.jobs === 'object' ? workflow.jobs as Record<string, unknown> : {};
  return Object.entries(jobs).map(([id, job]) => {
    const jobObj = job && typeof job === 'object' ? job as Record<string, unknown> : {};
    const steps = Array.isArray(jobObj.steps) ? jobObj.steps.map((step) => {
      if (typeof step === 'string') return step;
      if (step && typeof step === 'object') {
        const stepObj = step as Record<string, unknown>;
        return String(stepObj.name ?? stepObj.uses ?? stepObj.run ?? 'step');
      }
      return 'step';
    }) : [];
    const needsRaw = jobObj.needs;
    const needs = Array.isArray(needsRaw) ? needsRaw.map((entry) => String(entry)) : needsRaw ? [String(needsRaw)] : [];
    return {
      id,
      name: String(jobObj.name ?? id),
      runsOn: jobObj['runs-on'] ? String(jobObj['runs-on']) : null,
      needs,
      steps,
    };
  });
}

function parseWorkflowYaml(content: string): { name: string; triggers: string[]; jobs: CiJobSummary[] } {
  const parsed = YAML.parse(content) as Record<string, unknown>;
  const name = typeof parsed.name === 'string' ? parsed.name : 'workflow';
  const triggers = toArray(parsed.on);
  const jobs = extractJobs(parsed);
  return { name, triggers, jobs };
}

function parseJenkinsfile(content: string): { stages: string[] } {
  const stages: string[] = [];
  const regex = /stage\(['"]([^'"]+)['"]\)/g;
  let match = regex.exec(content);
  while (match) {
    stages.push(match[1] ?? 'stage');
    match = regex.exec(content);
  }
  return { stages };
}

export function createCiIngestionSource(options: CiIngestionOptions = {}): IngestionSource {
  const include = options.include ?? DEFAULT_CI_GLOBS;
  const exclude = options.exclude ?? [];
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_BYTES;

  return {
    type: 'ci',
    version: 'v1',
    validate: (data: unknown) => {
      if (!data || typeof data !== 'object') return false;
      const item = data as { payload?: { path?: string; pipelineType?: string } };
      return typeof item.payload?.path === 'string' && typeof item.payload?.pipelineType === 'string';
    },
    ingest: async (ctx: IngestionContext): Promise<IngestionResult> => {
      const files = await glob(include, { cwd: ctx.workspace, ignore: exclude, absolute: true });
      const items: IngestionItem[] = [];
      const errors: string[] = [];

      for (const filePath of files) {
        let content = '';
        try {
          const stats = await fs.stat(filePath);
          if (stats.size > maxFileBytes) continue;
          content = await fs.readFile(filePath, 'utf8');
        } catch (error: unknown) {
          errors.push(`Failed to read ${filePath}: ${getErrorMessage(error)}`);
          continue;
        }

        const relativePath = path.relative(ctx.workspace, filePath);
        const lower = relativePath.toLowerCase();
        const payload: Record<string, unknown> = {
          path: relativePath,
        };
        let pipelineType = 'ci';

        if (lower.includes('jenkinsfile')) {
          pipelineType = 'jenkins';
          payload.stages = parseJenkinsfile(content).stages;
        } else if (lower.includes('.gitlab-ci')) {
          pipelineType = 'gitlab';
          const parsed = YAML.parse(content) as Record<string, unknown>;
          payload.triggers = toArray(parsed.workflow ?? parsed.only ?? parsed.rules);
          payload.jobs = extractJobs(parsed);
        } else if (lower.includes('azure-pipelines')) {
          pipelineType = 'azure';
          const parsed = YAML.parse(content) as Record<string, unknown>;
          payload.triggers = toArray(parsed.trigger);
          payload.jobs = extractJobs(parsed);
        } else {
          pipelineType = 'github';
          try {
            const workflow = parseWorkflowYaml(content);
            payload.name = workflow.name;
            payload.triggers = workflow.triggers;
            payload.jobs = workflow.jobs;
          } catch (error: unknown) {
            errors.push(`Failed to parse ${filePath}: ${getErrorMessage(error)}`);
          }
        }

        payload.pipelineType = pipelineType;

        items.push({
          id: `ci:${relativePath}`,
          sourceType: 'ci',
          sourceVersion: 'v1',
          ingestedAt: ctx.now(),
          payload,
          metadata: {
            hash: hashContent(content),
            taxonomy: CI_TAXONOMY,
          },
        });
      }

      return { items, errors };
    },
  };
}
