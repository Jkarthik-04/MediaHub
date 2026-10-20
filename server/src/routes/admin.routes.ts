import { Router } from 'express';

import { showAdminOverview } from '../controllers/admin.controller.js';
import { requireRole } from '../middleware/require-role.js';
import { requireUser } from '../middleware/require-user.js';

export const adminRouter = Router();

adminRouter.use(requireUser, requireRole('ADMIN'));
adminRouter.get('/overview', showAdminOverview);
