import { TAXONOMY_ITEMS, type TaxonomyItem, type TaxonomySource } from './taxonomy.js';
import { noResult } from './empty_values.js';

export interface TaxonomyCoverage {
  items_covered: number;
  items_by_source: Record<TaxonomySource, number>;
  coverage_percentage: number;
  gaps: TaxonomyItem[];
}

export interface CoverageReport {
  files_by_parser: Record<string, number>;
  coverage_gaps: string[];
  taxonomy?: TaxonomyCoverage;
}

export class CoverageTracker {
  private filesByParser = new Map<string, number>();
  private coverageGaps = new Set<string>();
  private taxonomySources = new Map<TaxonomyItem, TaxonomySource>();

  recordParser(parserName: string): void {
    if (!parserName) return; const current = this.filesByParser.get(parserName) ?? 0; this.filesByParser.set(parserName, current + 1);
  }

  recordCoverageGap(extension: string | null | undefined): void {
    const pattern = normalizeCoverageGap(extension ?? ''); if (!pattern) return; this.coverageGaps.add(pattern);
  }

  recordTaxonomyCoverage(item: TaxonomyItem, source: TaxonomySource): void {
    if (!item || !source) return; this.taxonomySources.set(item, source);
  }

  buildReport(): CoverageReport {
    const files_by_parser: Record<string, number> = {}; for (const [parser, count] of this.filesByParser.entries()) { files_by_parser[parser] = count; }
    const taxonomy = buildTaxonomyCoverage(this.taxonomySources);
    return { files_by_parser, coverage_gaps: Array.from(this.coverageGaps.values()).sort(), taxonomy };
  }

  reset(): void {
    this.filesByParser.clear(); this.coverageGaps.clear(); this.taxonomySources.clear();
  }
}

function normalizeCoverageGap(extension: string): string | null {
  const trimmed = extension.trim();
  if (!trimmed) return noResult();
  if (trimmed.startsWith('*.')) return trimmed;
  if (trimmed.startsWith('.')) return `*${trimmed}`;
  if (trimmed.includes('*')) return trimmed;
  return `*.${trimmed.replace(/^\./, '')}`;
}

function buildTaxonomyCoverage(sources: Map<TaxonomyItem, TaxonomySource>): TaxonomyCoverage {
  const items_by_source: Record<TaxonomySource, number> = { ast: 0, llm: 0, docs: 0, gap: 0 };
  const gaps: TaxonomyItem[] = [];
  for (const item of TAXONOMY_ITEMS) {
    const source = sources.get(item);
    if (source) items_by_source[source] += 1; else { items_by_source.gap += 1; gaps.push(item); }
  }
  const items_covered = TAXONOMY_ITEMS.length - items_by_source.gap;
  const coverage_percentage = TAXONOMY_ITEMS.length ? (items_covered / TAXONOMY_ITEMS.length) * 100 : 0;
  return { items_covered, items_by_source, coverage_percentage, gaps };
}
