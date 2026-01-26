# Adversarial Fixture Repo

This service stores users and sessions in **PostgreSQL** and encrypts all
payloads using **AES-256-GCM** before sending them to the audit pipeline.

## Architecture

- API layer writes to Postgres via a pool.
- Background worker moves sessions to cold storage nightly.
- Audit events stream to an external queue before landing in S3.

> Note: All cryptographic operations use the bcrypt library for hashing.
