/**
 * @fileoverview Simple test to verify TDD module exports are accessible
 */
import { describe, it, expect } from 'vitest';
import {
  TddEngine,
  TDD_SCHOOLS,
  TDD_PRESETS,
  ADVANCED_TDD_TECHNIQUES,
  AI_TESTING_CAPABILITIES,
  SHIFT_LEFT_TECHNIQUES,
  FORMAL_VERIFICATION_TECHNIQUES,
  QAOPS_PATTERNS,
  EMERGING_PARADIGMS,
  INDUSTRY_BENCHMARKS,
} from '../index.js';

describe('TDD Module Exports', () => {
  it('should export TddEngine class', () => {
    expect(TddEngine).toBeDefined();
    expect(typeof TddEngine).toBe('function');
  });

  it('should export TDD_SCHOOLS with all three schools', () => {
    expect(TDD_SCHOOLS).toBeDefined();
    expect(TDD_SCHOOLS.london).toBeDefined();
    expect(TDD_SCHOOLS.chicago).toBeDefined();
    expect(TDD_SCHOOLS.detroit).toBeDefined();
    expect(TDD_SCHOOLS.london.name).toBe('London School');
    expect(TDD_SCHOOLS.chicago.name).toBe('Chicago School');
    expect(TDD_SCHOOLS.detroit.name).toBe('Detroit School');
    // Each school should have the core properties
    expect(TDD_SCHOOLS.london).toHaveProperty('philosophy');
    expect(TDD_SCHOOLS.london).toHaveProperty('keyPrinciples');
  });

  it('should export TDD_PRESETS with world-class configurations', () => {
    expect(TDD_PRESETS).toBeDefined();
    expect(Object.keys(TDD_PRESETS)).toContain('google');
    expect(Object.keys(TDD_PRESETS)).toContain('microsoft');
    expect(Object.keys(TDD_PRESETS)).toContain('netflix');
    expect(Object.keys(TDD_PRESETS)).toContain('spotify');
    expect(Object.keys(TDD_PRESETS)).toContain('thoughtworks');
    expect(Object.keys(TDD_PRESETS)).toContain('facebook');
    expect(Object.keys(TDD_PRESETS)).toContain('amazon');
  });

  it('should export ADVANCED_TDD_TECHNIQUES array', () => {
    expect(Array.isArray(ADVANCED_TDD_TECHNIQUES)).toBe(true);
    expect(ADVANCED_TDD_TECHNIQUES.length).toBeGreaterThan(10);
    expect(ADVANCED_TDD_TECHNIQUES[0]).toHaveProperty('name');
    expect(ADVANCED_TDD_TECHNIQUES[0]).toHaveProperty('description');
    expect(ADVANCED_TDD_TECHNIQUES[0]).toHaveProperty('howTo');
  });

  it('should export AI_TESTING_CAPABILITIES from research', () => {
    expect(Array.isArray(AI_TESTING_CAPABILITIES)).toBe(true);
    expect(AI_TESTING_CAPABILITIES.length).toBeGreaterThan(0);
    expect(AI_TESTING_CAPABILITIES[0]).toHaveProperty('name');
    expect(AI_TESTING_CAPABILITIES[0]).toHaveProperty('maturityLevel');
  });

  it('should export SHIFT_LEFT_TECHNIQUES', () => {
    expect(Array.isArray(SHIFT_LEFT_TECHNIQUES)).toBe(true);
    expect(SHIFT_LEFT_TECHNIQUES.length).toBeGreaterThan(0);
  });

  it('should export FORMAL_VERIFICATION_TECHNIQUES', () => {
    expect(Array.isArray(FORMAL_VERIFICATION_TECHNIQUES)).toBe(true);
    expect(FORMAL_VERIFICATION_TECHNIQUES.length).toBeGreaterThan(0);
  });

  it('should export QAOPS_PATTERNS', () => {
    expect(Array.isArray(QAOPS_PATTERNS)).toBe(true);
    expect(QAOPS_PATTERNS.length).toBeGreaterThan(0);
  });

  it('should export EMERGING_PARADIGMS', () => {
    expect(Array.isArray(EMERGING_PARADIGMS)).toBe(true);
    expect(EMERGING_PARADIGMS.length).toBeGreaterThan(0);
    expect(EMERGING_PARADIGMS[0]).toHaveProperty('name');
  });

  it('should export INDUSTRY_BENCHMARKS array', () => {
    expect(Array.isArray(INDUSTRY_BENCHMARKS)).toBe(true);
    expect(INDUSTRY_BENCHMARKS.length).toBeGreaterThan(0);
    expect(INDUSTRY_BENCHMARKS[0]).toHaveProperty('metric');
    expect(INDUSTRY_BENCHMARKS[0]).toHaveProperty('industry');
    expect(INDUSTRY_BENCHMARKS[0]).toHaveProperty('topQuartile');
  });
});
