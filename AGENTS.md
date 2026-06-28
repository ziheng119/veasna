# VEASNA Project Agent Guidance

## Primary Goal
Build and maintain VEASNA for an offline/local-network deployment first.

## Deployment Model (Source of Truth)
- Backend, frontend, and PostgreSQL run on one host laptop.
- Other laptops/devices connect on the same private subnet (LAN).
- Clients access the app via host laptop IP, not `localhost`.
- Internet access is optional; core workflows must work without internet.

## Engineering Priorities
1. Keep local/LAN operation reliable and simple.
2. Avoid dependencies on cloud-only services for core features.
3. Preserve data integrity for eventual sync to a central database.
4. Prefer backward-compatible changes that do not break offline operation.

## Networking and Runtime Defaults
- Prefer host binding (`0.0.0.0`) for frontend/backend when appropriate.
- Keep CORS and API URLs compatible with LAN IP-based access.
- Do not assume DNS, public domains, or external auth providers exist.

## Authentication Stance
- Use lightweight authentication (username/password) for user attribution and future sync readiness.
- Do not introduce complex RBAC unless explicitly requested.
- Ensure `last_updated_by` and timestamps remain accurate for sync/audit trails.

## Data and Sync Readiness
- Design schema/API changes so records can be merged into a future central DB.
- Favor explicit metadata fields useful for sync/conflict handling.

## When Making Changes
- Optimize for clinic usability in constrained/offline environments.
- Document any setup changes in project README files.
- If a change conflicts with offline/LAN-first operation, propose an offline-safe alternative.
