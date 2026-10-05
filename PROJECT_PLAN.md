# MediaHub - Phase-by-Phase Development Plan

## Planning progress

| Phase | Status | Completed artifacts |
|---:|---|---|
| 1 | **Planning complete; external setup pending** | [Project proposal](docs/phase-1/PROJECT_PROPOSAL.md), [source policy](docs/phase-1/SOURCE_POLICY.md) |
| 2 | **Complete** | [Requirements and UX specification](docs/phase-2/REQUIREMENTS_AND_UX.md), [REST API contract](docs/phase-2/API_CONTRACT.md) |
| 3 | **Complete** | [Database design](docs/phase-3/DATABASE_DESIGN.md), [data dictionary](docs/phase-3/DATA_DICTIONARY.md) |

The local Git repository and `main`/`dev` branches are initialized. Phase 1 faculty approval and GitHub remote/collaborator configuration require external details and are intentionally left as follow-up actions. All locally completable planning work for Phases 1-3 is finished as of **5 October 2026**. Implementation begins at Phase 4.

## 1. Project summary

**MediaHub** is a centralized media-management platform for movies, TV shows, anime, manga, and books. A user can maintain one combined library, record reading or watching progress, discover media through external sources, and receive explainable recommendations based on their complete taste profile rather than the history stored on only one platform.

External collection is the normal catalogue-building method. MediaHub should obtain metadata through official APIs, public exports, and permitted public-page scrapers, normalize that information, remove duplicates, and then save selected titles to PostgreSQL. Manual entry remains available only for niche, regional, independent, or newly released titles that none of the configured sources can find.

The application has three main user-facing areas:

1. **Central Dashboard** - combined progress, recent activity, statistics, search, and recommendations.
2. **Reading** - books and manga, including page/chapter/volume progress.
3. **Watching** - movies, TV shows, and anime, including percentage/season/episode progress.

An additional **Admin area** is required to demonstrate role-based authorization and to manage users, metadata, imports, and audit records.

## 2. Success criteria

The project is complete only when the group can demonstrate all of the following:

- A responsive React application with login, dashboard, CRUD, search, filtering, pagination, validation, and useful error messages.
- An Express.js REST API with clear routes, controllers, services, and centralized exception handling.
- A PostgreSQL database accessed primarily through Prisma ORM.
- Provider adapters that obtain movie, TV, anime, manga, and book metadata without requiring users to type every title.
- A staged import pipeline with normalization, duplicate detection, preview, confirmation, and clear failure reporting.
- A manual niche-title fallback with review/merge support.
- An ER diagram, relational schema, data dictionary, and justification that the schema is in Third Normal Form or higher.
- At least 8-10 related tables, with every implemented table represented in the ER diagram.
- Primary keys, foreign keys, `NOT NULL`, `UNIQUE`, `CHECK`, and `DEFAULT` constraints where appropriate.
- Joins, aggregate queries, views, transactions, indexes, at least one PostgreSQL function/procedure, and at least one trigger.
- Secure login and logout, a single `users` table, at least `USER` and `ADMIN` roles, and role checks at menu, page, and API levels.
- No credentials committed to Git; all secrets must be supplied through environment variables.
- A verified PostgreSQL backup and restore procedure.
- A private GitHub repository with all members as collaborators, `main` and `dev` branches, at least ten meaningful commits, a `.gitignore`, and a complete README.
- Docker support, a deployed live URL, and evidence mapped to every item in the marking rubric.

## 3. Agreed technical architecture

| Area | Choice | Reason |
|---|---|---|
| Frontend | React + Vite | Fast setup and clean separation from the API |
| Routing | React Router | Protected routes and dashboard/reading/watching navigation |
| UI | Tailwind CSS or Material UI | Responsive reusable components; choose one and do not mix systems |
| Data fetching | TanStack Query | Caching, loading/error states, mutations, and invalidation |
| Forms | React Hook Form + Zod | Shared, explicit validation rules |
| Backend | Node.js + Express.js | Required group stack and straightforward REST API design |
| ORM | Prisma | Type-safe models, migrations, and parameterized queries |
| Database | PostgreSQL | Supports constraints, views, triggers, functions, transactions, and indexing |
| Authentication | Google OAuth through Passport.js plus secure server session | Meets the recommended OAuth requirement and avoids storing a Google password |
| External data | APIs, public exports, and permitted scrapers behind provider adapters | Keeps source-specific logic away from the core database and API |
| Password fallback | Argon2 only if local login is added | Secure hashing; local login is optional after OAuth works |
| Tests | Vitest, React Testing Library, Supertest | Unit, component, and API testing |
| Local environment | Docker Compose | Reproducible frontend/backend/database startup |
| Deployment | Vercel frontend + Render/Railway backend and PostgreSQL | Clear separation of services and accessible live demo |
| CI/CD | GitHub Actions | Bonus mark and automatic checks on pull requests |

### High-level request flow

```text
React UI
   -> HTTPS request / secure session cookie
Express routes
   -> authentication and RBAC middleware
Controllers
   -> validation and response formatting
Services
   -> business rules and transactions
Repositories / Prisma
   -> PostgreSQL

External APIs / public exports / permitted scrapers
   -> provider adapter
   -> staging and validation
   -> normalization and deduplication
   -> MediaHub PostgreSQL schema
```

## 4. Working agreement

