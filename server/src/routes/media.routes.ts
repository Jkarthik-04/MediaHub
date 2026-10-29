import { Router } from 'express';

import { createManualMedia, getMedia, listMedia } from '../controllers/media.controller.js';
import { requireUser } from '../middleware/require-user.js';
import { validateRequest } from '../middleware/validate-request.js';
import {
  manualMediaBodySchema,
  mediaIdParamsSchema,
  mediaListQuerySchema,
} from '../validation/media.validation.js';

export const mediaRouter = Router();

mediaRouter.get('/', validateRequest('query', mediaListQuerySchema), listMedia);
mediaRouter.post(
  '/manual',
  requireUser,
  validateRequest('body', manualMediaBodySchema),
  createManualMedia,
);
mediaRouter.get('/:mediaId', validateRequest('params', mediaIdParamsSchema), getMedia);
