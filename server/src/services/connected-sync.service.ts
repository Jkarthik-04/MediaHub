import type { LibraryStatus } from '@prisma/client';

import { AppError } from '../errors/app-error.js';
import {
  findUserConnectionForSync,
  markConnectionExpired,
  markConnectionSyncCompleted,
  markConnectionSyncFailed,
  updateConnectionAccessToken,
} from '../repositories/connection.repository.js';
import {
  syncConnectedLibraryItems,
  type ConnectedLibraryItem,
} from '../repositories/connected-sync.repository.js';
import { decryptConnectionToken, encryptConnectionToken } from '../utils/token-crypto.js';

type AniListDate = { year?: number | null; month?: number | null; day?: number | null };

type AniListEntry = {
  status?: string | null;
  score?: number | null;
  progress?: number | null;
  startedAt?: AniListDate | null;
  completedAt?: AniListDate | null;
  media?: {
    id?: number;
    type?: 'ANIME' | 'MANGA';
    title?: {
      userPreferred?: string | null;
      english?: string | null;
      romaji?: string | null;
      native?: string | null;
    };
    description?: string | null;
    startDate?: AniListDate | null;
    coverImage?: { extraLarge?: string | null; large?: string | null };
    genres?: string[] | null;
    episodes?: number | null;
    chapters?: number | null;
    volumes?: number | null;
    siteUrl?: string | null;
  };
};

type AniListCollectionResponse = {
  data?: {
    MediaListCollection?: { lists?: Array<{ entries?: AniListEntry[] | null }> | null };
  };
  errors?: Array<{ message?: string }>;
};

type TraktMedia = {
  title?: string;
  year?: number;
  overview?: string | null;
  released?: string | null;
  first_aired?: string | null;
  runtime?: number | null;
  aired_episodes?: number | null;
  genres?: string[] | null;
  ids?: {
    trakt?: number;
    slug?: string | null;
    imdb?: string | null;
    tmdb?: number | null;
  };
};

type TraktWatchlistEntry = {
  listed_at?: string;
  movie?: TraktMedia;
  show?: TraktMedia;
};

type TraktWatchedMovie = {
  last_watched_at?: string;
  movie?: TraktMedia;
};

type TraktWatchedShow = {
  last_watched_at?: string;
  show?: TraktMedia;
  seasons?: Array<{
    number?: number;
    episodes?: Array<{ number?: number; plays?: number; last_watched_at?: string }>;
  }>;
};

type TraktRatingEntry = {
  rated_at?: string;
  rating?: number;
  movie?: TraktMedia;
  show?: TraktMedia;
};

type GoogleBookshelf = {
  id?: number;
  title?: string;
  volumeCount?: number;
};

type GoogleBookshelfResponse = {
  items?: GoogleBookshelf[];
};

type GoogleBookVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    description?: string | null;
    publishedDate?: string | null;
    pageCount?: number | null;
    categories?: string[] | null;
    imageLinks?: {
      extraLarge?: string;
      large?: string;
      medium?: string;
      small?: string;
      thumbnail?: string;
      smallThumbnail?: string;
    };
    infoLink?: string;
    canonicalVolumeLink?: string;
  };
  userInfo?: {
    updated?: string;
    review?: { rating?: string; date?: string };
  };
};

type GoogleBooksVolumeResponse = {
  totalItems?: number;
  items?: GoogleBookVolume[];
};

type GoogleRefreshTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

const aniListLibraryQuery = `
  query MediaHubLibrary($userId: Int!, $type: MediaType!) {
    MediaListCollection(userId: $userId, type: $type, forceSingleCompletedList: true) {
      lists {
        entries {
          status
          score(format: POINT_10)
          progress
          startedAt { year month day }
          completedAt { year month day }
          media {
            id
            type
            title { userPreferred english romaji native }
            description
            startDate { year month day }
            coverImage { extraLarge large }
            genres
            episodes
            chapters
            volumes
            siteUrl
          }
        }
      }
    }
  }
`;

