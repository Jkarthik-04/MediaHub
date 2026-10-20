import { z } from 'zod';

const providerSchema = z.enum(['jikan', 'omdb', 'open-library']);
const mediaTypeSchema = z.enum(['MOVIE', 'ANIME', 'MANGA', 'BOOK']);
const libraryStatusSchema = z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'DROPPED']);

export const providerMediaSchema = z
  .object({
    provider: providerSchema,
    externalId: z.string().trim().min(1).max(255),
    mediaType: mediaTypeSchema,
    title: z.string().trim().min(1).max(300),
    alternateTitles: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
    description: z.string().trim().min(1).max(10_000).optional(),
    releaseDate: z.string().max(40).optional(),
    coverUrl: z.string().url().max(2_048).optional(),
    genres: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    totalUnits: z.number().int().min(0).max(10_000_000).optional(),
    sourceUrl: z.string().url().max(2_048),
  })
  .strict();

export const importPreviewBodySchema = z
  .object({
    kind: z.literal('SELECTED_RESULTS').default('SELECTED_RESULTS'),
    items: z.array(providerMediaSchema).min(1).max(25),
    defaultLibraryStatus: libraryStatusSchema.default('PLANNED'),
  })
  .strict();

export const importJobParamsSchema = z.object({ jobId: z.string().uuid() });

export const importConfirmBodySchema = z
  .object({
    decisions: z
      .array(
        z
          .object({
            candidateId: z.string().uuid(),
            action: z.enum(['CREATE', 'REUSE', 'SKIP']),
            mediaItemId: z.string().uuid().optional(),
          })
          .strict()
          .superRefine((decision, context) => {
            if (decision.action === 'REUSE' && !decision.mediaItemId) {
              context.addIssue({
                code: 'custom',
                path: ['mediaItemId'],
                message: 'mediaItemId is required when action is REUSE.',
              });
            }
          }),
      )
      .min(1)
      .max(25),
  })
  .strict();

export type ProviderMediaInput = z.infer<typeof providerMediaSchema>;
export type ImportPreviewBody = z.infer<typeof importPreviewBodySchema>;
export type ImportJobParams = z.infer<typeof importJobParamsSchema>;
export type ImportConfirmBody = z.infer<typeof importConfirmBodySchema>;
