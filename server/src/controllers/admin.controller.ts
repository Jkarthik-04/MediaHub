import type { RequestHandler } from 'express';

import { getAdminOverview } from '../services/admin.service.js';

export const showAdminOverview: RequestHandler = async (_request, response) => {
  response.json(await getAdminOverview());
};
