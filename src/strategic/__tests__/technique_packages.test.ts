import { describe, it, expect, vi } from 'vitest';
import { createTechniquePackage } from '../technique_packages.js';

describe('technique packages', () => {
  it('defaults timestamps and optional arrays', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-20T05:00:00.000Z'));

    const pkg = createTechniquePackage({
      id: 'tpkg-core',
      name: 'Core package',
      description: 'Core primitives',
      primitiveIds: ['tp_root_cause'],
    });

    expect(pkg.createdAt).toBe('2026-01-20T05:00:00.000Z');
    expect(pkg.updatedAt).toBe('2026-01-20T05:00:00.000Z');
    expect(pkg.compositionIds).toEqual([]);
    expect(pkg.categories).toEqual([]);
    expect(pkg.domains).toEqual([]);
    expect(pkg.tags).toEqual([]);

    vi.useRealTimers();
  });

  it('preserves explicit arrays', () => {
    const pkg = createTechniquePackage({
      id: 'tpkg-quality',
      name: 'Quality package',
      description: 'Quality primitives',
      primitiveIds: ['tp_assurance_case'],
      compositionIds: ['tc_agentic_review_v1'],
      categories: ['quality'],
      domains: ['quality', 'verification'],
      tags: ['featured'],
    });

    expect(pkg.compositionIds).toEqual(['tc_agentic_review_v1']);
    expect(pkg.categories).toEqual(['quality']);
    expect(pkg.domains).toEqual(['quality', 'verification']);
    expect(pkg.tags).toEqual(['featured']);
  });

  it('trims name and description fields', () => {
    const pkg = createTechniquePackage({
      id: 'tpkg-trim',
      name: '  Trim package  ',
      description: '  Trim description  ',
      primitiveIds: ['tp_root_cause'],
    });

    expect(pkg.name).toBe('Trim package');
    expect(pkg.description).toBe('Trim description');
  });

  it('keeps explicit empty composition arrays', () => {
    const pkg = createTechniquePackage({
      id: 'tpkg-empty',
      name: 'Empty composition package',
      description: 'Explicitly empty compositions',
      primitiveIds: ['tp_root_cause'],
      compositionIds: [],
    });

    expect(pkg.compositionIds).toEqual([]);
  });

  it('rejects invalid package ids and primitive ids', () => {
    expect(() => createTechniquePackage({
      id: 'bad id',
      name: 'Bad package',
      description: 'Bad',
      primitiveIds: ['tp_root_cause'],
    })).toThrow(/invalid_package_id/);

    expect(() => createTechniquePackage({
      id: '---',
      name: 'Bad package',
      description: 'Bad',
      primitiveIds: ['tp_root_cause'],
    })).toThrow(/invalid_package_id/);

    expect(() => createTechniquePackage({
      id: 'tpkg-bad',
      name: 'Bad package',
      description: 'Bad',
      primitiveIds: [],
    })).toThrow(/invalid_package_primitive_id/);

    expect(() => createTechniquePackage({
      id: 'tpkg-bad',
      name: 'Bad package',
      description: 'Bad',
      primitiveIds: ['tp bad'] as string[],
    })).toThrow(/invalid_package_primitive_id/);
  });

  it('rejects duplicate ids in primitive and composition lists', () => {
    expect(() => createTechniquePackage({
      id: 'tpkg-dup',
      name: 'Duplicate primitives',
      description: 'Dup primitives',
      primitiveIds: ['tp_root_cause', 'tp_root_cause'],
    })).toThrow(/duplicate_package_primitive_id/);

    expect(() => createTechniquePackage({
      id: 'tpkg-dup-composition',
      name: 'Duplicate compositions',
      description: 'Dup compositions',
      primitiveIds: ['tp_root_cause'],
      compositionIds: ['tc_agentic_review_v1', 'tc_agentic_review_v1'],
    })).toThrow(/duplicate_package_composition_id/);
  });

  it('rejects empty names and descriptions', () => {
    expect(() => createTechniquePackage({
      id: 'tpkg-bad',
      name: '',
      description: 'Bad',
      primitiveIds: ['tp_root_cause'],
    })).toThrow(/invalid_package_name/);

    expect(() => createTechniquePackage({
      id: 'tpkg-bad',
      name: 'Bad',
      description: '   ',
      primitiveIds: ['tp_root_cause'],
    })).toThrow(/invalid_package_description/);
  });

  it('rejects overly long names and descriptions', () => {
    expect(() => createTechniquePackage({
      id: 'tpkg-bad',
      name: 'a'.repeat(121),
      description: 'Bad',
      primitiveIds: ['tp_root_cause'],
    })).toThrow(/invalid_package_name/);

    expect(() => createTechniquePackage({
      id: 'tpkg-bad',
      name: 'Bad',
      description: 'b'.repeat(501),
      primitiveIds: ['tp_root_cause'],
    })).toThrow(/invalid_package_description/);
  });
});
