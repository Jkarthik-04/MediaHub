import { isAniListOAuthConfigured } from '../config/security.js';
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
  },
  {
    key: 'trakt',
    name: 'Trakt',
    media: ['MOVIE', 'TV'],
    description: 'Import movie and show watchlists, history, ratings, and episode progress.',
    mode: 'OAUTH',
    configurationReady: () => Boolean(process.env.TRAKT_CLIENT_ID),
    connectorImplemented: false,
  },
  {
    key: 'google-books',
    name: 'Google Books',
    media: ['BOOK'],
    description: 'Import saved volumes from your Google Books My Library shelves.',
    mode: 'OAUTH',
    configurationReady: () =>
      Boolean(process.env.GOOGLE_BOOKS_CLIENT_ID && process.env.GOOGLE_BOOKS_CLIENT_SECRET),
    connectorImplemented: false,
  },
  {
    key: 'mangadex',
    name: 'MangaDex',
    media: ['MANGA'],
    description: 'Import followed manga when MediaHub API-client access is configured.',
    mode: 'OAUTH',
    configurationReady: () =>
      Boolean(process.env.MANGADEX_CLIENT_ID && process.env.MANGADEX_CLIENT_SECRET),
    connectorImplemented: false,
  },
] as const;

export const listConnections = async (userId: string) => {
  const savedConnections = await findUserConnections(userId);
  const savedBySource = new Map(savedConnections.map((item) => [item.source.key, item]));

  return {
    data: providers.map(({ configurationReady, connectorImplemented, ...provider }) => {
      const connection = savedBySource.get(provider.key) ?? null;
      const configured = configurationReady();
      return {
        ...provider,
        configured,
        connectAvailable: connectorImplemented && configured,
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
    }),
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
