import express from 'express';

import { prisma } from './utils/prisma.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

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
      response.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The database is not ready.',
        },
      });
    }
  });

  return app;
};
