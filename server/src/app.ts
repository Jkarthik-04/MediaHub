import express from 'express';

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

  return app;
};
