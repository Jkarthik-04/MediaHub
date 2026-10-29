import type { Profile } from 'passport-google-oauth20';

import { AppError } from '../errors/app-error.js';
import { prisma } from '../utils/prisma.js';

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  role: { select: { name: true } },
} as const;

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
};

export const findSessionUser = async (id: string): Promise<SessionUser | null> => {
  const user = await prisma.user.findFirst({
    where: { id, status: 'ACTIVE' },
    select: userSelect,
  });
  return user ? toSessionUser(user) : null;
};

export const upsertGoogleUser = async (profile: Profile): Promise<SessionUser> => {
  const email = getVerifiedEmail(profile);
  const displayName = profile.displayName.trim() || email;
  const avatarUrl = profile.photos?.[0]?.value ?? null;

  const user = await prisma.$transaction(async (transaction) => {
    const byGoogleSubject = await transaction.user.findUnique({
      where: { googleSubject: profile.id },
      select: { id: true },
    });
    if (byGoogleSubject) {
      return transaction.user.update({
        where: { id: byGoogleSubject.id },
        data: { email, displayName, avatarUrl, status: 'ACTIVE' },
        select: userSelect,
      });
    }

    const byEmail = await transaction.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (byEmail) {
      return transaction.user.update({
        where: { id: byEmail.id },
        data: { googleSubject: profile.id, displayName, avatarUrl, status: 'ACTIVE' },
        select: userSelect,
      });
    }

    const defaultRole = await transaction.role.findUnique({ where: { name: 'USER' } });
    if (!defaultRole) throw new AppError(500, 'ROLE_CONFIGURATION_ERROR', 'USER role is missing.');

    return transaction.user.create({
      data: {
        roleId: defaultRole.id,
        googleSubject: profile.id,
        email,
        displayName,
        avatarUrl,
      },
      select: userSelect,
    });
  });

  return toSessionUser(user);
};

const getVerifiedEmail = (profile: Profile) => {
  const email = profile.emails?.find((candidate) => candidate.verified)?.value;
  if (!email) {
    throw new AppError(
      400,
      'GOOGLE_EMAIL_REQUIRED',
      'A verified Google email address is required to sign in.',
    );
  }
  return email.toLocaleLowerCase();
};

const toSessionUser = (user: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: { name: string };
}): SessionUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
  role: user.role.name === 'ADMIN' ? 'ADMIN' : 'USER',
});
