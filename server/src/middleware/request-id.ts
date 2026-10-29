import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

export const requestId: RequestHandler = (_request, response, next) => {
  const id = `req_${randomUUID()}`;

  response.locals.requestId = id;
  response.setHeader('x-request-id', id);
  next();
};
