/**
 * @fileoverview Hallucination detection heuristic tests.
 */

import { describe, it, expect } from 'vitest';
import { detectHallucinations } from '../hallucination.js';

describe('detectHallucinations', () => {
  it('detects exact must-not-claim matches', () => {
    const result = detectHallucinations({
      claims: ['Deletes accounts', 'Writes to db'],
      mustNotClaim: ['deletes accounts'],
    });

    expect(result.hallucinationCount).toBe(1);
    expect(result.hallucinationRate).toBe(1);
    expect(result.falseClaims).toEqual(['deletes accounts']);
  });

  it('detects overlap matches for longer statements', () => {
    const result = detectHallucinations({
      claims: ['Deletes accounts permanently'],
      mustNotClaim: ['Deletes user accounts permanently'],
    });

    expect(result.hallucinationCount).toBe(1);
    expect(result.falseClaims).toEqual(['deletes user accounts permanently']);
  });

  it('avoids overlap matching for short statements', () => {
    const result = detectHallucinations({
      claims: ['Updates config'],
      mustNotClaim: ['updates cache'],
    });

    expect(result.hallucinationCount).toBe(0);
    expect(result.hallucinationRate).toBe(0);
  });

  it('returns zero when no must-not-claims provided', () => {
    const result = detectHallucinations({
      claims: ['Updates config'],
    });

    expect(result.hallucinationCount).toBe(0);
    expect(result.hallucinationRate).toBe(0);
    expect(result.falseClaims).toEqual([]);
  });
});
