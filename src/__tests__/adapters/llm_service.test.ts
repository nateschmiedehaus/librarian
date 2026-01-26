import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmChatOptions, LlmProviderHealth } from '../../adapters/llm_service.js';

const chatSpy = vi.fn(async (options: LlmChatOptions) => ({
  content: `mock-${options.provider}`,
  provider: options.provider,
}));
const claudeHealthSpy = vi.fn(async (): Promise<LlmProviderHealth> => ({
  provider: 'claude',
  available: true,
  authenticated: true,
  lastCheck: 1000,
}));
const codexHealthSpy = vi.fn(async (): Promise<LlmProviderHealth> => ({
  provider: 'codex',
  available: true,
  authenticated: true,
  lastCheck: 1000,
}));

import {
  clearDefaultLlmServiceFactory,
  clearLlmServiceAdapter,
  createDefaultLlmServiceAdapter,
  getLlmServiceAdapter,
  registerLlmServiceAdapter,
  requireLlmServiceAdapter,
  setDefaultLlmServiceFactory,
  withLlmServiceAdapter,
  type LlmServiceAdapter,
} from '../../adapters/llm_service.js';

const stubAdapter: LlmServiceAdapter = {
  chat: async () => ({ content: 'ok', provider: 'claude' }),
  checkClaudeHealth: async () => ({
    provider: 'claude',
    available: true,
    authenticated: true,
    lastCheck: 1000,
  }),
  checkCodexHealth: async () => ({
    provider: 'codex',
    available: true,
    authenticated: true,
    lastCheck: 1000,
  }),
};

const delay = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  clearLlmServiceAdapter();
  clearDefaultLlmServiceFactory();
});

beforeEach(() => {
  chatSpy.mockClear();
  claudeHealthSpy.mockClear();
  codexHealthSpy.mockClear();
});

const createMockService = () => ({
  chat: chatSpy,
  checkClaudeHealth: claudeHealthSpy,
  checkCodexHealth: codexHealthSpy,
});

describe('llm service adapter registry', () => {
  it('throws when no adapter is registered', () => {
    clearLlmServiceAdapter();
    expect(() => requireLlmServiceAdapter()).toThrow(/llm_adapter_unregistered/);
  });

  it('returns the registered adapter', () => {
    registerLlmServiceAdapter(stubAdapter);
    expect(requireLlmServiceAdapter()).toBe(stubAdapter);
  });

  it('rejects re-registration without force', () => {
    registerLlmServiceAdapter(stubAdapter);
    expect(() => registerLlmServiceAdapter(stubAdapter)).toThrow(/already_registered/);
  });

  it('allows re-registration with force', () => {
    registerLlmServiceAdapter(stubAdapter);
    const replacement: LlmServiceAdapter = {
      chat: async () => ({ content: 'ok', provider: 'codex' }),
      checkClaudeHealth: stubAdapter.checkClaudeHealth,
      checkCodexHealth: stubAdapter.checkCodexHealth,
    };
    registerLlmServiceAdapter(replacement, { force: true });
    expect(requireLlmServiceAdapter()).toBe(replacement);
  });

  it('returns null from get when unregistered', () => {
    clearLlmServiceAdapter();
    expect(getLlmServiceAdapter()).toBeNull();
  });
});

describe('llm service adapter validation', () => {
  const invalidAdapters: Array<{ label: string; value: unknown }> = [
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'empty object', value: {} },
    { label: 'missing health checks', value: { chat: async () => ({ content: 'ok', provider: 'claude' }) } },
    {
      label: 'non-function chat',
      value: {
        chat: 'nope',
        checkClaudeHealth: async () => ({
          provider: 'claude',
          available: true,
          authenticated: true,
          lastCheck: 1000,
        }),
        checkCodexHealth: async () => ({
          provider: 'codex',
          available: true,
          authenticated: true,
          lastCheck: 1000,
        }),
      },
    },
  ];

  for (const { label, value } of invalidAdapters) {
    it(`rejects invalid adapter (${label})`, () => {
      expect(() => registerLlmServiceAdapter(value as LlmServiceAdapter)).toThrow(/llm_adapter_invalid/);
    });
  }

  it('rejects invalid adapters in scoped usage', () => {
    expect(() =>
      withLlmServiceAdapter({} as LlmServiceAdapter, () => {
        throw new Error('should_not_run');
      })
    ).toThrow(/llm_adapter_invalid/);
  });
});

