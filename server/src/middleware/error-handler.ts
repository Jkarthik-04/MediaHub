import type { ErrorRequestHandler } from 'express';

import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next;

  const requestId = String(response.locals.requestId ?? 'unknown');

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        requestId,
      },
    });
    return;
  }

  console.error('Unhandled API error', { requestId, error });
  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId,
    },
  });
};
