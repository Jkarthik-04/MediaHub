import { Router } from 'express';

import {
  reviewManualMedia,
  showAdminOverview,
  showPendingManualMedia,
} from '../controllers/admin.controller.js';
import { requireRole } from '../middleware/require-role.js';
import { requireUser } from '../middleware/require-user.js';
import { validateRequest } from '../middleware/validate-request.js';
import {
  adminMediaParamsSchema,
  manualMediaReviewBodySchema,
} from '../validation/admin.validation.js';

export const adminRouter = Router();

adminRouter.use(requireUser, requireRole('ADMIN'));
adminRouter.get('/overview', showAdminOverview);
adminRouter.get('/manual-media/pending', showPendingManualMedia);
adminRouter.patch(
  '/manual-media/:mediaId/review',
  validateRequest('params', adminMediaParamsSchema),
  validateRequest('body', manualMediaReviewBodySchema),
  reviewManualMedia,
);
