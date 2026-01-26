import { describe, it, expect, vi } from 'vitest';
import { createEpisode } from '../episodes.js';

describe('createEpisode', () => {
  it('defaults timestamp and arrays', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T04:00:00.000Z'));

    const episode = createEpisode({
      id: 'ep-1',
      type: 'task_execution',
      context: { environment: 'test', state: {} },
      outcome: { success: true, duration: 10 },
    });

    expect(episode.timestamp.toISOString()).toBe('2026-01-19T04:00:00.000Z');
    expect(episode.actors).toEqual([]);
    expect(episode.events).toEqual([]);
    expect(episode.lessons).toEqual([]);
    expect(episode.metadata).toEqual({});

    vi.useRealTimers();
  });
});
