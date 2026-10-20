import { z } from 'zod';

export const discoverySearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
  type: z.enum(['MOVIE', 'ANIME', 'MANGA']),
  provider: z.enum(['jikan', 'imdb']).optional(),
  page: z.coerce.number().int().min(1).max(100).default(1),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export type DiscoverySearchQuery = z.infer<typeof discoverySearchQuerySchema>;
