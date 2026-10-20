import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '../errors/app-error.js';

type RequestTarget = 'body' | 'params' | 'query';

export const validateRequest = (target: RequestTarget, schema: ZodType): RequestHandler => {
  return (request, response, next) => {
    const result = schema.safeParse(request[target]);

    if (!result.success) {
      next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          'Request validation failed.',
          result.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.') || target,
            message: issue.message,
          })),
        ),
      );
      return;
    }

    response.locals.validatedRequest = {
      ...response.locals.validatedRequest,
      [target]: result.data,
    };
    next();
  };
};
