import {
  isAniListOAuthConfigured,
  isGoogleBooksOAuthConfigured,
  isTraktOAuthConfigured,
} from '../config/security.js';
import { AppError } from '../errors/app-error.js';
import {
  deleteUserConnection,
  findUserConnections,
  saveUserConnection,
} from '../repositories/connection.repository.js';
import { encryptConnectionToken } from '../utils/token-crypto.js';

const providers = [
  {
    key: 'anilist',
    name: 'AniList',
    media: ['ANIME', 'MANGA'],
    description: 'Import anime and manga lists, ratings, status, and progress.',
    mode: 'OAUTH',
    configurationReady: isAniListOAuthConfigured,
    connectorImplemented: true,
    syncImplemented: true,
  },
  {
    key: 'trakt',
    name: 'Trakt',
    media: ['MOVIE', 'TV'],
    description: 'Import movie and show watchlists, history, ratings, and episode progress.',
    mode: 'OAUTH',
    configurationReady: isTraktOAuthConfigured,
    connectorImplemented: true,
    syncImplemented: true,
  },
  {
    key: 'google-books',
    name: 'Google Books',
    media: ['BOOK'],
    description: 'Import saved volumes from your Google Books My Library shelves.',
    mode: 'OAUTH',
    configurationReady: isGoogleBooksOAuthConfigured,
    connectorImplemented: true,
    syncImplemented: true,
  },
] as const;

export const listConnections = async (userId: string) => {
  const savedConnections = await findUserConnections(userId);
  const savedBySource = new Map(savedConnections.map((item) => [item.source.key, item]));

  return {
    data: providers.map(
      ({ configurationReady, connectorImplemented, syncImplemented, ...provider }) => {
        const connection = savedBySource.get(provider.key) ?? null;
        const configured = configurationReady();
        return {
          ...provider,
          configured,
          connectAvailable: connectorImplemented && configured,
          syncAvailable: syncImplemented && Boolean(connection),
          connection: connection
            ? {
                id: connection.id,
                externalUserId: connection.externalUserId,
                externalUsername: connection.externalUsername,
                status: connection.status,
                tokenExpiresAt: connection.tokenExpiresAt,
                lastSyncedAt: connection.lastSyncedAt,
                lastError: connection.lastError,
                createdAt: connection.createdAt,
                updatedAt: connection.updatedAt,
              }
            : null,
        };
      },
    ),
  };
};

type AniListTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

type AniListViewerResponse = {
  data?: { Viewer?: { id: number; name: string } };
};

const aniListCallbackUrl = () =>
  process.env.ANILIST_CALLBACK_URL ?? 'http://localhost:3000/api/v1/connections/anilist/callback';

export const createAniListAuthorizationUrl = (state: string) => {
  if (!isAniListOAuthConfigured()) {
    throw new AppError(
      503,
      'CONNECTION_NOT_CONFIGURED',
      'AniList OAuth has not been configured for this environment.',
    );
  }

  const url = new URL('https://anilist.co/api/v2/oauth/authorize');
  url.searchParams.set('client_id', process.env.ANILIST_CLIENT_ID!);
  url.searchParams.set('redirect_uri', aniListCallbackUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
};

export const connectAniListAccount = async (userId: string, code: string) => {
  if (!isAniListOAuthConfigured()) {
    throw new AppError(
      503,
      'CONNECTION_NOT_CONFIGURED',
      'AniList OAuth has not been configured for this environment.',
    );
  }

  const tokenResponse = await fetch('https://anilist.co/api/v2/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.ANILIST_CLIENT_ID,
      client_secret: process.env.ANILIST_CLIENT_SECRET,
      redirect_uri: aniListCallbackUrl(),
      code,
    }),
  });
  const token = (await tokenResponse.json()) as AniListTokenResponse;
  if (!tokenResponse.ok || !token.access_token) {
    throw new AppError(
      502,
      'ANILIST_TOKEN_EXCHANGE_FAILED',
      'AniList did not accept the connection request.',
    );
  }

  const viewerResponse = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token.access_token}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ query: 'query { Viewer { id name } }' }),
  });
  const viewerPayload = (await viewerResponse.json()) as AniListViewerResponse;
  const viewer = viewerPayload.data?.Viewer;
  if (!viewerResponse.ok || !viewer) {
    throw new AppError(
      502,
      'ANILIST_PROFILE_FAILED',
      'MediaHub could not read the AniList profile.',
    );
  }

  const saved = await saveUserConnection({
    userId,
    sourceKey: 'anilist',
    externalUserId: String(viewer.id),
    externalUsername: viewer.name,
    accessTokenEncrypted: encryptConnectionToken(token.access_token),
    refreshTokenEncrypted: token.refresh_token ? encryptConnectionToken(token.refresh_token) : null,
    tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1_000) : null,
    scopes: [],
  });
  if (!saved) {
    throw new AppError(500, 'CONNECTION_SOURCE_MISSING', 'The AniList source has not been seeded.');
  }
};

type TraktTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type TraktSettingsResponse = {
  user?: {
    username?: string;
    ids?: { slug?: string; uuid?: string };
  };
};

const traktCallbackUrl = () =>
  process.env.TRAKT_CALLBACK_URL ?? 'http://localhost:3000/api/v1/connections/trakt/callback';

export const createTraktAuthorizationUrl = (state: string, codeChallenge: string) => {
  if (!isTraktOAuthConfigured()) {
    throw new AppError(
      503,
      'CONNECTION_NOT_CONFIGURED',
      'Trakt OAuth has not been configured for this environment.',
    );
  }

  const url = new URL('https://trakt.tv/oauth/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', process.env.TRAKT_CLIENT_ID!);
  url.searchParams.set('redirect_uri', traktCallbackUrl());
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
};

