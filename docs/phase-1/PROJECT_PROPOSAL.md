# MediaHub Project Proposal

**Planning status:** Approved baseline for implementation  
**Prepared:** 5 October 2026  
**Course:** Database Systems Lab

## Project title

**MediaHub - Unified Cross-Media Library, Progress Tracker, and Recommendation Platform**

## Application domain

Media library management and personalized recommendation systems within the media and entertainment domain.

## Problem statement

People consume movies, TV shows, anime, manga, and books across several websites and applications. Each service stores its own list, rating, and progress data. Users therefore have to switch between services, remember where they stopped, maintain spreadsheets or notes, and accept recommendations based on only one part of their interests.

The existing approach causes fragmented progress, duplicate entries, inconsistent metadata, manual maintenance, and incomplete recommendations. MediaHub addresses this by maintaining one normalized relational database for a user's entire media library.

## Proposed solution

MediaHub will discover and import titles through external provider APIs, user-owned exports, public lists, and permitted public-page collectors. Imported records will pass through normalization, staging, duplicate detection, and confirmation before becoming canonical MediaHub records. Users will not need to type ordinary titles manually. A reviewed manual-entry option will remain available for niche or missing works.

The application will provide:

- A central dashboard covering all media categories.
- Reading pages for books and manga.
- Watching pages for movies, TV shows, and anime.
- Page, chapter, volume, episode, season, and percentage progress tracking.
- External search and list import with source attribution.
- Duplicate prevention across providers.
- Search, filters, sorting, pagination, and validation.
- Explainable cross-media recommendations based on genres, ratings, and history.
- Google OAuth login and `USER`/`ADMIN` authorization.
- Administrative review of manual records, ingestion failures, duplicates, and audit events.

## Objectives

1. Design a PostgreSQL database in Third Normal Form or higher for catalogue, source, ingestion, library, progress, recommendation, and security data.
2. Implement at least 8-10 related tables with keys, constraints, indexes, views, transactions, a database function/procedure, and a trigger.
3. Build a responsive React frontend and Express.js REST API using Prisma ORM.
4. Automate title discovery through approved external sources while retaining controlled manual entry for missing media.
5. Track progress consistently across reading and watching formats.
6. Generate explainable recommendations from the user's combined media preferences.
7. Protect user data through authentication, RBAC, secure sessions, parameterized ORM access, and environment-based secrets.
8. Demonstrate backup/recovery, Docker, automated tests, CI/CD, and cloud deployment.

## Scope

### Included in the MVP

- Movies, TV shows, anime, manga, and books.
- Google OAuth login/logout and authenticated profile retrieval.
- External provider search and detail retrieval.
- Preview-before-import and list-import jobs.
- Metadata normalization and duplicate detection.
- Manual niche-title submission with admin review.
- Personal library CRUD, status, rating, and progress history.
- Central dashboard, Reading, Watching, Discovery, Recommendations, and Admin areas.
- `USER` and `ADMIN` roles using one `users` table.
- Content-based, genre-vector recommendations with explanations.
- PostgreSQL backup and verified restore.

### Outside the MVP

- Automated access to private accounts without explicit user authorization.
- Scraping sources that prohibit automated collection.
- Real-time synchronization with every media platform.
- Streaming, hosting, or distributing copyrighted media.
- Social feeds, messaging, payments, and native mobile applications.
- Training a large proprietary AI model.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, React Router, TanStack Query |
| Styling | Tailwind CSS or Material UI; one will be selected during setup |
| Forms | React Hook Form and Zod |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Google OAuth 2.0, Passport.js, secure server sessions |
| External data | TMDB, Google Books, Open Library fallback, provisional Kitsu connector, user-owned exports |
| Testing | Vitest, React Testing Library, Supertest |
| DevOps | Docker Compose and GitHub Actions |
| Deployment | Vercel/Netlify plus Render/Railway |

## Major deliverables

1. Project proposal, source policy, and ten-phase schedule.
2. Requirements, use cases, wireframes, and API contract.
3. ER diagram, relational schema, data dictionary, normalization proof, constraints, and index plan.
4. React/Express/PostgreSQL/Prisma project with migrations and seed data.
5. External ingestion, normalization, deduplication, and manual fallback.
6. Secure CRUD, dashboard, progress, recommendation, and admin functionality.
7. Test report, performance evidence, backup/restore proof, Docker, and CI/CD.
8. Live deployment, README, demonstration script, and rubric evidence pack.

## Ten-phase schedule

| Phase | Main outcome | Target week |
|---:|---|---:|
| 1 | Proposal, scope, source policy, repository plan | 1 |
| 2 | Requirements, workflows, wireframes, API contract | 2 |
| 3 | ER diagram, schema, dictionary, normalization | 3 |
| 4 | React/Express/PostgreSQL/Prisma foundation | 4 |
| 5 | Core API, ingestion staging, and advanced DB features | 5 |
| 6 | Authentication, RBAC, and security | 6 |
| 7 | Dashboard, discovery, reading, watching, and admin UI | 7 |
| 8 | External connectors, imports, deduplication, recommendations | 8 |
| 9 | Testing, performance, backup, Docker, and CI/CD | 9 |
| 10 | Deployment, documentation, evidence, and demonstration | 10 |

## Assumptions and decisions

- External search/import is the default title-addition flow.
- Only selected records become canonical catalogue entries; ordinary search results are not permanently stored.
- Provider-specific identifiers remain in `external_mappings`, not in `media_items`.
- External-source availability is not guaranteed, so saved libraries continue working during provider outages.
- The initial recommendation system will be transparent and reproducible rather than generative.
- Course-required team details will be maintained separately; this execution plan intentionally does not allocate phases to individuals.

## Phase 1 acceptance record

- [x] Title, problem, objectives, scope, stack, deliverables, and timeline documented.
- [x] MVP and non-scope defined.
- [x] Source selection and collection policy documented.
- [x] Ten-phase execution plan exists.
- [ ] Faculty approval recorded when received.
- [ ] GitHub remote, collaborators, and protected branches configured when account details are available.

The planning portion of Phase 1 is complete. The two unchecked items require external faculty/GitHub actions and do not block Phases 2-3 documentation.