export const syncAniListLibrary = async (userId: string) => {
  const connection = await findUserConnectionForSync(userId, 'anilist');
  if (!connection) {
    throw new AppError(404, 'USER_CONNECTION_NOT_FOUND', 'Connect AniList before syncing.');
  }
  if (!connection.accessTokenEncrypted) {
    throw new AppError(409, 'CONNECTION_TOKEN_MISSING', 'Reconnect AniList before syncing.');
  }
  if (connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date()) {
    await markConnectionExpired(connection.id);
    throw new AppError(409, 'CONNECTION_EXPIRED', 'Reconnect AniList before syncing.');
  }

  try {
    const accessToken = decryptConnectionToken(connection.accessTokenEncrypted);
    const externalUserId = Number(connection.externalUserId);
    if (!Number.isSafeInteger(externalUserId)) {
      throw new AppError(500, 'INVALID_CONNECTION_PROFILE', 'The AniList profile ID is invalid.');
    }

    const [animeEntries, mangaEntries] = await Promise.all([
      fetchAniListEntries(accessToken, externalUserId, 'ANIME'),
      fetchAniListEntries(accessToken, externalUserId, 'MANGA'),
    ]);
    const items = [...animeEntries, ...mangaEntries]
      .map(toConnectedLibraryItem)
      .filter((item): item is ConnectedLibraryItem => item !== null);
    const uniqueItems = [
      ...new Map(items.map((item) => [`${item.mediaType}:${item.externalId}`, item])).values(),
    ];
    const summary = await syncConnectedLibraryItems(userId, 'anilist', uniqueItems);
    await markConnectionSyncCompleted(connection.id, summary);
    return { data: { provider: 'anilist', ...summary } };
  } catch (error) {
    await recordConnectionSyncFailure(connection.id, error, 'AniList synchronization failed.');
    throw error;
  }
};

export const syncTraktLibrary = async (userId: string) => {
  const connection = await findUserConnectionForSync(userId, 'trakt');
  if (!connection) {
    throw new AppError(404, 'USER_CONNECTION_NOT_FOUND', 'Connect Trakt before syncing.');
  }
  if (!connection.accessTokenEncrypted) {
    throw new AppError(409, 'CONNECTION_TOKEN_MISSING', 'Reconnect Trakt before syncing.');
  }
  if (connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date()) {
    await markConnectionExpired(connection.id);
    throw new AppError(409, 'CONNECTION_EXPIRED', 'Reconnect Trakt before syncing.');
  }

  try {
    const accessToken = decryptConnectionToken(connection.accessTokenEncrypted);
    const [
      watchlistMovies,
      watchlistShows,
      watchedMovies,
      watchedShows,
      movieRatings,
      showRatings,
    ] = await Promise.all([
      fetchTraktPages<TraktWatchlistEntry>(accessToken, '/sync/watchlist/movies'),
      fetchTraktPages<TraktWatchlistEntry>(accessToken, '/sync/watchlist/shows'),
      fetchTraktPages<TraktWatchedMovie>(accessToken, '/sync/watched/movies'),
      fetchTraktPages<TraktWatchedShow>(accessToken, '/sync/watched/shows'),
      fetchTraktPages<TraktRatingEntry>(accessToken, '/sync/ratings/movies'),
      fetchTraktPages<TraktRatingEntry>(accessToken, '/sync/ratings/shows'),
    ]);

    const items = buildTraktLibraryItems({
      watchlistMovies,
      watchlistShows,
      watchedMovies,
      watchedShows,
      movieRatings,
      showRatings,
    });
    const summary = await syncConnectedLibraryItems(userId, 'trakt', items);
    await markConnectionSyncCompleted(connection.id, summary);
    return { data: { provider: 'trakt', ...summary } };
  } catch (error) {
    await recordConnectionSyncFailure(connection.id, error, 'Trakt synchronization failed.');
    throw error;
  }
};

