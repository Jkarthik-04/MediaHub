import { Router } from 'express';

import { showDashboardSummary } from '../controllers/dashboard.controller.js';
import { requireUser } from '../middleware/require-user.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireUser);
dashboardRouter.get('/summary', showDashboardSummary);
