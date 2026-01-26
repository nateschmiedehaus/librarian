import { describe, it, expect } from 'vitest';
import { DEFAULT_TECHNIQUE_PRIMITIVES } from '../../api/technique_library.js';
import { isConfidenceValue } from '../../epistemics/confidence.js';

describe('technique library confidence', () => {
  it('avoids raw numeric confidence on technique primitives', () => {
    const offenders: string[] = [];

    for (const primitive of DEFAULT_TECHNIQUE_PRIMITIVES) {
      if (primitive.confidence === undefined) continue;

      if (typeof primitive.confidence === 'number') {
        offenders.push(`${primitive.id}:number`);
        continue;
      }

      if (!isConfidenceValue(primitive.confidence)) {
        offenders.push(`${primitive.id}:invalid`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
