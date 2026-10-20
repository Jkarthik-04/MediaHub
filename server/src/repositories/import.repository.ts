import type { ImportAction, ImportDecision, LibraryStatus, Prisma } from '@prisma/client';

import { AppError } from '../errors/app-error.js';
import type { ProviderMediaInput } from '../validation/import.validation.js';
import { prisma } from '../utils/prisma.js';

export type StagedCandidate = {
  sourceId: number;
  mediaTypeId: number;
  media: ProviderMediaInput;
  libraryStatus: LibraryStatus;
  matchMediaId?: string;
  matchConfidence?: number;
  proposedAction: ImportAction;
};

export const findSourceMap = async (keys: string[]) => {
  const sources = await prisma.source.findMany({
    where: { key: { in: keys }, isEnabled: true },
    select: { id: true, key: true },
  });
  return new Map(sources.map((source) => [source.key, source.id]));
};

export const findMediaTypeMap = async (codes: string[]) => {
  const types = await prisma.mediaType.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  return new Map(types.map((type) => [type.code, type.id]));
};

export const findExternalMatch = (sourceId: number, externalId: string) =>
  prisma.externalMapping.findUnique({
    where: { sourceId_externalId: { sourceId, externalId } },
    select: { mediaItemId: true },
  });

export const findTitleMatch = (mediaTypeId: number, normalizedTitle: string) =>
  prisma.mediaItem.findFirst({
    where: { mediaTypeId, normalizedTitle, isActive: true },
    select: { id: true },
  });

export const createPreviewJob = (userId: string, candidates: StagedCandidate[]) => {
  const uniqueSourceIds = [...new Set(candidates.map((candidate) => candidate.sourceId))];
  return prisma.ingestionJob.create({
    data: {
      requestedByUserId: userId,
      sourceId: uniqueSourceIds.length === 1 ? uniqueSourceIds[0] : null,
      kind: 'SELECTED_RESULTS',
      status: 'PREVIEW_READY',
      startedAt: new Date(),
      candidateCount: candidates.length,
      candidates: {
        create: candidates.map((candidate) => ({
          sourceId: candidate.sourceId,
          externalId: candidate.media.externalId,
          mediaTypeId: candidate.mediaTypeId,
          normalizedPayload: {
            media: candidate.media,
            libraryStatus: candidate.libraryStatus,
          } as Prisma.InputJsonValue,
          matchMediaId: candidate.matchMediaId,
          matchConfidence: candidate.matchConfidence,
          proposedAction: candidate.proposedAction,
        })),
      },
    },
    select: { id: true },
  });
};

const jobSelect = {
  id: true,
  kind: true,
  status: true,
  candidateCount: true,
  importedCount: true,
  skippedCount: true,
  failedCount: true,
  requestedAt: true,
  startedAt: true,
  completedAt: true,
  source: { select: { key: true, name: true } },
  candidates: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      externalId: true,
      normalizedPayload: true,
      matchMediaId: true,
      matchConfidence: true,
      proposedAction: true,
      decision: true,
      validationErrors: true,
      source: { select: { key: true, name: true } },
      mediaType: { select: { code: true, name: true } },
      matchMedia: { select: { id: true, title: true } },
    },
  },
} satisfies Prisma.IngestionJobSelect;

export type ImportJobRecord = Prisma.IngestionJobGetPayload<{ select: typeof jobSelect }>;

export const findOwnedImportJob = (userId: string, jobId: string) =>
  prisma.ingestionJob.findFirst({
    where: { id: jobId, requestedByUserId: userId },
    select: jobSelect,
  });

export type PreparedDecision = {
  candidateId: string;
  action: Extract<ImportDecision, 'CREATE' | 'REUSE' | 'SKIP'>;
  targetMediaId?: string;
  media: ProviderMediaInput;
  libraryStatus: LibraryStatus;
};

