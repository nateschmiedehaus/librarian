# START IMPLEMENTATION

**Give this entire file to Codex to begin fully autonomous implementation.**

---

## Your Mission

Implement the complete Librarian spec system from current state to 100% completion.

**Repository**: `/Volumes/BigSSD4/nathanielschmiedehaus/Documents/software/librarian`

---

## Step 1: Read These Files (In Order)

```
1. AGENTS.md                  — Your permissions (FULL AUTONOMY)
2. CODEX_ORCHESTRATOR.md      — Work units and sub-agent architecture
3. CODEX_FULL_IMPLEMENTATION.md — Detailed implementation phases
4. docs/librarian/STATUS.md   — Current progress state
5. docs/librarian/GATES.json  — Gate status
```

---

## Step 2: Check Current State

```bash
cd /Volumes/BigSSD4/nathanielschmiedehaus/Documents/software/librarian
npm install    # Ensure dependencies
npm test -- --run   # Check baseline
npx tsc --noEmit    # Check types
```

---

## Step 3: Begin Orchestration Loop

1. Identify the first incomplete work unit (see CODEX_ORCHESTRATOR.md)
2. If sub-agents available: spawn up to 3 concurrent sub-agents
3. If sequential: execute work units one by one
4. After each work unit:
   - Verify: tests pass, types compile
   - Update: STATUS.md, GATES.json
   - Continue: next work unit
5. **Do not stop until Full Build Charter is satisfied**

---

## Critical Rules

**NEVER:**
- Ask for permission or human input
- Stop on a blocker (see `docs/librarian/specs/BLOCKER_RESOLUTION.md`)
- Wait between work units
- Summarize and ask "should I continue?"

**ALWAYS:**
- Fix blockers immediately
- Continue to next work unit automatically
- Update tracking after every work unit
- Work until Full Build Charter is complete

---

## Full Build Charter (Definition of Done)

See `docs/librarian/specs/README.md` for complete charter. Key gates:

- All Tier-0 tests pass
- TypeScript compiles
- UC-001...UC-310 map to ≤12 templates
- ≥30 scenario families
- Retrieval Recall >= 80%
- Hallucination Rate < 5%
- STATUS.md reflects verified reality

---

## Begin Now

Read the files listed above and start the orchestration loop.

**You have full autonomy. No permission needed. Continue until done.**
