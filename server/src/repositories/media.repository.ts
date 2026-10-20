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

export type MediaListRecord = Prisma.MediaItemGetPayload<{
  select: typeof mediaListSelect;
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
