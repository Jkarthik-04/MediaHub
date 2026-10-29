import { z } from 'zod';

const libraryStatusSchema = z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'DROPPED']);

const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).nullable();

export const libraryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  section: z.enum(['READING', 'WATCHING']).optional(),
  type: z.enum(['MOVIE', 'TV', 'ANIME', 'MANGA', 'BOOK']).optional(),
  q: z.string().trim().min(1).max(300).optional(),
  status: libraryStatusSchema.optional(),
  genre: z.string().trim().min(1).max(100).optional(),
  minRating: z.coerce.number().min(0).max(10).multipleOf(0.5).optional(),
  sort: z
    .enum(['updatedAt:desc', 'title:asc', 'rating:desc', 'progress:desc'])
    .default('updatedAt:desc'),
});

export const libraryEntryParamsSchema = z.object({
  libraryEntryId: z.string().uuid(),
});

export const createLibraryEntryBodySchema = z
  .object({
    mediaItemId: z.string().uuid(),
    status: libraryStatusSchema.default('PLANNED'),
    rating: z.number().min(0).max(10).multipleOf(0.5).optional(),
    notes: optionalText(5_000).optional(),
  })
  .strict();

export const updateLibraryEntryBodySchema = z
  .object({
    status: libraryStatusSchema.optional(),
    rating: z.number().min(0).max(10).multipleOf(0.5).nullable().optional(),
    notes: optionalText(5_000).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const progressBodySchema = z
  .object({
    progressValue: z.number().min(0).max(10_000_000),
    currentUnitId: z.string().uuid().nullable().optional(),
    note: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

export type LibraryListQuery = z.infer<typeof libraryListQuerySchema>;
export type LibraryEntryParams = z.infer<typeof libraryEntryParamsSchema>;
export type CreateLibraryEntryBody = z.infer<typeof createLibraryEntryBodySchema>;
export type UpdateLibraryEntryBody = z.infer<typeof updateLibraryEntryBodySchema>;
export type ProgressBody = z.infer<typeof progressBodySchema>;
