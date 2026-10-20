import { AppError } from '../../errors/app-error.js';
import type { ProviderMedia, ProviderSearchPage } from '../provider.types.js';

type OmdbSearchItem = {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
};

type OmdbSearchResponse = {
  Search?: OmdbSearchItem[];
  totalResults?: string;
  Response?: 'True' | 'False';
  Error?: string;
};

type OmdbSearchInput = {
  query: string;
  page: number;
};

const baseUrl = process.env.OMDB_BASE_URL ?? 'https://www.omdbapi.com/';
const cacheDurationMilliseconds = 5 * 60 * 1_000;
const responseCache = new Map<string, { expiresAt: number; value: ProviderSearchPage }>();

export const searchOmdb = async (input: OmdbSearchInput): Promise<ProviderSearchPage> => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    throw new AppError(503, 'OMDB_CONFIGURATION_REQUIRED', 'OMDb search requires an OMDB_API_KEY.');
  }

  const cacheKey = JSON.stringify(input);
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) responseCache.delete(cacheKey);

  const url = new URL(baseUrl);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('s', input.query);
  url.searchParams.set('type', 'movie');
  url.searchParams.set('page', String(input.page));
  url.searchParams.set('r', 'json');

  const payload = await requestOmdb(url);
  if (payload.Response === 'False') {
    if (payload.Error === 'Movie not found!') {
      return { items: [], page: input.page, limit: 10, totalItems: 0, totalPages: 0 };
    }
    throw new AppError(
      502,
      'PROVIDER_ERROR',
      payload.Error ?? 'OMDb could not complete the search.',
    );
  }

  const totalItems = Number(payload.totalResults ?? 0);
  const value: ProviderSearchPage = {
    items: (payload.Search ?? []).map(normalizeOmdbItem),
    page: input.page,
    limit: 10,
    totalItems: Number.isFinite(totalItems) ? totalItems : 0,
    totalPages: Number.isFinite(totalItems) ? Math.ceil(totalItems / 10) : 0,
  };
  remember(cacheKey, value);
  return value;
};

const requestOmdb = async (url: URL): Promise<OmdbSearchResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeout());
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (response.status === 429) {
      throw new AppError(503, 'PROVIDER_RATE_LIMITED', 'OMDb is temporarily rate limited.');
    }
    if (!response.ok) {
      throw new AppError(502, 'PROVIDER_ERROR', 'OMDb could not complete the search.');
    }
    return (await response.json()) as OmdbSearchResponse;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'PROVIDER_TIMEOUT', 'OMDb took too long to respond.');
    }
    throw new AppError(502, 'PROVIDER_UNAVAILABLE', 'OMDb is currently unavailable.');
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeOmdbItem = (item: OmdbSearchItem): ProviderMedia => {
  const year = item.Year.match(/\d{4}/)?.[0];
  return {
    provider: 'omdb',
    externalId: item.imdbID,
    mediaType: 'MOVIE',
    title: item.Title,
    alternateTitles: [],
    ...(year ? { releaseDate: `${year}-01-01` } : {}),
    ...(item.Poster && item.Poster !== 'N/A' ? { coverUrl: item.Poster } : {}),
    genres: [],
    sourceUrl: `https://www.imdb.com/title/${item.imdbID}/`,
  };
};

const remember = (key: string, value: ProviderSearchPage) => {
  if (responseCache.size >= 100) {
    const oldestKey = responseCache.keys().next().value as string | undefined;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { value, expiresAt: Date.now() + cacheDurationMilliseconds });
};

const providerTimeout = () => {
  const configured = Number(process.env.PROVIDER_REQUEST_TIMEOUT_MS ?? 15_000);
  return Number.isFinite(configured) && configured > 0 ? configured : 15_000;
};
