# Phase 6 Authentication, Authorization, and Security

## What Phase 6 adds

MediaHub uses Google OAuth for sign-in and a server-side PostgreSQL session for ongoing
authentication. The browser receives only a signed, HTTP-only session cookie; the session
data and authenticated user ID remain in the database.

The temporary Phase 5 `x-user-id` header is no longer accepted for authentication.

## Google OAuth configuration

Create a Google OAuth **Web application** client in the Google Cloud Console. Configure the
consent screen and add each team member as a test user while the application is in testing.
The redirect URI must exactly match the value used by MediaHub, including scheme, host, port,
path, case, and trailing slash.

For local development, register:

```text
http://localhost:3000/api/v1/auth/google/callback
```

For deployment, register the HTTPS backend callback URL, for example:

```text
https://api.example.com/api/v1/auth/google/callback
```

Google permits `localhost` for development, but normal deployed redirect URIs must use HTTPS.
Use the narrow `profile` and `email` scopes only. Google’s web-server OAuth documentation
describes the redirect flow and exact redirect-URI matching rules; the current OAuth console
guidance describes test users and consent-screen configuration.

Copy the credentials into the ignored local `.env` file only:

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
```

Never paste the client secret into chat, screenshots, source code, `.env.example`, commits,
or pull requests.

## Session configuration

Configure these values in `.env`:

```dotenv
SESSION_SECRET=use-a-long-random-value-with-at-least-32-characters
SESSION_MAX_AGE_DAYS=7
CLIENT_ORIGIN=http://localhost:5174
```

In production, `SESSION_SECRET` must not be a placeholder and must be at least 32 characters.
Production cookies use `Secure`, `HttpOnly`, and `SameSite=Lax`; the application also enables
proxy trust for an HTTPS reverse proxy.

The migration `20261021090000_add_user_sessions` creates `user_sessions`. Expired sessions
are pruned by the PostgreSQL session store.

## Authentication flow

```text
Login page
  -> GET /api/v1/auth/google
  -> Google consent and callback
  -> create/update users row by Google subject
  -> create server-side PostgreSQL session
  -> redirect to React application
  -> GET /api/v1/auth/me restores profile from session
```

First-time Google sign-in creates a `USER` account. Later sign-ins update safe profile fields.
If the same verified email already exists, the Google subject is linked to that user rather
than creating a duplicate row.

Implemented auth routes:

| Method | Route                          | Purpose                                          |
| ------ | ------------------------------ | ------------------------------------------------ |
| GET    | `/api/v1/auth/google`          | Begin Google OAuth login                         |
| GET    | `/api/v1/auth/google/callback` | Google callback and session creation             |
| GET    | `/api/v1/auth/me`              | Return current authenticated profile             |
| POST   | `/api/v1/auth/logout`          | Destroy the current session and clear the cookie |

If Google credentials are not configured, login returns `503 OAUTH_NOT_CONFIGURED`. This
allows API development and tests to run without storing real credentials in the repository.

## Role matrix

| Capability                              |  Anonymous |       USER | ADMIN |
| --------------------------------------- | ---------: | ---------: | ----: |
| View public catalogue and health routes |        Yes |        Yes |   Yes |
| View or change own library              |         No |        Yes |   Yes |
| Search providers and create imports     |         No |        Yes |   Yes |
| View dashboard and recommendations      |         No |        Yes |   Yes |
| See Admin navigation/page               |         No |         No |   Yes |
| Call `GET /api/v1/admin/overview`       | No (`401`) | No (`403`) |   Yes |

The React application uses `RequireAuth` for signed-in pages and `RequireRole` for the Admin
page. The Express API independently uses `requireUser` and `requireRole('ADMIN')`; hiding a
navigation item never grants or removes API permission.

## Security controls

- Helmet adds HTTP response security headers.
- CORS allows the configured `CLIENT_ORIGIN` and permits session cookies.
- A global rate limit allows 100 requests per 15 minutes per client.
- JSON bodies are limited to 1 MB.
- Prisma continues to use parameterized database operations; user input is not concatenated
  into SQL.
- Session cookies are HTTP-only and are signed. Server-side session records expire after the
  configured lifetime.
- Errors return `401 AUTHENTICATION_REQUIRED` for no/expired sessions and `403 FORBIDDEN` for
  an authenticated user lacking a required role.

## Test evidence

Run:

```bash
npm test
```

The integration suite verifies anonymous rejection, rejection of the retired header,
successful session profile retrieval, expired-session rejection, logout invalidation,
cross-user library protection, normal-user `403` against the admin API, successful admin
access, CORS, Helmet headers, input validation, and existing transaction rollback behavior.

## Team setup checklist

1. One team member creates the Google Cloud project and OAuth web client.
2. Add every group member as an OAuth test user.
3. Each member copies `.env.example` to their own ignored `.env` file.
4. Share credentials through a private, approved team channel—not GitHub commits or public
   documents.
5. Each member runs `npm install`, `npm run db:migrate`, `npm run db:seed`, and both apps.
6. Confirm sign-in, sign-out, an ordinary user flow, and an admin flow before merging to
   `dev`.

## References

- [Google: OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Cloud: Set up the OAuth consent screen](https://support.google.com/cloud/answer/13461325)
