const sessionMaxAgeDays = Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);

export const isProduction = process.env.NODE_ENV === 'production';
export const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
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
