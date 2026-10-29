import { prisma } from '../utils/prisma.js';
import type { ManualMediaReviewBody } from '../validation/admin.validation.js';

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

export const listPendingManualMedia = () =>
  prisma.mediaItem.findMany({
    where: { origin: 'MANUAL', reviewStatus: 'PENDING_REVIEW', isActive: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      description: true,
      releaseDate: true,
      coverUrl: true,
      totalUnits: true,
      createdAt: true,
      createdByUser: { select: { id: true, displayName: true, email: true } },
      mediaType: { select: { code: true, name: true, section: true } },
      genres: { select: { genre: { select: { name: true, slug: true } } } },
    },
  });

export const reviewManualMedia = async (
  mediaId: string,
  actorUserId: string,
  body: ManualMediaReviewBody,
) =>
  prisma.$transaction(async (transaction) => {
    const existing = await transaction.mediaItem.findFirst({
      where: { id: mediaId, origin: 'MANUAL', reviewStatus: 'PENDING_REVIEW', isActive: true },
      select: { id: true, title: true, reviewStatus: true, isActive: true },
    });
    if (!existing) return null;

    const updated = await transaction.mediaItem.update({
      where: { id: mediaId },
      data:
        body.decision === 'APPROVE'
          ? { reviewStatus: 'APPROVED' }
          : { reviewStatus: 'REJECTED', isActive: false },
      select: { id: true, title: true, reviewStatus: true, isActive: true },
    });
    await transaction.auditLog.create({
      data: {
        actorUserId,
        action: body.decision === 'APPROVE' ? 'MANUAL_MEDIA_APPROVED' : 'MANUAL_MEDIA_REJECTED',
        entityType: 'media_item',
        entityId: mediaId,
        oldValues: {
          title: existing.title,
          reviewStatus: existing.reviewStatus,
          isActive: existing.isActive,
        },
        newValues: {
          title: updated.title,
          reviewStatus: updated.reviewStatus,
          isActive: updated.isActive,
        },
      },
    });
    return updated;
  });
