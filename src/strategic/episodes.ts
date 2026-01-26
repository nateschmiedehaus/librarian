import type {
  Episode,
  EpisodeActor,
  EpisodeContext,
  EpisodeEvent,
  EpisodeLesson,
  EpisodeOutcome,
  EpisodeType,
} from './building_blocks.js';

export function createEpisode(input: {
  id: string;
  type: EpisodeType;
  context: EpisodeContext;
  actors?: EpisodeActor[];
  events?: EpisodeEvent[];
  outcome: EpisodeOutcome;
  lessons?: EpisodeLesson[];
  timestamp?: Date;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}): Episode {
  return {
    id: input.id,
    timestamp: input.timestamp ?? new Date(),
    type: input.type,
    context: input.context,
    actors: input.actors ?? [],
    events: input.events ?? [],
    outcome: input.outcome,
    lessons: input.lessons ?? [],
    embedding: input.embedding,
    metadata: input.metadata ?? {},
  };
}