export const syncGoogleBooksLibrary = async (userId: string) => {
  const connection = await findUserConnectionForSync(userId, 'google-books');
  if (!connection) {
    throw new AppError(404, 'USER_CONNECTION_NOT_FOUND', 'Connect Google Books before syncing.');
  }
  if (!connection.accessTokenEncrypted) {
    throw new AppError(409, 'CONNECTION_TOKEN_MISSING', 'Reconnect Google Books before syncing.');
  }

  try {
    const accessToken =
      connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date()
        ? await refreshGoogleBooksAccessToken(connection.id, connection.refreshTokenEncrypted)
        : decryptConnectionToken(connection.accessTokenEncrypted);
    const shelves = await fetchGoogleBookshelves(accessToken);
    const importableShelves = shelves.filter(isImportableGoogleBookshelf);
    const shelfVolumes = await Promise.all(
      importableShelves.map(async (shelf) => ({
        shelf,
        volumes: await fetchGoogleBookshelfVolumes(accessToken, shelf.id!),
      })),
    );
    const items = buildGoogleBooksLibraryItems(shelfVolumes);
    const summary = await syncConnectedLibraryItems(userId, 'google-books', items);
    await markConnectionSyncCompleted(connection.id, summary);
    return { data: { provider: 'google-books', ...summary } };
  } catch (error) {
    await recordConnectionSyncFailure(connection.id, error, 'Google Books synchronization failed.');
    throw error;
  }
};

const refreshGoogleBooksAccessToken = async (
  connectionId: string,
  refreshTokenEncrypted: string | null,
) => {
  if (!refreshTokenEncrypted) {
    throw new AppError(
      409,
      'CONNECTION_EXPIRED',
      'Reconnect Google Books to renew library access.',
    );
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_BOOKS_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_BOOKS_CLIENT_SECRET ?? '',
      refresh_token: decryptConnectionToken(refreshTokenEncrypted),
      grant_type: 'refresh_token',
    }),
  });
  const payload = (await response.json()) as GoogleRefreshTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new AppError(
      409,
      'CONNECTION_EXPIRED',
      payload.error_description ?? 'Reconnect Google Books to renew library access.',
    );
  }
  const tokenExpiresAt = payload.expires_in
    ? new Date(Date.now() + payload.expires_in * 1_000)
    : null;
  await updateConnectionAccessToken(
    connectionId,
    encryptConnectionToken(payload.access_token),
    tokenExpiresAt,
  );
  return payload.access_token;
};

const fetchGoogleBookshelves = async (accessToken: string) => {
  const response = await fetch('https://www.googleapis.com/books/v1/mylibrary/bookshelves', {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
  });
  const payload = (await response.json()) as GoogleBookshelfResponse & {
    error?: { message?: string };
  };
  if (!response.ok) throwGoogleBooksSyncError(response.status, payload.error?.message);
  return payload.items ?? [];
};

const fetchGoogleBookshelfVolumes = async (accessToken: string, shelfId: number) => {
  const volumes: GoogleBookVolume[] = [];
  let startIndex = 0;
  let totalItems = 1;

  while (startIndex < totalItems) {
    const url = new URL(
      `https://www.googleapis.com/books/v1/mylibrary/bookshelves/${shelfId}/volumes`,
    );
    url.searchParams.set('projection', 'full');
    url.searchParams.set('maxResults', '40');
    url.searchParams.set('startIndex', String(startIndex));
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    });
    const payload = (await response.json()) as GoogleBooksVolumeResponse & {
      error?: { message?: string };
    };
    if (!response.ok) throwGoogleBooksSyncError(response.status, payload.error?.message);
    const page = payload.items ?? [];
    volumes.push(...page);
    totalItems = payload.totalItems ?? volumes.length;
    if (page.length === 0) break;
    startIndex += page.length;
  }

  return volumes;
};

const throwGoogleBooksSyncError = (status: number, message?: string): never => {
  throw new AppError(
    status === 401 ? 409 : 502,
    status === 401 ? 'CONNECTION_EXPIRED' : 'GOOGLE_BOOKS_SYNC_FAILED',
    message ?? 'Google Books library synchronization failed.',
  );
};

