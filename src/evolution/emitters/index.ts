/**
 * @fileoverview Emitters Module Index
 *
 * @packageDocumentation
 */

export { BaseEmitter } from './base.js';
export { RetrievalWeightEmitter } from './retrieval_emitter.js';
export { PromptEmitter } from './prompt_emitter.js';
export { EvaluationEmitter } from './evaluation_emitter.js';
export { CodeEmitter } from './code_emitter.js';

import type { Emitter } from '../types.js';
import { RetrievalWeightEmitter } from './retrieval_emitter.js';
import { PromptEmitter } from './prompt_emitter.js';
import { EvaluationEmitter } from './evaluation_emitter.js';
import { CodeEmitter } from './code_emitter.js';

/**
 * Create all default emitters.
 */
export function createDefaultEmitters(): Emitter[] {
  return [
    new RetrievalWeightEmitter(),
    new PromptEmitter(),
    new EvaluationEmitter(),
    new CodeEmitter(),
  ];
}
