# Phase 5 API Reference

**Status:** Implemented and used by the React client. Provider-specific discovery adapters and
connected-account synchronization are documented separately in Phase 8 and Additional.

This document describes the endpoints that are implemented and tested at the end of
Phase 5. The earlier Phase 2 contract remains the long-term design; this reference is the
current runnable API.

## Run and authenticate locally

Start PostgreSQL and the API:

```bash
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev:server
```

The base URL is `http://localhost:3000/api/v1`.

Until OAuth is added in Phase 6, protected routes use this temporary development header:

```text
x-user-id: 00000000-0000-4000-8000-000000000002
```

That UUID belongs to the seeded standard user. It is validated as an active user on every
protected request. It is not a production authentication mechanism and will be replaced by
the server-side session.

## Response conventions

Successful responses use `data` and, for paginated endpoints, `meta`:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 6,
    "totalPages": 1,
    "sort": "title:asc"
  }
}
```

Errors use one consistent shape. The `requestId` is also returned in the
`x-request-id` response header.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [{ "field": "rating", "message": "Invalid number: must be a multiple of 0.5" }],
    "requestId": "req_5acb..."
  }
}
```

## Endpoint summary

| Method | Route                               | Phase 5 access       | Purpose                                         |
| ------ | ----------------------------------- | -------------------- | ----------------------------------------------- |
| GET    | `/`                                 | Public               | API name and version                            |
| GET    | `/health/live`                      | Public               | Process liveness                                |
| GET    | `/health/ready`                     | Public               | PostgreSQL readiness                            |
| GET    | `/media`                            | Public               | Search and paginate the canonical catalogue     |
| GET    | `/media/:mediaId`                   | Public               | Canonical media details                         |
| POST   | `/media/manual`                     | Public until Phase 6 | Submit a niche title for review                 |
| GET    | `/library`                          | Development user     | Current user's library                          |
| POST   | `/library`                          | Development user     | Add a canonical title                           |
| PATCH  | `/library/:libraryEntryId`          | Owner                | Update status, rating, or notes                 |
| DELETE | `/library/:libraryEntryId`          | Owner                | Remove an entry                                 |
| POST   | `/library/:libraryEntryId/progress` | Owner                | Transactional progress update                   |
| GET    | `/dashboard/summary`                | Development user     | Counts, recent entries, completions, and genres |
| GET    | `/discovery/providers`              | Development user     | Provider availability and attribution           |
| GET    | `/discovery/search`                 | Development user     | Search and normalize external metadata          |
| POST   | `/imports/preview`                  | Development user     | Stage selected normalized results               |
| GET    | `/imports/:jobId`                   | Job owner            | Read preview or completion state                |
| POST   | `/imports/:jobId/confirm`           | Job owner            | Atomically create, reuse, or skip candidates    |

## Health

```bash
curl http://localhost:3000/api/v1/health/live
curl http://localhost:3000/api/v1/health/ready
```

The readiness route returns `503 DATABASE_UNAVAILABLE` if PostgreSQL cannot be queried.

## Canonical media

### List media

```http
GET /api/v1/media?page=1&limit=20&q=dune&type=BOOK&section=READING&sort=title:asc
```

All query parameters are optional:

- `page`: integer starting at 1; default `1`.
- `limit`: 1–100; default `20`.
- `q`: case-insensitive title search.
- `type`: `MOVIE`, `TV`, `ANIME`, `MANGA`, or `BOOK`.
- `section`: `READING` or `WATCHING`.
- `sort`: `title:asc`, `title:desc`, or `createdAt:desc`.

### Get media details

```bash
curl http://localhost:3000/api/v1/media/10000000-0000-4000-8000-000000000001
```

The result includes type, genres, provider mappings, units, origin, review status, and
active state. An unknown active title returns `404 MEDIA_NOT_FOUND`.

### Submit a manual niche title

```bash
curl -X POST http://localhost:3000/api/v1/media/manual \
  -H 'content-type: application/json' \
  -d '{
    "title": "A Small Regional Anthology",
    "mediaType": "BOOK",
    "description": "A title not found through the configured providers.",
    "releaseYear": 2025,
    "genres": ["Anthology"],
    "totalUnits": 180
  }'
```

Manual records are saved with origin `MANUAL` and review status `PENDING_REVIEW`. A title
with the same normalized name and media type returns `409 MEDIA_ALREADY_EXISTS`.

## Personal library

Every example in this section needs the seeded user's header.

### List entries

```bash
curl 'http://localhost:3000/api/v1/library?section=READING&status=IN_PROGRESS&page=1&limit=20&sort=updatedAt:desc' \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000002'
```

Filters are `section`, `status`, and a genre name. Sort values are `updatedAt:desc`,
`title:asc`, and `rating:desc`.

### Add an entry

