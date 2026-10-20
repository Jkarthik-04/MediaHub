import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { Pool } from 'pg';

import {
  getSessionDatabaseUrl,
  getSessionSecret,
  isProduction,
  sessionCookieName,
  sessionMaxAgeMilliseconds,
} from './security.js';

const sessionPool = new Pool({ connectionString: getSessionDatabaseUrl() });
const PgSessionStore = connectPgSimple(session);
const sessionStore = new PgSessionStore({
  pool: sessionPool,
  tableName: 'user_sessions',
  createTableIfMissing: false,
  pruneSessionInterval: 15 * 60,
});

export const sessionMiddleware = session({
  name: sessionCookieName,
  secret: getSessionSecret(),
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: sessionMaxAgeMilliseconds,
  },
});

export const disconnectSessionStore = () => sessionPool.end();
