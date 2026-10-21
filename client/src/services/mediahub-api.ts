
import { apiClient } from './api-client';

export type ApiEnvelope<T> = {
  data: T;
};

export type ApiInfo = {
  name: string;
  version: string;
};

export type LibraryStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'DROPPED';

export type LibrarySection = 'READING' | 'WATCHING';

export type MediaTypeCode = 'MOVIE' | 'TV' | 'ANIME' | 'MANGA' | 'BOOK';

export type LibrarySort =
  | 'updatedAt:desc'
  | 'title:asc'
  | 'rating:desc';

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
export const getApiInfo = () =>
  apiClient<ApiEnvelope<ApiInfo>>('');

export async function getLibrary(
  query: LibraryListQuery = {},
): Promise<LibraryListResponse> {
  const params = new URLSearchParams();

  if (query.section) params.set('section', query.section);
  if (query.type) params.set('type', query.type);
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.status) params.set('status', query.status);
  if (query.genre) params.set('genre', query.genre);
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

export function updateLibraryProgress(
  entryId: string,
  body: LibraryProgressBody,
) {
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

export function updateLibraryEntry(
  entryId: string,
  body: LibraryEntryUpdate,
) {
  return apiClient<{ data: LibraryEntry }>(
    `/library/${encodeURIComponent(entryId)}`,
    {
      method: 'PATCH',
      body,
    },
  );
}

export function deleteLibraryEntry(entryId: string) {
  return apiClient<void>(
    `/library/${encodeURIComponent(entryId)}`,
    {
      method: 'DELETE',
    },
  );
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

export type MediaCatalogueSort =
  | 'title:asc'
  | 'title:desc'
  | 'createdAt:desc';

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

export async function searchMedia(
  query: MediaCatalogueQuery,
): Promise<MediaCatalogueResponse> {
  const params = new URLSearchParams();

  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.type) params.set('type', query.type);
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.sort) params.set('sort', query.sort);

  const queryString = params.toString();

  return apiClient<MediaCatalogueResponse>(
    `/media${queryString ? `?${queryString}` : ''}`,
  );
}

export function addLibraryEntry(
  mediaItemId: string,
  status: LibraryStatus = 'PLANNED',
) {
  return apiClient<ApiEnvelope<LibraryEntry>>('/library', {
    method: 'POST',
    body: {
      mediaItemId,
      status,
    },
  });
}
