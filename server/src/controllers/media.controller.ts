import type { RequestHandler } from 'express';

import { getMediaCatalogue } from '../services/media.service.js';
import type { MediaListQuery } from '../validation/media.validation.js';

export const listMedia: RequestHandler = async (_request, response) => {
  const query = response.locals.validatedRequest.query as MediaListQuery;
  const result = await getMediaCatalogue(query);

  response.json(result);
};
