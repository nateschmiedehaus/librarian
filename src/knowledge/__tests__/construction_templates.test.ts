import { describe, it, expect } from 'vitest';
import {
  createConstructionTemplateRegistry,
  DEFAULT_TEMPLATE_IDS,
} from '../construction_templates.js';

describe('Construction template registry', () => {
  it('registers the canonical template set within budget', () => {
    const registry = createConstructionTemplateRegistry();
    const templates = registry.listTemplates();
    const ids = templates.map((template) => template.id);

    expect(templates.length).toBe(DEFAULT_TEMPLATE_IDS.length);
    expect(ids).toEqual(DEFAULT_TEMPLATE_IDS);
  });

  it('resolves templates by id', () => {
    const registry = createConstructionTemplateRegistry();
    const template = registry.getConstructionTemplate('T1');

    expect(template?.id).toBe('T1');
    expect(template?.name).toBe('RepoMap');
    expect(template?.requiredObjects).toContain('map');
  });

  it('uses uc mappings when provided', () => {
    const registry = createConstructionTemplateRegistry();
    registry.setUcMappings(new Map([['UC-001', ['T2', 'T3']]]));

    const result = registry.templatesForUc('UC-001');
    expect(result.templateIds).toEqual(['T2', 'T3']);
    expect(result.templates.map((template) => template.id)).toEqual(['T2', 'T3']);
    expect(result.disclosures).toEqual([]);

    const missing = registry.templatesForUc('UC-999');
    expect(missing.templates).toHaveLength(0);
    expect(missing.disclosures[0]).toContain('template_mapping_missing');
  });

  it('falls back to T1 for intent when no resolver exists', () => {
    const registry = createConstructionTemplateRegistry();

    const result = registry.templatesForIntent('give me a repo map');
    expect(result.templateIds).toEqual(['T1']);
    expect(result.templates.map((template) => template.id)).toEqual(['T1']);
    expect(result.disclosures[0]).toContain('intent_template_defaulted');
  });
});
