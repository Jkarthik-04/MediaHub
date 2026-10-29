import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import { isGoogleOAuthConfigured } from './security.js';
import { findSessionUser, upsertGoogleUser } from '../services/auth.service.js';

let configured = false;

export const configurePassport = () => {
  if (configured) return;
  configured = true;

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      done(null, await findSessionUser(id));
    } catch (error) {
      done(error);
    }
  });

  if (!isGoogleOAuthConfigured()) return;

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL ?? '/api/v1/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          done(null, await upsertGoogleUser(profile));
        } catch (error) {
          done(error as Error);
        }
      },
    ),
  );
};

export { passport };
