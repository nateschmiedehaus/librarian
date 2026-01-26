# Code Sprawl Prevention: Evidence-Based Agent Constraints

> **Last Updated**: 2026-01-17
> **Research Sources**: [Agentic Coding Best Practices](https://lucumr.pocoo.org/2025/6/12/agentic-coding/), [Quality Ratchets](https://leaddev.com/software-quality/introducing-quality-ratchets-tool-managing-complex-systems), [AI Agent Failure Modes](https://www.microsoft.com/en-us/security/blog/2025/04/24/new-whitepaper-outlines-the-taxonomy-of-failure-modes-in-ai-agents/)

## The Problem

Complexity budgets get circumvented because:

1. **Budget violations occur after the code is written** - Agents write first, then discover limits
2. **Justifications are easy to generate** - LLMs excel at rationalizing ("this is necessary for...")
3. **No hard enforcement** - Budget file is advisory, not blocking
4. **Compression targets are deferred** - "Will compress later" never happens

## Research-Backed Solutions

### 1. Quality Ratchets (Proven Effective)

A ratchet is a mechanism where movement in one direction is possible, but the other is blocked. Per [Notion's implementation](https://leaddev.com/software-quality/introducing-quality-ratchets-tool-managing-complex-systems):

```typescript
// Example: Per-file violation counts that can only decrease
// state/audits/code_ratchet.json
{
  "files": {
    "src/foo.ts": { "max_lines": 450, "current": 423 },
    "src/bar.ts": { "max_lines": 200, "current": 198 }
  },
  "policy": "Counts auto-decrease on fix. Increases require issue ticket."
}
```

**Key insight**: If a developer wants to add lines to a "maxed out" file, they must first reduce lines elsewhere, or create a ticket justifying the increase.

### 2. Pre-Commit Hard Blocks (Not Advisory)

Per [quality gate research](https://www.sonarsource.com/resources/library/quality-gate/):

```bash
# .husky/pre-commit - BLOCKING, not advisory
#!/bin/sh
set -e  # Fail on ANY error

# Count lines BEFORE commit
LOC_BEFORE=$(git diff --cached --numstat | awk '{s+=$1} END {print s}')
LOC_LIMIT=200

if [ "$LOC_BEFORE" -gt "$LOC_LIMIT" ]; then
  echo "ERROR: Commit adds $LOC_BEFORE lines (limit: $LOC_LIMIT)"
  echo "Split into smaller commits or justify with --no-verify + ticket"
  exit 1
fi
```

### 3. ESLint Hard Limits (Deterministic Enforcement)

Per [ESLint documentation](https://eslint.org/docs/latest/rules/max-lines):

```json
// .eslintrc.json
{
  "rules": {
    "max-lines": ["error", { "max": 500, "skipBlankLines": true, "skipComments": true }],
    "max-lines-per-function": ["error", { "max": 75, "skipBlankLines": true, "skipComments": true }]
  }
}
```

**This fails TypeScript compilation** - agents cannot bypass without explicit override.

### 4. Agent Self-Limiting Architecture

Per [AI SDK loop control](https://ai-sdk.dev/docs/agents/loop-control) and [CodeTree research](https://arxiv.org/html/2411.04329v2):

```typescript
// CLAUDE.md or agent configuration
const HARD_LIMITS = {
  maxLinesPerCommit: 200,
  maxFilesPerCommit: 10,
  maxLinesPerFile: 500,
  maxLinesPerFunction: 75,
  maxNewFilesPerTask: 3,
};

// Agent instruction
`Before writing code, check these limits. If your planned changes
would exceed any limit, STOP and ask the user for guidance instead
of proceeding. Never increase limits without explicit human approval.`
```

### 5. Bounded Expansion with Circuit Breakers

Per [Galileo AI safety research](https://galileo.ai/blog/prevent-llm-unbounded-consumption):

```typescript
interface CodeGenerationBudget {
  linesRemaining: number;
  filesRemaining: number;
  refillRate: 'never' | 'per_task' | 'per_session';
}

function checkBudget(planned: { lines: number; files: number }, budget: CodeGenerationBudget): boolean {
  if (planned.lines > budget.linesRemaining) {
    throw new BudgetExceededError(`Would write ${planned.lines} lines but only ${budget.linesRemaining} available`);
  }
  return true;
}
```

## Recommended Implementation for Wave0

### Tier 1: Immediate (Deterministic, Blocking)

1. **Add ESLint max-lines rules** - Fails compilation
2. **Pre-commit LOC check** - Blocks commits over threshold
3. **Ratchet file per-module** - Track and enforce limits

### Tier 2: Process (Human Checkpoints)

1. **Require issue tickets for budget increases** - No inline justification
2. **Compression targets have deadlines** - Tracked in TODO, not deferred
3. **Weekly LOC audit** - Team review of growth

### Tier 3: Agent Configuration

Add to CLAUDE.md:
```markdown
## Code Volume Constraints (MANDATORY)

1. **Before writing code**: Estimate lines to add. If >100, ask user first.
2. **Per-commit limit**: 200 lines maximum. Split larger changes.
3. **Per-file limit**: 500 lines. Extract modules proactively.
4. **Per-function limit**: 75 lines. Extract helpers.
5. **Budget increases**: NEVER justify inline. Create issue ticket instead.
6. **Compression**: Complete within 7 days or escalate.
```

### Enforcement Matrix

| Control | Type | Bypass Difficulty | Implementation |
|---------|------|-------------------|----------------|
| ESLint max-lines | Deterministic | Requires config change | .eslintrc.json |
| Pre-commit LOC check | Deterministic | Requires --no-verify | .husky/pre-commit |
| Ratchet file | Semi-automated | Requires manual edit | state/code_ratchet.json |
| CLAUDE.md instruction | Advisory | Easy to ignore | docs/CLAUDE.md |
| Issue ticket requirement | Process | Social pressure | Team norm |

## Why This Works

1. **Deterministic beats advisory** - ESLint errors cannot be rationalized away
2. **Ratchets compound** - Improvements stick, regressions require effort
3. **Human checkpoints** - Issue tickets create accountability
4. **Budget depletion model** - Agents can't infinitely expand

## Anti-Patterns to Avoid

1. ❌ **Advisory budgets with inline justification** - Too easy to circumvent
2. ❌ **Post-hoc checks** - Code already written, sunk cost bias
3. ❌ **Deferred compression** - "Will fix later" never happens
4. ❌ **Single global limit** - Doesn't prevent one module exploding

## Sources

- [Armin Ronacher: Agentic Coding Recommendations](https://lucumr.pocoo.org/2025/6/12/agentic-coding/)
- [LeadDev: Introducing Quality Ratchets](https://leaddev.com/software-quality/introducing-quality-ratchets-tool-managing-complex-systems)
- [Microsoft: AI Agent Failure Taxonomy](https://www.microsoft.com/en-us/security/blog/2025/04/24/new-whitepaper-outlines-the-taxonomy-of-failure-modes-in-ai-agents/)
- [ESLint: max-lines Rule](https://eslint.org/docs/latest/rules/max-lines)
- [ESLint: max-lines-per-function Rule](https://eslint.org/docs/latest/rules/max-lines-per-function)
- [Sonar: Quality Gates](https://www.sonarsource.com/resources/library/quality-gate/)
- [Galileo: Prevent Unbounded Consumption](https://galileo.ai/blog/prevent-llm-unbounded-consumption)
- [AI SDK: Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
- [qntm: Ratchets in Software Development](https://qntm.org/ratchet)
