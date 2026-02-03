# WU-META-001: Librarian Utility Analysis

> **Purpose**: Analyze whether Librarian is actually useful for agents working on codebases
> **Date**: 2026-01-30
> **Status**: Analysis Complete - Recommendations Pending Implementation

---

## Executive Summary

**Finding**: Librarian has sophisticated infrastructure but **significant utility gaps** prevent it from being genuinely useful for agent work today.

The fundamental question: *If a repo has been bootstrapped with Librarian, but agents don't use it to significantly improve their epistemic, cognitive, and organizational foundations, then Librarian provides no value.*

**Current State**:
- ✅ Rich infrastructure: 7,381 functions indexed, 5,000 context packs, 8,608 embeddings
- ✅ Comprehensive APIs: Query, bootstrap, context enrichment
- ⚠️ **Gap**: Agents don't automatically use Librarian (no integration with Claude Code, Codex, etc.)
- ⚠️ **Gap**: Meta-queries return code, not guidance (see Section 3)
- ⚠️ **Gap**: Documentation not indexed as first-class knowledge
- ⚠️ **Gap**: No "agent onboarding" flow that happens automatically
- ❌ **Critical**: Librarian doesn't improve THIS session's work (circular failure)

---

## 1. Infrastructure Assessment

### What Exists (Theory)

| Component | Status | Purpose |
|-----------|--------|---------|
| Bootstrap | ✅ Working | Indexes codebase: 1,242 files, 7,381 functions |
| Embeddings | ✅ Working | 8,608 vectors for semantic search |
| Context Packs | ✅ Working | 5,000 pre-computed context bundles |
| Query API | ✅ Working | L0-L3 depth levels, multi-signal scoring |
| Agent Integration | ✅ Defined | `ensureLibrarianReady`, `enrichTaskContext`, `recordTaskOutcome` |
| CLI | ✅ Working | 22 commands available |
| Self-Improvement | ✅ Defined | Homeostatic healing, evolutionary improvement |
| Calibration | ✅ Working | Confidence tracking, ECE measurement |

### What's Actually Used (Practice)

| Integration | Status | Notes |
|-------------|--------|-------|
| Claude Code using Librarian | ❌ None | This session doesn't query Librarian |
| Codex using Librarian | ❌ None | No automatic integration |
| Agent Instructions | ⚠️ Passive | AGENTS.md exists but isn't enforced |
| Automatic bootstrap check | ❌ None | Agents start cold without Librarian context |
| Feedback loop | ❌ None | No `recordTaskOutcome` calls happen |

---

## 2. Utility Gap Analysis

### The Core Problem

Librarian is designed as a **perception layer** for agents, but agents don't perceive through it:

```
INTENDED FLOW:
Agent → Query Librarian → Get Context → Make Decision → Record Outcome
         ↑                                                      ↓
         ←←←←←←←←←←←←←← Feedback Loop ←←←←←←←←←←←←←←←←←←←←←←←←

ACTUAL FLOW:
Agent → Read Files Directly → Make Decision → No Feedback
(Librarian sits unused)
```

### Why This Matters

Without Librarian integration:
1. **Epistemic Loss**: Agent lacks calibrated confidence scores
2. **Cognitive Loss**: Agent re-discovers patterns already indexed
3. **Organizational Loss**: Agent doesn't benefit from ADRs, ownership data
4. **Learning Loss**: No outcome tracking means no improvement over time

### Evidence: Live Query Test

Query: `"How should an agent use Librarian?"`

**Expected**: Integration documentation, `ensureLibrarianReady` API, workflow guidance

**Actual Results** (41.7s latency):
```
1. createProvAgent() - PROV record creation (irrelevant)
2. getStorage() - Storage backend access (low-level)
3. getAgentsByCapability() - Agent registry (somewhat relevant)
4. getLearnedRecommendations() - Learning API (relevant)
5. createMockStorage() - Test helper (irrelevant)
6. createLibrarianEngineToolkit() - Engine factory (low-level)
```

**Diagnosis**:
- ❌ Returned code functions, not documentation
- ❌ Didn't find `ensureLibrarianReady`, `enrichTaskContext`
- ❌ Didn't return AGENTS.md or AGENT_INTEGRATION.md
- ❌ 41.7s latency too slow for interactive use
- ⚠️ Results matched "agent" keyword, not semantic intent

---

## 3. Specific Utility Gaps

### Gap 1: No Automatic Agent Onboarding

**Problem**: When an agent (Claude Code, Codex) starts a session, Librarian isn't consulted.

**Impact**: Agent works "cold" without:
- Codebase architecture understanding
- Recent change context
- Ownership information
- Known patterns and anti-patterns
- Prior decisions (ADRs)

**Recommendation**: Create automatic integration hooks:
```typescript
// In agent startup (e.g., Claude Code's init)
const context = await enrichTaskContext(workspace, {
  intent: userQuery,
  taskType: detectTaskType(userQuery),
});
// Inject context into agent's system prompt
```

