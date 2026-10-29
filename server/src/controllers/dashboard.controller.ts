import type { RequestHandler } from 'express';

import { getDashboardSummary } from '../services/dashboard.service.js';

export const showDashboardSummary: RequestHandler = async (_request, response) => {
  response.json(await getDashboardSummary(response.locals.userId as string));
};