export const confirmImport = (userId: string, jobId: string, decisions: PreparedDecision[]) =>
  prisma.$transaction(async (transaction) => {
    const job = await transaction.ingestionJob.findFirst({
      where: { id: jobId, requestedByUserId: userId },
      select: { status: true },
    });
    if (!job) return { kind: 'not-found' as const };
    if (job.status !== 'PREVIEW_READY') return { kind: 'invalid-state' as const };

    let importedCount = 0;
    let skippedCount = 0;

    for (const decision of decisions) {
      const candidate = await transaction.ingestionCandidate.findFirst({
        where: { id: decision.candidateId, jobId },
        select: { id: true, sourceId: true, externalId: true, mediaTypeId: true },
      });
      if (!candidate) {
        throw new AppError(400, 'INVALID_CANDIDATE', 'An import candidate is invalid.');
      }

      if (decision.action === 'SKIP') {
        await transaction.ingestionCandidate.update({
          where: { id: candidate.id },
          data: { decision: 'SKIP' },
        });
        skippedCount += 1;
        continue;
      }

      let mediaItemId = decision.targetMediaId;
      if (decision.action === 'REUSE') {
        const target = mediaItemId
          ? await transaction.mediaItem.findFirst({
              where: { id: mediaItemId, mediaTypeId: candidate.mediaTypeId, isActive: true },
              select: { id: true },
            })
          : null;
        if (!target) {
          throw new AppError(400, 'INVALID_REUSE_TARGET', 'The reuse target is invalid.');
        }
      } else {
        const genreIds: number[] = [];
        for (const name of decision.media.genres) {
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
        const created = await transaction.mediaItem.create({
          data: {
            mediaTypeId: candidate.mediaTypeId,
            title: decision.media.title,
            normalizedTitle: normalizeTitle(decision.media.title),
            description: decision.media.description,
            releaseDate: parseDate(decision.media.releaseDate),
            coverUrl: decision.media.coverUrl,
            totalUnits: decision.media.totalUnits,
            origin: 'EXTERNAL',
            reviewStatus: 'APPROVED',
            genres: { create: [...new Set(genreIds)].map((genreId) => ({ genreId })) },
          },
          select: { id: true },
        });
        mediaItemId = created.id;
      }

      const existingMapping = await transaction.externalMapping.findUnique({
        where: {
          sourceId_externalId: { sourceId: candidate.sourceId, externalId: candidate.externalId },
        },
        select: { mediaItemId: true },
      });
      if (existingMapping && existingMapping.mediaItemId !== mediaItemId) {
        throw new AppError(
          409,
          'EXTERNAL_MAPPING_CONFLICT',
          'The provider title is already mapped.',
        );
      }
      await transaction.externalMapping.upsert({
        where: {
          sourceId_externalId: { sourceId: candidate.sourceId, externalId: candidate.externalId },
        },
        update: { mediaItemId, sourceUrl: decision.media.sourceUrl, lastSyncedAt: new Date() },
        create: {
          sourceId: candidate.sourceId,
          externalId: candidate.externalId,
          mediaItemId: mediaItemId!,
          sourceUrl: decision.media.sourceUrl,
        },
      });
      await transaction.libraryEntry.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId: mediaItemId! } },
        update: {},
        create: {
          userId,
          mediaItemId: mediaItemId!,
          status: decision.libraryStatus,
          startedAt:
            decision.libraryStatus === 'IN_PROGRESS' || decision.libraryStatus === 'COMPLETED'
              ? new Date()
              : undefined,
          completedAt: decision.libraryStatus === 'COMPLETED' ? new Date() : undefined,
        },
      });
      await transaction.ingestionCandidate.update({
        where: { id: candidate.id },
        data: { decision: decision.action, matchMediaId: mediaItemId },
      });
      importedCount += 1;
    }

    await transaction.ingestionJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', importedCount, skippedCount, completedAt: new Date() },
    });
    return { kind: 'completed' as const, importedCount, skippedCount };
  });

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

const parseDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};
