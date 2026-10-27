import { AppError } from '../errors/app-error.js';
import {
  deleteUserConnection,
  findUserConnections,
} from '../repositories/connection.repository.js';

const providers = [
  {
    key: 'anilist',
    name: 'AniList',
    media: ['ANIME', 'MANGA'],
    description: 'Import anime and manga lists, ratings, status, and progress.',
    mode: 'OAUTH',
    configurationReady: () =>
      Boolean(process.env.ANILIST_CLIENT_ID && process.env.ANILIST_CLIENT_SECRET),
  },
  {
    key: 'trakt',
    name: 'Trakt',
    media: ['MOVIE', 'TV'],
    description: 'Import movie and show watchlists, history, ratings, and episode progress.',
    mode: 'OAUTH',
    configurationReady: () => Boolean(process.env.TRAKT_CLIENT_ID),
  },
  {
    key: 'google-books',
    name: 'Google Books',
    media: ['BOOK'],
    description: 'Import saved volumes from your Google Books My Library shelves.',
    mode: 'OAUTH',
    configurationReady: () =>
      Boolean(process.env.GOOGLE_BOOKS_CLIENT_ID && process.env.GOOGLE_BOOKS_CLIENT_SECRET),
  },
  {
    key: 'mangadex',
    name: 'MangaDex',
    media: ['MANGA'],
    description: 'Import followed manga when MediaHub API-client access is configured.',
    mode: 'OAUTH',
    configurationReady: () =>
      Boolean(process.env.MANGADEX_CLIENT_ID && process.env.MANGADEX_CLIENT_SECRET),
  },
] as const;

export const listConnections = async (userId: string) => {
  const savedConnections = await findUserConnections(userId);
  const savedBySource = new Map(savedConnections.map((item) => [item.source.key, item]));

  return {
    data: providers.map(({ configurationReady, ...provider }) => {
      const connection = savedBySource.get(provider.key) ?? null;
      return {
        ...provider,
        configured: configurationReady(),
        connectAvailable: false,
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

export const disconnectProvider = async (userId: string, sourceKey: string) => {
  if (!providers.some((provider) => provider.key === sourceKey)) {
    throw new AppError(
      404,
      'CONNECTION_PROVIDER_NOT_FOUND',
      'The connection provider was not found.',
    );
  }
  const deleted = await deleteUserConnection(userId, sourceKey);
  if (!deleted)
    throw new AppError(404, 'USER_CONNECTION_NOT_FOUND', 'The account connection was not found.');
};
