import { Router } from 'express';

import { listProviders, searchProviders } from '../controllers/discovery.controller.js';
import { requireUser } from '../middleware/require-user.js';
import { validateRequest } from '../middleware/validate-request.js';
import { discoverySearchQuerySchema } from '../validation/discovery.validation.js';

export const discoveryRouter = Router();

discoveryRouter.use(requireUser);
discoveryRouter.get('/providers', listProviders);
discoveryRouter.get(
  '/search',
  validateRequest('query', discoverySearchQuerySchema),
  searchProviders,
);
