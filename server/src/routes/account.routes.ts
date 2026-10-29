import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  deleteAccount,
  downloadAccountBackup,
  sendDeletionCode,
} from '../controllers/account.controller.js';
import { requireUser } from '../middleware/require-user.js';

export const accountRouter = Router();
const otpRequestLimit = rateLimit({
  windowMs: 60 * 60 * 1_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: { code: 'OTP_RATE_LIMITED', message: 'Too many code requests. Try again later.' },
  },
});
const otpVerifyLimit = rateLimit({
  windowMs: 10 * 60 * 1_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'OTP_RATE_LIMITED',
      message: 'Too many verification attempts. Try again later.',
    },
  },
});
accountRouter.use(requireUser);
accountRouter.get('/backup', downloadAccountBackup);
accountRouter.post('/deletion-code', otpRequestLimit, sendDeletionCode);
accountRouter.post('/delete', otpVerifyLimit, deleteAccount);
