import { prisma } from '../utils/prisma.js';

export const getDashboardData = async (userId: string) => {
  const libraryFilter = { some: { userId } };

  const [statusCounts, mediaTypeCounts, recentEntries, completedEntries, genres] =
    await Promise.all([
      prisma.libraryEntry.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.mediaType.findMany({
        orderBy: { name: 'asc' },
        select: {
          code: true,
          name: true,
          section: true,
          _count: {
            select: {
              mediaItems: { where: { libraryEntries: libraryFilter } },
            },
          },
        },
      }),
      prisma.libraryEntry.findMany({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: 5,
        select: {
          id: true,
          status: true,
          progressValue: true,
          rating: true,
          updatedAt: true,
          mediaItem: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
              totalUnits: true,
              mediaType: {
                select: { code: true, section: true, progressMode: true },
              },
            },
          },
        },
      }),
      prisma.libraryEntry.findMany({
        where: { userId, status: 'COMPLETED', completedAt: { not: null } },
        orderBy: { completedAt: 'asc' },
        select: { completedAt: true },
      }),
      prisma.genre.findMany({
        where: { mediaItems: { some: { mediaItem: { libraryEntries: libraryFilter } } } },
        select: {
          name: true,
          slug: true,
          _count: {
            select: {
              mediaItems: { where: { mediaItem: { libraryEntries: libraryFilter } } },
            },
          },
        },
      }),
    ]);

  return { statusCounts, mediaTypeCounts, recentEntries, completedEntries, genres };
};
