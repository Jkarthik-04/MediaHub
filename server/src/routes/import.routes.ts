import { Router } from 'express';

import {
  confirmImportJob,
  createImportPreview,
  showImportJob,
} from '../controllers/import.controller.js';
import { requireUser } from '../middleware/require-user.js';
import { validateRequest } from '../middleware/validate-request.js';
import {
  importConfirmBodySchema,
  importJobParamsSchema,
  importPreviewBodySchema,
} from '../validation/import.validation.js';

export const importRouter = Router();

importRouter.use(requireUser);
importRouter.post(
  '/preview',
  validateRequest('body', importPreviewBodySchema),
  createImportPreview,
);
importRouter.post(
  '/:jobId/confirm',
  validateRequest('params', importJobParamsSchema),
  validateRequest('body', importConfirmBodySchema),
  confirmImportJob,
);
importRouter.get('/:jobId', validateRequest('params', importJobParamsSchema), showImportJob);
