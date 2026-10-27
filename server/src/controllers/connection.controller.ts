import type { RequestHandler } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { clientOrigin } from '../config/security.js';
import { AppError } from '../errors/app-error.js';
import {
  connectAniListAccount,
  connectGoogleBooksAccount,
  connectTraktAccount,
  createAniListAuthorizationUrl,
  createGoogleBooksAuthorizationUrl,
  createTraktAuthorizationUrl,
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

export const startTraktConnection: RequestHandler = (request, response) => {
  const state = randomBytes(32).toString('base64url');
  const codeVerifier = randomBytes(64).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const authorizationUrl = createTraktAuthorizationUrl(state, codeChallenge);
  request.session.connectionOAuth = {
    provider: 'trakt',
    state,
    createdAt: Date.now(),
    codeVerifier,
  };
  response.redirect(authorizationUrl);
};

export const finishTraktConnection: RequestHandler = async (request, response) => {
  const code = typeof request.query.code === 'string' ? request.query.code : '';
  const returnedState = typeof request.query.state === 'string' ? request.query.state : '';
  const savedState = request.session.connectionOAuth;
  delete request.session.connectionOAuth;

  const stateMatches =
    savedState?.provider === 'trakt' &&
    Date.now() - savedState.createdAt < 10 * 60 * 1_000 &&
    returnedState.length === savedState.state.length &&
    timingSafeEqual(Buffer.from(returnedState), Buffer.from(savedState.state));
  if (!code || !stateMatches || !savedState?.codeVerifier) {
    throw new AppError(
      400,
      'INVALID_OAUTH_CALLBACK',
      'The Trakt authorization response is invalid or expired.',
    );
  }

  await connectTraktAccount(response.locals.userId as string, code, savedState.codeVerifier);
  response.redirect(`${clientOrigin}/connections?connection=trakt-success`);
};

export const startGoogleBooksConnection: RequestHandler = (request, response) => {
  const state = randomBytes(32).toString('base64url');
  const codeVerifier = randomBytes(64).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const authorizationUrl = createGoogleBooksAuthorizationUrl(state, codeChallenge);
  request.session.connectionOAuth = {
    provider: 'google-books',
    state,
    createdAt: Date.now(),
    codeVerifier,
  };
  response.redirect(authorizationUrl);
};

export const finishGoogleBooksConnection: RequestHandler = async (request, response) => {
  const code = typeof request.query.code === 'string' ? request.query.code : '';
  const returnedState = typeof request.query.state === 'string' ? request.query.state : '';
  const savedState = request.session.connectionOAuth;
  delete request.session.connectionOAuth;

  const stateMatches =
    savedState?.provider === 'google-books' &&
    Date.now() - savedState.createdAt < 10 * 60 * 1_000 &&
    returnedState.length === savedState.state.length &&
    timingSafeEqual(Buffer.from(returnedState), Buffer.from(savedState.state));
  if (!code || !stateMatches || !savedState?.codeVerifier) {
    throw new AppError(
      400,
      'INVALID_OAUTH_CALLBACK',
      'The Google Books authorization response is invalid or expired.',
    );
  }

  await connectGoogleBooksAccount(response.locals.userId as string, code, savedState.codeVerifier);
  response.redirect(`${clientOrigin}/connections?connection=google-books-success`);
};