const isImportableGoogleBookshelf = (
  shelf: GoogleBookshelf,
): shelf is GoogleBookshelf & { id: number } =>
  typeof shelf.id === 'number' && shelf.id !== 6 && shelf.id !== 8 && (shelf.volumeCount ?? 0) > 0;

const buildGoogleBooksLibraryItems = (
  shelves: Array<{
    shelf: GoogleBookshelf & { id: number };
    volumes: GoogleBookVolume[];
  }>,
) => {
  const items = new Map<string, { item: ConnectedLibraryItem; priority: number }>();

  for (const { shelf, volumes } of shelves) {
    const state = googleBookshelfState(shelf.id);
    for (const volume of volumes) {
      const item = toGoogleBooksLibraryItem(volume, state.status);
      if (!item) continue;
      const existing = items.get(item.externalId);
      if (!existing || state.priority > existing.priority) {
        items.set(item.externalId, { item, priority: state.priority });
      } else if (item.rating !== null && existing.item.rating === null) {
        existing.item.rating = item.rating;
      }
    }
  }

  return [...items.values()].map(({ item }) => item);
};

const googleBookshelfState = (shelfId: number) => {
  if (shelfId === 4 || shelfId === 5) {
    return { status: 'COMPLETED' as const, priority: 3 };
  }
  if (shelfId === 3) return { status: 'IN_PROGRESS' as const, priority: 2 };
  return { status: 'PLANNED' as const, priority: 1 };
};

const toGoogleBooksLibraryItem = (
  volume: GoogleBookVolume,
  status: LibraryStatus,
): ConnectedLibraryItem | null => {
  const info = volume.volumeInfo;
  if (!volume.id || !info?.title) return null;
  const pageCount =
    typeof info.pageCount === 'number' && info.pageCount > 0 ? info.pageCount : null;
  const updatedAt = toTimestamp(volume.userInfo?.updated);

  return {
    externalId: volume.id,
    mediaType: 'BOOK',
    title: info.title,
    description: stripHtml(info.description),
    releaseDate: toGooglePublishedDate(info.publishedDate),
    coverUrl: normalizeGoogleImageUrl(
      info.imageLinks?.extraLarge ??
        info.imageLinks?.large ??
        info.imageLinks?.medium ??
        info.imageLinks?.small ??
        info.imageLinks?.thumbnail ??
        info.imageLinks?.smallThumbnail,
    ),
    totalUnits: pageCount,
    genres: info.categories ?? [],
    sourceUrl:
      info.canonicalVolumeLink ??
      info.infoLink ??
      `https://books.google.com/books?id=${encodeURIComponent(volume.id)}`,
    status,
    progress: status === 'COMPLETED' ? (pageCount ?? 0) : 0,
    rating: toGoogleUserRating(volume.userInfo?.review?.rating),
    startedAt: status === 'IN_PROGRESS' ? updatedAt : null,
    completedAt: status === 'COMPLETED' ? updatedAt : null,
  };
};

const toGoogleUserRating = (rating?: string) => {
  const ratings: Record<string, number> = { ONE: 2, TWO: 4, THREE: 6, FOUR: 8, FIVE: 10 };
  return rating ? (ratings[rating] ?? null) : null;
};

const normalizeGoogleImageUrl = (url?: string) => (url ? url.replace(/^http:/, 'https:') : null);

const toGooglePublishedDate = (value?: string | null) => {
  if (!value) return null;
  const match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2] ?? 1);
  const day = Number(match[3] ?? 1);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
};

