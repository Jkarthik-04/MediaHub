import type { LibraryStatus, Prisma } from '@prisma/client';

import { AppError } from '../errors/app-error.js';
import { prisma } from '../utils/prisma.js';

export type ConnectedLibraryItem = {
  externalId: string;
  mediaType: 'ANIME' | 'MANGA' | 'MOVIE' | 'TV' | 'BOOK';
  title: string;
  description: string | null;
  releaseDate: Date | null;
  coverUrl: string | null;
  totalUnits: number | null;
  genres: string[];
  sourceUrl: string;
  status: LibraryStatus;
  progress: number;
  rating: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

export const syncConnectedLibraryItems = (
  userId: string,
  sourceKey: string,
  items: ConnectedLibraryItem[],
) =>
  prisma.$transaction(
    async (transaction) => {
      const source = await transaction.source.findUnique({
        where: { key: sourceKey },
        select: { id: true, isEnabled: true },
      });
      if (!source?.isEnabled) {
        throw new AppError(503, 'PROVIDER_DISABLED', `${sourceKey} is not enabled.`);
      }
      const requestedMediaTypes = [...new Set(items.map((item) => item.mediaType))];
      const mediaTypes = await transaction.mediaType.findMany({
        where: { code: { in: requestedMediaTypes } },
        select: { id: true, code: true },
      });
      const mediaTypeIds = new Map(mediaTypes.map((type) => [type.code, type.id]));

      let imported = 0;
      let updated = 0;

      for (const item of items) {
        const mediaTypeId = mediaTypeIds.get(item.mediaType);
        if (!mediaTypeId) {
          throw new AppError(500, 'MEDIA_TYPE_MISSING', `${item.mediaType} is not configured.`);
        }

        const existingMapping = await transaction.externalMapping.findUnique({
          where: {
            sourceId_externalId: { sourceId: source.id, externalId: item.externalId },
          },
          select: { mediaItemId: true },
        });
        let mediaItemId = existingMapping?.mediaItemId;

        if (!mediaItemId) {
          const titleMatch = await transaction.mediaItem.findFirst({
            where: {
              mediaTypeId,
              normalizedTitle: normalizeTitle(item.title),
              isActive: true,
              reviewStatus: 'APPROVED',
            },
            select: { id: true },
          });
          mediaItemId = titleMatch?.id;
        }

        if (!mediaItemId) {
          const genreIds: number[] = [];
          for (const name of item.genres) {
            const slug = toSlug(name);
            if (!slug) continue;
            const genre = await transaction.genre.upsert({
              where: { slug },
              update: {},
              create: { name, slug },
              select: { id: true },
            });
            genreIds.push(genre.id);
          }
          const mediaItem = await transaction.mediaItem.create({
            data: {
              mediaTypeId,
              title: item.title,
              normalizedTitle: normalizeTitle(item.title),
              description: item.description,
              releaseDate: item.releaseDate,
              coverUrl: item.coverUrl,
              totalUnits: item.totalUnits,
              origin: 'EXTERNAL',
              reviewStatus: 'APPROVED',
              genres: { create: [...new Set(genreIds)].map((genreId) => ({ genreId })) },
            },
            select: { id: true },
          });
          mediaItemId = mediaItem.id;
        }

        await transaction.externalMapping.upsert({
          where: {
            sourceId_externalId: { sourceId: source.id, externalId: item.externalId },
          },
          update: { mediaItemId, sourceUrl: item.sourceUrl, lastSyncedAt: new Date() },
          create: {
            sourceId: source.id,
            externalId: item.externalId,
            mediaItemId,
            sourceUrl: item.sourceUrl,
          },
        });

        const existingEntry = await transaction.libraryEntry.findUnique({
          where: { userId_mediaItemId: { userId, mediaItemId } },
          select: { id: true },
        });
        const libraryData = {
          status: item.status,
          progressValue: item.progress,
          rating: item.rating,
          startedAt: item.startedAt,
          completedAt: item.completedAt,
        } satisfies Prisma.LibraryEntryUpdateInput;
        await transaction.libraryEntry.upsert({
          where: { userId_mediaItemId: { userId, mediaItemId } },
          update: libraryData,
          create: { userId, mediaItemId, ...libraryData },
        });
        if (existingEntry) updated += 1;
        else imported += 1;
      }

      return { imported, updated, total: items.length };
    },
    { timeout: 60_000 },
  );

const normalizeTitle = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const toSlug = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
