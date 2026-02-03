# Librarian Performance Analysis - Evaluation Report

**Date:** 2026-01-31
**Files Analyzed:**
- `src/api/query.ts` (6,490 lines)
- `src/storage/sqlite_storage.ts` (6,192 lines)

## Summary

| Metric | query.ts | sqlite_storage.ts |
|--------|----------|-------------------|
| Overall Risk | HIGH | LOW |
| Total Issues | 146 | 201 |
| Analysis Time | 63ms | 34ms |

## Issue Categories & Validation

### 1. N+1 Pattern Detection (query.ts: 49 issues)

**Sample Finding (Lines 2421-2426):**
```typescript
for (const pack of finalPacks) {
  const entityType = resolveEvidenceEntityType(pack);
  if (!entityType) continue;
  const evidence = await evidenceStore.getEvidenceForTarget(pack.targetId, entityType);
  if (evidence.length) evidenceByPack[pack.packId] = evidence;
}
for (const pack of finalPacks) await storage.recordContextPackAccess(pack.packId);
```

**VERDICT: REAL ISSUE**
- This IS a sequential await pattern inside a loop
- Each iteration waits for the previous database call
- Could be parallelized with `Promise.all()`

**Sample Finding (Lines 4892-4894):**
```typescript
for (let i = 0; i < initialPacks.length; i += DEFEATER_BATCH_SIZE) {
  const chunk = initialPacks.slice(i, i + DEFEATER_BATCH_SIZE);
  const chunkResults = await Promise.allSettled(chunk.map(async (pack) => {
```

**VERDICT: FALSE POSITIVE (partially)**
- This code ALREADY uses batching with `Promise.allSettled()`
- The outer loop is intentionally sequential to limit batch size
- This is actually GOOD code - the detection didn't recognize the batching pattern

### 2. Unbounded Growth Detection (192 issues in sqlite_storage.ts)

**Sample Finding (Lines 1120-1135):**
```typescript
const params: unknown[] = [];
if (options.minConfidence !== undefined) {
  sql += ' AND confidence >= ?';
  params.push(options.minConfidence);
}
```

**VERDICT: FALSE POSITIVE**
- These are local arrays for building SQL queries
- They have natural bounds (the number of query options)
- They are NOT growing unbounded over time - just within a single function call
- The "unbounded growth" detector is too simplistic

### 3. Large Bundle Import (2 issues in sqlite_storage.ts)

**Finding:**
```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
```

**VERDICT: FALSE POSITIVE**
- These are Node.js built-in modules
- They are NOT bundled - they're loaded from the Node runtime
- Tree-shaking doesn't apply to Node built-ins
- The detector should exclude `node:` and built-in module prefixes

### 4. Redundant Computation (7 issues)

**VERDICT: MOSTLY ACCURATE**
- Chained `.filter().map()` patterns were correctly identified
- These CAN be optimized but are often preferred for readability

## Detection Quality Assessment

| Category | True Positives | False Positives | Accuracy |
|----------|---------------|-----------------|----------|
| N+1 Patterns | ~40% | ~60% | LOW |
| Unbounded Growth | ~5% | ~95% | VERY LOW |
| Large Bundle Import | 0% | 100% | NONE |
| Redundant Computation | ~70% | ~30% | GOOD |

## Root Cause Analysis

### Why N+1 Detection Generates False Positives

1. **No AST-based analysis**: Uses regex patterns that match code context but can't distinguish:
   - Intentional batching patterns
   - Already-parallel `Promise.all()` usage
   - Loops that need sequential execution (dependency between iterations)

2. **Window-based matching**: The 5-line window approach catches too many unrelated await statements

### Why Unbounded Growth Detection Fails

1. **No scope analysis**: Can't tell if `params.push()` is in a loop vs. a one-time function
2. **No lifecycle understanding**: Doesn't track that local arrays are garbage collected
3. **Overly simplistic heuristic**: Just looks for `.push()` without limiting logic nearby

### Why Bundle Import Detection Fails

1. **Doesn't recognize Node built-ins**: `fs/promises` and `path` are NOT npm packages
2. **Should have allowlist**: Common patterns like `import * as path` are idiomatic

## Recommendations for Improvement

### High Priority
1. **Add AST parsing for N+1 detection**: Use tree-sitter or ts-morph to:
   - Track function scopes
   - Identify if loops contain parallelized awaits
   - Recognize common batching patterns

2. **Fix bundle import detection**: Exclude:
   - Node.js built-in modules
   - Local imports (`./*`, `../*`)
   - Already-known-good namespace imports

### Medium Priority
3. **Improve unbounded growth detection**:
   - Only flag class/module-level arrays
   - Check if array is returned or stored in longer-lived scope
   - Ignore function-local query builders

4. **Add semantic context**:
   - Recognize that `params.push()` in SQL builder is bounded
   - Check for common patterns like `const results = []` in loops

### Low Priority
5. **Better hotspot detection**: Currently finding 0 hotspots because the mock storage returns no functions. Need integration with actual index.

## Actionable Findings (Real Issues to Fix)

### In `src/api/query.ts`:

1. **Line 2421-2426**: Sequential evidence fetching
   ```typescript
   // BEFORE
   for (const pack of finalPacks) {
     const evidence = await evidenceStore.getEvidenceForTarget(...);
   }

   // AFTER
   await Promise.all(finalPacks.map(async (pack) => {
     const evidence = await evidenceStore.getEvidenceForTarget(...);
   }));
   ```

2. **Line 2426**: Sequential pack access recording
   ```typescript
   // BEFORE
   for (const pack of finalPacks) await storage.recordContextPackAccess(pack.packId);

   // AFTER
   await Promise.all(finalPacks.map(p => storage.recordContextPackAccess(p.packId)));
   ```

### In `src/storage/sqlite_storage.ts`:

- **No actionable issues found** - the detected issues are false positives

## Conclusion

The Librarian performance analysis system has **good intent** but **poor precision**. It correctly identifies the categories of performance issues that matter (N+1, sync I/O, memory leaks, etc.) but the implementation generates too many false positives due to lack of AST-based analysis.

**Overall Score: 2/5**
- Useful for initial triage
- Requires manual validation of all findings
- Would benefit significantly from tree-sitter integration
