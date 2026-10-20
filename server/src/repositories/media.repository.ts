import type { Prisma } from '@prisma/client';

import { prisma } from '../utils/prisma.js';

const mediaListSelect = {
  id: true,
  title: true,
  description: true,
  releaseDate: true,
  coverUrl: true,
  totalUnits: true,
  origin: true,
  reviewStatus: true,
  createdAt: true,
  mediaType: {
    select: {
      code: true,
      name: true,
      section: true,
      progressMode: true,
    },
  },
  genres: {
    select: {
      genre: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  },
  externalMappings: {
    select: {
      externalId: true,
      sourceUrl: true,
      source: {
        select: {
          key: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.MediaItemSelect;

const mediaDetailSelect = {
  ...mediaListSelect,
  updatedAt: true,
  isActive: true,
  createdByUser: {
    select: {
      id: true,
      displayName: true,
    },
  },
  units: {
    orderBy: [{ sequenceNumber: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      parentUnitId: true,
      unitKind: true,
      sequenceNumber: true,
      seasonNumber: true,
      title: true,
      durationMinutes: true,
      pageCount: true,
      releaseDate: true,
    },
  },
} satisfies Prisma.MediaItemSelect;

export type MediaListRecord = Prisma.MediaItemGetPayload<{
  select: typeof mediaListSelect;
}>;

export type MediaDetailRecord = Prisma.MediaItemGetPayload<{
  select: typeof mediaDetailSelect;
}>;

type ListMediaInput = {
  where: Prisma.MediaItemWhereInput;
  orderBy: Prisma.MediaItemOrderByWithRelationInput[];
  skip: number;
  take: number;
};

export const listMedia = async ({ where, orderBy, skip, take }: ListMediaInput) => {
  const [totalItems, items] = await prisma.$transaction([
    prisma.mediaItem.count({ where }),
    prisma.mediaItem.findMany({
      where,
      orderBy,
      skip,
      take,
      select: mediaListSelect,
    }),
  ]);

  return { items, totalItems };
};

export const findMediaById = (id: string) => {
  return prisma.mediaItem.findFirst({
    where: { id, isActive: true },
    select: mediaDetailSelect,
  });
};

export const findMediaTypeByCode = (code: string) => {
  return prisma.mediaType.findUnique({
    where: { code },
    select: { id: true },
  });
};

export const findMediaByNormalizedTitle = (mediaTypeId: number, normalizedTitle: string) => {
  return prisma.mediaItem.findFirst({
    where: { mediaTypeId, normalizedTitle, isActive: true },
    select: { id: true, title: true },
  });
};

type CreateManualMediaInput = {
  mediaTypeId: number;
  title: string;
  normalizedTitle: string;
  description?: string;
  releaseDate?: Date;
  coverUrl?: string;
  totalUnits?: number;
  genres: Array<{ name: string; slug: string }>;
};

export const createManualMedia = (input: CreateManualMediaInput) => {
  return prisma.$transaction(async (transaction) => {
    const genreIds: number[] = [];

    for (const genre of input.genres) {
      const savedGenre = await transaction.genre.upsert({
        where: { slug: genre.slug },
        update: {},
        create: genre,
        select: { id: true },
      });
      genreIds.push(savedGenre.id);
    }

    return transaction.mediaItem.create({
      data: {
        mediaTypeId: input.mediaTypeId,
        title: input.title,
        normalizedTitle: input.normalizedTitle,
        description: input.description,
        releaseDate: input.releaseDate,
        coverUrl: input.coverUrl,
        totalUnits: input.totalUnits,
        origin: 'MANUAL',
        reviewStatus: 'PENDING_REVIEW',
        genres: {
          create: genreIds.map((genreId) => ({ genreId })),
        },
      },
      select: mediaDetailSelect,
    });
  });
};
