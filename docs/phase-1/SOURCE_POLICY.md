# External Source Feasibility and Collection Policy

**Decision date:** 5 October 2026  
**Status:** Approved planning baseline; re-check provider terms immediately before implementation.

## Collection policy

MediaHub will obtain title metadata in this order:

1. Official API.
2. Official public export, feed, or authenticated user-authorized list endpoint.
3. Public-page collector only when the source explicitly permits automated access.
4. Manual niche-title submission when no approved source has a usable match.

The application will not bypass authentication, CAPTCHAs, access controls, rate limits, or `robots.txt`. It will not collect private lists without authorization or treat an external provider as a bulk database. Provider responses will be cached only as needed for search/import, while selected records will be stored with source attribution and external identifiers.

## Approved and provisional sources

| Domain | Source | Decision | Access and operational rules | Intended fields |
|---|---|---|---|---|
| Movies and TV | TMDB API | **Approved primary** for non-commercial coursework | Use a server-side API credential, cache searches, handle `429`, use HTTPS, and show the required TMDB notice/logo in Credits/About | Title, alternate/original title, overview, dates, genres, poster/backdrop paths, runtime/episode information, provider ID |
| Books | Google Books API | **Approved primary** | Use a restricted API key for public data; OAuth only for user-private Books data; paginate within API limits and retain Google volume ID/source link | Title, authors, description, publication date, categories, page count, ISBNs, cover links, volume ID |
| Books | Open Library API | **Approved fallback**, not a bulk backend | Use API rather than HTML scraping; identify the app with `User-Agent` and contact; stay within documented request limits; cache and batch responsibly | Work/edition ID, title, author, subjects, ISBN, covers, publication data |
| Anime and manga | Kitsu public JSON:API | **Provisional primary** | Public catalogue `GET` operations are documented without user authentication. Treat limits as unspecified, use conservative throttling/cache, and re-check current terms and endpoint health before implementation | Canonical/alternate titles, synopsis, subtype, dates, status, poster, episode/chapter/volume counts, categories, Kitsu ID |
| Anime and manga | AniList GraphQL API | **Rejected as default** | Current terms prohibit competing non-complementary tracker services. Do not integrate unless written permission or an applicable terms change is confirmed | None in baseline |
| Anime and manga | Jikan | **Not selected for baseline** | It is an unofficial read-only API that scrapes MyAnimeList. Avoid adding indirect terms/reliability risk when a documented public catalogue API is available | Potential development fallback only after policy review |
| Public lists | User-owned CSV/JSON exports | **Approved** | User uploads an export they are authorized to use. Parse locally/server-side, show preview, and require confirmation | Source ID/title, status, progress, rating when present |
| Public lists | Provider-authorized user/list APIs | **Approved when authorized** | Use the provider's OAuth/list endpoint and least-required scopes; never request or store the user's provider password | External IDs, user status/progress/rating as permitted |
| Public HTML pages | Site-specific collector | **No source approved yet** | May be added only after explicit permission is documented. Use conservative rate limiting and fixture-based parser tests | Minimal public metadata only |

## Why APIs/exports are preferred over HTML scraping

- Structured fields reduce parsing errors and broken selectors.
- Source IDs make deduplication reliable.
- APIs communicate rate-limit failures and support pagination.
- Public exports and authorized list endpoints respect user ownership and privacy.
- Provider attribution and permitted use are clearer.

This still satisfies MediaHub's goal of avoiding manual title entry: the catalogue is populated from external services, while HTML scraping is reserved for a clearly permitted source.

## Normalized provider record

Every connector must return the same application-level shape before database staging:

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

## Request and storage rules

- Provider credentials remain on the Express server and in environment variables.
- Add timeouts; retry only idempotent requests after transient errors.
- Respect `Retry-After` and provider-specific rate-limit headers.
- Cache search/detail responses for a short, documented period.
- Do not insert all search results into `media_items`.
- Stage selected/list-imported results in `ingestion_candidates`.
- Preserve source name, external ID, source URL, and synchronization timestamp.
- Download/store artwork only if provider rules permit it; otherwise retain provider image URLs and attribution.
- Log operational metadata, not access tokens or private payloads.

## Deduplication policy

1. Match exact `(source_id, external_id)`.
2. If absent, compare normalized title, media type, release year, and identifiers such as ISBN.
3. Auto-reuse only an exact or high-confidence safe match.
4. Present uncertain matches during import preview.
5. Never silently merge conflicting records.
6. If a manual record later receives an external match, attach the mapping to that canonical record.

## Manual fallback policy

The UI may show **No result? Add a niche title** after an external search returns no suitable match. The user must provide title, media type, and one supporting detail such as creator, release year, description, or public reference URL. The title is marked `MANUAL` and `PENDING_REVIEW`; an admin may approve, correct, merge, or reject it.

## Official references checked

- [TMDB API FAQ and attribution](https://developer.themoviedb.org/docs/faq)
- [TMDB rate-limit guidance](https://developer.themoviedb.org/docs/rate-limiting)
- [Google Books API usage](https://developers.google.com/books/docs/v1/using)
- [Open Library API usage and rate limits](https://openlibrary.org/developers/api)
- [Kitsu anime/manga API documentation](https://kitsu.docs.apiary.io/)
- [AniList API terms](https://docs.anilist.co/guide/terms-of-use)
- [Jikan API documentation](https://docs.api.jikan.moe/)

## Implementation gate

Before writing a connector, re-open its official documentation and record the check date. If terms, availability, or access requirements changed, disable that source and retain the provider interface, manual fallback, and other approved sources.
