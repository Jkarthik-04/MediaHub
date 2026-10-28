import type { LibraryStatus, RecommendationFeedback } from '@prisma/client';

import { AppError } from '../errors/app-error.js';
import {
  getRecommendationInputs,
  listActiveRecommendations,
  replaceActiveRecommendations,
  type RecommendationCandidate,
  updateOwnedRecommendationFeedback,
} from '../repositories/recommendation.repository.js';

const MODEL_VERSION = 'genre-vector-v1';
const DEFAULT_LIMIT = 12;
const statusWeights: Record<LibraryStatus, number> = {
  COMPLETED: 1,
  IN_PROGRESS: 0.8,
  ON_HOLD: 0.35,
  PLANNED: 0.2,
  DROPPED: -0.6,
};

type TasteEntry = Awaited<ReturnType<typeof getRecommendationInputs>>['libraryEntries'][number];

const serializeRecommendation = (
  item: Awaited<ReturnType<typeof listActiveRecommendations>>[number],
) => ({
  id: item.id,
  score: item.score.toNumber(),
  reason: item.reason,
  modelVersion: item.modelVersion,
  feedback: item.feedback,
  generatedAt: item.generatedAt,
  mediaItem: {
    ...item.mediaItem,
    genres: item.mediaItem.genres.map(({ genre }) => genre),
  },
});

export const getRecommendations = async (userId: string, limit = DEFAULT_LIMIT) => {
  const items = await listActiveRecommendations(userId, limit);
  return { data: items.map(serializeRecommendation) };
};

export const refreshRecommendations = async (userId: string, limit = DEFAULT_LIMIT) => {
  const { libraryEntries, candidates, rejectedMediaIds } = await getRecommendationInputs(userId);
  const generated = buildGenreRecommendations(
    libraryEntries,
    candidates.filter((candidate) => !rejectedMediaIds.includes(candidate.id)),
    limit,
  );

  await replaceActiveRecommendations(userId, MODEL_VERSION, generated);
  return getRecommendations(userId, limit);
};

export const setRecommendationFeedback = async (
  userId: string,
  recommendationId: string,
  feedback: RecommendationFeedback,
) => {
  const result = await updateOwnedRecommendationFeedback(userId, recommendationId, feedback);
  if (result.count === 0) {
    throw new AppError(404, 'RECOMMENDATION_NOT_FOUND', 'Recommendation not found.');
  }
  return { data: { id: recommendationId, feedback } };
};

const buildGenreRecommendations = (
  libraryEntries: TasteEntry[],
  candidates: RecommendationCandidate[],
  limit: number,
) => {
  const genreWeights = new Map<string, { name: string; weight: number }>();
  const familiarMediaTypes = new Set<string>();

  for (const entry of libraryEntries) {
    const rating = entry.rating?.toNumber();
    const ratingAdjustment = rating === undefined ? 0 : (rating - 5) / 5;
    const weight = statusWeights[entry.status] + ratingAdjustment;
    if (weight > 0.4) familiarMediaTypes.add(entry.mediaItem.mediaType.code);

    for (const { genre } of entry.mediaItem.genres) {
      const current = genreWeights.get(genre.slug)?.weight ?? 0;
      genreWeights.set(genre.slug, { name: genre.name, weight: current + weight });
    }
  }

  const maximumGenreWeight = Math.max(0, ...[...genreWeights.values()].map(({ weight }) => weight));
  if (maximumGenreWeight <= 0) return [];

  return candidates
    .map((candidate) =>
      scoreCandidate(candidate, genreWeights, maximumGenreWeight, familiarMediaTypes),
    )
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit)
    .map(({ mediaItemId, score, reason }) => ({ mediaItemId, score, reason }));
};

const scoreCandidate = (
  candidate: RecommendationCandidate,
  genreWeights: Map<string, { name: string; weight: number }>,
  maximumGenreWeight: number,
  familiarMediaTypes: Set<string>,
) => {
  const matches = candidate.genres
    .map(({ genre }) => ({ ...genre, weight: genreWeights.get(genre.slug)?.weight ?? 0 }))
    .filter(({ weight }) => weight > 0)
    .sort((left, right) => right.weight - left.weight);
  if (matches.length === 0) return null;

  const genreScore =
    matches.reduce((sum, match) => sum + match.weight / maximumGenreWeight, 0) /
    candidate.genres.length;
  const crossMediaBoost = familiarMediaTypes.has(candidate.mediaType.code) ? 0 : 0.08;
  const score = Math.min(1, Math.max(0.01, genreScore * 0.92 + crossMediaBoost));
  const genreNames = matches.slice(0, 2).map(({ name }) => name);
  const reason = `Matches your interest in ${formatList(genreNames)}${
    crossMediaBoost > 0 ? ' and adds variety from another media type' : ''
  }.`;

  return { mediaItemId: candidate.id, title: candidate.title, score, reason };
};

const formatList = (values: string[]) =>
  values.length > 1 ? `${values[0]} and ${values[1]}` : (values[0] ?? 'similar genres');
