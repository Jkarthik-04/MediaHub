import { prisma } from '../utils/prisma.js';

export const findUserConnections = (userId: string) =>
  prisma.userConnection.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      externalUserId: true,
      externalUsername: true,
      status: true,
      tokenExpiresAt: true,
      lastSyncedAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
      source: { select: { key: true, name: true } },
    },
  });

export const deleteUserConnection = async (userId: string, sourceKey: string) => {
  const source = await prisma.source.findUnique({
    where: { key: sourceKey },
    select: { id: true },
  });
  if (!source) return false;
  const result = await prisma.userConnection.deleteMany({ where: { userId, sourceId: source.id } });
  return result.count > 0;
};

type SaveUserConnectionInput = {
  userId: string;
  sourceKey: string;
  externalUserId: string;
  externalUsername: string | null;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
};

export const saveUserConnection = async (input: SaveUserConnectionInput) => {
  const source = await prisma.source.findUnique({
    where: { key: input.sourceKey },
    select: { id: true },
  });
  if (!source) return null;

  const data = {
    externalUserId: input.externalUserId,
    externalUsername: input.externalUsername,
    accessTokenEncrypted: input.accessTokenEncrypted,
    refreshTokenEncrypted: input.refreshTokenEncrypted,
    tokenExpiresAt: input.tokenExpiresAt,
    scopes: input.scopes,
    status: 'CONNECTED' as const,
    lastError: null,
  };

  return prisma.userConnection.upsert({
    where: { userId_sourceId: { userId: input.userId, sourceId: source.id } },
    create: { userId: input.userId, sourceId: source.id, ...data },
    update: data,
    select: { id: true },
  });
};
