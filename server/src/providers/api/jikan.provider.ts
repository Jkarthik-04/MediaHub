import { AppError } from '../../errors/app-error.js';
import type { ProviderMedia, ProviderMediaType, ProviderSearchPage } from '../provider.types.js';

type JikanTitle = { title?: string | null };
type JikanGenre = { name?: string | null };

type JikanItem = {
  mal_id: number;
  url: string;
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  titles?: JikanTitle[];
  synopsis?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  genres?: JikanGenre[];
  aired?: { from?: string | null };
  published?: { from?: string | null };
  images?: { jpg?: { large_image_url?: string | null; image_url?: string | null } };
};

type JikanSearchResponse = {
  data?: JikanItem[];
  pagination?: {
    last_visible_page?: number;
    items?: { total?: number; per_page?: number; current_page?: number };
  };
};

type JikanSearchInput = {
  query: string;
  mediaType: Extract<ProviderMediaType, 'ANIME' | 'MANGA'>;
  page: number;
  limit: number;
};

const baseUrl = process.env.JIKAN_BASE_URL ?? 'https://api.jikan.moe/v4';
const configuredTimeout = Number(process.env.PROVIDER_REQUEST_TIMEOUT_MS ?? 15_000);
const timeoutMilliseconds =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 15_000;
const cacheDurationMilliseconds = 5 * 60 * 1_000;
const maximumCacheEntries = 100;
const responseCache = new Map<string, { expiresAt: number; value: ProviderSearchPage }>();

export const searchJikan = async (input: JikanSearchInput): Promise<ProviderSearchPage> => {
  const cacheKey = JSON.stringify(input);
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) responseCache.delete(cacheKey);

  const resource = input.mediaType === 'ANIME' ? 'anime' : 'manga';
  const url = new URL(`${baseUrl}/${resource}`);
  url.searchParams.set('q', input.query);
  url.searchParams.set('page', String(input.page));
  url.searchParams.set('limit', String(input.limit));
  url.searchParams.set('sfw', 'true');
  url.searchParams.set('order_by', 'members');
  url.searchParams.set('sort', 'desc');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'MediaHub/0.1 educational-project' },
    });

    if (response.status === 429) {
      throw new AppError(
        503,
        'PROVIDER_RATE_LIMITED',
        'Jikan is temporarily rate limited. Please try again shortly.',
      );
    }
    if (!response.ok) {
      throw new AppError(502, 'PROVIDER_ERROR', 'Jikan could not complete the search.');
    }

    const payload = (await response.json()) as JikanSearchResponse;
    const pagination = payload.pagination;
    const value: ProviderSearchPage = {
      items: (payload.data ?? []).map((item) => normalizeJikanItem(item, input.mediaType)),
      page: pagination?.items?.current_page ?? input.page,
      limit: pagination?.items?.per_page ?? input.limit,
      totalItems: pagination?.items?.total ?? 0,
      totalPages: pagination?.last_visible_page ?? 0,
    };

    if (responseCache.size >= maximumCacheEntries) {
      const oldestKey = responseCache.keys().next().value as string | undefined;
      if (oldestKey) responseCache.delete(oldestKey);
    }
    responseCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + cacheDurationMilliseconds,
    });
    return value;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'PROVIDER_TIMEOUT', 'Jikan took too long to respond.');
    }
    throw new AppError(502, 'PROVIDER_UNAVAILABLE', 'Jikan is currently unavailable.');
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeJikanItem = (
  item: JikanItem,
  mediaType: Extract<ProviderMediaType, 'ANIME' | 'MANGA'>,
): ProviderMedia => {
  const alternateTitles = [
    ...(item.titles ?? []).map((title) => title.title),
    item.title_english,
    item.title_japanese,
  ].filter((title): title is string => Boolean(title && title !== item.title));
  const releaseDate = mediaType === 'ANIME' ? item.aired?.from : item.published?.from;
  const totalUnits = mediaType === 'ANIME' ? item.episodes : item.chapters;

  return {
    provider: 'jikan',
    externalId: String(item.mal_id),
    mediaType,
    title: item.title,
    alternateTitles: [...new Set(alternateTitles)],
    ...(item.synopsis ? { description: item.synopsis } : {}),
    ...(releaseDate ? { releaseDate } : {}),
    ...(item.images?.jpg?.large_image_url || item.images?.jpg?.image_url
      ? { coverUrl: item.images.jpg.large_image_url ?? item.images.jpg.image_url ?? undefined }
      : {}),
    genres: [...new Set((item.genres ?? []).flatMap((genre) => (genre.name ? [genre.name] : [])))],
    ...(totalUnits !== null && totalUnits !== undefined ? { totalUnits } : {}),
    sourceUrl: item.url,
  };
};
