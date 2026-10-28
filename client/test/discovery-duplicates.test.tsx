import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isCatalogueItemInLibrary,
  isProviderItemInLibrary,
} from '../src/utils/discovery-duplicates';
import type { DiscoveryMedia, LibraryEntry } from '../src/services/mediahub-api';

const providerResult = (
  mediaType: DiscoveryMedia['mediaType'],
  provider: DiscoveryMedia['provider'],
): DiscoveryMedia => ({
  provider,
  externalId: `${mediaType}-123`,
  mediaType,
  title: `A ${mediaType} Title: Revised Edition`,
  alternateTitles: [],
  genres: [],
  sourceUrl: `https://example.test/${mediaType}-123`,
});

const libraryEntry = (overrides: Partial<LibraryEntry['mediaItem']> = {}): LibraryEntry => ({
  id: 'entry-1',
  status: 'PLANNED',
  progressValue: 0,
  rating: null,
  notes: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  mediaItem: {
    id: 'media-1',
    title: 'A Book: Revised Edition',
    normalizedTitle: 'a book revised edition',
    coverUrl: null,
    totalUnits: null,
    mediaType: { code: 'BOOK', name: 'Book', section: 'READING', progressMode: 'PAGES' },
    genres: [],
    externalMappings: [],
    units: [],
    ...overrides,
  },
  currentUnit: null,
});

test('recognizes provider results for movies, anime, books, and manga by provider ID', () => {
  const cases = [
    { mediaType: 'MOVIE', provider: 'omdb' },
    { mediaType: 'ANIME', provider: 'jikan' },
    { mediaType: 'BOOK', provider: 'open-library' },
    { mediaType: 'MANGA', provider: 'jikan' },
  ] as const;

  for (const { mediaType, provider } of cases) {
    const result = providerResult(mediaType, provider);
    const entry = libraryEntry({
      mediaType: {
        code: mediaType,
        name: mediaType,
        section: mediaType === 'BOOK' || mediaType === 'MANGA' ? 'READING' : 'WATCHING',
        progressMode: 'PERCENTAGE',
      },
      externalMappings: [{ externalId: result.externalId, source: { key: provider } }],
    });

    assert.equal(isProviderItemInLibrary(result, [entry]), true, `${mediaType} should match`);
    assert.equal(
      isProviderItemInLibrary({ ...result, externalId: `${mediaType}-new`, title: 'A new title' }, [
        entry,
      ]),
      false,
      `${mediaType} should allow a new result`,
    );
  }
});

test('recognizes catalogue results for every media type by their internal MediaHub ID', () => {
  const ids = new Set(['movie-id', 'tv-id', 'anime-id', 'book-id', 'manga-id']);

  for (const id of ids) assert.equal(isCatalogueItemInLibrary(id, ids), true);
  assert.equal(isCatalogueItemInLibrary('new-title-id', ids), false);
});

test('falls back to a normalized title match only for the same media type', () => {
  const bookResult = providerResult('BOOK', 'open-library');
  const existingBook = libraryEntry({
    title: bookResult.title,
    normalizedTitle: 'a book title revised edition',
  });
  const sameTitleMovie = libraryEntry({
    title: bookResult.title,
    normalizedTitle: 'a book title revised edition',
    mediaType: { code: 'MOVIE', name: 'Movie', section: 'WATCHING', progressMode: 'PERCENTAGE' },
  });

  assert.equal(isProviderItemInLibrary(bookResult, [existingBook]), true);
  assert.equal(isProviderItemInLibrary(bookResult, [sameTitleMovie]), false);
  assert.equal(
    isProviderItemInLibrary({ ...bookResult, externalId: 'OL999', title: 'A Different Book' }, [
      existingBook,
    ]),
    false,
  );
});
