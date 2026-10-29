import type { LibraryStatus, Prisma } from '@prisma/client';

import { getDashboardData } from '../repositories/dashboard.repository.js';

const libraryStatuses: LibraryStatus[] = [
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'DROPPED',
];

export const getDashboardSummary = async (userId: string) => {
  const data = await getDashboardData(userId);
  const statusMap = new Map(data.statusCounts.map((item) => [item.status, item._count._all]));
  const byStatus = libraryStatuses.map((status) => ({
    status,
    count: statusMap.get(status) ?? 0,
  }));

  return {
    data: {
      overview: {
        totalTitles: byStatus.reduce((total, item) => total + item.count, 0),
        byStatus,
        byMediaType: data.mediaTypeCounts.map((item) => ({
          code: item.code,
          name: item.name,
          section: item.section,
          count: item._count.mediaItems,
        })),
      },
      recentEntries: data.recentEntries.map((entry) => ({
        id: entry.id,
        status: entry.status,
        progressValue: entry.progressValue.toNumber(),
        rating: toNumber(entry.rating),
        updatedAt: entry.updatedAt,
        mediaItem: entry.mediaItem,
      })),
      completionsByMonth: groupCompletionsByMonth(
        data.completedEntries.map((entry) => entry.completedAt).filter((date) => date !== null),
      ),
      topGenres: data.genres
        .map((genre) => ({
          name: genre.name,
          slug: genre.slug,
          titleCount: genre._count.mediaItems,
        }))
        .sort(
          (left, right) =>
            right.titleCount - left.titleCount || left.name.localeCompare(right.name),
        )
        .slice(0, 5),
    },
  };
};

const groupCompletionsByMonth = (dates: Date[]) => {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const month = date.toISOString().slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return [...counts.entries()].map(([month, count]) => ({ month, count }));
};

const toNumber = (value: Prisma.Decimal | null) => (value === null ? null : value.toNumber());
