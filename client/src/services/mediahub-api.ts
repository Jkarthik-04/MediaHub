import { apiClient } from './api-client';

export type ApiEnvelope<T> = {
  data: T;
};

export type ApiInfo = {
  name: string;
  version: string;
};

export type DashboardSummary = {
  overview: {
    totalTitles: number;
    byStatus: Array<{ status: LibraryStatus; count: number }>;
    byMediaType: Array<{
      code: MediaTypeCode;
      name: string;
      section: LibrarySection;
      count: number;
    }>;
  };
  recentEntries: Array<{
    id: string;
    status: LibraryStatus;
    progressValue: number;
    rating: number | null;
    updatedAt: string;
    mediaItem: {
      id: string;
      title: string;
      coverUrl: string | null;
      totalUnits: number | null;
      mediaType: { code: MediaTypeCode; section: LibrarySection; progressMode: string };
    };
  }>;
  completionsByMonth: Array<{ month: string; count: number }>;
  topGenres: Array<{ name: string; slug: string; titleCount: number }>;
};

export const getDashboardSummary = () =>
  apiClient<ApiEnvelope<DashboardSummary>>('/dashboard/summary');

export type MediaDetails = MediaCatalogueItem & {
  origin: string;
  reviewStatus: string;
  sources: Array<{ key: string; name: string; externalId: string; sourceUrl: string }>;
  units: Array<{
    id: string;
    parentUnitId: string | null;
    unitKind: string;
    sequenceNumber: number | null;
    seasonNumber: number | null;
    title: string | null;
    durationMinutes: number | null;
    pageCount: number | null;
    releaseDate: string | null;
  }>;
  createdByUser: { id: string; displayName: string } | null;
};

export const getMediaDetails = (mediaId: string) =>
  apiClient<ApiEnvelope<MediaDetails>>(`/media/${encodeURIComponent(mediaId)}`);

export type LibraryStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'DROPPED';

export type LibrarySection = 'READING' | 'WATCHING';

export type MediaTypeCode = 'MOVIE' | 'TV' | 'ANIME' | 'MANGA' | 'BOOK';

export type LibrarySort = 'updatedAt:desc' | 'title:asc' | 'rating:desc' | 'progress:desc';

export type LibraryEntry = {
  id: string;
  status: LibraryStatus;
  progressValue: number | null;
  rating: number | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  mediaItem: {
    id: string;
    title: string;
    coverUrl: string | null;
    totalUnits: number | null;
    mediaType: {
      code: string;
      name: string;
      section: LibrarySection;
      progressMode: string;
    };
    genres: Array<{
      name: string;
      slug: string;
    }>;
    units: Array<{
      id: string;
      unitKind: string;
      sequenceNumber: number | null;
      seasonNumber: number | null;
      title: string | null;
    }>;
  };
  currentUnit: {
    id: string;
    unitKind: string;
    sequenceNumber: number | null;
    seasonNumber: number | null;
    title: string | null;
  } | null;
};

export type LibraryListQuery = {
  section?: LibrarySection;
  type?: MediaTypeCode;
  q?: string;
  status?: LibraryStatus;
  genre?: string;
  minRating?: number;
  sort?: LibrarySort;
  page?: number;
  limit?: number;
};

export type LibraryListResponse = ApiEnvelope<LibraryEntry[]> & {
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    sort: LibrarySort;
  };
};

/** Public endpoint, retained as a connectivity check. */
export const getApiInfo = () => apiClient<ApiEnvelope<ApiInfo>>('');

export async function getLibrary(query: LibraryListQuery = {}): Promise<LibraryListResponse> {
  const params = new URLSearchParams();

  if (query.section) params.set('section', query.section);
  if (query.type) params.set('type', query.type);
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.status) params.set('status', query.status);
  if (query.genre) params.set('genre', query.genre);
  if (query.minRating !== undefined) params.set('minRating', String(query.minRating));
  if (query.sort) params.set('sort', query.sort);

  if (query.page !== undefined) {
    params.set('page', String(query.page));
  }

  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }

  const queryString = params.toString();
  const path = `/library${queryString ? `?${queryString}` : ''}`;

  return apiClient<LibraryListResponse>(path);
}

export type LibraryProgressBody = {
  progressValue: number;
  currentUnitId?: string | null;
  note?: string;
};

export function updateLibraryProgress(entryId: string, body: LibraryProgressBody) {
  return apiClient<{
    data: LibraryEntry;
    progressEvent: unknown;
  }>(`/library/${encodeURIComponent(entryId)}/progress`, {
    method: 'POST',
    body,
  });
}

export type LibraryEntryUpdate = {
  status?: LibraryStatus;
  rating?: number | null;
  notes?: string | null;
};