- `main` must always contain a tested release candidate.
- `dev` is the integration branch.
- Work in branches such as `feature/library-crud`, `feature/auth`, or `fix/progress-validation`.
- Every task should have a GitHub issue with acceptance criteria and a target phase.
- Open a pull request into `dev`; at least one teammate reviews it before merging.
- Do not modify a migration that has already been used by another teammate. Create a new migration.
- Never commit `.env`, database dumps containing personal data, OAuth credentials, tokens, or private keys.
- Hold a short weekly review: demo completed work, inspect the board, record blockers, and agree on the next phase.
- Each of the ten phases ends in at least one meaningful milestone commit. Use additional commits whenever independently reviewable work is completed.
- Prefer an official API or export. Scrape only public data from a source that permits automated access, and document the decision before implementation.

## 5. Proposed database model

The final ER diagram may refine names, but the group should agree on the following foundation before coding.

| Table | Important fields | Purpose |
|---|---|---|
| `roles` | `id`, `name` | Stores `USER` and `ADMIN`; avoids separate user/admin tables |
| `users` | `id`, `role_id`, `email`, `display_name`, `avatar_url`, timestamps | A single table for every authenticated person |
| `media_types` | `id`, `name`, `progress_mode` | Movie, TV, anime, manga, and book lookup data |
| `media_items` | `id`, `media_type_id`, `title`, `description`, `release_date`, `cover_url`, `total_units`, timestamps | Provider-independent media catalogue |
| `genres` | `id`, `name` | Normalized genre/tag catalogue |
| `media_genres` | `media_item_id`, `genre_id` | Many-to-many media/genre relationship |
| `media_units` | `id`, `media_item_id`, `unit_number`, `season_number`, `title`, `duration_or_pages` | Episodes, chapters, volumes, or other progress units |
| `library_entries` | `id`, `user_id`, `media_item_id`, `status`, `progress`, `rating`, `started_at`, `completed_at`, timestamps | A user's current state for one title |
| `progress_events` | `id`, `library_entry_id`, `old_progress`, `new_progress`, `recorded_at` | Historical progress and activity data |
| `sources` | `id`, `name`, `base_url`, `is_enabled` | Metadata providers supported by MediaHub |
| `external_mappings` | `id`, `media_item_id`, `source_id`, `external_id`, `source_url`, `last_synced_at` | Maps canonical titles to provider records |
| `ingestion_jobs` | `id`, `user_id`, `source_id`, `kind`, `status`, `requested_at`, `completed_at`, `error_message` | Tracks API, list-import, and scraping operations |
| `ingestion_candidates` | `id`, `job_id`, `external_id`, `normalized_payload`, `match_media_id`, `match_confidence`, `decision` | Stages normalized results before confirmation |
| `recommendations` | `id`, `user_id`, `media_item_id`, `score`, `reason`, `model_version`, `generated_at` | Stores explainable recommendation output |
| `audit_logs` | `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `created_at` | Security and change history |

Optional novelty table after the core system works:

| Table | Important fields | Purpose |
|---|---|---|
| `media_relations` | `source_media_id`, `target_media_id`, `relation_type` | Represents adaptations, sequels, spin-offs, and shared universes |

Key constraints to demonstrate:

- Unique user email.
- Unique role, media type, genre, and source names.
- Unique `(user_id, media_item_id)` so a title is not duplicated in one user's library.
- Unique `(source_id, external_id)` so an external record is imported once.
- Unique `(media_item_id, genre_id)` in the junction table.
- Rating constrained to an agreed range such as 1-10.
- Progress and total units cannot be negative.
- Status constrained to `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD`, or `DROPPED`.
- Ingestion status constrained to `QUEUED`, `RUNNING`, `PREVIEW_READY`, `COMPLETED`, or `FAILED`.
- Foreign-key behavior must be chosen deliberately; do not cascade-delete user history accidentally.

---

# Phase-by-phase execution plan

## Phase 1 - Project definition, source policy, and repository setup

**Status:** Planning deliverables completed on 5 October 2026. Faculty approval and GitHub remote/collaborator setup remain external follow-ups.

**Goal:** Make every member agree on what will be built, what will not be built, and how work will be coordinated.

**Suggested duration:** Week 1

### Tasks

1. Convert the problem statement into a concise proposal containing title, problem, objectives, scope, members, responsibilities, stack, deliverables, and timeline.
2. Define the minimum viable product (MVP):
   - Google login/logout.
   - Central dashboard.
   - Reading and watching libraries.
   - External title discovery/import as the default addition method.
   - Manual addition only when external sources have no match.
   - Progress, status, and rating updates.
   - Search, filters, and pagination.
   - Explainable genre-based recommendations.
   - Admin role and admin page.
3. Put these items explicitly out of scope until the MVP is complete:
   - Automatic private-account synchronization with every media website.
   - Scraping websites that prohibit scraping.
   - Social feeds, messaging, and mobile applications.
   - Complex deep-learning training infrastructure.
4. Evaluate at least one source for movies/TV, one for anime/manga, and one for books. Record API/export availability, authentication, rate limits, attribution, obtainable fields, and whether public-page scraping is allowed.
5. Define the ingestion order: official API, official export/feed, permitted public-page scraper, then manual fallback.
6. Create the private GitHub repository, add collaborators, create `main` and `dev`, protect `main`, and create issue/PR templates.
7. Create a GitHub Project board with `Backlog`, `Ready`, `In Progress`, `Review`, and `Done` columns.
8. Agree on naming, commit, review, meeting, and communication conventions.
9. Obtain faculty approval for the selected domain and record any requested scope changes.

### Required artifacts

- [x] [Project proposal, scope, deliverables, and timeline](docs/phase-1/PROJECT_PROPOSAL.md).
- [x] [Source feasibility and permitted-use policy](docs/phase-1/SOURCE_POLICY.md).
- [x] Scope and non-scope list.
- [x] Ten-phase timeline.
- [x] Local Git repository with `main` and `dev` branches.
- [ ] Initial GitHub issue backlog, to create with the remote repository.
- [ ] Private GitHub repository/collaborators, pending repository account details.

### Completion checkpoint

The local planning portion is complete: the MVP is unambiguous and each proposed external source has a documented decision. Full operational closure occurs after faculty approval is recorded and the GitHub remote/collaborators are configured.

### Milestone commit 1

```text
chore: initialize MediaHub proposal repository and source policy
```

Include the proposal, scope, source feasibility notes, timeline, README skeleton, `.gitignore`, and initial directory structure.

---

## Phase 2 - Requirements, user journeys, and interface design

**Status:** Completed on 5 October 2026.

**Goal:** Describe expected behavior before database and API implementation begins.

**Suggested duration:** Week 2

### Tasks

1. Write user stories with acceptance criteria. Examples:
   - As a user, I can add an anime to my library so that I can track watched episodes.
   - As a user, I can filter manga by status and genre so that I can find what to continue.
   - As an admin, I can disable a duplicate media item so that catalogue quality is maintained.
2. Document the primary workflows:
   - First login and profile creation.
   - Search external providers -> normalize -> preview -> add to library.
   - Import a permitted public list by URL or export file.
   - Detect exact and possible duplicate titles before saving.
   - Manual niche-title submission when all external searches fail.
   - Update progress -> record event -> update dashboard.
   - Generate recommendations -> view reason -> dismiss or add title.
   - Admin login -> protected management operation.
3. Decide progress rules for each type:
   - Movie: percentage or completed flag.
   - TV/anime: season and episode/unit.
   - Manga: volume/chapter.
   - Book: page or percentage.
4. Define validation and edge cases:
   - Progress cannot exceed known total units.
   - Completing a title sets completion date.
   - Reducing progress must require confirmation but should remain possible.
   - Duplicate library entries return a useful conflict message.
   - Provider outages must not prevent viewing the existing local library.
   - Importing the same external title twice must reuse the canonical record.
   - A manual title that later matches a provider record must be merged rather than duplicated.
5. Produce wireframes for login, dashboard, search, details, reading, watching, recommendations, and admin pages.
6. Define responsive behavior for mobile, tablet, and desktop.
7. Draft the API contract, including request bodies, response shapes, pagination metadata, and standard error format.

### Suggested API contract

```text
GET    /api/auth/me
POST   /api/auth/logout
GET    /api/media?q=&type=&genre=&page=&limit=
GET    /api/media/:id
POST   /api/media                     ADMIN or controlled manual-create flow
PATCH  /api/media/:id                 ADMIN
DELETE /api/media/:id                 ADMIN / soft delete
GET    /api/library?section=&status=&genre=&sort=&page=
POST   /api/library
PATCH  /api/library/:id
DELETE /api/library/:id
POST   /api/library/:id/progress
GET    /api/dashboard/summary
GET    /api/recommendations
POST   /api/recommendations/refresh
GET    /api/discovery/search?q=&type=&provider=
POST   /api/imports/preview
POST   /api/imports/confirm
GET    /api/imports/:jobId
POST   /api/media/manual
GET    /api/admin/users
PATCH  /api/admin/users/:id/role
GET    /api/admin/manual-submissions
PATCH  /api/admin/manual-submissions/:id
GET    /api/admin/ingestion-jobs
GET    /api/admin/audit-logs
```

### Required artifacts

- [x] Functional requirements and acceptance conditions.
- [x] Use-case and navigation diagrams.
- [x] External discovery, list import, manual fallback, progress, and admin workflows.
- [x] Dashboard, Discovery, Library, and Import Preview wireframes.
- [x] Validation and edge-case rules.
- [x] [Requirements and UX specification](docs/phase-2/REQUIREMENTS_AND_UX.md).
- [x] [Versioned REST API contract](docs/phase-2/API_CONTRACT.md).

### Completion checkpoint

Completed: each main flow, state transition, validation rule, error convention, and frontend/backend API shape is documented.

### Milestone commit 2

```text
docs: define discovery import manual fallback and application flows
```

---

## Phase 3 - ER diagram, relational schema, and normalization

**Status:** Completed on 5 October 2026; schema v1 is the implementation baseline for Phase 4.

**Goal:** Complete and review the database design before creating application tables.

**Suggested duration:** Week 3

### Tasks

1. Identify entities, attributes, candidate keys, primary keys, and relationship cardinalities.
2. Draw the complete ER diagram, including every table planned for implementation.
3. Transform the ER diagram into a relational schema with PK/FK annotations.
4. Create a data dictionary with column name, data type, nullability, default, constraints, description, and example.
5. Demonstrate normalization:
   - 1NF: attributes are atomic; genres and progress events are not stored as comma-separated lists.
   - 2NF: junction-table attributes depend on the whole composite key.
   - 3NF: role details, type names, genres, and provider data are separated from users/media.
6. Decide delete/update behavior for every foreign key.
7. Identify indexes based on real queries rather than indexing every column.
8. Review the design against the mandatory counts: at least four primary entities, three relationships, and eight tables.
9. Conduct a group design review before Prisma code is written.
10. Explicitly separate canonical `media_items`, provider `external_mappings`, temporary `ingestion_candidates`, and user-specific `library_entries` so imported data does not become mixed with personal progress.

### Initial index plan

- Unique index on `users.email`.
- Composite unique index on `library_entries(user_id, media_item_id)`.
- Index on `library_entries(user_id, status, updated_at)` for dashboard/library queries.
- Index on `media_items(media_type_id, title)` for filtered searches.
- Composite unique index on `external_mappings(source_id, external_id)`.
- Index on `ingestion_jobs(user_id, status, requested_at)`.
- Index on `ingestion_candidates(job_id, decision)`.
- Index on `progress_events(library_entry_id, recorded_at)`.
- Index on `recommendations(user_id, score)`.

### Required artifacts

- [x] [ER diagram and relationship summary](docs/phase-3/DATABASE_DESIGN.md).
- [x] Relational schema covering all 15 planned tables.
- [x] [Full data dictionary](docs/phase-3/DATA_DICTIONARY.md).
- [x] 1NF, 2NF, and 3NF justification.
- [x] PK/FK, nullability, defaults, checks, unique constraints, and delete rules.
- [x] Index and `EXPLAIN ANALYZE` validation plan.
- [x] Planned views, function/procedure, triggers, and transactions.

### Completion checkpoint

Completed: every intended v1 table appears in the ER diagram, relationships/cardinalities are documented, 3NF is justified, and schema v1 is frozen as the Phase 4 implementation baseline. Any later structural change requires an ER/data-dictionary update and a new migration.

### Milestone commit 3

```text
docs: add normalized ER schema dictionary and index plan
```

---

## Phase 4 - Repository foundation, PostgreSQL, and Prisma

**Goal:** Produce a reproducible development environment and a working schema populated with test data.

**Suggested duration:** Week 4

### Tasks

1. Create a repository structure such as:

```text
MediaHub/
  client/
    src/components/
    src/features/
    src/pages/
    src/services/
  server/
    src/routes/
    src/controllers/
    src/services/
    src/repositories/
    src/middleware/
    src/providers/api/
    src/providers/scrapers/
    src/providers/importers/
    src/jobs/
    src/utils/
    prisma/
  docs/
  docker-compose.yml
  README.md
