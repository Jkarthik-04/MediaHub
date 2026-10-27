import type { RequestHandler } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';

import { clientOrigin } from '../config/security.js';
import { AppError } from '../errors/app-error.js';
import {
  connectAniListAccount,
  createAniListAuthorizationUrl,
  disconnectProvider,
  listConnections,
} from '../services/connection.service.js';

export const showConnections: RequestHandler = async (_request, response) => {
  response.json(await listConnections(response.locals.userId as string));
};

export const removeConnection: RequestHandler = async (request, response) => {
  await disconnectProvider(response.locals.userId as string, request.params.sourceKey as string);
  response.status(204).end();
};

export const startAniListConnection: RequestHandler = (request, response) => {
  const state = randomBytes(32).toString('base64url');
  const authorizationUrl = createAniListAuthorizationUrl(state);
  request.session.connectionOAuth = { provider: 'anilist', state, createdAt: Date.now() };
  response.redirect(authorizationUrl);
};

export const finishAniListConnection: RequestHandler = async (request, response) => {
  const code = typeof request.query.code === 'string' ? request.query.code : '';
  const returnedState = typeof request.query.state === 'string' ? request.query.state : '';
  const savedState = request.session.connectionOAuth;
  delete request.session.connectionOAuth;

  const stateMatches =
    savedState?.provider === 'anilist' &&
    Date.now() - savedState.createdAt < 10 * 60 * 1_000 &&
    returnedState.length === savedState.state.length &&
    timingSafeEqual(Buffer.from(returnedState), Buffer.from(savedState.state));
  if (!code || !stateMatches) {
    throw new AppError(
      400,
      'INVALID_OAUTH_CALLBACK',
      'The AniList authorization response is invalid or expired.',
    );
  }

  await connectAniListAccount(response.locals.userId as string, code);
  response.redirect(`${clientOrigin}/connections?connection=anilist-success`);
};
