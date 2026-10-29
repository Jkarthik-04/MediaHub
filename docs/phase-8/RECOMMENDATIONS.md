# Phase 8 - Explainable Recommendations

## Status

The recommendation MVP is implemented. MediaHub uses a deterministic, content-based model named
`genre-vector-v1`; it does not call a paid generative-AI service. Recommendations are generated from
the authenticated user's combined reading and watching library and are stored in PostgreSQL with an
explanation and model version.

## User experience

Recommendations are part of the Discovery page instead of a separate primary-navigation page. The
page order is:

1. Search and media-type controls.
2. A horizontally scrollable **Recommended for you** row.
3. Search results and the existing import/manual-title workflow.

Each recommendation card displays the cover when the catalogue has a `cover_url`, title, media type,
match percentage, matching genres, a human-readable reason, **Add to library**, and **Not
interested**. The row remains horizontally scrollable by touch, trackpad, or Shift+wheel while its
visual scrollbar is hidden. Old `/recommendations` links redirect to `/discovery`.

## Recommendation inputs

The service reads only normalized MediaHub data:

- Library status.
- Optional user rating from 0 to 10.
- Normalized genres through `media_genres` and `genres`.
- Media type, used to introduce cross-media variety.

Status weights are deliberately simple and reproducible:

| Library status | Base weight |
| -------------- | ----------: |
| `COMPLETED`    |      `1.00` |
| `IN_PROGRESS`  |      `0.80` |
| `ON_HOLD`      |      `0.35` |
| `PLANNED`      |      `0.20` |
| `DROPPED`      |     `-0.60` |

When a rating exists, the service adds `(rating - 5) / 5` to the status weight. High ratings
strengthen the corresponding genres, while low ratings and dropped titles can reduce their weight.

## Candidate selection and scoring

The candidate query considers at most 500 catalogue items and requires every candidate to be:

- Active.
- Approved by the catalogue review workflow.
- Associated with at least one normalized genre.
- Absent from the current user's library.
- Not previously marked `NOT_INTERESTED` or `DISMISSED` by that user.

For each candidate, MediaHub finds positively weighted genres shared with the user's profile. The
genre component is the average normalized preference weight across the candidate's genres. The
implemented score is:

```text
score = clamp((genre score * 0.92) + cross-media boost, 0.01, 1.00)
cross-media boost = 0.08 when the media type is new to the user's strong preferences
```

Candidates without a positive genre match are excluded. Remaining candidates are ordered by score,
then title, and limited to the requested result count. A generated reason names the strongest one or
two matching genres and states when cross-media variety contributed.

## Persistence

Generated results are stored in `recommendations` with:

- `user_id` and `media_item_id` foreign keys.
- Decimal `score`.
- `model_version = genre-vector-v1`.
- Human-readable `reason`.
- `feedback` (`NONE`, `USEFUL`, `NOT_INTERESTED`, or `DISMISSED`).
- Generation and expiry timestamps.

A refresh expires the previous active results from this model and creates a new set in one Prisma
transaction. New results expire after seven days. Negative feedback remains available for future
candidate exclusion. All reads and feedback updates are restricted to the authenticated user's ID.

## REST API

All recommendation routes require an authenticated server-side session.

| Method | Route                                                | Purpose                                          |
| ------ | ---------------------------------------------------- | ------------------------------------------------ |
| `GET`  | `/api/v1/recommendations?limit=12`                   | Return active recommendations                    |
| `POST` | `/api/v1/recommendations/refresh?limit=12`           | Rebuild recommendations from the current library |
| `POST` | `/api/v1/recommendations/:recommendationId/feedback` | Save useful/not-interested/dismissed feedback    |

`limit` defaults to 12 and is validated between 1 and 30. The feedback body is:

```json
{
  "feedback": "NOT_INTERESTED"
}
```

Example response item:

```json
{
  "id": "recommendation-uuid",
  "score": 0.86,
  "reason": "Matches your interest in Science Fiction and Drama.",
  "modelVersion": "genre-vector-v1",
  "feedback": "NONE",
  "generatedAt": "2026-10-29T10:00:00.000Z",
  "mediaItem": {
    "id": "media-uuid",
    "title": "Example title",
    "coverUrl": "https://example.com/poster.jpg",
    "mediaType": { "code": "MOVIE", "name": "Movies" },
    "genres": [{ "name": "Science Fiction", "slug": "science-fiction" }]
  }
}
```

## Verification

The server integration suite verifies that refresh:

- Produces at least one explainable match for a prepared taste profile.
- Does not recommend a title already owned by the user.
- Returns `genre-vector-v1`, a positive score, genres, and an explanation.
- Records `NOT_INTERESTED` and removes that result from the active response.

Run the relevant project checks with:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Current limitations and next improvements

- The candidate pool is the approved MediaHub catalogue; external search results must first be
  imported and normalized.
- A new user needs a few genre-bearing library entries before meaningful matches are available.
- The current model favors explainability over collaborative filtering or machine learning.
- Future evaluation can add prepared personas, ranking metrics, freshness, popularity, and adaptation
  relationships without changing the stored recommendation contract.
