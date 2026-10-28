import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../errors/app-error.js';

const OTP_TTL_MS = 10 * 60 * 1_000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1_000;
const hashCode = (code: string) =>
  createHmac(
    'sha256',
    process.env.OTP_PEPPER ?? process.env.SESSION_SECRET ?? 'local-development-only',
  )
    .update(code)
    .digest('hex');

export type Mailer = (to: string, code: string) => Promise<void>;

export const mapResendFailure = (status: number, providerMessage = '') => {
  const safeMessage = providerMessage.toLowerCase();
  if (status === 401)
    return new AppError(
      503,
      'RESEND_AUTHENTICATION_FAILED',
      'Resend rejected the API key. Check the key in the local environment configuration.',
    );
  if (status === 403 && /only send testing emails|own email address/.test(safeMessage))
    return new AppError(
      503,
      'RESEND_RECIPIENT_RESTRICTED',
      'Resend testing mode only allows delivery to the Resend account owner email. Verify a sending domain to reach other recipients.',
    );
  if (status === 403 && /domain/.test(safeMessage))
    return new AppError(
      503,
      'RESEND_SENDER_NOT_VERIFIED',
      'Resend rejected the sender domain. Verify the domain and sender in Resend.',
    );
  if (status === 403)
    return new AppError(
      503,
      'RESEND_SENDER_NOT_AUTHORIZED',
      'Resend did not authorize this sender. Check sender verification and API key permissions.',
    );
  if (status === 422)
    return new AppError(
      503,
      'RESEND_ADDRESS_REJECTED',
      'Resend rejected the sender or recipient address. Check both email addresses.',
    );
  if (status === 429)
    return new AppError(
      503,
      'RESEND_RATE_LIMITED',
      'Resend is temporarily rate limiting email delivery. Try again later.',
    );
  if (status >= 500)
    return new AppError(
      503,
      'RESEND_UNAVAILABLE',
      'Resend is temporarily unavailable. Try again later.',
    );
  return new AppError(
    503,
    'EMAIL_DELIVERY_FAILED',
    'We could not send the verification email. Check the Resend email configuration.',
  );
};

