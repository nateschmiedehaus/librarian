# Librarian Evaluation Corpus

This folder holds the ground-truth evaluation corpus used by the evaluation
harness. It is intentionally scaffolded first so future work can populate real
repositories, annotations, and query/answer pairs.

## Structure

- `schema/ground_truth.schema.json`: JSON Schema for corpus-level ground truth
  (versioned; required fields only).
- `repos/`: Annotated repositories. Each repo contains a `.librarian-eval/`
  folder with `manifest.json` and `ground-truth.json`.
- `queries/`: Shared query sets by category (structural, behavioral, etc.).

## Placeholder Status

All contents are placeholders until real corpora are added. File counts and
query arrays are currently empty and should be updated alongside real fixtures.