describe('llm service adapter execution', () => {
  it('fails when the default factory is missing', async () => {
    const adapter = createDefaultLlmServiceAdapter();
    const options: LlmChatOptions = {
      provider: 'claude',
      modelId: 'test-model',
      messages: [{ role: 'user', content: 'hello' }],
    };
    await expect(adapter.chat(options)).rejects.toThrow(/llm_adapter_unavailable/);
  });

  it('delegates through the default adapter', async () => {
    setDefaultLlmServiceFactory(async () => createMockService());
    const adapter = createDefaultLlmServiceAdapter();
    const options: LlmChatOptions = {
      provider: 'claude',
      modelId: 'test-model',
      messages: [{ role: 'user', content: 'hello' }],
    };
    const response = await adapter.chat(options);
    expect(response.content).toBe('mock-claude');
    expect(chatSpy).toHaveBeenCalledTimes(1);
    await adapter.checkClaudeHealth();
    await adapter.checkCodexHealth();
    expect(claudeHealthSpy).toHaveBeenCalledTimes(1);
    expect(codexHealthSpy).toHaveBeenCalledTimes(1);
  });

  it('propagates adapter errors', async () => {
    const failingAdapter: LlmServiceAdapter = {
      chat: async () => {
        throw new Error('api_down');
      },
      checkClaudeHealth: stubAdapter.checkClaudeHealth,
      checkCodexHealth: stubAdapter.checkCodexHealth,
    };
    await expect(withLlmServiceAdapter(failingAdapter, async () => {
      const options: LlmChatOptions = {
        provider: 'claude',
        modelId: 'test-model',
        messages: [{ role: 'user', content: 'hello' }],
      };
      await requireLlmServiceAdapter().chat(options);
    })).rejects.toThrow('api_down');
  });

  it('prefers scoped adapters over global registration', async () => {
    registerLlmServiceAdapter(stubAdapter);
    const scoped: LlmServiceAdapter = {
      chat: async () => ({ content: 'scoped', provider: 'codex' }),
      checkClaudeHealth: stubAdapter.checkClaudeHealth,
      checkCodexHealth: stubAdapter.checkCodexHealth,
    };
    await withLlmServiceAdapter(scoped, async () => {
      await delay();
      expect(requireLlmServiceAdapter()).toBe(scoped);
    });
    expect(requireLlmServiceAdapter()).toBe(stubAdapter);
  });

  it('supports nested scopes', async () => {
    const outer: LlmServiceAdapter = {
      chat: async () => ({ content: 'outer', provider: 'claude' }),
      checkClaudeHealth: stubAdapter.checkClaudeHealth,
      checkCodexHealth: stubAdapter.checkCodexHealth,
    };
    const inner: LlmServiceAdapter = {
      chat: async () => ({ content: 'inner', provider: 'codex' }),
      checkClaudeHealth: stubAdapter.checkClaudeHealth,
      checkCodexHealth: stubAdapter.checkCodexHealth,
    };
    await withLlmServiceAdapter(outer, async () => {
      expect(requireLlmServiceAdapter()).toBe(outer);
      await withLlmServiceAdapter(inner, async () => {
        await delay();
        expect(requireLlmServiceAdapter()).toBe(inner);
      });
      expect(requireLlmServiceAdapter()).toBe(outer);
    });
  });

  it('isolates concurrent scopes', async () => {
    const adapterA: LlmServiceAdapter = {
      chat: async () => ({ content: 'a', provider: 'claude' }),
      checkClaudeHealth: stubAdapter.checkClaudeHealth,
      checkCodexHealth: stubAdapter.checkCodexHealth,
    };
    const adapterB: LlmServiceAdapter = {
      chat: async () => ({ content: 'b', provider: 'codex' }),
      checkClaudeHealth: stubAdapter.checkClaudeHealth,
      checkCodexHealth: stubAdapter.checkCodexHealth,
    };
    const [aOk, bOk] = await Promise.all([
      withLlmServiceAdapter(adapterA, async () => {
        await delay();
        return requireLlmServiceAdapter() === adapterA;
      }),
      withLlmServiceAdapter(adapterB, async () => {
        await delay();
        return requireLlmServiceAdapter() === adapterB;
      }),
    ]);
    expect(aOk).toBe(true);
    expect(bOk).toBe(true);
  });
});
