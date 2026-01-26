/**
 * @fileoverview Marked JSON - Re-export from utils
 */
export { extractMarkedJson, createMarkedJson, wrapJsonCodeBlock } from '../utils/marked_json.js';
export type { MarkedJsonResult, ExtractMarkedJsonOptions } from '../utils/marked_json.js';

/**
 * Strip ANSI escape codes from a string
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}