const recordConnectionSyncFailure = async (
  connectionId: string,
  error: unknown,
  fallbackMessage: string,
) => {
  if (error instanceof AppError && error.code === 'CONNECTION_EXPIRED') {
    await markConnectionExpired(connectionId);
    return;
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  await markConnectionSyncFailed(connectionId, message);
};

const fetchTraktPages = async <T>(accessToken: string, path: string) => {
  const items: T[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const url = new URL(`https://api.trakt.tv${path}`);
    url.searchParams.set('extended', 'full');
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', '100');
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'trakt-api-key': process.env.TRAKT_CLIENT_ID ?? '',
        'trakt-api-version': '2',
      },
    });
    if (!response.ok) {
      let message = 'Trakt library synchronization failed.';
      try {
        const payload = (await response.json()) as { error_description?: string; error?: string };
        message = payload.error_description ?? payload.error ?? message;
      } catch {
        // Trakt may return an empty or non-JSON response for temporary failures.
      }
      throw new AppError(
        response.status === 401 ? 409 : 502,
        response.status === 401 ? 'CONNECTION_EXPIRED' : 'TRAKT_SYNC_FAILED',
        message,
      );
    }
    items.push(...((await response.json()) as T[]));
    const parsedPageCount = Number(response.headers.get('x-pagination-page-count'));
    pageCount = Number.isSafeInteger(parsedPageCount) && parsedPageCount > 0 ? parsedPageCount : 1;
    page += 1;
  } while (page <= pageCount);

  return items;
};

type TraktLibraryData = {
  watchlistMovies: TraktWatchlistEntry[];
  watchlistShows: TraktWatchlistEntry[];
  watchedMovies: TraktWatchedMovie[];
  watchedShows: TraktWatchedShow[];
  movieRatings: TraktRatingEntry[];
  showRatings: TraktRatingEntry[];
};

const buildTraktLibraryItems = (data: TraktLibraryData) => {
  const items = new Map<string, ConnectedLibraryItem>();

  const store = (
    media: TraktMedia | undefined,
    mediaType: 'MOVIE' | 'TV',
    library: Pick<
      ConnectedLibraryItem,
      'status' | 'progress' | 'rating' | 'startedAt' | 'completedAt'
    >,
  ) => {
    const item = toTraktLibraryItem(media, mediaType, library);
    if (item) items.set(`${mediaType}:${item.externalId}`, item);
  };

  for (const entry of data.watchlistMovies) {
    store(entry.movie, 'MOVIE', emptyTraktLibraryState('PLANNED'));
  }
  for (const entry of data.watchlistShows) {
    store(entry.show, 'TV', emptyTraktLibraryState('PLANNED'));
  }
  for (const entry of data.watchedMovies) {
    store(entry.movie, 'MOVIE', {
      status: 'COMPLETED',
      progress: 100,
      rating: null,
      startedAt: null,
      completedAt: toTimestamp(entry.last_watched_at),
    });
  }
  for (const entry of data.watchedShows) {
    const watchedEpisodes =
      entry.seasons?.reduce(
        (total, season) =>
          total + (season.episodes?.filter((episode) => (episode.plays ?? 0) > 0).length ?? 0),
        0,
      ) ?? 0;
    const airedEpisodes = entry.show?.aired_episodes ?? 0;
    const completed = airedEpisodes > 0 && watchedEpisodes >= airedEpisodes;
    store(entry.show, 'TV', {
      status: completed ? 'COMPLETED' : 'IN_PROGRESS',
      progress: watchedEpisodes,
      rating: null,
      startedAt: null,
      completedAt: completed ? toTimestamp(entry.last_watched_at) : null,
    });
  }

  for (const entry of [...data.movieRatings, ...data.showRatings]) {
    const mediaType = entry.movie ? 'MOVIE' : 'TV';
    const media = entry.movie ?? entry.show;
    const externalId = media?.ids?.trakt;
    if (!externalId) continue;
    const key = `${mediaType}:${toTraktExternalId(mediaType, externalId)}`;
    const existing = items.get(key);
    const rating = normalizeTraktRating(entry.rating);
    if (existing) {
      items.set(key, { ...existing, rating });
    } else {
      store(media, mediaType, {
        status: 'COMPLETED',
        progress: mediaType === 'MOVIE' ? 100 : (media?.aired_episodes ?? 0),
        rating,
        startedAt: null,
        completedAt: toTimestamp(entry.rated_at),
      });
    }
  }

  return [...items.values()];
};

const emptyTraktLibraryState = (status: LibraryStatus) => ({
  status,
  progress: 0,
  rating: null,
  startedAt: null,
  completedAt: null,
});

