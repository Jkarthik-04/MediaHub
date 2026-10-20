import type { RequestHandler } from 'express';

import { sessionCookieName } from '../config/security.js';

export const showCurrentUser: RequestHandler = (_request, response) => {
  response.json({ data: response.locals.user });
};

export const logout: RequestHandler = (request, response, next) => {
  request.logout((logoutError) => {
    if (logoutError) {
      next(logoutError);
      return;
    }

    request.session.destroy((sessionError) => {
      if (sessionError) {
        next(sessionError);
        return;
      }
      response.clearCookie(sessionCookieName);
      response.status(204).send();
    });
  });
};
