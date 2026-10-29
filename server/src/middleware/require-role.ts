import type { RequestHandler } from 'express';

import { AppError } from '../errors/app-error.js';

type Role = 'USER' | 'ADMIN';

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (request, _response, next) => {
    if (!request.user) {
      next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.'));
      return;
    }
    if (!roles.includes(request.user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
      return;
    }
    next();
  };
