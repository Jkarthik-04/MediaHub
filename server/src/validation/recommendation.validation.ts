import { z } from 'zod';

export const recommendationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(12),
});

export const recommendationParamsSchema = z.object({
  recommendationId: z.string().uuid(),
});

export const recommendationFeedbackBodySchema = z
  .object({
    feedback: z.enum(['USEFUL', 'NOT_INTERESTED', 'DISMISSED']),
  })
  .strict();

export type RecommendationListQuery = z.infer<typeof recommendationListQuerySchema>;
export type RecommendationParams = z.infer<typeof recommendationParamsSchema>;
export type RecommendationFeedbackBody = z.infer<typeof recommendationFeedbackBodySchema>;