export const sendDeletionCode: Mailer = async (to, code) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ACCOUNT_EMAIL_FROM;
  if (!apiKey || !from)
    throw new AppError(503, 'EMAIL_NOT_CONFIGURED', 'Account email delivery is not configured.');
  let result: Response;
  try {
    result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: 'Your MediaHub account deletion code',
        text: `Your MediaHub account deletion code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      }),
    });
  } catch {
    throw new AppError(
      503,
      'EMAIL_DELIVERY_FAILED',
      'We could not send the verification email. Please try again later.',
    );
  }
  if (!result.ok) {
    const providerError: unknown = await result.json().catch(() => null);
    const providerMessage =
      providerError &&
      typeof providerError === 'object' &&
      'message' in providerError &&
      typeof providerError.message === 'string'
        ? providerError.message
        : '';
    throw mapResendFailure(result.status, providerMessage);
  }
};

export const exportAccountData = async (userId: string) => {
  const [user, entries, recommendations, connections, jobs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { name: true } },
      },
    }),
    prisma.libraryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        mediaItem: {
          include: { mediaType: true, genres: { include: { genre: { select: { name: true } } } } },
        },
        currentUnit: true,
        progressEvents: { orderBy: { recordedAt: 'asc' }, include: { unit: true } },
      },
    }),
    prisma.recommendation.findMany({
      where: { userId },
      orderBy: { generatedAt: 'asc' },
      include: {
        mediaItem: {
          select: { title: true, mediaType: { select: { name: true, section: true } } },
        },
      },
    }),
    prisma.userConnection.findMany({
      where: { userId },
      select: {
        source: { select: { key: true, name: true } },
        externalUserId: true,
        externalUsername: true,
        scopes: true,
        status: true,
        tokenExpiresAt: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.ingestionJob.findMany({
      where: { requestedByUserId: userId },
      orderBy: { requestedAt: 'asc' },
      include: {
        candidates: {
          select: { externalId: true, proposedAction: true, decision: true, createdAt: true },
        },
      },
    }),
  ]);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Account was not found.');
  return {
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    account: user,
    library: entries.map((entry) => ({
      id: entry.id,
      status: entry.status,
      progressValue: entry.progressValue.toString(),
      rating: entry.rating?.toString() ?? null,
      notes: entry.notes,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      currentUnit: entry.currentUnit,
      progressHistory: entry.progressEvents.map((event) => ({
        oldProgress: event.oldProgress?.toString() ?? null,
        newProgress: event.newProgress.toString(),
        note: event.note,
        recordedAt: event.recordedAt,
        unit: event.unit,
      })),
      media: {
        id: entry.mediaItem.id,
        title: entry.mediaItem.title,
        type: entry.mediaItem.mediaType.name,
        section: entry.mediaItem.mediaType.section,
        description: entry.mediaItem.description,
        releaseDate: entry.mediaItem.releaseDate,
        totalUnits: entry.mediaItem.totalUnits,
        genres: entry.mediaItem.genres.map(({ genre }) => genre.name),
      },
    })),
    recommendations: recommendations.map(
      ({ id, score, modelVersion, reason, feedback, generatedAt, expiresAt, mediaItem }) => ({
        id,
        score: score.toString(),
        modelVersion,
        reason,
        feedback,
        generatedAt,
        expiresAt,
        media: mediaItem,
      }),
    ),
    connectedServices: connections,
    imports: jobs.map(
      ({
        id,
        kind,
        status,
        inputReference,
        candidateCount,
        importedCount,
        skippedCount,
        failedCount,
        errorCode,
        errorMessage,
        requestedAt,
        completedAt,
        candidates,
      }) => ({
        id,
        kind,
        status,
        inputReference,
        candidateCount,
        importedCount,
        skippedCount,
        failedCount,
        errorCode,
        errorMessage,
        requestedAt,
        completedAt,
        candidates,
      }),
    ),
  };
};

export const requestDeletionCode = async (
  userId: string,
  email: string,
  mailer: Mailer = sendDeletionCode,
) => {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  await prisma.$transaction(async (tx) => {
    // Prisma cannot deserialize PostgreSQL's `void` return type. The cast keeps
    // the transaction-scoped lock while returning a regular text column.
    await tx.$queryRaw<{ lock_result: string }[]>`
      SELECT pg_advisory_xact_lock(hashtext(${userId}))::text AS lock_result
    `;
    const prior = await tx.accountDeletionChallenge.findUnique({ where: { userId } });
    if (prior && Date.now() - prior.requestedAt.getTime() < RESEND_COOLDOWN_MS)
      throw new AppError(
        429,
        'OTP_RATE_LIMITED',
        'Wait one minute before requesting another code.',
      );
    const now = new Date();
    await tx.accountDeletionChallenge.upsert({
      where: { userId },
      create: {
        userId,
        codeHash: hashCode(code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        requestedAt: now,
      },
      update: {
        codeHash: hashCode(code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        attempts: 0,
        requestedAt: now,
      },
    });
    await mailer(email, code);
  });
};

export const verifyAndDeleteAccount = async (userId: string, code: string, request: Request) => {
  const challenge = await prisma.accountDeletionChallenge.findUnique({ where: { userId } });
  if (
    !challenge ||
    challenge.expiresAt.getTime() <= Date.now() ||
    challenge.attempts >= MAX_ATTEMPTS
  )
    throw new AppError(400, 'OTP_INVALID', 'The code is invalid or expired. Request a new code.');
  const expected = Buffer.from(challenge.codeHash, 'hex');
  const actual = Buffer.from(hashCode(code), 'hex');
  if (!timingSafeEqual(expected, actual)) {
    const updated = await prisma.accountDeletionChallenge.updateMany({
      where: { userId, codeHash: challenge.codeHash, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (updated.count === 0)
      throw new AppError(400, 'OTP_INVALID', 'The code is invalid or expired. Request a new code.');
    throw new AppError(
      400,
      updated.count && challenge.attempts + 1 >= MAX_ATTEMPTS
        ? 'OTP_ATTEMPTS_EXHAUSTED'
        : 'OTP_INVALID',
      updated.count && challenge.attempts + 1 >= MAX_ATTEMPTS
        ? 'Too many incorrect attempts. Request a new code.'
        : 'The code is incorrect.',
    );
  }
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.accountDeletionChallenge.deleteMany({
      where: {
        userId,
        codeHash: challenge.codeHash,
        attempts: { lt: MAX_ATTEMPTS },
        expiresAt: { gt: new Date() },
      },
    });
    if (consumed.count !== 1)
      throw new AppError(400, 'OTP_INVALID', 'The code is invalid or expired. Request a new code.');
    await tx.auditLog.updateMany({
      where: { actorUserId: userId },
      data: { oldValues: Prisma.DbNull, newValues: Prisma.DbNull },
    });
    await tx.$executeRaw`DELETE FROM "user_sessions" WHERE "sess" #>> '{passport,user}' = ${userId}`;
    await tx.user.delete({ where: { id: userId } });
  });
  await new Promise<void>((resolve, reject) => {
    request.session.destroy((sessionError) => {
      if (sessionError) reject(sessionError);
      else resolve();
    });
  });
};
