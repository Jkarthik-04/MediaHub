import type { LibraryStatus, Prisma } from '@prisma/client';

import { AppError } from '../errors/app-error.js';
import {
  confirmImport,
  createPreviewJob,
  findExternalMatch,
  findLibraryEntryByUserAndMedia,
  findMediaTypeMap,
  findOwnedImportJob,
  findSourceMap,
  findTitleMatch,
  type ImportJobRecord,
  type PreparedDecision,
  type StagedCandidate,
} from '../repositories/import.repository.js';
import {
  providerMediaSchema,
  type ImportConfirmBody,
  type ImportPreviewBody,
  type ProviderMediaInput,
} from '../validation/import.validation.js';

const providerMediaTypes: Record<
  ProviderMediaInput['provider'],
  ProviderMediaInput['mediaType'][]
> = {
  jikan: ['ANIME', 'MANGA'],
  omdb: ['MOVIE'],
  'open-library': ['BOOK'],
};

export const previewImport = async (userId: string, body: ImportPreviewBody) => {
  assertUniqueProviderItems(body.items);
  for (const item of body.items) {
    if (item.provider === 'omdb' && !process.env.OMDB_API_KEY) {
      throw new AppError(
        503,
        'OMDB_CONFIGURATION_REQUIRED',
        'OMDb imports require an OMDB_API_KEY.',
      );
    }
    if (!providerMediaTypes[item.provider].includes(item.mediaType)) {
      throw new AppError(
        400,
        'INVALID_PROVIDER_MEDIA_TYPE',
        `${item.provider} does not support ${item.mediaType}.`,
      );
    }
  }

  const sourceMap = await findSourceMap([...new Set(body.items.map((item) => item.provider))]);
  const mediaTypeMap = await findMediaTypeMap([
    ...new Set(body.items.map((item) => item.mediaType)),
  ]);
  const candidates: StagedCandidate[] = [];

  for (const media of body.items) {
    const sourceId = sourceMap.get(media.provider);
    const mediaTypeId = mediaTypeMap.get(media.mediaType);
    if (!sourceId) {
      throw new AppError(503, 'PROVIDER_DISABLED', `${media.provider} is not enabled.`);
    }
    if (!mediaTypeId) {
      throw new AppError(400, 'INVALID_MEDIA_TYPE', `${media.mediaType} is unavailable.`);
    }

    const externalMatch = await findExternalMatch(sourceId, media.externalId, mediaTypeId);
    if (externalMatch) {
      await assertNotAlreadyInLibrary(userId, externalMatch.mediaItemId);
      candidates.push({
        sourceId,
        mediaTypeId,
        media,
        libraryStatus: body.defaultLibraryStatus,
        matchMediaId: externalMatch.mediaItemId,
        matchConfidence: 1,
        proposedAction: 'REUSE',
      });
      continue;
    }

    const titleMatch = await findTitleMatch(mediaTypeId, normalizeTitle(media.title));
    if (titleMatch) await assertNotAlreadyInLibrary(userId, titleMatch.id);
    candidates.push({
      sourceId,
      mediaTypeId,
      media,
      libraryStatus: body.defaultLibraryStatus,
      ...(titleMatch ? { matchMediaId: titleMatch.id, matchConfidence: 0.85 } : {}),
      proposedAction: titleMatch ? 'REVIEW_MATCH' : 'CREATE',
    });
  }

  const job = await createPreviewJob(userId, candidates);
  return getImportJob(userId, job.id);
};

export const getImportJob = async (userId: string, jobId: string) => {
  const job = await findOwnedImportJob(userId, jobId);
  if (!job) throw new AppError(404, 'IMPORT_JOB_NOT_FOUND', 'The import job was not found.');
  return { data: toJobResponse(job) };
};

