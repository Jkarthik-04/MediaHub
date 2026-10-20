import { z } from 'zod';

export const mediaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(300).optional(),
  type: z.enum(['MOVIE', 'TV', 'ANIME', 'MANGA', 'BOOK']).optional(),
  section: z.enum(['READING', 'WATCHING']).optional(),
  sort: z.enum(['title:asc', 'title:desc', 'createdAt:desc']).default('title:asc'),
});

export type MediaListQuery = z.infer<typeof mediaListQuerySchema>;
