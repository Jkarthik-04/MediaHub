import { AppError } from '../errors/app-error.js';
import {
  getAdminOverviewData,
  listPendingManualMedia,
  reviewManualMedia,
} from '../repositories/admin.repository.js';
import type { ManualMediaReviewBody } from '../validation/admin.validation.js';

export const getAdminOverview = async () => ({ data: await getAdminOverviewData() });

export const getPendingManualMedia = async () => {
  const records = await listPendingManualMedia();
  return {
    data: records.map((record) => ({
      ...record,
      genres: record.genres.map(({ genre }) => genre),
    })),
  };
};

export const decideManualMedia = async (
  mediaId: string,
  actorUserId: string,
  body: ManualMediaReviewBody,
) => {
  const result = await reviewManualMedia(mediaId, actorUserId, body);
  if (!result) {
    throw new AppError(404, 'PENDING_MEDIA_NOT_FOUND', 'The pending media title was not found.');
  }
  return { data: result };
};
