import { Router } from 'express';

import {
  createLibrary,
  createProgress,
  deleteLibrary,
  listLibrary,
  updateLibrary,
} from '../controllers/library.controller.js';
import { requireUser } from '../middleware/require-user.js';
import { validateRequest } from '../middleware/validate-request.js';
import {
  createLibraryEntryBodySchema,
  libraryEntryParamsSchema,
  libraryListQuerySchema,
  progressBodySchema,
  updateLibraryEntryBodySchema,
} from '../validation/library.validation.js';

export const libraryRouter = Router();

libraryRouter.use(requireUser);
libraryRouter.get('/', validateRequest('query', libraryListQuerySchema), listLibrary);
libraryRouter.post('/', validateRequest('body', createLibraryEntryBodySchema), createLibrary);
libraryRouter.patch(
  '/:libraryEntryId',
  validateRequest('params', libraryEntryParamsSchema),
  validateRequest('body', updateLibraryEntryBodySchema),
  updateLibrary,
);
libraryRouter.delete(
  '/:libraryEntryId',
  validateRequest('params', libraryEntryParamsSchema),
  deleteLibrary,
);
libraryRouter.post(
  '/:libraryEntryId/progress',
  validateRequest('params', libraryEntryParamsSchema),
  validateRequest('body', progressBodySchema),
  createProgress,
);
