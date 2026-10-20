import type { RequestHandler } from 'express';
import { z } from 'zod';

import { AppError } from '../errors/app-error.js';
import { prisma } from '../utils/prisma.js';

const userIdSchema = z.string().uuid();

export const requireUser: RequestHandler = async (request, response, next) => {
  const rawUserId = request.header('x-user-id');

  if (!rawUserId) {
    next(
      new AppError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Provide an x-user-id header during development.',
      ),
    );
    return;
  }

  const parsedUserId = userIdSchema.safeParse(rawUserId);
  if (!parsedUserId.success) {
    next(new AppError(400, 'INVALID_USER_ID', 'The x-user-id header must contain a UUID.'));
    return;
  }

  const user = await prisma.user.findFirst({
    where: { id: parsedUserId.data, status: 'ACTIVE' },
    select: { id: true },
  });

  if (!user) {
    next(new AppError(401, 'INVALID_USER', 'The selected user is unavailable.'));
    return;
  }

  response.locals.userId = user.id;
  next();
};
