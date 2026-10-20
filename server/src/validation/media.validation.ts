import { z } from 'zod';

export const mediaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(300).optional(),
  type: z.enum(['MOVIE', 'TV', 'ANIME', 'MANGA', 'BOOK']).optional(),
  section: z.enum(['READING', 'WATCHING']).optional(),
  sort: z.enum(['title:asc', 'title:desc', 'createdAt:desc']).default('title:asc'),
});

export const mediaIdParamsSchema = z.object({
  mediaId: z.string().uuid(),
});

export const manualMediaBodySchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    mediaType: z.enum(['MOVIE', 'TV', 'ANIME', 'MANGA', 'BOOK']),
    description: z.string().trim().min(1).max(5_000).optional(),
    releaseYear: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getUTCFullYear() + 1)
      .optional(),
    coverUrl: z.string().url().max(2_048).optional(),
    genres: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
    totalUnits: z.number().int().min(0).max(10_000_000).optional(),
  })
  .strict();

export type MediaListQuery = z.infer<typeof mediaListQuerySchema>;
export type MediaIdParams = z.infer<typeof mediaIdParamsSchema>;
export type ManualMediaBody = z.infer<typeof manualMediaBodySchema>;
