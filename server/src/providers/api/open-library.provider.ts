import { AppError } from '../../errors/app-error.js';
import type { ProviderMedia, ProviderSearchPage } from '../provider.types.js';

type OpenLibraryDocument = {
  key: string;
  title: string;
  alternative_title?: string[];
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
  number_of_pages_median?: number;
};

type OpenLibraryResponse = {
  start?: number;
  numFound?: number;
  num_found?: number;
  docs?: OpenLibraryDocument[];
};

type OpenLibrarySearchInput = {
  query: string;
  page: number;
  limit: number;
};

const baseUrl = process.env.OPEN_LIBRARY_BASE_URL ?? 'https://openlibrary.org';
const cacheDurationMilliseconds = 5 * 60 * 1_000;
const responseCache = new Map<string, { expiresAt: number; value: ProviderSearchPage }>();

export const searchOpenLibrary = async (
  input: OpenLibrarySearchInput,
): Promise<ProviderSearchPage> => {
  const cacheKey = JSON.stringify(input);
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) responseCache.delete(cacheKey);

  const url = new URL('/search.json', baseUrl);
  url.searchParams.set('q', input.query);
  url.searchParams.set('page', String(input.page));
  url.searchParams.set('limit', String(input.limit));
  url.searchParams.set(
    'fields',
    'key,title,alternative_title,author_name,first_publish_year,cover_i,subject,number_of_pages_median',
  );

  const payload = await requestOpenLibrary(url);
  const totalItems = payload.numFound ?? payload.num_found ?? 0;
  const value: ProviderSearchPage = {
    items: (payload.docs ?? []).map(normalizeOpenLibraryDocument),
    page: Math.floor((payload.start ?? 0) / input.limit) + 1,
    limit: input.limit,
    totalItems,
    totalPages: Math.ceil(totalItems / input.limit),
  };
  remember(cacheKey, value);
  return value;
};

const requestOpenLibrary = async (url: URL): Promise<OpenLibraryResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeout());
  const contact = process.env.OPEN_LIBRARY_CONTACT_EMAIL;
  const userAgent = contact ? `MediaHub/0.1 (${contact})` : 'MediaHub/0.1 educational-project';

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': userAgent },
    });
    if (response.status === 429) {
      throw new AppError(503, 'PROVIDER_RATE_LIMITED', 'Open Library is temporarily rate limited.');
    }
    if (!response.ok) {
      throw new AppError(502, 'PROVIDER_ERROR', 'Open Library could not complete the search.');
    }
    return (await response.json()) as OpenLibraryResponse;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'PROVIDER_TIMEOUT', 'Open Library took too long to respond.');
    }
    throw new AppError(502, 'PROVIDER_UNAVAILABLE', 'Open Library is currently unavailable.');
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeOpenLibraryDocument = (document: OpenLibraryDocument): ProviderMedia => {
  const key = document.key.startsWith('/') ? document.key : `/works/${document.key}`;
  const genres = new Map<string, string>();
  for (const subject of document.subject ?? []) {
    if (subject.length > 60 || subject.includes('=')) continue;
    const normalizedSubject = subject
      .normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
    if (normalizedSubject && !genres.has(normalizedSubject)) {
      genres.set(normalizedSubject, subject);
    }
  }

  return {
    provider: 'open-library',
    externalId: key.split('/').filter(Boolean).at(-1) ?? document.key,
    mediaType: 'BOOK',
    title: document.title,
    alternateTitles: [...new Set(document.alternative_title ?? [])],
    ...(document.author_name?.length
      ? { description: `By ${document.author_name.join(', ')}` }
      : {}),
    ...(document.first_publish_year ? { releaseDate: `${document.first_publish_year}-01-01` } : {}),
    ...(document.cover_i
      ? { coverUrl: `https://covers.openlibrary.org/b/id/${document.cover_i}-L.jpg` }
      : {}),
    genres: [...genres.values()].slice(0, 10),
    ...(document.number_of_pages_median
      ? { totalUnits: Math.round(document.number_of_pages_median) }
      : {}),
    sourceUrl: `https://openlibrary.org${key}`,
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
