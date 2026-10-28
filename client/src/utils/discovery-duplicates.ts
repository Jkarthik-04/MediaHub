import type { DiscoveryMedia, LibraryEntry } from '../services/mediahub-api';

/**
 * Provider results do not have MediaHub IDs. Match them to the current user's
 * library by the provider mapping first, then by a same-type normalized title.
 */
export const isProviderItemInLibrary = (item: DiscoveryMedia, libraryEntries: LibraryEntry[]) => {
  const normalizedTitle = normalizeTitle(item.title);

  return libraryEntries.some(({ mediaItem }) => {
    if (mediaItem.mediaType.code !== item.mediaType) return false;

    const hasProviderMatch = mediaItem.externalMappings.some(
      ({ source, externalId }) => source.key === item.provider && externalId === item.externalId,
    );
    return hasProviderMatch || mediaItem.normalizedTitle === normalizedTitle;
  });
};

export const isCatalogueItemInLibrary = (mediaItemId: string, libraryMediaIds: Set<string>) =>
  libraryMediaIds.has(mediaItemId);

const normalizeTitle = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