```

2. Initialize React/Vite, Express, TypeScript if the team agrees to use it, ESLint, and formatting.
3. Configure PostgreSQL locally, preferably through Docker Compose.
4. Write the Prisma schema from the reviewed ER diagram.
5. Run and commit the initial migration.
6. Create a repeatable seed script containing roles, media types, genres, sources, sample users, and sample titles.
7. Add `.env.example`, `.gitignore`, health-check endpoint, and startup scripts.
8. Verify that a new member can clone the repository, copy `.env.example`, start services, migrate, and seed without undocumented steps.
9. Add the first CI job for dependency installation, linting, and build checks.

### Required artifacts

- Working client and server skeletons.
- PostgreSQL service.
- Prisma models and migration history.
- Seed script.
- Environment template.
- Updated installation section in README.

### Completion checkpoint

This phase is done when every teammate can start the same environment, Prisma Studio shows correctly related seed data, and CI passes on `dev`.

### Milestone commit 4

```text
feat: scaffold React Express PostgreSQL and Prisma foundation
```

---

## Phase 5 - Core Express API and ingestion foundations

**Goal:** Complete the database-backed business operations and the staging workflow needed by every external source.

**Suggested duration:** Weeks 5-6

### Tasks

1. Implement the route -> controller -> service -> repository structure.
2. Add Zod/Joi request validation and a standard response/error format.
3. Implement media CRUD and library CRUD with ownership rules.
4. Implement source, ingestion-job, and ingestion-candidate repositories before writing site-specific collectors.
5. Define one normalized `ProviderMedia` shape used by APIs, importers, and permitted scrapers.
6. Add discovery, preview, confirmation, job-status, and manual-title endpoints. At this stage they may use seeded/mock provider data; the real connectors arrive in Phase 8.
7. Implement progress updates inside a transaction:
   - Read and validate the library entry.
   - Update current progress/status.
   - Insert a `progress_events` record.
   - Commit together or roll back together.
8. Implement parameterized search, filtering, sorting, and server-side pagination.
9. Add dashboard queries using joins and aggregates:
   - Count by media type and status.
   - Recently updated entries.
   - Completion totals by month.
   - Most-used genres.
10. Add required database objects:
   - `user_library_summary` view.
   - `media_popularity_summary` view.
   - `get_user_genre_profile(user_id)` PostgreSQL function.
   - Audit trigger for important updates.
   - Optional progress trigger that marks a title complete at its final unit.
11. Use raw SQL only for the views, functions, triggers, or genuinely performance-critical query; use Prisma for normal database access.
12. Add indexes from Phase 3 and save representative `EXPLAIN ANALYZE` output for later comparison.
13. Write API integration tests for success, validation failure, duplicate entry, missing record, transaction rollback, pagination, and ingestion confirmation.

### Required artifacts

- Media, library, progress, dashboard, discovery, and ingestion APIs.
- Demonstrable CRUD, joins, aggregates, views, transactions, function/procedure, trigger, and indexes.
- API test suite.
- API documentation with example requests and responses.

### Completion checkpoint

This phase is done when all core operations work through API tests, failed multi-step operations roll back cleanly, and the database features required by the rubric can be demonstrated independently.

### Milestone commit 5

```text
feat: implement core APIs ingestion staging and database features
```

---

## Phase 6 - Authentication, authorization, and application security

**Goal:** Secure the system and demonstrate user/admin separation at every layer.

**Suggested duration:** Week 6

### Tasks

1. Register OAuth credentials separately for development and production callback URLs.
2. Implement Google OAuth with Passport.js.
3. On first login, create a row in the single `users` table with the default `USER` role; on later logins, update safe profile fields.
4. Store authentication in a secure server session or an equivalent secure HTTP-only cookie flow.
5. Add `requireAuth`, `requireRole`, and resource-ownership middleware.
6. Implement role-based behavior at three levels:
   - Menu: ordinary users do not see admin navigation.
   - Page: protected React routes reject unauthorized access.
   - API: Express independently rejects unauthorized requests even if UI checks are bypassed.
7. Add logout, session expiry, current-user retrieval, and clear 401/403 responses.
8. Configure CORS, Helmet, rate limiting, cookie flags, request-size limits, and environment-specific settings.
9. Confirm Prisma parameterization is used and no route concatenates user input into SQL.
10. Search the repository for hardcoded secrets and verify `.env` is ignored.
11. If local passwords are added, hash them with Argon2 or bcrypt and never store or log plaintext passwords.

### Security test cases

- Anonymous user cannot access the library.
- User A cannot update User B's library entry.
- Normal user cannot call an admin API.
- Hiding an admin button is not the only access control.
- Invalid/expired session receives 401.
- Authenticated but unauthorized request receives 403.
- Malformed IDs and SQL-like input are safely rejected or treated as data.

### Required artifacts

- Working login/logout and authenticated-profile flow.
- RBAC matrix.
- Protected API routes and React routes.
- Security test evidence.
- Secrets-management documentation.

### Completion checkpoint

This phase is done when two demo accounts can prove different permissions and direct unauthorized API calls fail correctly.

### Milestone commit 6

```text
feat: secure MediaHub with OAuth sessions and role authorization
```

---

## Phase 7 - React dashboard, reading, watching, and admin UI

**Goal:** Deliver all required user-facing functionality with responsive design and complete state handling.

**Suggested duration:** Weeks 6-8

### Shared frontend foundation

1. Build a common application shell, navigation, theme, authentication context, protected routes, API client, query keys, notifications, and error boundary.
2. Create reusable components for media cards, progress controls, status badges, search, filters, pagination, confirmation dialogs, forms, empty states, skeleton loaders, and error states.
3. Ensure every form has client-side validation, while still displaying server validation errors.
4. Test layouts at mobile, tablet, and desktop widths.

### Discovery and import page

- Search one or all configured providers.
- Display source attribution and normalized result cards.
- Preview a title before saving it.
- Show possible duplicate matches and request a decision.
- Accept supported public-list URLs or export files.
- Display ingestion job progress and errors.
- Offer **No result? Add a niche title** only after external search has been attempted.

### Central Dashboard

- Continue reading/watching list.
- Recently updated entries.
- Counts by type and status.
- Completion activity.
- Favourite genres.
- Recommendation preview.
- Global title search.

### Reading page

- Books and manga tabs.
- Chapter, volume, page, or percentage progress depending on metadata.
- Add/edit/remove entry.
- Status, genre, and rating filters.
- Sort by title, last updated, progress, or rating.
- Paginated grid/list view.

### Watching page

- Movie, TV, and anime tabs.
- Movie percentage/completion and series season/episode progress.
- Add/edit/remove entry.
- Status and genre filters.
- Sort and pagination.

### Media details page

- Cover, description, type, genres, release information, provider attribution, and units.
- User-specific status, progress, rating, and dates.
- Related/adaptation titles if the novelty table is implemented.

### Admin page

- View users and roles.
- Promote/demote authorized accounts.
- Manage duplicate or incorrect media records.
- Approve, correct, reject, or merge manually submitted niche titles.
- Inspect failed ingestion jobs and source health.
- Enable/disable sources.
- Inspect audit logs.

### Required artifacts

- Responsive login and application shell.
- Dashboard, discovery/import, reading, watching, details, recommendations, and admin pages.
- Full loading, success, empty, validation, unauthorized, and server-error states.
- Core component tests.

### Completion checkpoint

This phase is done when a user can complete every MVP workflow through the UI on both desktop and mobile, without using Prisma Studio or manually editing the database.

### Milestone commit 7

```text
feat: build responsive dashboard reading watching and admin interface
```

---

## Phase 8 - External APIs, permitted scraping, and explainable recommendations

**Goal:** Make external discovery/import the default way to populate MediaHub, preserve manual entry for missing niche works, and generate useful recommendations from the normalized catalogue.

**Suggested duration:** Weeks 8-9

### Source-selection order

Use this priority for each media category:

1. Official API.
2. Official export, public feed, or supported public-list endpoint.
3. Permitted public-page scraper.
4. Manual niche-title submission when no source contains the title.

Select the actual movie/TV, anime/manga, book, and public-list providers only after checking their current documentation, access conditions, rate limits, and attribution requirements. Do not build around a source merely because its HTML can technically be downloaded.

### Common provider interface

Every source connector should implement the same contract so routes and services never depend on a particular website:

```ts
interface MediaProvider {
  key: string;
  supportedTypes: MediaType[];
  search(query: SearchQuery): Promise<ProviderMedia[]>;
  getDetails(externalId: string): Promise<ProviderMedia>;
  importPublicList?(input: PublicListInput): Promise<ProviderListItem[]>;
}
```

Normalize all output before staging it:

```ts
type ProviderMedia = {
  provider: string;
  externalId: string;
  mediaType: "MOVIE" | "TV" | "ANIME" | "MANGA" | "BOOK";
  title: string;
  alternateTitles: string[];
  description?: string;
  releaseDate?: string;
  coverUrl?: string;
  genres: string[];
  totalUnits?: number;
  sourceUrl: string;
};
```

### API and public-list connector tasks

1. Create a separate adapter for each provider.
2. Keep provider credentials in environment variables.
3. Implement request timeouts and retry only safe transient failures.
4. Respect rate limits and cache short-lived search results.
5. Store source attribution, external ID, source URL, and last-sync time.
6. Do not permanently save every search result. Stage or save only results the user selects/imports.
7. Support a public-list URL or export-file importer when a permitted source is available.
8. Track each large import in `ingestion_jobs` so the UI can show running, preview-ready, completed, or failed status.

### Permitted scraper tasks

1. Verify that the page is public and automated access is permitted; record that decision in the source-policy document.
2. Create one scraper module per site so selector changes remain isolated.
3. Fetch conservatively using a descriptive user agent and source-appropriate rate limiting.
4. Parse only fields needed for MediaHub and validate the result against `ProviderMedia`.
5. Never store login cookies, private page contents, or credentials collected from a browser session.
6. Add fixture-based parser tests using permitted sample HTML so automated tests do not repeatedly contact the live site.
7. When the HTML structure changes, fail the ingestion job with a useful message instead of saving empty or corrupt metadata.

### Staging, preview, and deduplication

```text
Search / public-list URL / export file
  -> provider adapter
  -> normalized ProviderMedia records
  -> ingestion_candidates staging table
  -> exact external-ID matching
  -> title + type + year similarity matching
  -> preview and conflict resolution
  -> confirmed transaction
  -> canonical media + mappings + optional library entries
