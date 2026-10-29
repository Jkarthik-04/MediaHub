# Additional Feature - Connected Apps

## Status and purpose

Connected Apps is implemented as an additional MediaHub feature. It lets an authenticated user
authorize supported media services and import existing lists, statuses, ratings, and progress. The
user never enters a provider password into MediaHub.

The profile icon in the header opens the profile card. Selecting **Connected apps** navigates to
`/connections`, where provider cards show their logos, configuration/connection state, sync action,
and disconnect action. The page reports the result of each sync or disconnect operation.

## Supported providers

| Provider     | Media           | Imported information                                                   | Authorization                |
| ------------ | --------------- | ---------------------------------------------------------------------- | ---------------------------- |
| AniList      | Anime and manga | Lists, status, ratings, and progress                                   | OAuth 2.0 authorization code |
| Trakt        | Movies and TV   | Watchlists, history, ratings, and episode progress                     | OAuth 2.0 with PKCE          |
| Google Books | Books           | My Library shelves, ratings, status, and available cover/page metadata | Google OAuth 2.0 with PKCE   |

MangaDex was intentionally removed because MediaHub does not have an approved, complete account-list
connection for it. Jikan, OMDb, and Open Library remain discovery metadata sources; they are not user
account connections.

## Connection flow

```text
Profile icon -> Connected apps -> Connect
  -> provider authorization page
  -> provider callback with authorization code and validated state
  -> MediaHub exchanges the code for tokens
  -> encrypted connection stored in PostgreSQL
  -> redirect to the React application
  -> initial synchronization
  -> normalized titles and per-user library state upserted
```

The callback carries an anti-forgery `state` value stored in the user's server-side session. Trakt
and Google Books additionally use a PKCE verifier/challenge pair. Provider credentials and tokens are
never included in frontend responses.

## Token security

Access and refresh tokens are encrypted before database storage using AES-256-GCM. Each encrypted
value has a random 12-byte initialization vector and an authentication tag. The key is derived from
`CONNECTION_TOKEN_ENCRYPTION_KEY`, which must remain in the ignored `.env` file or the deployment
platform's secret manager.

The `user_connections` table stores the encrypted tokens, provider identity, granted scopes, expiry,
connection status, last synchronization time, sync cursor, and safe error information. Its unique
`(user_id, source_id)` constraint prevents duplicate connections for one provider.

## REST API

All routes below require an authenticated MediaHub session.

| Method   | Route                                       | Purpose                                            |
| -------- | ------------------------------------------- | -------------------------------------------------- |
| `GET`    | `/api/v1/connections`                       | List supported providers and safe connection state |
| `GET`    | `/api/v1/connections/anilist/connect`       | Begin AniList authorization                        |
| `GET`    | `/api/v1/connections/anilist/callback`      | Complete AniList authorization                     |
| `POST`   | `/api/v1/connections/anilist/sync`          | Synchronize AniList library data                   |
| `GET`    | `/api/v1/connections/trakt/connect`         | Begin Trakt authorization                          |
| `GET`    | `/api/v1/connections/trakt/callback`        | Complete Trakt authorization                       |
| `POST`   | `/api/v1/connections/trakt/sync`            | Synchronize Trakt library data                     |
| `GET`    | `/api/v1/connections/google-books/connect`  | Begin Google Books authorization                   |
| `GET`    | `/api/v1/connections/google-books/callback` | Complete Google Books authorization                |
| `POST`   | `/api/v1/connections/google-books/sync`     | Synchronize Google Books shelves                   |
| `DELETE` | `/api/v1/connections/:sourceKey`            | Remove the local connection and encrypted tokens   |

The provider list returns booleans such as `configured`, `connectAvailable`, and `syncAvailable`, but
never returns encrypted access/refresh tokens.

## Synchronization and normalization

Provider responses are converted to one internal connected-library representation before database
work begins. The shared synchronization workflow:

1. Decrypts the provider token only inside the server process.
2. Fetches the authorized lists using the provider API.
3. Normalizes external IDs, title, media type, description, date, cover, genres, total units, status,
   progress, rating, and relevant timestamps.
4. Deduplicates repeated records in the provider response.
5. Reuses an existing `external_mappings` record when available.
6. Otherwise reuses a strong canonical catalogue match or creates an approved external media item.
7. Upserts the user's unique `(user_id, media_item_id)` library entry.
8. Records imported/updated totals and either the successful sync time or a safe failure message.

This ensures connected imports use the same normalized `media_items`, `genres`,
`external_mappings`, and `library_entries` tables as manual discovery imports and recommendations.

## Local configuration

Generate and retain a strong token-encryption secret, including any trailing `=` characters in its
encoded value. Add credentials only to `.env`:

```dotenv
CONNECTION_TOKEN_ENCRYPTION_KEY=replace-with-a-long-random-value

ANILIST_CLIENT_ID=
ANILIST_CLIENT_SECRET=
ANILIST_CALLBACK_URL=http://localhost:3000/api/v1/connections/anilist/callback

TRAKT_CLIENT_ID=
TRAKT_CLIENT_SECRET=
TRAKT_CALLBACK_URL=http://localhost:3000/api/v1/connections/trakt/callback

GOOGLE_BOOKS_CLIENT_ID=
GOOGLE_BOOKS_CLIENT_SECRET=
GOOGLE_BOOKS_CALLBACK_URL=http://localhost:3000/api/v1/connections/google-books/callback
```

Every callback URL must exactly match the value registered with its provider. Restart the Express
server after changing `.env`. A provider remains visible but unavailable when its required credentials
or encryption key are missing.

## Verification

The API integration suite checks that:

- Provider state never exposes encrypted token columns.
- Missing connections return `USER_CONNECTION_NOT_FOUND` for sync.
- Unconfigured providers return `CONNECTION_NOT_CONFIGURED`.
- AniList produces a provider authorization redirect when configured.
- Trakt and Google Books authorization URLs contain an S256 PKCE challenge.
- The Google Books request includes the Books authorization scope.

Manual verification should connect a test account, confirm the automatic first sync, compare imported
status/progress/rating data, run **Sync now**, disconnect, and confirm that the local connection is
removed.

## Current limitations

- OAuth client registration and provider approval are external setup steps for each environment.
- A provider API outage can delay synchronization without affecting the existing local library.
- Expired or revoked credentials may require reconnection if a refresh operation cannot recover them.
- Disconnect currently removes MediaHub's local connection; users can separately revoke MediaHub from
  the provider's account-security page.