export function updateLibraryEntry(entryId: string, body: LibraryEntryUpdate) {
  return apiClient<{ data: LibraryEntry }>(`/library/${encodeURIComponent(entryId)}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteLibraryEntry(entryId: string) {
  return apiClient<void>(`/library/${encodeURIComponent(entryId)}`, {
    method: 'DELETE',
  });
}

export type MediaCatalogueItem = {
  id: string;
  title: string;
  description: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  totalUnits: number | null;
  mediaType: {
    code: MediaTypeCode;
    name: string;
    section: LibrarySection;
    progressMode: string;
  };
  genres: Array<{
    name: string;
    slug: string;
  }>;
};

export type MediaCatalogueSort = 'title:asc' | 'title:desc' | 'createdAt:desc';

export type MediaCatalogueResponse = ApiEnvelope<MediaCatalogueItem[]> & {
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    sort: MediaCatalogueSort;
  };
};

export type MediaCatalogueQuery = {
  q?: string;
  type?: MediaTypeCode;
  page?: number;
  limit?: number;
  sort?: MediaCatalogueSort;
};

export type DiscoveryMedia = {
  provider: 'jikan' | 'omdb' | 'open-library';
  externalId: string;
  mediaType: MediaTypeCode;
  title: string;
  alternateTitles: string[];
  description?: string;
  releaseDate?: string;
  coverUrl?: string;
  genres: string[];
  totalUnits?: number;
  sourceUrl: string;
};

export type DiscoverySearchResponse = ApiEnvelope<DiscoveryMedia[]> & {
  meta: {
    provider: DiscoveryMedia['provider'];
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ImportJob = {
  id: string;
  status: string;
  candidates: Array<{
    id: string;
    externalId?: string;
    proposedAction: 'CREATE' | 'REUSE' | 'REVIEW_MATCH';
    match: { id: string; title: string } | null;
  }>;
};

export async function searchDiscovery(query: {
  q: string;
  type: Extract<MediaTypeCode, 'MOVIE' | 'ANIME' | 'BOOK' | 'MANGA'>;
  page?: number;
  limit?: number;
}): Promise<DiscoverySearchResponse> {
  const params = new URLSearchParams({ q: query.q, type: query.type });
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  return apiClient<DiscoverySearchResponse>(`/discovery/search?${params.toString()}`);
}

export function previewImport(item: DiscoveryMedia, defaultLibraryStatus: LibraryStatus) {
  return apiClient<ApiEnvelope<ImportJob>>('/imports/preview', {
    method: 'POST',
    body: { items: [item], defaultLibraryStatus },
  });
}

export function confirmImport(
  jobId: string,
  decision: { candidateId: string; action: 'CREATE' | 'REUSE' | 'SKIP'; mediaItemId?: string },
) {
  return apiClient<ApiEnvelope<ImportJob>>(`/imports/${encodeURIComponent(jobId)}/confirm`, {
    method: 'POST',
    body: { decisions: [decision] },
  });
}

export type ManualMediaBody = {
  title: string;
  mediaType: MediaTypeCode;
  description?: string;
  releaseYear?: number;
  coverUrl?: string;
  genres: string[];
  totalUnits?: number;
};

export function submitManualMedia(body: ManualMediaBody) {
  return apiClient<ApiEnvelope<MediaDetails>>('/media/manual', { method: 'POST', body });
}

export async function searchMedia(query: MediaCatalogueQuery): Promise<MediaCatalogueResponse> {
  const params = new URLSearchParams();

  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.type) params.set('type', query.type);
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.sort) params.set('sort', query.sort);

  const queryString = params.toString();

  return apiClient<MediaCatalogueResponse>(`/media${queryString ? `?${queryString}` : ''}`);
}

export function addLibraryEntry(mediaItemId: string, status: LibraryStatus = 'PLANNED') {
  return apiClient<ApiEnvelope<LibraryEntry>>('/library', {
    method: 'POST',
    body: {
      mediaItemId,
      status,
    },
  });
}

export type ConnectionProvider = {
  key: 'anilist' | 'trakt' | 'google-books' | 'mangadex';
  name: string;
  media: MediaTypeCode[];
  description: string;
  mode: 'OAUTH';
  configured: boolean;
  connectAvailable: boolean;
  connection: null | {
    id: string;
    externalUserId: string;
    externalUsername: string | null;
    status: 'CONNECTED' | 'EXPIRED' | 'REVOKED' | 'ERROR';
    tokenExpiresAt: string | null;
    lastSyncedAt: string | null;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export const getConnectionProviders = () =>
  apiClient<ApiEnvelope<ConnectionProvider[]>>('/connections');

export const disconnectProvider = (sourceKey: ConnectionProvider['key']) =>
  apiClient<void>(`/connections/${encodeURIComponent(sourceKey)}`, { method: 'DELETE' });
