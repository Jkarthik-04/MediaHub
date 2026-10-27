import { z } from 'zod';

export const adminMediaParamsSchema = z.object({ mediaId: z.string().uuid() });

export const manualMediaReviewBodySchema = z
  .object({ decision: z.enum(['APPROVE', 'REJECT']) })
  .strict();

export type AdminMediaParams = z.infer<typeof adminMediaParamsSchema>;
export type ManualMediaReviewBody = z.infer<typeof manualMediaReviewBodySchema>;
