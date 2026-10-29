import type { RequestHandler } from 'express';
import { sessionCookieName } from '../config/security.js';
import {
  exportAccountData,
  requestDeletionCode,
  verifyAndDeleteAccount,
} from '../services/account.service.js';
import { AppError } from '../errors/app-error.js';

export const downloadAccountBackup: RequestHandler = async (_request, response) => {
  const data = await exportAccountData(response.locals.userId as string);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="mediahub-backup-${new Date().toISOString().slice(0, 10)}.json"`,
  );
  response.setHeader('Cache-Control', 'no-store');
  response.json(data);
};

export const sendDeletionCode: RequestHandler = async (_request, response) => {
  const user = response.locals.user as Express.User | undefined;
  if (!user) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');
  await requestDeletionCode(user.id, user.email);
  response.status(202).json({
    data: {
      message:
        'If the account is eligible, a verification code has been sent to your registered email.',
    },
  });
};

export const deleteAccount: RequestHandler = async (request, response) => {
  const body = request.body as { code?: unknown; confirm?: unknown };
  if (body.confirm !== true)
    throw new AppError(
      400,
      'CONFIRMATION_REQUIRED',
      'Explicit confirmation is required to delete the account.',
    );
  if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code))
    throw new AppError(400, 'INVALID_CODE_FORMAT', 'Enter the six-digit verification code.');
  await verifyAndDeleteAccount(response.locals.userId as string, body.code, request);
  response.clearCookie(sessionCookieName);
  response.status(204).send();
};