```bash
curl -X POST http://localhost:3000/api/v1/library \
  -H 'content-type: application/json' \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000002' \
  -d '{
    "mediaItemId": "10000000-0000-4000-8000-000000000003",
    "status": "PLANNED",
    "notes": "Watch after the current series"
  }'
```

Valid statuses are `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD`, and `DROPPED`.
Ratings use 0–10 in increments of 0.5. Adding the same title twice returns
`409 LIBRARY_ENTRY_EXISTS`.

### Edit or remove an entry

```bash
curl -X PATCH http://localhost:3000/api/v1/library/LIBRARY_ENTRY_UUID \
  -H 'content-type: application/json' \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000002' \
  -d '{"status":"IN_PROGRESS","rating":8.5,"notes":"Started this week"}'

curl -X DELETE http://localhost:3000/api/v1/library/LIBRARY_ENTRY_UUID \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000002'
```

Ownership is enforced in the query. A missing entry or another user's entry returns
`404 LIBRARY_ENTRY_NOT_FOUND` without exposing ownership information.

### Record progress

```bash
curl -X POST http://localhost:3000/api/v1/library/LIBRARY_ENTRY_UUID/progress \
  -H 'content-type: application/json' \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000002' \
  -d '{"progressValue":75,"note":"Reached 75 percent"}'
```

The library update and new `progress_events` row run in one database transaction. The
service rejects values above the title's maximum, verifies that an optional
`currentUnitId` belongs to the same title, and automatically derives the status. Reaching
the maximum marks the entry `COMPLETED`.

## Dashboard

```bash
curl http://localhost:3000/api/v1/dashboard/summary \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000002'
```

The response contains total titles, counts by status and media type, five recent entries,
completion counts grouped by month, and the five most-used genres.

## External discovery

### Provider status

```bash
curl http://localhost:3000/api/v1/discovery/providers \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000002'
```

Configured mappings are:

| Media type      | Provider     | API key required    |
| --------------- | ------------ | ------------------- |
| Movie           | OMDb         | Yes, `OMDB_API_KEY` |
| Anime and manga | Jikan        | No                  |
| Book            | Open Library | No                  |

### Search

```bash
curl 'http://localhost:3000/api/v1/discovery/search?q=one%20piece&type=MANGA&provider=jikan&page=1&limit=10' \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000002'
```

The required parameters are `q` and `type`. The optional provider must match the media
type. Every provider is normalized into this shape before it reaches import staging:

```json
{
  "provider": "jikan",
  "externalId": "13",
  "mediaType": "MANGA",
  "title": "One Piece",
  "alternateTitles": [],
  "description": "...",
  "releaseDate": "1997-07-22T00:00:00+00:00",
  "coverUrl": "https://...",
  "genres": ["Action", "Adventure", "Fantasy"],
  "totalUnits": 1150,
  "sourceUrl": "https://myanimelist.net/manga/13/One_Piece"
}
```

Provider timeouts, rate limits, upstream errors, and missing OMDb configuration have
separate error codes.

## Staged imports

Search results are not saved immediately. The client sends only selected normalized
items to preview.

### Create a preview

```bash
curl -X POST http://localhost:3000/api/v1/imports/preview \
  -H 'content-type: application/json' \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000002' \
  -d '{
    "kind": "SELECTED_RESULTS",
    "defaultLibraryStatus": "PLANNED",
    "items": [{
      "provider": "open-library",
      "externalId": "OL262758W",
      "mediaType": "BOOK",
      "title": "Dune",
      "alternateTitles": [],
      "genres": ["Science Fiction"],
      "sourceUrl": "https://openlibrary.org/works/OL262758W"
    }]
  }'
```

The response has status `PREVIEW_READY`. Each candidate proposes:

- `REUSE` for an exact `(source, externalId)` mapping.
- `REVIEW_MATCH` for a same-type normalized-title match.
- `CREATE` when no match exists.

### Read and confirm the job

```bash
curl http://localhost:3000/api/v1/imports/JOB_UUID \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000002'

curl -X POST http://localhost:3000/api/v1/imports/JOB_UUID/confirm \
  -H 'content-type: application/json' \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000002' \
  -d '{
    "decisions": [
      {"candidateId":"CANDIDATE_UUID","action":"REUSE","mediaItemId":"MEDIA_UUID"}
    ]
  }'
```

Allowed decisions are `CREATE`, `REUSE`, and `SKIP`. Exactly one decision is required for
every candidate. Confirmation is one transaction: if any candidate or reuse target is
invalid, no candidate decision, mapping, media record, library entry, or job count is
committed.

## Automated verification

```bash
npm test
```

The Phase 5 suite covers authentication errors, validation errors, missing records,
pagination, provider normalization, preview/confirmation, rollback, duplicate library
entries, progress, audit logging, and dashboard aggregates. CI starts PostgreSQL, applies
migrations, seeds the database, and runs the same suite.
