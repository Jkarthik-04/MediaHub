import { prisma } from '../utils/prisma.js';

export const getAdminOverviewData = async () => {
  const [activeUsers, pendingManualMedia, failedIngestionJobs, enabledSources] = await Promise.all([
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.mediaItem.count({
      where: { origin: 'MANUAL', reviewStatus: 'PENDING_REVIEW', isActive: true },
    }),
    prisma.ingestionJob.count({ where: { status: 'FAILED' } }),
    prisma.source.count({ where: { isEnabled: true } }),
  ]);

  return { activeUsers, pendingManualMedia, failedIngestionJobs, enabledSources };
};
