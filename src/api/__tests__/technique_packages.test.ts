import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TECHNIQUE_PACKAGES,
  listTechniquePackages,
  getTechniquePackage,
  compileTechniquePackageBundleById,
} from '../technique_packages.js';

describe('technique packages', () => {
  it('lists default packages', () => {
    const packages = listTechniquePackages();
    expect(packages.length).toBeGreaterThan(0);
    const ids = packages.map((pkg) => pkg.id);
    expect(ids).toEqual(expect.arrayContaining(['tpkg_core_reasoning', 'tpkg_quality_safety']));
  });

  it('retrieves packages by id', () => {
    const pkg = getTechniquePackage('tpkg_evidence_compliance');
    expect(pkg).toBeTruthy();
    expect(pkg?.primitiveIds.length).toBeGreaterThan(0);
    expect(getTechniquePackage('tpkg_missing')).toBeNull();
    expect(() => getTechniquePackage('tpkg_')).toThrow(/invalid_package_id_query/);
    expect(() => getTechniquePackage('bad-id')).toThrow(/invalid_package_id_query/);
  });

  it('compiles package bundles', () => {
    const bundle = compileTechniquePackageBundleById('tpkg_resilience_ops');
    expect(bundle).toBeTruthy();
    expect(bundle?.missingPrimitiveIds).toEqual([]);
    expect(bundle?.missingCompositionIds).toEqual([]);
    expect(bundle?.primitives.length).toBeGreaterThan(0);
    expect(() => compileTechniquePackageBundleById('bad-id')).toThrow(/invalid_package_id_query/);
  });
});
