import { Router } from 'express';
import type { AuthenticateOptionsGoogle } from 'passport-google-oauth20';

import { clientOrigin, isGoogleOAuthConfigured } from '../config/security.js';
import { passport } from '../config/passport.js';
import { showCurrentUser, logout } from '../controllers/auth.controller.js';
import { AppError } from '../errors/app-error.js';
import { requireUser } from '../middleware/require-user.js';

export const authRouter = Router();

// The runtime strategy accepts `true` and stores a per-login state value in the session.
// The current DefinitelyTyped declaration only permits a string for this option.
const googleAuthenticationOptions = {
  scope: ['profile', 'email'],
  state: true,
} as unknown as AuthenticateOptionsGoogle;

const requireGoogleConfiguration = (
  _request: unknown,
  _response: unknown,
  next: (error?: Error) => void,
) => {
  if (isGoogleOAuthConfigured()) {
    next();
    return;
  }
  next(
    new AppError(
      503,
      'OAUTH_NOT_CONFIGURED',
      'Google OAuth has not been configured for this environment.',
    ),
  );
};

authRouter.get(
  '/google',
  requireGoogleConfiguration,
  passport.authenticate('google', googleAuthenticationOptions),
);
authRouter.get(
  '/google/callback',
  requireGoogleConfiguration,
  passport.authenticate('google', { failureRedirect: `${clientOrigin}/?auth=failed` }),
  (_request, response) => response.redirect(`${clientOrigin}/?auth=success`),
);
authRouter.get('/me', requireUser, showCurrentUser);
authRouter.post('/logout', requireUser, logout);
