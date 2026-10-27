import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { configurePassport, passport } from './config/passport.js';
import { sessionMiddleware } from './config/session.js';
import { clientOrigin, isProduction } from './config/security.js';
import { AppError } from './errors/app-error.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { discoveryRouter } from './routes/discovery.routes.js';
import { connectionRouter } from './routes/connection.routes.js';
import { importRouter } from './routes/import.routes.js';
import { libraryRouter } from './routes/library.routes.js';
import { mediaRouter } from './routes/media.routes.js';
import { prisma } from './utils/prisma.js';

export const createApp = () => {
  const app = express();

  configurePassport();
  if (isProduction) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: clientOrigin, credentials: true }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1_000,
      limit: 100,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/api/v1', (_request, response) => {
    response.json({
      data: {
        name: 'MediaHub API',
        version: '0.1.0',
      },
    });
  });

  app.get('/api/v1/health/live', (_request, response) => {
    response.json({
      data: {
        status: 'ok',
        service: 'mediahub-api',
      },
    });
  });

  app.get('/api/v1/health/ready', async (_request, response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      response.json({
        data: {
          status: 'ready',
          database: 'connected',
        },
      });
    } catch {
      throw new AppError(503, 'DATABASE_UNAVAILABLE', 'The database is not ready.');
    }
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/media', mediaRouter);
  app.use('/api/v1/library', libraryRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/discovery', discoveryRouter);
  app.use('/api/v1/connections', connectionRouter);
  app.use('/api/v1/imports', importRouter);

  app.use((_request, _response, next) => {
    next(new AppError(404, 'ROUTE_NOT_FOUND', 'The requested API route does not exist.'));
  });

  app.use(errorHandler);

  return app;
};
