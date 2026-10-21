import type { LibraryStatus, Prisma } from '@prisma/client';

import { AppError } from '../errors/app-error.js';
import {
  createLibraryEntry,
  deleteOwnedLibraryEntry,
  findActiveMediaForLibrary,
  findOwnedLibraryEntry,
  findOwnedLibraryEntryByMedia,
  listLibraryEntries,
  recordLibraryProgress,
  updateOwnedLibraryEntry,
  type LibraryEntryRecord,
} from '../repositories/library.repository.js';
import type {
  CreateLibraryEntryBody,
  LibraryListQuery,
  ProgressBody,
  UpdateLibraryEntryBody,
} from '../validation/library.validation.js';

export const getUserLibrary = async (userId: string, query: LibraryListQuery) => {
  const mediaItemWhere: Prisma.MediaItemWhereInput = {
    ...(query.section || query.type
      ? {
          mediaType: {
            ...(query.section ? { section: query.section } : {}),
            ...(query.type ? { code: query.type } : {}),
          },
        }
      : {}),
    ...(query.q
      ? {
          OR: [
            {
              title: {
                contains: query.q,
                mode: 'insensitive',
              },
            },
            {
              normalizedTitle: {
                contains: query.q.toLowerCase(),
              },
            },
          ],
        }
      : {}),
    ...(query.genre
      ? {
          genres: {
            some: {
              genre: {
                slug: toSlug(query.genre),
              },
            },
          },
        }
      : {}),
  };

  const where: Prisma.LibraryEntryWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(Object.keys(mediaItemWhere).length > 0 ? { mediaItem: mediaItemWhere } : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const { items, totalItems } = await listLibraryEntries({
    userId,
    where,
    orderBy: getOrderBy(query.sort),
    skip,
    take: query.limit,
  });

  return {
    data: items.map(toLibraryResponse),
    meta: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit),
      sort: query.sort,
    },
  };
};

export const addToLibrary = async (userId: string, body: CreateLibraryEntryBody) => {
  const mediaItem = await findActiveMediaForLibrary(body.mediaItemId);
  if (!mediaItem) {
    throw new AppError(404, 'MEDIA_NOT_FOUND', 'The selected media title was not found.');
  }

  const duplicate = await findOwnedLibraryEntryByMedia(userId, body.mediaItemId);
  if (duplicate) {
    throw new AppError(409, 'LIBRARY_ENTRY_EXISTS', 'This title is already in your library.');
  }

  const entry = await createLibraryEntry({
    userId,
    mediaItemId: body.mediaItemId,
    status: body.status,
    ...(body.rating !== undefined ? { rating: body.rating } : {}),
    ...(body.notes !== undefined ? { notes: body.notes } : {}),
  });
  return { data: toLibraryResponse(entry) };
};

export const editLibraryEntry = async (
  userId: string,
  libraryEntryId: string,
  body: UpdateLibraryEntryBody,
) => {
  const existing = await requireOwnedEntry(userId, libraryEntryId);
  const timing = getStatusTiming(existing, body.status);
  const entry = await updateOwnedLibraryEntry(userId, libraryEntryId, {
    ...(body.status ? { status: body.status } : {}),
    ...(body.rating !== undefined ? { rating: body.rating } : {}),
    ...(body.notes !== undefined ? { notes: body.notes } : {}),
    ...timing,
  });

  return { data: toLibraryResponse(entry) };
};

export const removeLibraryEntry = async (userId: string, libraryEntryId: string) => {
  await requireOwnedEntry(userId, libraryEntryId);
  await deleteOwnedLibraryEntry(userId, libraryEntryId);
};

export const updateProgress = async (
  userId: string,
  libraryEntryId: string,
  body: ProgressBody,
) => {
  const result = await recordLibraryProgress({ userId, libraryEntryId, ...body });

  if (result.kind === 'not-found') {
    throw new AppError(404, 'LIBRARY_ENTRY_NOT_FOUND', 'The library entry was not found.');
  }
  if (result.kind === 'invalid-unit') {
    throw new AppError(400, 'INVALID_MEDIA_UNIT', 'The selected unit belongs to another title.');
  }
  if (result.kind === 'progress-too-high') {
    throw new AppError(
      400,
      'PROGRESS_EXCEEDS_TOTAL',
      `Progress cannot be greater than ${result.maximum}.`,
    );
  }

  return {
    data: toLibraryResponse(result.entry),
    progressEvent: {
      ...result.event,
      oldProgress: toNumber(result.event.oldProgress),
      newProgress: toNumber(result.event.newProgress),
    },
  };
};

const requireOwnedEntry = async (userId: string, id: string) => {
  const entry = await findOwnedLibraryEntry(userId, id);
  if (!entry) {
    throw new AppError(404, 'LIBRARY_ENTRY_NOT_FOUND', 'The library entry was not found.');
  }
  return entry;
};

const getOrderBy = (
  sort: LibraryListQuery['sort'],
): Prisma.LibraryEntryOrderByWithRelationInput[] => {
  switch (sort) {
    case 'title:asc':
      return [{ mediaItem: { title: 'asc' } }, { id: 'asc' }];
    case 'rating:desc':
      return [{ rating: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }];
    default:
      return [{ updatedAt: 'desc' }, { id: 'asc' }];
  }
};

const getStatusTiming = (
  current: LibraryEntryRecord,
  nextStatus?: LibraryStatus,
): { startedAt?: Date | null; completedAt?: Date | null } => {
  if (!nextStatus) return {};

  return {
    ...(nextStatus === 'IN_PROGRESS' && !current.startedAt ? { startedAt: new Date() } : {}),
    completedAt: nextStatus === 'COMPLETED' ? (current.completedAt ?? new Date()) : null,
  };
};

const toLibraryResponse = (entry: LibraryEntryRecord) => ({
  id: entry.id,
  status: entry.status,
  progressValue: toNumber(entry.progressValue),
  rating: toNumber(entry.rating),
  notes: entry.notes,
  startedAt: entry.startedAt,
  completedAt: entry.completedAt,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  mediaItem: {
    ...entry.mediaItem,
    genres: entry.mediaItem.genres.map(({ genre }) => genre),
  },
  currentUnit: entry.currentUnit
    ? { ...entry.currentUnit, sequenceNumber: toNumber(entry.currentUnit.sequenceNumber) }
    : null,
});

const toNumber = (value: Prisma.Decimal | null) => (value === null ? null : value.toNumber());

const toSlug = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
