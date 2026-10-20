import type { Prisma } from '@prisma/client';

import { AppError } from '../errors/app-error.js';
import {
  createManualMedia,
  findMediaById,
  findMediaByNormalizedTitle,
  findMediaTypeByCode,
  listMedia,
  type MediaDetailRecord,
  type MediaListRecord,
} from '../repositories/media.repository.js';
import type { ManualMediaBody, MediaListQuery } from '../validation/media.validation.js';

export const getMediaCatalogue = async (query: MediaListQuery) => {
  const where: Prisma.MediaItemWhereInput = {
    isActive: true,
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { normalizedTitle: { contains: query.q.toLowerCase() } },
          ],
        }
      : {}),
    ...(query.type ? { mediaType: { code: query.type } } : {}),
    ...(query.section ? { mediaType: { section: query.section } } : {}),
  };

  const orderBy = getOrderBy(query.sort);
  const skip = (query.page - 1) * query.limit;
  const { items, totalItems } = await listMedia({
    where,
    orderBy,
    skip,
    take: query.limit,
  });

  return {
    data: items.map(toMediaResponse),
    meta: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit),
      sort: query.sort,
    },
  };
};

export const getMediaDetails = async (mediaId: string) => {
  const mediaItem = await findMediaById(mediaId);

  if (!mediaItem) {
    throw new AppError(404, 'MEDIA_NOT_FOUND', 'The requested media title was not found.');
  }

  return { data: toMediaDetailResponse(mediaItem) };
};

export const submitManualMedia = async (body: ManualMediaBody) => {
  const normalizedTitle = normalizeTitle(body.title);
  const mediaType = await findMediaTypeByCode(body.mediaType);

  if (!mediaType) {
    throw new AppError(400, 'INVALID_MEDIA_TYPE', 'The selected media type is unavailable.');
  }

  const duplicate = await findMediaByNormalizedTitle(mediaType.id, normalizedTitle);
  if (duplicate) {
    throw new AppError(409, 'MEDIA_ALREADY_EXISTS', 'A matching media title already exists.', [
      { field: 'title', message: `Existing title: ${duplicate.title} (${duplicate.id})` },
    ]);
  }

  const genres = [
    ...new Map(
      body.genres.map((name) => {
        const slug = toSlug(name);
        return [slug, { name, slug }];
      }),
    ).values(),
  ];

  const mediaItem = await createManualMedia({
    mediaTypeId: mediaType.id,
    title: body.title,
    normalizedTitle,
    ...(body.description ? { description: body.description } : {}),
    ...(body.releaseYear ? { releaseDate: new Date(Date.UTC(body.releaseYear, 0, 1)) } : {}),
    ...(body.coverUrl ? { coverUrl: body.coverUrl } : {}),
    ...(body.totalUnits !== undefined ? { totalUnits: body.totalUnits } : {}),
    genres,
  });

  return { data: toMediaDetailResponse(mediaItem) };
};

const getOrderBy = (sort: MediaListQuery['sort']): Prisma.MediaItemOrderByWithRelationInput[] => {
  switch (sort) {
    case 'title:desc':
      return [{ title: 'desc' }, { id: 'asc' }];
    case 'createdAt:desc':
      return [{ createdAt: 'desc' }, { id: 'asc' }];
    default:
      return [{ title: 'asc' }, { id: 'asc' }];
  }
};

const toMediaResponse = (mediaItem: MediaListRecord) => ({
  id: mediaItem.id,
  title: mediaItem.title,
  description: mediaItem.description,
  releaseDate: mediaItem.releaseDate,
  coverUrl: mediaItem.coverUrl,
  totalUnits: mediaItem.totalUnits,
  origin: mediaItem.origin,
  reviewStatus: mediaItem.reviewStatus,
  createdAt: mediaItem.createdAt,
  mediaType: mediaItem.mediaType,
  genres: mediaItem.genres.map(({ genre }) => genre),
  sources: mediaItem.externalMappings.map(({ source, externalId, sourceUrl }) => ({
    ...source,
    externalId,
    sourceUrl,
  })),
});

const toMediaDetailResponse = (mediaItem: MediaDetailRecord) => ({
  ...toMediaResponse(mediaItem),
  updatedAt: mediaItem.updatedAt,
  isActive: mediaItem.isActive,
  createdByUser: mediaItem.createdByUser,
  units: mediaItem.units,
});

const normalizeTitle = (value: string) => {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
};

const toSlug = (value: string) => {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
};
