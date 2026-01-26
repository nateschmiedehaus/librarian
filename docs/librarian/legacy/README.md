# Legacy Librarian Docs (Archived)

This folder is **historical**. It is retained for reference, but it may contain **outdated guidance** that conflicts with current Wave0 rules and the active Librarian spec set.

If you are implementing Librarian today, start with:
- `docs/librarian/AGENT_INSTRUCTIONS.md` (authoritative implementation workflow)
- `docs/librarian/STATUS.md` (target vs reality with evidence links)
- `docs/librarian/specs/` (future spec system)
- `docs/TEST.md`, `docs/LIVE_PROVIDERS_PLAYBOOK.md`, `src/EMBEDDING_RULES.md` (non-negotiable testing/provider rules)

## Known Outdated Patterns in Legacy Docs

- API-key based provider examples (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) are **not valid** for Wave0. Wave0 uses **CLI-only auth** and the provider gate (`checkAllProviders()` / `requireProviders()`).
- “Degraded mode” language may be inconsistent. Current policy: **no silent degraded success**; when capabilities/providers are missing, fail-closed with `unverified_by_trace(...)` or skip explicitly in Tier-1.

