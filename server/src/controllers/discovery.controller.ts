import type { RequestHandler } from 'express';

import { getProviders, searchDiscovery } from '../services/discovery.service.js';
import type { DiscoverySearchQuery } from '../validation/discovery.validation.js';

export const listProviders: RequestHandler = (_request, response) => {
  response.json(getProviders());
};

export const searchProviders: RequestHandler = async (_request, response) => {
  const query = response.locals.validatedRequest.query as DiscoverySearchQuery;
  response.json(await searchDiscovery(query));
};
