import { describe, it, expect } from 'vitest';
import { buildUcTemplateMapping } from '../knowledge/uc_template_mapping.js';
import { DEFAULT_TEMPLATE_IDS } from '../knowledge/construction_templates.js';

describe('UC → template mapping', () => {
  it('maps known UCs to canonical templates', async () => {
    const { mapping } = await buildUcTemplateMapping(process.cwd());
    const templates = mapping.get('UC-001') ?? [];

    expect(mapping.size).toBeGreaterThan(0);
    expect(templates.length).toBeGreaterThan(0);
    for (const templateId of templates) {
      expect(DEFAULT_TEMPLATE_IDS).toContain(templateId);
    }
  });
});
