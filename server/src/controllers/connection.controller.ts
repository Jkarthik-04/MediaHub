import type { RequestHandler } from 'express';

import { disconnectProvider, listConnections } from '../services/connection.service.js';

export const showConnections: RequestHandler = async (_request, response) => {
  response.json(await listConnections(response.locals.userId as string));
};

export const removeConnection: RequestHandler = async (request, response) => {
  await disconnectProvider(response.locals.userId as string, request.params.sourceKey as string);
  response.status(204).end();
};