```

Deduplicate in this order:

1. If `(source_id, external_id)` exists, reuse its canonical `media_item_id`.
2. Otherwise compare normalized title, media type, and release year.
3. If the likely match is strong, propose the existing title in the preview.
4. If confidence is uncertain, show both choices and require confirmation.
5. Never silently merge conflicting records.

### Manual niche-title fallback

The manual form should be secondary to external search and appear as **No result? Add a niche title**. Require a title, media type, and at least one supporting detail such as creator, release year, description, or public reference URL. Genres, cover, and total units may be optional.

Mark the record as manually sourced and `PENDING_REVIEW`. An admin can approve, correct, merge, or reject it. If an external match is discovered later, add its external mapping to the existing canonical record rather than creating a duplicate.

### Recommendation MVP

1. Create a user preference profile from completed/in-progress titles, ratings, statuses, and genres.
2. Give stronger weight to highly rated/completed items and weaker or negative weight to dropped/poorly rated items.
3. Represent the user and candidate title as genre/tag vectors.
4. Compute cosine similarity.
5. Exclude items already in the library unless the feature explicitly recommends resuming them.
6. Add popularity or freshness as a small secondary score, not the primary signal.
7. Store the score, model version, and a human-readable explanation.
8. Evaluate with several prepared personas and confirm recommendations change when library preferences change.

### Recommended novelty implementation order

1. **Explainable recommendations** - show which genres and liked titles affected the result.
2. **Unified progress model** - already part of the core design and a strong differentiator.
3. **Cross-media recommendations** - allow a book preference to influence movie/anime suggestions.
4. **Adaptation graph** - connect source novels, manga, anime, movies, sequels, and spin-offs.
5. **What should I consume next?** - rank results using available time, desired format, and mood.

Treat items 4-5 as stretch goals. They must not delay security, database evidence, testing, or deployment.

### Required artifacts

- Provider adapter interface.
- At least one working source for each broad media domain, or a documented staged rollout that still covers reading and watching.
- A permitted public-list importer or documented reason it was not feasible.
- Import/search preview, staging, normalization, conflict resolution, deduplication, and transactional save.
- Manual niche-title form and admin review/merge flow.
- Ingestion job status and error reporting.
- Mocked API tests and fixture-based scraper parser tests.
- Recommendation algorithm and stored explanations.
- Evaluation examples for multiple user tastes.

### Completion checkpoint

This phase is done when a normal user can populate a library primarily from external sources, the same title is not duplicated across providers, a missing niche title can still be submitted manually, provider failures are visible and recoverable, and every recommendation has a reproducible score and understandable reason.

### Milestone commit 8

```text
feat: add external connectors deduplication manual fallback and recommendations
```

Because this phase is substantial, additional meaningful commits are recommended:

```text
feat: add movie television anime manga and book adapters
feat: add permitted public-list importer and ingestion preview
test: add provider mocks and scraper parsing fixtures
```

---

## Phase 9 - Testing, performance, backup/recovery, Docker, and audit

**Goal:** Prove that the application is reliable, recoverable, secure, and easy to run.

**Suggested duration:** Week 9

### Testing plan

- **Unit:** validators, progress conversion, recommendation weights/similarity, normalization, and deduplication.
- **Provider:** mocked API responses and fixture-based permitted-scraper parsing.
- **API integration:** CRUD, imports, conflicts, search, filters, pagination, RBAC, transaction rollback, trigger effects, and error responses.
- **Frontend:** forms, protected routes, filters, progress controls, loading/empty/error states.
- **End-to-end:** login, external search/import, manual fallback, add title, update progress, view dashboard, obtain recommendation, and admin authorization.

### Performance tasks

1. Seed enough records to make query behavior meaningful.
2. Measure dashboard, title search, filtered library, and recommendation candidate queries with `EXPLAIN ANALYZE`.
3. Record results before and after targeted indexes.
4. Remove redundant indexes and check pagination remains stable.
5. Avoid N+1 query patterns in services.

### Backup and recovery tasks

1. Create a PostgreSQL backup with `pg_dump` using a documented command.
2. Restore into a separate empty test database with `pg_restore`.
3. Verify schema objects, table counts, views, functions, triggers, and representative data.
4. Record the test date and result in the documentation.

### Docker and quality tasks

1. Create frontend and backend Dockerfiles and a Docker Compose configuration.
2. Add health checks and correct service dependency/startup handling.
3. Extend GitHub Actions to run lint, tests, Prisma generation, and builds.
4. Perform an accessibility pass: labels, keyboard navigation, contrast, focus states, and useful alt text.
5. Perform a security/repository audit for secrets, debug logs, dependency issues, and incorrect production configuration.

### Required artifacts

- Automated test suite and test report.
- Before/after query-plan evidence.
- Verified backup and restore guide.
- Dockerfiles and Docker Compose.
- Passing CI pipeline.
- Audit log demonstration as the additional industry best practice.

### Completion checkpoint

This phase is done when CI passes from a clean checkout, the backup is successfully restored into a separate database, and the team has recorded evidence for performance and security tests.

### Milestone commit 9

```text
test: verify imports recommendations performance backup and Docker
```

An additional CI commit is encouraged:

```text
ci: run lint tests Prisma checks and builds on pull requests
```

---

## Phase 10 - Deployment, final documentation, and demonstration

**Goal:** Produce a stable public demonstration and a submission package directly aligned with the rubric.

**Suggested duration:** Week 10

### Deployment tasks

1. Provision production PostgreSQL and run migrations safely.
2. Deploy Express and configure database, session, OAuth, and allowed-origin secrets.
3. Deploy React and configure the production API URL.
4. Update OAuth callback URLs, CORS, secure cookies, proxy trust, and HTTPS behavior.
5. Seed only safe demo/reference data; do not copy sensitive development data.
6. Run production smoke tests for both `USER` and `ADMIN` accounts.
7. Configure logs/health checks and document how to diagnose a failed deployment.

### Documentation tasks

Complete the README with:

- Problem and solution.
- Feature list and screenshots.
- Architecture and stack.
- Prerequisites, installation, environment variables, migration, seed, and run commands.
- Test and Docker commands.
- Deployment overview.
- Course-required team details, maintained separately from this phase plan.

Prepare the academic evidence pack:

- Proposal and Gantt chart.
- ER diagram, relational schema, data dictionary, and normalization proof.
- Constraints and index list.
- Screenshots/output for CRUD, joins, aggregates, views, transaction rollback, function/procedure, and trigger.
- Authentication/RBAC and security evidence.
- Backup and restore evidence.
- Git history, branches, pull requests, Docker, CI/CD, and live URL.

### Demonstration sequence

1. Explain the cross-platform media problem and project objectives.
2. Show the ER diagram and explain why the unified schema is in 3NF.
3. Log in as a user and show dashboard, reading, and watching sections.
4. Search an external source and preview normalized metadata.
5. Import a title and demonstrate external-ID and title-based duplicate prevention.
6. Search for a niche title that is unavailable and use the manual fallback.
7. Update progress and show the history/dashboard change.
8. Show search, filtering, pagination, and validation.
9. Generate an explainable cross-media recommendation.
10. Attempt an admin action as a normal user and show it is rejected.
11. Log in as admin, review the manual title, and inspect ingestion/audit records.
12. Demonstrate the database view, aggregate query, transaction, function, trigger, index evidence, and backup/restore.
13. Show GitHub workflow, CI/CD, Docker, and the deployed URL.

### Required artifacts

- Live frontend and backend.
- Managed production database.
- Final README and evidence pack.
- Demo accounts and rehearsed presentation.
- Tagged final release in GitHub.

### Completion checkpoint

This phase is done when a new reviewer can follow the README, the live demo passes the full sequence, and every rubric row points to visible evidence.

### Milestone commit 10

```text
release: complete deployment documentation and evaluation evidence
```

After testing this commit, merge the release to `main` and create a tag such as `v1.0.0`.

---

## 6. Ten-week schedule and dependencies

| Week | Main outcome | Work that may overlap |
|---|---|---|
| 1 | Approved proposal, source policy, scope, repository | Backlog creation |
| 2 | User stories, workflows, wireframes, API draft | Initial UI component exploration |
| 3 | Approved ER diagram, schema, dictionary, normalization | API contract review |
| 4 | Reproducible project skeleton, PostgreSQL, Prisma migration/seed | CI foundation |
| 5 | Core API, ingestion staging, CRUD, validation, queries | Provider research and fixtures |
| 6 | Progress transaction, DB objects, authentication/RBAC | Dashboard and library UI |
| 7 | Central, reading, watching, details, and admin flows | API integration tests |
| 8 | API/scraper adapters, public-list import, deduplication, manual fallback, recommendation MVP | Responsive and accessibility fixes |
| 9 | Full tests, performance, backup/restore, Docker, CI/CD | Deployment preparation |
| 10 | Deployment, evidence pack, README, rehearsal | Bug fixes only; freeze new features |

The critical dependency chain is:

```text
Scope/source policy -> Requirements -> ER/Schema -> Migration -> Core API/staging
      -> Authentication/RBAC -> Complete UI -> External connectors/Recommendations
      -> Testing/Recovery -> Deployment/Demo
