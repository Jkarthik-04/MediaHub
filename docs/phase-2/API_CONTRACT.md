# MediaHub REST API Contract v1

**Base path:** `/api/v1`  
**Format:** JSON except OAuth redirects and file uploads  
**Status:** Planning baseline; OpenAPI generation will be added during implementation

## Conventions

### Authentication

- Browser authentication uses a secure HTTP-only session cookie.
- State-changing requests require the session and CSRF protection appropriate to the chosen session architecture.
- `401` means unauthenticated; `403` means authenticated but unauthorized.

### Success envelope

```json
{
  "data": {},
  "meta": {}
}
```

### Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "rating", "message": "Must be between 1 and 10" }
    ],
    "requestId": "req_..."
  }
}
```

### Pagination

```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 87,
    "totalPages": 5,
    "sort": "updatedAt:desc"
  }
}
```

Default `limit` is 20; maximum is 100. Stable sorting adds `id` as a final tie-breaker.

## Authentication

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/auth/google` | Public | Start Google OAuth |
| GET | `/auth/google/callback` | Public | OAuth callback; establishes session |
| GET | `/auth/me` | User/Admin | Return authenticated profile and role |
| POST | `/auth/logout` | User/Admin | Destroy session and clear cookie |

`GET /auth/me` response:

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Example User",
    "avatarUrl": "https://...",
    "role": "USER"
  }
}
```

## Providers and discovery

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/providers` | User/Admin | Enabled providers and supported media types |
| GET | `/discovery/search` | User/Admin | Federated or provider-specific search |
| GET | `/discovery/:provider/:externalId` | User/Admin | Normalized provider detail preview |

Search query:

```text
q=<required text>&type=MOVIE|TV|ANIME|MANGA|BOOK&provider=<optional>&page=1&limit=20
```

Each result includes provider, external ID, source URL, media type, title, alternate titles, summary, date/year, cover URL, genres, total units, and a short-lived preview token or normalized candidate ID.

## Import jobs

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/imports/preview` | User/Admin | Create preview from selected search results, public-list URL, or uploaded export |
| GET | `/imports/:jobId` | Owner/Admin | Poll job status and counts |
| GET | `/imports/:jobId/candidates` | Owner/Admin | Paginated candidates/conflicts |
| POST | `/imports/:jobId/confirm` | Owner/Admin | Commit user decisions |
| POST | `/imports/:jobId/cancel` | Owner/Admin | Cancel queued/preview-ready job |

Selected-results preview request:

```json
{
  "kind": "SELECTED_RESULTS",
  "items": [
    { "provider": "tmdb", "externalId": "1399", "mediaType": "TV" }
  ],
  "defaultLibraryStatus": "PLANNED"
}
```

List URL request:

```json
{
  "kind": "PUBLIC_LIST_URL",
  "provider": "supported-provider-key",
  "url": "https://provider.example/public/list/..."
}
```

Confirmation request:

```json
{
  "decisions": [
    { "candidateId": "uuid", "action": "CREATE" },
    { "candidateId": "uuid", "action": "REUSE", "mediaItemId": "uuid" },
    { "candidateId": "uuid", "action": "SKIP" }
  ]
}
```

## Canonical media

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/media` | User/Admin | Search/filter canonical catalogue |
| GET | `/media/:mediaId` | User/Admin | Details, genres, units, sources, user-specific library state |
| POST | `/media/manual` | User/Admin | Submit a missing niche title |
| PATCH | `/media/:mediaId` | Admin | Correct canonical metadata |
| DELETE | `/media/:mediaId` | Admin | Soft-delete/disable when safe |

Manual request:

```json
{
  "title": "Niche title",
  "mediaType": "BOOK",
  "creatorText": "Creator name",
  "releaseYear": 2026,
  "description": "Optional description",
  "referenceUrl": "https://public-reference.example/item",
  "genres": ["Speculative Fiction"],
  "totalUnits": 240,
  "addToLibrary": true,
  "libraryStatus": "PLANNED"
}
```

