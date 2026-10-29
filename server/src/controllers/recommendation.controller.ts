import type { RequestHandler } from 'express';

import {
  getRecommendations,
  refreshRecommendations,
  setRecommendationFeedback,
} from '../services/recommendation.service.js';
import type {
  RecommendationFeedbackBody,
  RecommendationListQuery,
  RecommendationParams,
} from '../validation/recommendation.validation.js';

export const listRecommendations: RequestHandler = async (_request, response) => {
  const { limit } = response.locals.validatedRequest.query as RecommendationListQuery;
  response.json(await getRecommendations(response.locals.userId as string, limit));
};

export const generateRecommendations: RequestHandler = async (_request, response) => {
  const { limit } = response.locals.validatedRequest.query as RecommendationListQuery;
  response.json(await refreshRecommendations(response.locals.userId as string, limit));
};

export const updateRecommendationFeedback: RequestHandler = async (_request, response) => {
  const { recommendationId } = response.locals.validatedRequest.params as RecommendationParams;
  const { feedback } = response.locals.validatedRequest.body as RecommendationFeedbackBody;
  response.json(
    await setRecommendationFeedback(response.locals.userId as string, recommendationId, feedback),
  );
};
