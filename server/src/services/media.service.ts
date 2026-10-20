import type { Prisma } from '@prisma/client';

import { listMedia, type MediaListRecord } from '../repositories/media.repository.js';
import type { MediaListQuery } from '../validation/media.validation.js';

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
