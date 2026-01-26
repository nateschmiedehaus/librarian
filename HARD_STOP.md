# 🛑 HARD STOP — READ IMMEDIATELY

## Circular Evaluation Detected

**ALL PHASE 9/10 WORK IS INVALID** until this is resolved.

### The Problem

The evaluation corpus at `eval-corpus/repos/` contains **synthetic directories**, NOT real external git repositories.

**Proof:**
```bash
$ cd eval-corpus/repos/small-typescript
$ git remote -v
(no output - these are not cloned repos)

$ git log --oneline -3
3ebe521 docs: update orchestration for new eval framework  # <-- commits from MAIN repo
f30cd3b docs(orchestrator): update master work-unit state
```

These are just directories inside the main librarian repo, created by Codex itself. This is **circular evaluation** — the model evaluating its own outputs.

### Why This Is a Hard Stop

From `docs/librarian/specs/BLOCKER_RESOLUTION.md`:

> **Hard Stops (ONLY these things should stop you):**
> - Circular evaluation (model evaluating its own outputs)

### Required Action

**STOP** whatever Phase 9/10 work you are doing and execute **WU-801-REAL**:

```bash
# 1. Create directory for REAL external repos
mkdir -p eval-corpus/external-repos
cd eval-corpus/external-repos

# 2. Find real, recent TypeScript repos
gh search repos --language=typescript --created=">2024-06-01" --stars="10..100" --limit=20

# 3. Clone 5+ real repos (pick ones that look legitimate)
git clone https://github.com/<owner>/<repo> repo-1
git clone https://github.com/<owner>/<repo> repo-2
# ... etc.

# 4. Verify each is real
for dir in */; do
  echo "=== $dir ==="
  cd "$dir"
  git remote -v
  git log --oneline -3
  cd ..
done

# 5. Create manifest proving provenance
cat > manifest.json << 'EOF'
{
  "repos": [
    {
      "localName": "repo-1",
      "sourceUrl": "https://github.com/...",
      "clonedAt": "2026-01-26T...",
      "verification": "git remote shows real origin"
    }
  ],
  "validationNote": "All repos are REAL GitHub projects, NOT AI-generated"
}
EOF
```

### Do Not Proceed Until

- [ ] `eval-corpus/external-repos/` exists with 5+ repos
- [ ] Each repo has `git remote -v` showing real GitHub origin
- [ ] `manifest.json` documents all repos with provenance
- [ ] NO synthetic/AI-generated repos are used for evaluation

---

**This file will be deleted once WU-801-REAL is complete.**
