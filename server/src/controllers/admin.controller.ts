import type { RequestHandler } from 'express';

import {
  decideManualMedia,
  getAdminOverview,
  getPendingManualMedia,
} from '../services/admin.service.js';
import type { AdminMediaParams, ManualMediaReviewBody } from '../validation/admin.validation.js';

export const showAdminOverview: RequestHandler = async (_request, response) => {
  response.json(await getAdminOverview());
};

export const showPendingManualMedia: RequestHandler = async (_request, response) => {
  response.json(await getPendingManualMedia());
};

export const reviewManualMedia: RequestHandler = async (_request, response) => {
  const { mediaId } = response.locals.validatedRequest.params as AdminMediaParams;
  const body = response.locals.validatedRequest.body as ManualMediaReviewBody;
  response.json(await decideManualMedia(mediaId, response.locals.userId as string, body));
};
