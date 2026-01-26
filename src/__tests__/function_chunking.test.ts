/**
 * @fileoverview Tier-0 unit tests for function chunking (no embeddings)
 */

import { describe, it, expect } from 'vitest';
import { parseFileIntoChunks, buildChunkEmbeddingInput } from '../api/embedding_providers/function_chunking.js';

const SAMPLE_CODE = `
export interface UserConfig { name: string; age: number; active: boolean; }
export type UserId = string | number;
export class UserService {
  async getUser(id: UserId): Promise<UserConfig | null> { return null; }
  deleteUser(id: UserId): boolean { return true; }
}
export function validateConfig(config: UserConfig): boolean { return config.age >= 0; }
export const processUsers = async (users: UserConfig[]): Promise<void> => { users.forEach(u => u.name); };
const internalHelper = (x: number): number => x * 2;
`;

describe('Function Chunking (unit)', () => {
  it('extracts interfaces, types, classes, methods, and functions', () => {
    const chunks = parseFileIntoChunks('test.ts', SAMPLE_CODE);

    expect(chunks.some((c) => c.type === 'interface' && c.name === 'UserConfig')).toBe(true);
    expect(chunks.some((c) => c.type === 'type' && c.name === 'UserId')).toBe(true);
    expect(chunks.some((c) => c.type === 'class' && c.name === 'UserService')).toBe(true);

    const methods = chunks.filter((c) => c.type === 'method').map((c) => c.name).sort();
    expect(methods).toEqual(['deleteUser', 'getUser']);

    const functions = chunks.filter((c) => c.type === 'function').map((c) => c.name);
    for (const name of ['validateConfig', 'processUsers', 'internalHelper']) {
      expect(functions).toContain(name);
    }
  });

  it('builds a stable embedding input format for a chunk', () => {
    const chunks = parseFileIntoChunks('test.ts', SAMPLE_CODE);
    const validateConfig = chunks.find((c) => c.name === 'validateConfig');
    expect(validateConfig).toBeDefined();

    const input = buildChunkEmbeddingInput(validateConfig!);
    expect(input).toContain('function: validateConfig');
    expect(input).toContain('File: test.ts');
    expect(input).toContain('Code:');
  });
});
