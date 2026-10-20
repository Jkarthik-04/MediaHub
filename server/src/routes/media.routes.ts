import { Router } from 'express';

import { listMedia } from '../controllers/media.controller.js';
import { validateRequest } from '../middleware/validate-request.js';
import { mediaListQuerySchema } from '../validation/media.validation.js';

export const mediaRouter = Router();

mediaRouter.get('/', validateRequest('query', mediaListQuerySchema), listMedia);
