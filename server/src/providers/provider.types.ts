export type ProviderMediaType = 'MOVIE' | 'TV' | 'ANIME' | 'MANGA' | 'BOOK';

export type ProviderMedia = {
  provider: string;
  externalId: string;
  mediaType: ProviderMediaType;
  title: string;
  alternateTitles: string[];
  description?: string;
  releaseDate?: string;
  coverUrl?: string;
  genres: string[];
  totalUnits?: number;
  sourceUrl: string;
};

export type ProviderSearchPage = {
  items: ProviderMedia[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};