### Gap 2: Documentation Not Indexed as Knowledge

**Problem**: Librarian indexes code but treats docs as secondary.

**Evidence**: Query for "How should an agent use Librarian?" didn't return:
- `AGENTS.md` (agent instructions)
- `docs/librarian/AGENT_INTEGRATION.md` (integration guide)
- `docs/librarian/AGENT_INSTRUCTIONS.md` (implementation guide)

**Recommendation**: Treat markdown docs as first-class entities:
```typescript
// Index docs with same rigor as code
await indexDocumentation({
  paths: ['AGENTS.md', 'docs/**/*.md'],
  entityType: 'documentation',
  generateEmbeddings: true,
});
```

### Gap 3: No Feedback Loop Implementation

**Problem**: `recordTaskOutcome` exists but nothing calls it.

**Impact**:
- No learning from successes/failures
- Calibration data never accumulates
- Recommendations don't improve

**Recommendation**: Instrument agent tool calls:
```typescript
// After every tool call that modifies code
await recordTaskOutcome(librarian, {
  taskId: toolCall.id,
  outcome: toolCall.success ? 'success' : 'failure',
  filesModified: toolCall.affectedFiles,
  packIdsUsed: contextUsed.packIds,
});
```

### Gap 4: Query Latency Too High

**Problem**: 41.7 seconds for a simple query.

**Impact**: Agents can't use Librarian interactively.

**Analysis**:
- Embedding model load: ~2-3s
- LLM synthesis: ~30s (main bottleneck)
- Multi-signal scoring: ~5s

**Recommendation**:
1. Pre-warm embedding model at session start
2. Cache synthesis results aggressively
3. Offer "fast" mode without LLM synthesis:
```bash
librarian query "intent" --fast  # Skip LLM, return raw packs
```

### Gap 5: No "Librarian Awareness" in Agent Prompts

**Problem**: Even when Librarian is available, agent prompts don't mention it.

**Evidence**: AGENTS.md includes Librarian docs, but:
- Claude Code's system prompt doesn't include Librarian usage
- No automatic context injection happens
- Agent must manually decide to query

**Recommendation**: Add to agent system prompts:
```
This repository has Librarian available. Before implementing:
1. Query: librarian query "<your intent>" --depth L1
2. Use the context packs in your implementation
3. Check confidence scores before making claims
```

---

## 4. Recommendations

### Immediate (This Session)

1. **Add Librarian query to my workflow**: Before implementing tasks, query Librarian first
2. **Index documentation**: Run `librarian index docs/**/*.md --force`
3. **Enable watch mode**: `librarian watch` for continuous updates

### Short-Term (Next Sprint)

1. **Create agent integration package**:
   - `@librarian/claude-code` - Auto-inject context into Claude Code
   - `@librarian/codex` - Codex integration

2. **Add fast query mode**:
   - Skip LLM synthesis for speed
   - Return raw context packs
   - Sub-second latency target

3. **Implement feedback hooks**:
   - Instrument tool calls
   - Record outcomes automatically
   - Feed into calibration system

### Medium-Term (Phase 9/10)

1. **Measure actual agent lift**:
   - Control vs Treatment comparison
   - Track success rate with/without Librarian
   - Validate >25% lift target

2. **Auto-evolve knowledge**:
   - Detect stale context packs
   - Re-index on significant changes
   - Prune low-confidence knowledge

3. **Cross-repo learning**:
   - Federation already supports this
   - Share patterns across projects
   - Learn from similar codebases

---

## 5. Success Criteria

Librarian is **actually useful** when:

| Metric | Target | Current |
|--------|--------|---------|
| Agent queries Librarian before work | 100% | 0% |
| Query latency (fast mode) | <1s | 41s |
| Context pack usage rate | >80% | 0% |
| Feedback outcomes recorded | >90% | 0% |
| Calibration samples | >1000 | 0 |
| Agent success lift (with vs without) | >25% | Unknown |

---

## 6. Meta-Observation

This analysis was conducted **without using Librarian effectively**, proving the point:

1. I manually explored the codebase with Grep/Read
2. I ran Librarian queries but they returned low-utility results
3. No Librarian context was injected into my decision-making
4. No feedback was recorded from this session

**The fix is not more features—it's integration**.

Librarian has the infrastructure. What's missing is the **automatic activation** that makes agents use it without thinking about it.

---

## 7. Next Steps

1. [ ] Create `WU-AGENT-INTEGRATION-001`: Claude Code auto-integration
2. [ ] Create `WU-QUERY-PERF-001`: Fast query mode (<1s)
3. [ ] Create `WU-DOCS-INDEX-001`: Index docs as first-class knowledge
4. [ ] Create `WU-FEEDBACK-001`: Automatic outcome recording
5. [ ] Update AGENTS.md with mandatory Librarian usage

---

*Generated by WU-META-001 analysis task*