## Personal library and progress

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/library` | User/Admin | Current user's paginated entries |
| POST | `/library` | User/Admin | Add canonical title to current user's library |
| GET | `/library/:entryId` | Owner/Admin | Entry and progress history |
| PATCH | `/library/:entryId` | Owner/Admin | Change status, rating, dates, or notes |
| DELETE | `/library/:entryId` | Owner/Admin | Remove current user's entry according to retention policy |
| POST | `/library/:entryId/progress` | Owner/Admin | Transactional progress update |

Library query parameters:

```text
section=READING|WATCHING
type=MOVIE|TV|ANIME|MANGA|BOOK
status=PLANNED|IN_PROGRESS|COMPLETED|ON_HOLD|DROPPED
genre=<slug>&q=<text>&sort=updatedAt:desc&page=1&limit=20
```

Progress request:

```json
{
  "progressValue": 12,
  "unitId": "optional-uuid",
  "note": "Finished episode 12"
}
```

The server derives percentage/status where possible and never accepts `userId` from the browser for personal operations.

## Dashboard and recommendations

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/dashboard/summary` | User/Admin | Continue items, recent activity, counts, trends, genres |
| GET | `/recommendations` | User/Admin | Current paginated recommendations |
| POST | `/recommendations/refresh` | User/Admin | Regenerate recommendations with throttling |
| POST | `/recommendations/:id/feedback` | Owner/Admin | Mark useful/not interested/dismissed |

Recommendation response item:

```json
{
  "id": "uuid",
  "media": { "id": "uuid", "title": "...", "mediaType": "ANIME" },
  "score": 0.86,
  "reason": "Matches your strong preference for mystery and science fiction.",
  "modelVersion": "genre-vector-v1",
  "generatedAt": "2026-10-05T12:00:00Z"
}
```

## Admin

All routes require `ADMIN`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/admin/users` | Paginated user list |
| PATCH | `/admin/users/:userId/role` | Controlled role update; cannot remove last admin |
| GET | `/admin/manual-submissions` | Pending/manual catalogue records |
| POST | `/admin/manual-submissions/:mediaId/approve` | Approve/correct record |
| POST | `/admin/manual-submissions/:mediaId/merge` | Merge into canonical media transactionally |
| POST | `/admin/manual-submissions/:mediaId/reject` | Reject with reason |
| GET | `/admin/ingestion-jobs` | Search jobs/errors by status/source/user/date |
| GET | `/admin/audit-logs` | Read-only paginated audit log |
| PATCH | `/admin/providers/:sourceId` | Enable/disable configured source |

Merge request:

```json
{
  "targetMediaId": "canonical-uuid",
  "reason": "Same work; manual submission lacked external mapping"
}
```

All affected library entries, mappings, genres, recommendations, and audit data are handled in one transaction or by documented merge rules.

## Health

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/health/live` | Public | Process is running; no sensitive details |
| GET | `/health/ready` | Deployment/platform | Database readiness; protected or minimal in production |

## HTTP status rules

| Status | Meaning |
|---:|---|
| 200 | Successful read/update/action |
| 201 | Resource/job created |
| 202 | Background import/recommendation job accepted |
| 204 | Successful action with no response body |
| 400 | Malformed request |
| 401 | Authentication required/expired |
| 403 | Authenticated but role/ownership denied |
| 404 | Resource not found or intentionally hidden from unauthorized actor |
| 409 | Duplicate library entry, merge conflict, or invalid state transition |
| 413 | Import file too large |
| 422 | Semantically invalid normalized/import data |
| 429 | Application/provider rate limit reached |
| 502/503 | Provider or dependency unavailable |

## Versioning and changes

Breaking changes require `/api/v2` or a documented migration. Additive fields may be introduced in v1. The implementation should generate an OpenAPI document and examples from validation schemas where practical.