export const completeImport = async (userId: string, jobId: string, body: ImportConfirmBody) => {
  const job = await findOwnedImportJob(userId, jobId);
  if (!job) throw new AppError(404, 'IMPORT_JOB_NOT_FOUND', 'The import job was not found.');
  if (job.status !== 'PREVIEW_READY') {
    throw new AppError(409, 'INVALID_IMPORT_STATE', 'This import job cannot be confirmed.');
  }
  if (body.decisions.length !== job.candidates.length) {
    throw new AppError(400, 'INCOMPLETE_DECISIONS', 'Provide one decision for every candidate.');
  }

  const decisionsById = new Map(body.decisions.map((decision) => [decision.candidateId, decision]));
  if (decisionsById.size !== body.decisions.length) {
    throw new AppError(400, 'DUPLICATE_DECISION', 'Each candidate may be decided only once.');
  }

  const prepared: PreparedDecision[] = job.candidates.map((candidate) => {
    const decision = decisionsById.get(candidate.id);
    if (!decision)
      throw new AppError(400, 'INCOMPLETE_DECISIONS', 'A candidate decision is missing.');
    const payload = parsePayload(candidate.normalizedPayload);
    return {
      candidateId: candidate.id,
      action: decision.action,
      ...(decision.mediaItemId ? { targetMediaId: decision.mediaItemId } : {}),
      media: payload.media,
      libraryStatus: payload.libraryStatus,
    };
  });

  const result = await confirmImport(userId, jobId, prepared);
  if (result.kind === 'not-found') {
    throw new AppError(404, 'IMPORT_JOB_NOT_FOUND', 'The import job was not found.');
  }
  if (result.kind === 'invalid-state') {
    throw new AppError(409, 'INVALID_IMPORT_STATE', 'This import job cannot be confirmed.');
  }
  return getImportJob(userId, jobId);
};

const toJobResponse = (job: ImportJobRecord) => ({
  id: job.id,
  kind: job.kind,
  status: job.status,
  source: job.source,
  counts: {
    candidates: job.candidateCount,
    imported: job.importedCount,
    skipped: job.skippedCount,
    failed: job.failedCount,
  },
  requestedAt: job.requestedAt,
  startedAt: job.startedAt,
  completedAt: job.completedAt,
  candidates: job.candidates.map((candidate) => ({
    id: candidate.id,
    externalId: candidate.externalId,
    source: candidate.source,
    mediaType: candidate.mediaType,
    media: parsePayload(candidate.normalizedPayload).media,
    proposedAction: candidate.proposedAction,
    decision: candidate.decision,
    match: candidate.matchMedia,
    matchConfidence: toNumber(candidate.matchConfidence),
    validationErrors: candidate.validationErrors,
  })),
});

const parsePayload = (value: Prisma.JsonValue) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(500, 'INVALID_STAGED_DATA', 'Stored import data is invalid.');
  }
  const object = value as Record<string, unknown>;
  const media = providerMediaSchema.safeParse(object.media);
  const libraryStatus = object.libraryStatus;
  const validStatuses: LibraryStatus[] = [
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
    'ON_HOLD',
    'DROPPED',
  ];
  if (!media.success || !validStatuses.includes(libraryStatus as LibraryStatus)) {
    throw new AppError(500, 'INVALID_STAGED_DATA', 'Stored import data is invalid.');
  }
  return { media: media.data, libraryStatus: libraryStatus as LibraryStatus };
};

const assertUniqueProviderItems = (items: ProviderMediaInput[]) => {
  const keys = items.map((item) => `${item.provider}:${item.externalId}`);
  if (new Set(keys).size !== keys.length) {
    throw new AppError(400, 'DUPLICATE_PROVIDER_ITEM', 'The preview contains duplicate items.');
  }
};

const assertNotAlreadyInLibrary = async (userId: string, mediaItemId: string) => {
  const existingEntry = await findLibraryEntryByUserAndMedia(userId, mediaItemId);
  if (existingEntry) {
    throw new AppError(409, 'LIBRARY_ENTRY_EXISTS', 'This title already exists in your list.');
  }
};

const normalizeTitle = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const toNumber = (value: Prisma.Decimal | null) => (value === null ? null : value.toNumber());
