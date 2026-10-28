import { Router } from 'express';

import {
  generateRecommendations,
  listRecommendations,
  updateRecommendationFeedback,
} from '../controllers/recommendation.controller.js';
import { requireUser } from '../middleware/require-user.js';
import { validateRequest } from '../middleware/validate-request.js';
import {
  recommendationFeedbackBodySchema,
  recommendationListQuerySchema,
  recommendationParamsSchema,
} from '../validation/recommendation.validation.js';

export const recommendationRouter = Router();

recommendationRouter.use(requireUser);
recommendationRouter.get(
  '/',
  validateRequest('query', recommendationListQuerySchema),
  listRecommendations,
);
recommendationRouter.post(
  '/refresh',
  validateRequest('query', recommendationListQuerySchema),
  generateRecommendations,
);
recommendationRouter.post(
  '/:recommendationId/feedback',
  validateRequest('params', recommendationParamsSchema),
  validateRequest('body', recommendationFeedbackBodySchema),
  updateRecommendationFeedback,
);