```

Do not start provider integrations before the canonical media schema exists. Do not leave authentication, backup, or deployment to the last two days.

## 7. Ten-commit minimum checklist

These are milestone commits, not a maximum. Use more commits whenever a change is independently testable and reviewable.

| Commit | Phase | Expected content |
|---:|---|---|
| 1 | Definition | Proposal, scope, source policy, timeline, repository structure |
| 2 | Requirements | User flows, wireframes, progress rules, API contract |
| 3 | Database design | ER diagram, relational schema, dictionary, 3NF, indexes |
| 4 | Foundation | React, Express, PostgreSQL, Prisma, migration, seed, initial CI |
| 5 | Core API | CRUD, ingestion staging, progress transaction, views/function/trigger/indexes |
| 6 | Security | OAuth, sessions, USER/ADMIN RBAC, protected pages and APIs |
| 7 | Frontend | Dashboard, discovery/import, reading, watching, details, admin UI |
| 8 | External data | API/scraper adapters, public-list import, deduplication, manual fallback, recommendations |
| 9 | Quality | Tests, performance evidence, backup/restore, Docker, CI/CD |
| 10 | Release | Deployment, README, evidence pack, demo preparation |

Recommended branch flow:

```text
feature/<phase-or-feature>
        -> pull request and review
        -> dev
        -> tested release pull request
        -> main
