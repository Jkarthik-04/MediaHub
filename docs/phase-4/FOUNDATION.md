# Phase 4 Foundation

## Goal

Phase 4 created a reproducible React, Express, PostgreSQL, and Prisma foundation that every
group member can run using the same commands.

## What was implemented

- React application created with Vite and TypeScript.
- Express API organized into routes, controllers, services, repositories, middleware,
  providers, validation, and utilities.
- PostgreSQL 17 development database managed through Docker Compose.
- Prisma schema containing the 15 planned MediaHub tables and their relationships.
- Initial migration history committed under `server/prisma/migrations`.
- Repeatable seed script containing roles, users, media types, genres, sources, sample
  titles, library entries, progress, mappings, ingestion data, and a recommendation.
- `.env.example` containing safe configuration placeholders.
- API liveness and database-readiness endpoints.
- ESLint, Prettier, TypeScript checks, builds, and GitHub Actions CI.

## Repository structure

```text
client/                     React and Vite application
server/src/                 Express application code
server/prisma/schema.prisma Database models and relationships
server/prisma/migrations/   Versioned PostgreSQL migrations
server/prisma/seed.ts       Repeatable sample data
docs/                       Project documentation
.github/workflows/ci.yml    Continuous-integration checks
docker-compose.yml          Local PostgreSQL service
```

## First-time setup

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run db:seed
```

Start the backend and frontend in separate terminals:

```bash
npm run dev:server
npm run dev:client
```

Open:

- React: <http://localhost:5173>
- API: <http://localhost:3000/api/v1>
- Liveness: <http://localhost:3000/api/v1/health/live>
- Database readiness: <http://localhost:3000/api/v1/health/ready>

## Environment configuration

The local `.env` file is ignored by Git. New variables must be documented with an empty or
safe example value in `.env.example`. API keys, passwords, OAuth secrets, and session
secrets must never be committed.

The default database connection is:

```text
postgresql://mediahub:mediahub_dev_password@localhost:5432/mediahub?schema=public
```

This default is for local development only.

## Database and seed verification

Validate and inspect the database with:

```bash
npm run db:validate
npm run db:seed
npm run db:studio
```

The seed command uses fixed identifiers and upserts, so it can be run repeatedly without
creating duplicate sample records. Prisma Studio should show related users, media items,
genres, library entries, progress events, sources, mappings, ingestion data, and
recommendations.

## Foundation quality checks

```bash
npm run db:generate
npm run lint
npm run typecheck
npm run build
npm run format:check
```

GitHub Actions runs these checks on pull requests and changes to `dev` or `main`. Phase 5
later extended CI with PostgreSQL migrations, seeding, and API integration tests.

## Completion evidence

Phase 4 is complete because a new group member can clone the repository, copy the
environment template, start PostgreSQL, apply the committed migration, load the same seed
data, run both applications, reach both health endpoints, and pass the automated checks
without undocumented setup steps.
