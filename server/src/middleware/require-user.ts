import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

export const requireUser: RequestHandler = async (request, response, next) => {
  if (!request.user) {
    next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.'));
    return;
  }

  response.locals.userId = request.user.id;
  response.locals.user = request.user;
  response.locals.role = request.user.role;
  next();
};
