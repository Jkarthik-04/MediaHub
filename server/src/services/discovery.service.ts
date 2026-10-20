import { AppError } from '../errors/app-error.js';
import { searchJikan } from '../providers/api/jikan.provider.js';
import type { DiscoverySearchQuery } from '../validation/discovery.validation.js';

export const getProviders = () => ({
  data: [
    {
      key: 'jikan',
      name: 'Jikan',
      enabled: true,
      mediaTypes: ['ANIME', 'MANGA'],
      requiresApiKey: false,
      attribution: 'Metadata provided through the unofficial Jikan/MyAnimeList interface.',
    },
    {
      key: 'imdb',
      name: 'IMDb',
      enabled: false,
      configured: isImdbConfigured(),
      mediaTypes: ['MOVIE'],
      requiresApiKey: true,
      configuration: isImdbConfigured()
        ? 'Credentials detected; the official IMDb connector is not enabled yet.'
        : 'Official IMDb API requires AWS Data Exchange and IMDb API credentials.',
    },
  ],
});

export const searchDiscovery = async (query: DiscoverySearchQuery) => {
  if (query.type === 'MOVIE') {
    if (query.provider && query.provider !== 'imdb') {
      throw new AppError(400, 'UNSUPPORTED_PROVIDER', 'Jikan does not support movie searches.');
    }
    throw new AppError(
      503,
      'IMDB_CONFIGURATION_REQUIRED',
      'Official IMDb search requires AWS Data Exchange and IMDb API credentials.',
    );
  }

  if (query.provider === 'imdb') {
    throw new AppError(
      400,
      'UNSUPPORTED_PROVIDER',
      'IMDb does not support anime or manga searches.',
    );
  }

  const result = await searchJikan({
    query: query.q,
    mediaType: query.type,
    page: query.page,
    limit: query.limit,
  });

  return {
    data: result.items,
    meta: {
      provider: 'jikan',
      page: result.page,
      limit: result.limit,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    },
  };
};

const isImdbConfigured = () => {
  return [
    process.env.IMDB_API_KEY,
    process.env.IMDB_DATA_SET_ID,
    process.env.IMDB_REVISION_ID,
    process.env.IMDB_ASSET_ID,
    process.env.AWS_ACCESS_KEY_ID,
    process.env.AWS_SECRET_ACCESS_KEY,
  ].every(Boolean);
};