export const connectTraktAccount = async (userId: string, code: string, codeVerifier: string) => {
  if (!isTraktOAuthConfigured()) {
    throw new AppError(
      503,
      'CONNECTION_NOT_CONFIGURED',
      'Trakt OAuth has not been configured for this environment.',
    );
  }

  const tokenResponse = await fetch('https://api.trakt.tv/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      code,
      client_id: process.env.TRAKT_CLIENT_ID,
      client_secret: process.env.TRAKT_CLIENT_SECRET,
      redirect_uri: traktCallbackUrl(),
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });
  const token = (await tokenResponse.json()) as TraktTokenResponse;
  if (!tokenResponse.ok || !token.access_token) {
    throw new AppError(
      502,
      'TRAKT_TOKEN_EXCHANGE_FAILED',
      'Trakt did not accept the connection request.',
    );
  }

  const settingsResponse = await fetch('https://api.trakt.tv/users/settings', {
    headers: {
      authorization: `Bearer ${token.access_token}`,
      'content-type': 'application/json',
      'trakt-api-key': process.env.TRAKT_CLIENT_ID!,
      'trakt-api-version': '2',
    },
  });
  const settings = (await settingsResponse.json()) as TraktSettingsResponse;
  const traktUser = settings.user;
  const externalUserId = traktUser?.ids?.uuid ?? traktUser?.ids?.slug ?? traktUser?.username;
  if (!settingsResponse.ok || !traktUser || !externalUserId) {
    throw new AppError(502, 'TRAKT_PROFILE_FAILED', 'MediaHub could not read the Trakt profile.');
  }

  const saved = await saveUserConnection({
    userId,
    sourceKey: 'trakt',
    externalUserId,
    externalUsername: traktUser.username ?? null,
    accessTokenEncrypted: encryptConnectionToken(token.access_token),
    refreshTokenEncrypted: token.refresh_token ? encryptConnectionToken(token.refresh_token) : null,
    tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1_000) : null,
    scopes: token.scope ? token.scope.split(' ').filter(Boolean) : [],
  });
  if (!saved) {
    throw new AppError(500, 'CONNECTION_SOURCE_MISSING', 'The Trakt source has not been seeded.');
  }
};

type GoogleBooksTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type GoogleUserInfoResponse = {
  sub?: string;
  name?: string;
  email?: string;
};

const googleBooksCallbackUrl = () =>
  process.env.GOOGLE_BOOKS_CALLBACK_URL ??
  'http://localhost:3000/api/v1/connections/google-books/callback';

export const createGoogleBooksAuthorizationUrl = (state: string, codeChallenge: string) => {
  if (!isGoogleBooksOAuthConfigured()) {
    throw new AppError(
      503,
      'CONNECTION_NOT_CONFIGURED',
      'Google Books OAuth has not been configured for this environment.',
    );
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_BOOKS_CLIENT_ID!);
  url.searchParams.set('redirect_uri', googleBooksCallbackUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile https://www.googleapis.com/auth/books');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
};

export const connectGoogleBooksAccount = async (
  userId: string,
  code: string,
  codeVerifier: string,
) => {
  if (!isGoogleBooksOAuthConfigured()) {
    throw new AppError(
      503,
      'CONNECTION_NOT_CONFIGURED',
      'Google Books OAuth has not been configured for this environment.',
    );
  }

  const tokenBody = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_BOOKS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_BOOKS_CLIENT_SECRET!,
    redirect_uri: googleBooksCallbackUrl(),
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: tokenBody,
  });
  const token = (await tokenResponse.json()) as GoogleBooksTokenResponse;
  if (!tokenResponse.ok || !token.access_token) {
    throw new AppError(
      502,
      'GOOGLE_BOOKS_TOKEN_EXCHANGE_FAILED',
      'Google did not accept the Books connection request.',
    );
  }

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${token.access_token}`, accept: 'application/json' },
  });
  const profile = (await profileResponse.json()) as GoogleUserInfoResponse;
  if (!profileResponse.ok || !profile.sub) {
    throw new AppError(
      502,
      'GOOGLE_BOOKS_PROFILE_FAILED',
      'MediaHub could not read the connected Google Books profile.',
    );
  }

  const saved = await saveUserConnection({
    userId,
    sourceKey: 'google-books',
    externalUserId: profile.sub,
    externalUsername: profile.name ?? profile.email ?? null,
    accessTokenEncrypted: encryptConnectionToken(token.access_token),
    refreshTokenEncrypted: token.refresh_token ? encryptConnectionToken(token.refresh_token) : null,
    tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1_000) : null,
    scopes: token.scope ? token.scope.split(' ').filter(Boolean) : [],
  });
  if (!saved) {
    throw new AppError(
      500,
      'CONNECTION_SOURCE_MISSING',
      'The Google Books source has not been seeded.',
    );
  }
};

export const disconnectProvider = async (userId: string, sourceKey: string) => {
  if (!providers.some((provider) => provider.key === sourceKey)) {
    throw new AppError(
      404,
      'CONNECTION_PROVIDER_NOT_FOUND',
      'The connection provider was not found.',
    );
  }
  const deleted = await deleteUserConnection(userId, sourceKey);
  if (!deleted) {
    throw new AppError(404, 'USER_CONNECTION_NOT_FOUND', 'The account connection was not found.');
  }
};
