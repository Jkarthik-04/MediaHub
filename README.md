# MediaHub

MediaHub is a React, Express, PostgreSQL, and Prisma application for organizing and
tracking movies, TV shows, anime, manga, and books in one library. External providers
will supply most catalogue data, while manual entry remains available for niche titles.

## Current status

Planning Phases 1-3, the Phase 4 application/database foundation, and the Phase 5 core API
are complete. The repository includes working React and Express applications, PostgreSQL,
the 15-table Prisma schema, repeatable seed data, media/library/progress/dashboard APIs,
Jikan/OMDb/Open Library discovery, staged imports, database views/function/trigger/indexes,
integration tests, and continuous integration.

## Prerequisites

- Git
- Node.js 24 or newer with npm
- Docker Desktop with Docker Compose

## First-time setup

Clone the repository and enter the project:

```bash
git clone https://github.com/Jkarthik-04/MediaHub.git
cd MediaHub
git switch dev
```

Install the dependencies and create the local environment file:

```bash
npm install
cp .env.example .env
```

Start PostgreSQL, apply the migrations, and add the sample data:

```bash
docker compose up -d postgres
npm run db:migrate
npm run db:seed
```

The seed command is repeatable. Running it again updates the same sample records instead
of inserting duplicates.

## Start MediaHub

Run the server in one terminal:

```bash
npm run dev:server
```

Run the React client in a second terminal:

```bash
npm run dev:client
```

Open these addresses:

- React client: <http://localhost:5173>
- Express API: <http://localhost:3000/api/v1>
- Liveness check: <http://localhost:3000/api/v1/health/live>
- Database readiness check: <http://localhost:3000/api/v1/health/ready>

If either port is already occupied, use the replacement URL printed in that terminal.

Stop the applications with `Ctrl+C`. Stop PostgreSQL with:

```bash
docker compose stop postgres
```

## Database commands

| Command | Purpose |
|---|---|
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Apply development migrations |
| `npm run db:deploy` | Apply existing migrations non-interactively, as CI/deployment does |
| `npm run db:seed` | Insert or update the sample data |
| `npm run db:studio` | Open Prisma Studio |

The seed creates `admin@mediahub.local` and `user@mediahub.local` as development records.
Authentication is implemented in a later phase, so these are not currently login
credentials.

## Quality checks

Run the same checks used by GitHub Actions:

```bash
npm run db:generate
npm test
npm run lint
npm run typecheck
npm run build
npm run format:check
```

The CI workflow starts PostgreSQL, applies migrations, seeds it, and runs these checks for
pull requests and changes to `dev` or `main`.

## Environment variables

`.env.example` documents every expected variable. Keep the local `.env` file private and
never commit API keys, OAuth secrets, session secrets, or production database credentials.

The default development values work with the PostgreSQL service in `docker-compose.yml`.
`OMDB_API_KEY` is required only for movie discovery. Jikan and Open Library searches need
no API key. Google OAuth variables may remain empty until Phase 6.

## Repository structure

```text
client/           React and Vite application
server/src/       Express application
server/prisma/    Prisma schema, migrations, and seed
docs/             Planning and database documentation
.github/          GitHub Actions workflows
```

## Project documentation

- [Master project plan](PROJECT_PLAN.md)
- [Project proposal](docs/phase-1/PROJECT_PROPOSAL.md)
- [External source policy](docs/phase-1/SOURCE_POLICY.md)
- [Requirements and UX specification](docs/phase-2/REQUIREMENTS_AND_UX.md)
- [REST API contract](docs/phase-2/API_CONTRACT.md)
- [Database design and ER diagram](docs/phase-3/DATABASE_DESIGN.md)
- [Data dictionary](docs/phase-3/DATA_DICTIONARY.md)
- [Implemented Phase 5 API reference](docs/phase-5/API_REFERENCE.md)
- [Query-plan and database-object evidence](docs/phase-5/QUERY_PLAN_EVIDENCE.md)
- [Individual Git collaboration guide](docs/GIT_COLLABORATION_GUIDE.md)
