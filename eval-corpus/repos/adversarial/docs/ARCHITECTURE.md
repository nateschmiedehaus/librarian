# Architecture (Outdated)

The system is built around a queue-first design:

- Events flow into `queue/dispatcher.ts`.
- A `worker/session_archiver.ts` job persists sessions to disk.
- All data access goes through `storage/postgres.ts`.

This document predates the in-memory refactor but is still shipped with the repo.
