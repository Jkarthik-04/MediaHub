# Phase 9 Testing, Backup, and Recovery

**Status:** Implemented evidence and repeatable verification procedures are available.

## Automated quality gates

GitHub Actions runs dependency installation, Prisma client generation, PostgreSQL-backed tests,
ESLint, TypeScript checks, formatting checks, and production builds. Pull requests and pushes to
the integration/release branches must pass the workflow before merging.

## Database evidence

The project includes integration coverage for CRUD, ownership, validation, rollback, joins,
aggregates, views, the genre-profile function, audit trigger, recommendations, and provider
normalization. Representative `EXPLAIN (ANALYZE, BUFFERS)` plans and index definitions are recorded
in [QUERY_PLAN_EVIDENCE.md](../phase-5/QUERY_PLAN_EVIDENCE.md).

## Native PostgreSQL backup test

Create a custom-format backup from a development or staging database:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=mediahub.backup
```

Restore it into a separate empty database:

```bash
createdb mediahub_restore_test
pg_restore --clean --if-exists --dbname="$RESTORE_DATABASE_URL" mediahub.backup
```

Then compare table counts, query both views, call `get_user_genre_profile`, and confirm that the
audit trigger exists. Record the date, source database, restore target, and result in the report.
Never run `pg_restore --clean` against the production database.

## Deployment verification

Render runs Prisma migrations before starting the server. A successful deployment must show
`No pending migrations to apply` followed by `MediaHub API listening`, and the deployed health
endpoint must return HTTP 200. Production secrets are configured in the platform secret store, not
in Git.
