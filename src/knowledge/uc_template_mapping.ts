/**
 * @fileoverview UC → construction template mapping helpers.
 */

import type { ConstructionTemplateId } from './construction_templates.js';
import { DEFAULT_TEMPLATE_IDS } from './construction_templates.js';
import { loadUcDomainMap, loadDomainTemplateMap } from '../api/construction_plan.js';

export interface UcTemplateMappingResult {
  mapping: Map<string, ConstructionTemplateId[]>;
  disclosures: string[];
}

const validTemplateIds = new Set<ConstructionTemplateId>(DEFAULT_TEMPLATE_IDS);

export async function buildUcTemplateMapping(workspaceRoot: string): Promise<UcTemplateMappingResult> {
  const disclosures: string[] = [];
  const ucDomainMap = await loadUcDomainMap(workspaceRoot);
  const domainTemplateMap = await loadDomainTemplateMap(workspaceRoot);
  const mapping = new Map<string, ConstructionTemplateId[]>();

  for (const [ucId, domain] of ucDomainMap.entries()) {
    if (!domain) {
      disclosures.push(`unverified_by_trace(uc_domain_missing): ${ucId}`);
      mapping.set(ucId, []);
      continue;
    }
    const templates = domainTemplateMap.get(domain) ?? [];
    if (templates.length === 0) {
      disclosures.push(`unverified_by_trace(template_mapping_missing): ${domain}`);
      mapping.set(ucId, []);
      continue;
    }
    const filtered = templates.filter((template) => validTemplateIds.has(template as ConstructionTemplateId)) as ConstructionTemplateId[];
    if (filtered.length !== templates.length) {
      disclosures.push(`unverified_by_trace(template_id_invalid): ${domain}`);
    }
    mapping.set(ucId, filtered);
  }

  return { mapping, disclosures };
}

export function resolveTemplatesForUc(
  ucId: string,
  mapping: Map<string, ConstructionTemplateId[]>
): ConstructionTemplateId[] {
  return mapping.get(ucId) ?? [];
}
