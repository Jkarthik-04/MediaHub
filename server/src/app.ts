import express from 'express';

import { AppError } from './errors/app-error.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { discoveryRouter } from './routes/discovery.routes.js';
import { libraryRouter } from './routes/library.routes.js';
import { mediaRouter } from './routes/media.routes.js';
import { prisma } from './utils/prisma.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);

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

  app.use('/api/v1/media', mediaRouter);
  app.use('/api/v1/library', libraryRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/discovery', discoveryRouter);

  app.use((_request, _response, next) => {
    next(new AppError(404, 'ROUTE_NOT_FOUND', 'The requested API route does not exist.'));
  });

  app.use(errorHandler);

  return app;
};
