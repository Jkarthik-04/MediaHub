const sessionMaxAgeDays = Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);

export const isProduction = process.env.NODE_ENV === 'production';
export const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5174';
export const sessionCookieName = 'mediahub.sid';
export const sessionMaxAgeMilliseconds =
  Number.isFinite(sessionMaxAgeDays) && sessionMaxAgeDays > 0
    ? sessionMaxAgeDays * 24 * 60 * 60 * 1_000
    : 7 * 24 * 60 * 60 * 1_000;

export const getSessionSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET must be configured.');
  if (isProduction && (secret.length < 32 || secret.includes('replace-with-'))) {
    throw new Error('SESSION_SECRET must be a strong, non-placeholder value in production.');
  }
  return secret;
};

export const getSessionDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL must be configured.');

  const url = new URL(databaseUrl);
  url.searchParams.delete('schema');
  return url.toString();
};

export const isGoogleOAuthConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const isAniListOAuthConfigured = () =>
  Boolean(
    process.env.ANILIST_CLIENT_ID &&
      process.env.ANILIST_CLIENT_SECRET &&
      process.env.CONNECTION_TOKEN_ENCRYPTION_KEY,
  );

export const isTraktOAuthConfigured = () =>
  Boolean(
    process.env.TRAKT_CLIENT_ID &&
      process.env.TRAKT_CLIENT_SECRET &&
      process.env.CONNECTION_TOKEN_ENCRYPTION_KEY,
  );

export const isGoogleBooksOAuthConfigured = () =>
  Boolean(
    process.env.GOOGLE_BOOKS_CLIENT_ID &&
      process.env.GOOGLE_BOOKS_CLIENT_SECRET &&
      process.env.CONNECTION_TOKEN_ENCRYPTION_KEY,
  );
