import type { RequestHandler } from 'express';

import {
  getMediaCatalogue,
  getMediaDetails,
  submitManualMedia,
} from '../services/media.service.js';
import type {
  ManualMediaBody,
  MediaIdParams,
  MediaListQuery,
} from '../validation/media.validation.js';

export const listMedia: RequestHandler = async (_request, response) => {
  const query = response.locals.validatedRequest.query as MediaListQuery;
  const result = await getMediaCatalogue(query);

  response.json(result);
};

export const getMedia: RequestHandler = async (_request, response) => {
  const { mediaId } = response.locals.validatedRequest.params as MediaIdParams;
  const result = await getMediaDetails(mediaId);

  response.json(result);
};

export const createManualMedia: RequestHandler = async (_request, response) => {
  const body = response.locals.validatedRequest.body as ManualMediaBody;
  const result = await submitManualMedia(body, response.locals.userId as string);

  response.status(201).json(result);
};
