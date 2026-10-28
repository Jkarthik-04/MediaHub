import type { LibraryStatus, Prisma } from '@prisma/client';

import { prisma } from '../utils/prisma.js';

const libraryEntrySelect = {
  id: true,
  status: true,
  progressValue: true,
  rating: true,
  notes: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  mediaItem: {
    select: {
      id: true,
      title: true,
      normalizedTitle: true,
      coverUrl: true,
      totalUnits: true,
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
          genre: { select: { name: true, slug: true } },
        },
      },
      externalMappings: {
        select: {
          externalId: true,
          source: { select: { key: true } },
        },
      },
      units: {
        orderBy: [{ sequenceNumber: 'asc' }, { id: 'asc' }],
        take: 250,
        select: {
          id: true,
          unitKind: true,
          sequenceNumber: true,
          seasonNumber: true,
          title: true,
        },
      },
    },
  },
  currentUnit: {
    select: {
      id: true,
      unitKind: true,
      sequenceNumber: true,
      seasonNumber: true,
      title: true,
    },
  },
} satisfies Prisma.LibraryEntrySelect;

export type LibraryEntryRecord = Prisma.LibraryEntryGetPayload<{
  select: typeof libraryEntrySelect;
}>;

type ListLibraryInput = {
  userId: string;
  where: Prisma.LibraryEntryWhereInput;
  orderBy: Prisma.LibraryEntryOrderByWithRelationInput[];
  skip: number;
  take: number;
};

export const listLibraryEntries = async ({
  userId,
  where,
  orderBy,
  skip,
  take,
}: ListLibraryInput) => {
  const ownedWhere: Prisma.LibraryEntryWhereInput = { userId, ...where };
  const [totalItems, items] = await prisma.$transaction([
    prisma.libraryEntry.count({ where: ownedWhere }),
    prisma.libraryEntry.findMany({
      where: ownedWhere,
      orderBy,
      skip,
      take,
      select: libraryEntrySelect,
    }),
  ]);

  return { items, totalItems };
};

export const findOwnedLibraryEntry = (userId: string, id: string) => {
  return prisma.libraryEntry.findFirst({
    where: { id, userId },
    select: libraryEntrySelect,
  });
};

export const findOwnedLibraryEntryByMedia = (userId: string, mediaItemId: string) => {
  return prisma.libraryEntry.findUnique({
    where: { userId_mediaItemId: { userId, mediaItemId } },
    select: { id: true },
  });
};

export const findActiveMediaForLibrary = (mediaItemId: string) => {
  return prisma.mediaItem.findFirst({
    where: { id: mediaItemId, isActive: true, reviewStatus: 'APPROVED' },
    select: { id: true },
  });
};

type CreateLibraryInput = {
  userId: string;
  mediaItemId: string;
  status: LibraryStatus;
  rating?: number;
  notes?: string | null;
};

export const createLibraryEntry = (input: CreateLibraryInput) => {
  const now = new Date();
  return prisma.libraryEntry.create({
    data: {
      userId: input.userId,
      mediaItemId: input.mediaItemId,
      status: input.status,
      rating: input.rating,
      notes: input.notes,
      startedAt: input.status === 'IN_PROGRESS' ? now : undefined,
      completedAt: input.status === 'COMPLETED' ? now : undefined,
    },
    select: libraryEntrySelect,
  });
};

type UpdateLibraryInput = {
  status?: LibraryStatus;
  rating?: number | null;
  notes?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

export const updateOwnedLibraryEntry = (userId: string, id: string, data: UpdateLibraryInput) => {
  return prisma.libraryEntry.update({
    where: { id, userId },
    data,
    select: libraryEntrySelect,
  });
};

export const deleteOwnedLibraryEntry = (userId: string, id: string) => {
  return prisma.libraryEntry.deleteMany({ where: { id, userId } });
};

type RecordProgressInput = {
  userId: string;
  libraryEntryId: string;
  progressValue: number;
  currentUnitId?: string | null;
  note?: string;
};

export const recordLibraryProgress = (input: RecordProgressInput) => {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.libraryEntry.findFirst({
      where: { id: input.libraryEntryId, userId: input.userId },
      select: {
        progressValue: true,
        startedAt: true,
        mediaItem: {
          select: {
            id: true,
            totalUnits: true,
            mediaType: { select: { progressMode: true } },
          },
        },
      },
    });

    if (!current) return { kind: 'not-found' as const };

    if (input.currentUnitId) {
      const unit = await transaction.mediaUnit.findFirst({
        where: { id: input.currentUnitId, mediaItemId: current.mediaItem.id },
        select: { id: true },
      });
      if (!unit) return { kind: 'invalid-unit' as const };
    }

    const maximum =
      current.mediaItem.mediaType.progressMode === 'PERCENTAGE'
        ? 100
        : current.mediaItem.totalUnits;
    if (maximum !== null && input.progressValue > maximum) {
      return { kind: 'progress-too-high' as const, maximum };
    }

    const completed = maximum !== null && input.progressValue === maximum;
    const status: LibraryStatus = completed
      ? 'COMPLETED'
      : input.progressValue > 0
        ? 'IN_PROGRESS'
        : 'PLANNED';
    const now = new Date();

    const entry = await transaction.libraryEntry.update({
      where: { id: input.libraryEntryId },
      data: {
        progressValue: input.progressValue,
        ...(input.currentUnitId !== undefined ? { currentUnitId: input.currentUnitId } : {}),
        status,
        startedAt: input.progressValue > 0 ? (current.startedAt ?? now) : null,
        completedAt: completed ? now : null,
      },
      select: libraryEntrySelect,
    });

    const event = await transaction.progressEvent.create({
      data: {
        libraryEntryId: input.libraryEntryId,
        unitId: input.currentUnitId,
        oldProgress: current.progressValue,
        newProgress: input.progressValue,
        note: input.note,
      },
      select: {
        id: true,
        oldProgress: true,
        newProgress: true,
        note: true,
        recordedAt: true,
      },
    });

    return { kind: 'updated' as const, entry, event };
  });
};
