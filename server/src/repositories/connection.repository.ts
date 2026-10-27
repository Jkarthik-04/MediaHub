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
