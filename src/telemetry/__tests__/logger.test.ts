import { afterEach, describe, expect, it, vi } from 'vitest';
import { logDebug, logError, logInfo, logWarning } from '../logger.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('telemetry logger', () => {
  const cases = [
    { fn: logInfo, level: 'info' as const, method: 'error' as const },
    { fn: logWarning, level: 'warn' as const, method: 'warn' as const },
    { fn: logError, level: 'error' as const, method: 'error' as const },
    { fn: logDebug, level: 'debug' as const, method: 'error' as const },
  ];

  for (const { fn, level, method } of cases) {
    it(`logs message only for ${level} when context is undefined`, () => {
      const spy = vi.spyOn(console, method).mockImplementation(() => {});

      fn('hello');

      expect(spy).toHaveBeenCalledWith('hello');
    });

    it(`logs message only for ${level} when context is empty`, () => {
      const spy = vi.spyOn(console, method).mockImplementation(() => {});

      fn('hello', {});

      expect(spy).toHaveBeenCalledWith('hello');
    });

    it(`logs message and context for ${level} when context has keys`, () => {
      const spy = vi.spyOn(console, method).mockImplementation(() => {});
      const context = { requestId: 'req-123' };

      fn('hello', context);

      expect(spy).toHaveBeenCalledWith('hello', context);
    });
  }
});
