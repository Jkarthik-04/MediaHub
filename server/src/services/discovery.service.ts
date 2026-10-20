import { AppError } from '../errors/app-error.js';
import { searchJikan } from '../providers/api/jikan.provider.js';
import { searchOmdb } from '../providers/api/omdb.provider.js';
import { searchOpenLibrary } from '../providers/api/open-library.provider.js';
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
      key: 'omdb',
      name: 'OMDb',
      enabled: Boolean(process.env.OMDB_API_KEY),
      mediaTypes: ['MOVIE'],
      requiresApiKey: true,
      attribution: 'Movie results use OMDb metadata and IMDb title identifiers.',
    },
    {
      key: 'open-library',
      name: 'Open Library',
      enabled: true,
      mediaTypes: ['BOOK'],
      requiresApiKey: false,
      attribution: 'Book metadata and cover links are provided by Open Library.',
    },
  ],
});

export const searchDiscovery = async (query: DiscoverySearchQuery) => {
  if (query.type === 'MOVIE') {
    requireCompatibleProvider(query.provider, 'omdb', 'Movie searches use OMDb.');
    const result = await searchOmdb({ query: query.q, page: query.page });
    return toDiscoveryResponse('omdb', result);
  }

  if (query.type === 'BOOK') {
    requireCompatibleProvider(query.provider, 'open-library', 'Book searches use Open Library.');
    const result = await searchOpenLibrary({
      query: query.q,
      page: query.page,
      limit: query.limit,
    });
    return toDiscoveryResponse('open-library', result);
  }

  requireCompatibleProvider(query.provider, 'jikan', 'Anime and manga searches use Jikan.');
  const result = await searchJikan({
    query: query.q,
    mediaType: query.type,
    page: query.page,
    limit: query.limit,
  });
  return toDiscoveryResponse('jikan', result);
};

const requireCompatibleProvider = (
  selectedProvider: DiscoverySearchQuery['provider'],
  expectedProvider: NonNullable<DiscoverySearchQuery['provider']>,
  message: string,
) => {
  if (selectedProvider && selectedProvider !== expectedProvider) {
    throw new AppError(400, 'UNSUPPORTED_PROVIDER', message);
  }
};

const toDiscoveryResponse = (
  provider: NonNullable<DiscoverySearchQuery['provider']>,
  result: Awaited<ReturnType<typeof searchJikan>>,
) => ({
  data: result.items,
  meta: {
    provider,
    page: result.page,
    limit: result.limit,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  },
});
