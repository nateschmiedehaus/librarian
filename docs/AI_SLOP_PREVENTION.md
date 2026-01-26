# AI Slop Prevention: Research-Backed Detection and Mitigation

> **Last Updated**: 2026-01-17
> **Research Sources**: arXiv security research, USENIX empirical studies, IEEE-ISTAS proceedings

## Executive Summary

AI-generated code has distinct characteristics that differ from human-written code. These "slop patterns" include:
- **40-50% vulnerability rates** in certain languages (Pearce et al., 2024)
- **42-85% higher code smell rates** compared to human baselines (arXiv 2510.03029)
- **No correlation between functional performance and security** (arXiv 2508.14727)

This document provides research-backed detection and prevention strategies.

---

## Part 1: Empirical Characteristics of AI-Generated Code

### Security Vulnerability Rates (Quantified)

| Source | Finding | Citation |
|--------|---------|----------|
| Large-scale GitHub analysis | 12.1% vulnerability rate overall; Python 16.18%-18.50% | [arXiv 2510.26103](https://arxiv.org/abs/2510.26103) |
| Copilot analysis | ~40% of programs contain vulnerabilities | Pearce et al., 2024 |
| Multi-language study | C code: ~50% vulnerability rate | [arXiv 2506.11022](https://arxiv.org/abs/2506.11022) |
| Security degradation | 14.3% increase in vulnerabilities per 10% complexity increase | IEEE-ISTAS 2025 |

### Code Smell Rates (Quantified)

From [arXiv 2510.03029](https://arxiv.org/abs/2510.03029) (October 2025):

| Model | Code Smell Score (lower=better) | Increase vs Human |
|-------|--------------------------------|-------------------|
| Human baseline | - | - |
| Falcon | 27.571 | +42.28% |
| CodeLlama | 32.165 | +65.99% |
| GPT-4o | 33.285 | +71.77% |
| Codex | 35.844 | +84.97% |

### Common Vulnerability Types

From [arXiv 2508.14727](https://arxiv.org/abs/2508.14727):

1. **Hardcoded credentials** - Consistently observed across all models
2. **Path traversal vulnerabilities** - Common in file handling code
3. **XML External Entity (XXE) injection** - In XML processing code
4. **Resource management lapses** - Memory leaks, unclosed handles
5. **Improper input validation** - Insufficient sanitization

---

## Part 2: Detection Patterns

### Structural Indicators

Based on empirical research:

| Pattern | AI Indicator | Human Indicator |
|---------|--------------|-----------------|
| Variable names | Verbose, grammatically correct | Abbreviated, contextual |
| Comments | Overly detailed or templated | Sparse, contextual |
| Formatting | Perfectly consistent | Minor inconsistencies |
| Structure | Strict patterns, predictable | Variable approaches |
| Error handling | Generic or over-engineered | Context-specific |

### Specific Code Smells (from arXiv 2510.03029)

AI-generated code exhibits higher rates of:
1. **Long methods** - Tendency to generate complete solutions in single functions
2. **Large classes** - Everything in one place rather than decomposed
3. **Feature envy** - Methods that use more features of other classes
4. **Data clumps** - Groups of parameters that appear together
5. **Speculative generality** - Unused abstractions "just in case"

### Slopsquatting Detection

From [USENIX Security 2025](https://www.usenix.org/conference/usenixsecurity25/presentation/spracklen):

- **58% of hallucinated packages are repeatable** - Not random noise
- **Self-detection possible** - GPT-4 Turbo and DeepSeek achieved >75% accuracy detecting their own hallucinations

Detection strategy:
```bash
# Validate package existence before installation
pip index versions <package-name> || echo "PACKAGE NOT FOUND - possible hallucination"
npm view <package-name> || echo "PACKAGE NOT FOUND - possible hallucination"
```

---

## Part 3: Prevention Strategies

### Tier 1: Static Analysis Integration (Mandatory)

Based on [arXiv 2508.14727](https://arxiv.org/abs/2508.14727) recommendation: "Static analysis is an effective mechanism for identifying latent risks."

```json
// package.json - Required pre-commit hooks
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run lint && npm run security-check"
    }
  },
  "scripts": {
    "security-check": "npm audit --audit-level=high && snyk test",
    "lint": "eslint --max-warnings 0 src/"
  }
}
```

### Tier 2: Hybrid Pipeline (Research-Recommended)

From [arXiv 2508.04448](https://arxiv.org/abs/2508.04448): "A hybrid pipeline: employ language models early in development for broad, context-aware triage, while reserving deterministic rule-based scanners for high-assurance verification."

```
Phase 1: LLM generates code
Phase 2: Static analysis (SonarQube, CodeQL, SnykCode)
Phase 3: LLM self-review (>75% accuracy on own hallucinations)
Phase 4: Human review of flagged items
Phase 5: Integration tests with real dependencies
```

### Tier 3: Iterative Refinement Safeguards

From [arXiv 2506.11022](https://arxiv.org/abs/2506.11022) - "Security Degradation in Iterative AI Code Generation":

**Problem**: Each AI iteration increases complexity → increases vulnerabilities (r = 0.64 correlation).

**Mitigation**:
```markdown
## CLAUDE.md constraint
When iterating on code:
1. Track complexity delta (cyclomatic, LOC)
2. If complexity increases >10%, STOP and refactor first
3. Never iterate more than 3 times without human review
4. Run security scanner after EACH iteration, not just final
```

### Tier 4: Package Verification

From [Snyk slopsquatting research](https://snyk.io/articles/slopsquatting-mitigation-strategies/):

```typescript
// Before installing any AI-suggested package
async function verifyPackage(name: string): Promise<boolean> {
  // 1. Check official registry
  const exists = await npm.view(name).catch(() => null);
  if (!exists) {
    console.error(`SLOPSQUATTING ALERT: Package "${name}" not found`);
    return false;
  }

  // 2. Check download count (hallucinated packages have 0 or near-0)
  if (exists.downloads < 1000) {
    console.warn(`LOW DOWNLOADS: Package "${name}" may be suspicious`);
  }

  // 3. Check age (hallucinated packages are often newly registered)
  const createdAt = new Date(exists.time.created);
  const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < 30) {
    console.warn(`NEW PACKAGE: Package "${name}" created ${Math.floor(daysSinceCreation)} days ago`);
  }

  return true;
}
```

---

## Part 4: Wave0-Specific Implementation

### Anti-Slop Rules (Extended from AGENTS.md)

Add these research-backed rules:

| # | Rule | Research Source |
|---|------|-----------------|
| 56 | No hardcoded credentials, paths, or URLs | arXiv 2508.14727 |
| 57 | Validate all package names before import | USENIX slopsquatting |
| 58 | Complexity delta check on iterations | arXiv 2506.11022 |
| 59 | Static security scan after each file change | arXiv 2508.04448 |
| 60 | Self-review prompt for own generated code | USENIX self-detection |

### Prompt Engineering for Slop Reduction

From [arXiv 2506.23034](https://arxiv.org/abs/2506.23034) - "Guiding AI to Fix Its Own Flaws":

```markdown
## CLAUDE.md prompt constraints

Before generating code, explicitly acknowledge:
1. Security requirements for this context
2. Known vulnerability patterns to avoid (CWE-specific)
3. Complexity budget for this change

After generating code, self-review:
1. Are there hardcoded values that should be configurable?
2. Are all imports to real, verified packages?
3. Is error handling context-specific, not generic?
4. Would a junior developer understand this without comments?
```

### CI/CD Security Gates

```yaml
# .github/workflows/security.yml
name: Security Gates
on: [push, pull_request]

jobs:
  security-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Gate 1: Static analysis
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@master

      # Gate 2: Dependency verification
      - name: Verify Dependencies
        run: |
          npm audit --audit-level=high
          npx snyk test --severity-threshold=high

      # Gate 3: CodeQL security scan
      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v3

      # Gate 4: Slopsquatting check
      - name: Verify Package Registry
        run: |
          # Check all imports against npm registry
          node scripts/verify_packages.mjs
```

---

## Part 5: Measurement and Tracking

### Metrics to Track

| Metric | Target | Measurement |
|--------|--------|-------------|
| Vulnerability density | <5 per KLOC | CodeQL/SonarQube |
| Code smell ratio | <50% above human baseline | SonarQube |
| Iteration security delta | <10% vulnerability increase per iteration | Diff analysis |
| Package verification rate | 100% | Pre-commit hook |
| False positive rate | Track over time | Manual review log |

### Audit Trail

```json
// state/audits/ai_slop_review/{timestamp}/report.json
{
  "kind": "AISlopReview.v1",
  "timestamp": "2026-01-17T00:00:00Z",
  "files_reviewed": 42,
  "vulnerabilities_detected": 3,
  "code_smells_detected": 12,
  "packages_verified": true,
  "complexity_delta": "+5.2%",
  "recommendation": "approve" | "revise" | "reject"
}
```

---

## Sources (Academic)

- [AI Code in the Wild: Measuring Security Risks (arXiv 2512.18567)](https://arxiv.org/abs/2512.18567)
- [Security Degradation in Iterative AI Code Generation (IEEE-ISTAS 2025)](https://arxiv.org/abs/2506.11022)
- [Security Vulnerabilities in AI-Generated Code (arXiv 2510.26103)](https://arxiv.org/abs/2510.26103)
- [Assessing Quality and Security of AI-Generated Code (arXiv 2508.14727)](https://arxiv.org/abs/2508.14727)
- [Investigating The Smells of LLM Generated Code (arXiv 2510.03029)](https://arxiv.org/abs/2510.03029)
- [LLMs vs Static Analysis Tools (arXiv 2508.04448)](https://arxiv.org/abs/2508.04448)
- [Guiding AI to Fix Its Own Flaws (arXiv 2506.23034)](https://arxiv.org/abs/2506.23034)
- [Package Hallucinations Analysis (USENIX Security 2025)](https://www.usenix.org/conference/usenixsecurity25/presentation/spracklen)
- [Slopsquatting Mitigation (Snyk)](https://snyk.io/articles/slopsquatting-mitigation-strategies/)
