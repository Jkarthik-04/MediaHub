import { createApp } from './app.js';
import { prisma } from './utils/prisma.js';

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const app = createApp();

const server = app.listen(port, () => {
  console.info(`MediaHub API listening on http://localhost:${port}`);
});

const shutdown = (signal: NodeJS.Signals) => {
  console.info(`${signal} received; stopping MediaHub API.`);

  server.close(() => {
    void prisma.$disconnect().finally(() => {
      process.exit(0);
    });
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
