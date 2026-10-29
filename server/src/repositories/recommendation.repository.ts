import type { RecommendationFeedback } from '@prisma/client';

import { prisma } from '../utils/prisma.js';

export const recommendationMediaSelect = {
  id: true,
  title: true,
  description: true,
  releaseDate: true,
  coverUrl: true,
  totalUnits: true,
  mediaType: {
    select: { code: true, name: true, section: true, progressMode: true },
  },
  genres: {
    select: { genre: { select: { name: true, slug: true } } },
  },
} as const;

export const getRecommendationInputs = async (userId: string) => {
  const [libraryEntries, candidates, rejected] = await Promise.all([
    prisma.libraryEntry.findMany({
      where: { userId },
      select: {
        status: true,
        rating: true,
        mediaItem: {
          select: {
            id: true,
            mediaType: { select: { code: true } },
            genres: { select: { genre: { select: { name: true, slug: true } } } },
          },
        },
      },
    }),
    prisma.mediaItem.findMany({
      where: {
        isActive: true,
        reviewStatus: 'APPROVED',
        genres: { some: {} },
        libraryEntries: { none: { userId } },
      },
      take: 500,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: recommendationMediaSelect,
    }),
    prisma.recommendation.findMany({
      where: { userId, feedback: { in: ['NOT_INTERESTED', 'DISMISSED'] } },
      distinct: ['mediaItemId'],
      select: { mediaItemId: true },
    }),
  ]);

  return { libraryEntries, candidates, rejectedMediaIds: rejected.map((item) => item.mediaItemId) };
};

export type RecommendationCandidate = Awaited<
  ReturnType<typeof getRecommendationInputs>
>['candidates'][number];

type GeneratedRecommendation = {
  mediaItemId: string;
  score: number;
  reason: string;
};

export const replaceActiveRecommendations = async (
  userId: string,
  modelVersion: string,
  generated: GeneratedRecommendation[],
) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);

  await prisma.$transaction(async (transaction) => {
    await transaction.recommendation.updateMany({
      where: {
        userId,
        modelVersion,
        feedback: { in: ['NONE', 'USEFUL'] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { expiresAt: now },
    });

    if (generated.length > 0) {
      await transaction.recommendation.createMany({
        data: generated.map((item) => ({
          userId,
          mediaItemId: item.mediaItemId,
          score: item.score,
          reason: item.reason,
          modelVersion,
          generatedAt: now,
          expiresAt,
        })),
      });
    }
  });
};

export const listActiveRecommendations = (userId: string, limit: number) => {
  const now = new Date();
  return prisma.recommendation.findMany({
    where: {
      userId,
      feedback: { in: ['NONE', 'USEFUL'] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ score: 'desc' }, { generatedAt: 'desc' }, { id: 'asc' }],
    take: limit,
    select: {
      id: true,
      score: true,
      reason: true,
      modelVersion: true,
      feedback: true,
      generatedAt: true,
      mediaItem: { select: recommendationMediaSelect },
    },
  });
};

export const updateOwnedRecommendationFeedback = (
  userId: string,
  recommendationId: string,
  feedback: RecommendationFeedback,
) => {
  return prisma.recommendation.updateMany({
    where: { id: recommendationId, userId },
    data: { feedback },
  });
};