const toTraktLibraryItem = (
  media: TraktMedia | undefined,
  mediaType: 'MOVIE' | 'TV',
  library: Pick<
    ConnectedLibraryItem,
    'status' | 'progress' | 'rating' | 'startedAt' | 'completedAt'
  >,
): ConnectedLibraryItem | null => {
  const externalId = media?.ids?.trakt;
  if (!externalId || !media.title) return null;
  const section = mediaType === 'MOVIE' ? 'movies' : 'shows';

  return {
    externalId: toTraktExternalId(mediaType, externalId),
    mediaType,
    title: media.title,
    description: media.overview?.trim() || null,
    releaseDate: toTimestamp(media.released ?? media.first_aired),
    coverUrl: null,
    totalUnits: mediaType === 'TV' ? (media.aired_episodes ?? null) : 1,
    genres: media.genres ?? [],
    sourceUrl: media.ids?.slug
      ? `https://trakt.tv/${section}/${media.ids.slug}`
      : `https://trakt.tv/${section}/${externalId}`,
    ...library,
  };
};

const toTraktExternalId = (mediaType: 'MOVIE' | 'TV', externalId: number) =>
  `${mediaType.toLocaleLowerCase()}:${externalId}`;

const normalizeTraktRating = (rating?: number) =>
  typeof rating === 'number' && rating >= 1 ? Math.min(10, rating) : null;

const toTimestamp = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const fetchAniListEntries = async (
  accessToken: string,
  userId: number,
  type: 'ANIME' | 'MANGA',
) => {
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ query: aniListLibraryQuery, variables: { userId, type } }),
  });
  const payload = (await response.json()) as AniListCollectionResponse;
  if (!response.ok || payload.errors?.length) {
    throw new AppError(
      response.status === 401 ? 409 : 502,
      response.status === 401 ? 'CONNECTION_EXPIRED' : 'ANILIST_SYNC_FAILED',
      payload.errors?.[0]?.message ?? 'AniList library synchronization failed.',
    );
  }
  return (payload.data?.MediaListCollection?.lists ?? []).flatMap((list) => list.entries ?? []);
};

const toConnectedLibraryItem = (entry: AniListEntry): ConnectedLibraryItem | null => {
  const media = entry.media;
  const title =
    media?.title?.userPreferred ??
    media?.title?.english ??
    media?.title?.romaji ??
    media?.title?.native;
  if (!media?.id || !media.type || !title) return null;

  return {
    externalId: String(media.id),
    mediaType: media.type,
    title,
    description: stripHtml(media.description),
    releaseDate: toDate(media.startDate),
    coverUrl: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    totalUnits:
      media.type === 'ANIME' ? (media.episodes ?? null) : (media.chapters ?? media.volumes ?? null),
    genres: media.genres ?? [],
    sourceUrl:
      media.siteUrl ??
      `https://anilist.co/${media.type === 'ANIME' ? 'anime' : 'manga'}/${media.id}`,
    status: toLibraryStatus(entry.status),
    progress: Math.max(0, entry.progress ?? 0),
    rating: entry.score && entry.score > 0 ? Math.min(10, entry.score) : null,
    startedAt: toDate(entry.startedAt),
    completedAt: toDate(entry.completedAt),
  };
};

const toLibraryStatus = (status?: string | null): LibraryStatus => {
  const statuses: Record<string, LibraryStatus> = {
    CURRENT: 'IN_PROGRESS',
    REPEATING: 'IN_PROGRESS',
    PLANNING: 'PLANNED',
    COMPLETED: 'COMPLETED',
    PAUSED: 'ON_HOLD',
    DROPPED: 'DROPPED',
  };
  return status ? (statuses[status] ?? 'PLANNED') : 'PLANNED';
};

const toDate = (value?: AniListDate | null) => {
  if (!value?.year) return null;
  return new Date(Date.UTC(value.year, Math.max(0, (value.month ?? 1) - 1), value.day ?? 1));
};

const stripHtml = (value?: string | null) => {
  if (!value) return null;
  return (
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || null
  );
};