```

Do not put unrelated unfinished work in one milestone commit. For example, provider adapters, database triggers, and React pages should be additional separate commits if they are completed at different times.

## 8. Definition of done for every task

A task may move to `Done` only when:

- Its acceptance criteria are met.
- Code is formatted and linted.
- Relevant tests pass.
- Database changes include a migration and ER/data-dictionary update when necessary.
- API behavior or setup changes are documented.
- No secrets or temporary debug code are included.
- Another member reviewed the pull request.
- The feature works after a clean checkout or in the shared development environment.

## 9. Risk register and fallback decisions

| Risk | Likely impact | Planned response |
|---|---|---|
| External API is unavailable or rate-limited | Search/import demo fails | Cache results, handle timeouts, retain manual add, and seed demo data |
| Provider fields do not match | Incorrect or incomplete catalogue | Normalize through adapters; keep provider-specific code outside core services |
| Duplicate titles from several providers | Poor data quality | Unique external IDs plus title/type/year matching and confirmation flow |
| OAuth configuration fails in production | Users cannot sign in | Configure callbacks early and retain a documented development login strategy if faculty permits |
| Recommendation model becomes too ambitious | Core work is delayed | Ship transparent genre-vector similarity first; treat advanced AI as stretch work |
| Schema changes repeatedly | Broken migrations and blocked teammates | Freeze schema v1 after Phase 3; change through reviewed additive migrations |
| Knowledge is not shared | Integration and viva risk | PR reviews, weekly demos, shared documentation, and walkthroughs |
| Deployment platform sleeps or has limits | Slow demo | Warm the service before evaluation and prepare local Docker fallback |
| Insufficient database emphasis | Lost DBMS marks | Maintain a rubric evidence checklist from Phase 3 onward |

## 10. Rubric coverage checklist

| Evaluation area | Planned evidence |
|---|---|
| Problem and planning | Proposal, objectives, scope, course-required contributor information, stack, deliverables, Gantt chart |
| Database design | ER diagram, 15 core tables, relationships, schema, constraints, data dictionary, 3NF explanation |
| Database implementation | Prisma migrations/CRUD, joins, aggregate queries, views, transaction, function, trigger, indexes |
| Application development | React/Express, dashboard, responsive design, CRUD, search, filters, pagination, validation, error handling |
| Authentication and security | OAuth, login/logout, secure session, single users table, USER/ADMIN RBAC, Prisma, secret management |
| Professional practices | Private GitHub, branches/commits/PRs, `.gitignore`, README, `pg_dump`/`pg_restore`, Docker, deployment |
| Bonus | GitHub Actions CI/CD and audit logging or measured performance optimization |

## 11. Final priority rule

When time is limited, complete work in this order:

1. Correct ER design and PostgreSQL implementation.
2. External discovery/import, normalization, deduplication, and manual niche-title fallback.
3. Reliable CRUD, progress transactions, queries, views, function, trigger, and indexes.
4. Authentication, RBAC, security, and validation.
5. Complete responsive dashboard/reading/watching flows.
6. Testing, backup/restore, Docker, and deployment.
7. Explainable recommendation MVP.
8. Adaptation graphs, mood/time ranking, and other stretch features.

The project should be judged as a strong database application first. Novel features should strengthen the core design, not replace required database, security, testing, or deployment evidence.
