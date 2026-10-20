import {
  ConnectorKind,
  ImportAction,
  ImportDecision,
  IngestionKind,
  IngestionStatus,
  LibraryStatus,
  MediaSection,
  MetadataOrigin,
  Prisma,
  PrismaClient,
  ProgressMode,
  RecommendationFeedback,
  ReviewStatus,
  UnitKind,
} from '@prisma/client';

const prisma = new PrismaClient();

const seedIds = {
  admin: '00000000-0000-4000-8000-000000000001',
  user: '00000000-0000-4000-8000-000000000002',
  interstellar: '10000000-0000-4000-8000-000000000001',
  breakingBad: '10000000-0000-4000-8000-000000000002',
  attackOnTitan: '10000000-0000-4000-8000-000000000003',
  onePiece: '10000000-0000-4000-8000-000000000004',
  dune: '10000000-0000-4000-8000-000000000005',
  nicheTitle: '10000000-0000-4000-8000-000000000006',
  breakingBadEpisode: '20000000-0000-4000-8000-000000000001',
  userInterstellarLibrary: '30000000-0000-4000-8000-000000000001',
  userDuneLibrary: '30000000-0000-4000-8000-000000000002',
  adminBreakingBadLibrary: '30000000-0000-4000-8000-000000000003',
  progressEvent: '40000000-0000-4000-8000-000000000001',
  interstellarMapping: '50000000-0000-4000-8000-000000000001',
  breakingBadMapping: '50000000-0000-4000-8000-000000000002',
  ingestionJob: '60000000-0000-4000-8000-000000000001',
  ingestionCandidate: '70000000-0000-4000-8000-000000000001',
  recommendation: '80000000-0000-4000-8000-000000000001',
} as const;

const seedDate = new Date('2026-10-05T00:00:00.000Z');
const sourceReviewDate = new Date('2026-10-20T00:00:00.000Z');

async function seedDatabase() {
  await prisma.$transaction(
    async (tx) => {
      const userRole = await tx.role.upsert({
        where: { name: 'USER' },
        update: {},
        create: { name: 'USER' },
      });
      const adminRole = await tx.role.upsert({
        where: { name: 'ADMIN' },
        update: {},
        create: { name: 'ADMIN' },
      });

      const mediaTypeData = [
        {
          code: 'MOVIE',
          name: 'Movies',
          section: MediaSection.WATCHING,
          progressMode: ProgressMode.PERCENTAGE,
        },
        {
          code: 'TV',
          name: 'TV Shows',
          section: MediaSection.WATCHING,
          progressMode: ProgressMode.EPISODE,
        },
        {
          code: 'ANIME',
          name: 'Anime',
          section: MediaSection.WATCHING,
          progressMode: ProgressMode.EPISODE,
        },
        {
          code: 'MANGA',
          name: 'Manga',
          section: MediaSection.READING,
          progressMode: ProgressMode.CHAPTER,
        },
        {
          code: 'BOOK',
          name: 'Books',
          section: MediaSection.READING,
          progressMode: ProgressMode.PAGE,
        },
      ] as const;

      const mediaTypes = new Map<string, { id: number }>();
      for (const mediaType of mediaTypeData) {
        const savedMediaType = await tx.mediaType.upsert({
          where: { code: mediaType.code },
          update: {
            name: mediaType.name,
            section: mediaType.section,
            progressMode: mediaType.progressMode,
          },
          create: mediaType,
          select: { id: true },
        });
        mediaTypes.set(mediaType.code, savedMediaType);
      }

      const genreData = [
        ['Action', 'action'],
        ['Adventure', 'adventure'],
        ['Animation', 'animation'],
        ['Crime', 'crime'],
        ['Drama', 'drama'],
        ['Fantasy', 'fantasy'],
        ['Mystery', 'mystery'],
        ['Science Fiction', 'science-fiction'],
        ['Thriller', 'thriller'],
      ] as const;

      const genres = new Map<string, { id: number }>();
      for (const [name, slug] of genreData) {
        const genre = await tx.genre.upsert({
          where: { slug },
          update: { name },
          create: { name, slug },
          select: { id: true },
        });
        genres.set(slug, genre);
      }

      const sourceData = [
        {
          key: 'tmdb',
          name: 'TMDB',
          connectorKind: ConnectorKind.API,
          baseUrl: 'https://api.themoviedb.org',
          isEnabled: true,
        },
        {
          key: 'google-books',
          name: 'Google Books',
          connectorKind: ConnectorKind.API,
          baseUrl: 'https://www.googleapis.com/books/v1',
          isEnabled: true,
        },
        {
          key: 'open-library',
          name: 'Open Library',
          connectorKind: ConnectorKind.API,
          baseUrl: 'https://openlibrary.org',
          isEnabled: true,
        },
        {
          key: 'jikan',
          name: 'Jikan',
          connectorKind: ConnectorKind.API,
          baseUrl: 'https://api.jikan.moe/v4',
          isEnabled: true,
        },
        {
          key: 'kitsu',
          name: 'Kitsu',
          connectorKind: ConnectorKind.API,
          baseUrl: 'https://kitsu.io/api/edge',
          isEnabled: false,
        },
        {
          key: 'imdb',
          name: 'IMDb',
          connectorKind: ConnectorKind.API,
          baseUrl: 'https://api-fulfill.dataexchange.us-east-1.amazonaws.com/v1',
          isEnabled: false,
        },
      ] as const;

      const sources = new Map<string, { id: number }>();
      for (const source of sourceData) {
        const savedSource = await tx.source.upsert({
          where: { key: source.key },
          update: {
            name: source.name,
            connectorKind: source.connectorKind,
            baseUrl: source.baseUrl,
            isEnabled: source.isEnabled,
            termsCheckedAt: sourceReviewDate,
          },
          create: { ...source, termsCheckedAt: sourceReviewDate },
          select: { id: true },
        });
        sources.set(source.key, savedSource);
      }

      await tx.user.upsert({
        where: { id: seedIds.admin },
        update: {
          roleId: adminRole.id,
          googleSubject: 'seed-admin',
          email: 'admin@mediahub.local',
          displayName: 'MediaHub Admin',
        },
        create: {
          id: seedIds.admin,
          roleId: adminRole.id,
          googleSubject: 'seed-admin',
          email: 'admin@mediahub.local',
          displayName: 'MediaHub Admin',
        },
      });

      await tx.user.upsert({
        where: { id: seedIds.user },
        update: {
          roleId: userRole.id,
          googleSubject: 'seed-user',
          email: 'user@mediahub.local',
          displayName: 'Demo User',
        },
        create: {
          id: seedIds.user,
          roleId: userRole.id,
          googleSubject: 'seed-user',
          email: 'user@mediahub.local',
          displayName: 'Demo User',
        },
      });

      const mediaItems = [
        {
          id: seedIds.interstellar,
          mediaTypeId: requiredId(mediaTypes, 'MOVIE'),
          title: 'Interstellar',
          normalizedTitle: 'interstellar',
          description: 'Sample externally sourced movie record.',
          totalUnits: 100,
          origin: MetadataOrigin.EXTERNAL,
          reviewStatus: ReviewStatus.APPROVED,
          createdByUserId: null,
        },
        {
          id: seedIds.breakingBad,
          mediaTypeId: requiredId(mediaTypes, 'TV'),
          title: 'Breaking Bad',
          normalizedTitle: 'breaking bad',
          description: 'Sample externally sourced television record.',
          totalUnits: 62,
          origin: MetadataOrigin.EXTERNAL,
          reviewStatus: ReviewStatus.APPROVED,
          createdByUserId: null,
        },
        {
          id: seedIds.attackOnTitan,
          mediaTypeId: requiredId(mediaTypes, 'ANIME'),
          title: 'Attack on Titan',
          normalizedTitle: 'attack on titan',
          description: 'Sample anime record for cross-media recommendations.',
          totalUnits: null,
          origin: MetadataOrigin.MANUAL,
          reviewStatus: ReviewStatus.APPROVED,
          createdByUserId: seedIds.admin,
        },
        {
          id: seedIds.onePiece,
          mediaTypeId: requiredId(mediaTypes, 'MANGA'),
          title: 'One Piece',
          normalizedTitle: 'one piece',
          description: 'Sample manga record for reading-list testing.',
          totalUnits: null,
          origin: MetadataOrigin.MANUAL,
          reviewStatus: ReviewStatus.APPROVED,
          createdByUserId: seedIds.admin,
        },
        {
          id: seedIds.dune,
          mediaTypeId: requiredId(mediaTypes, 'BOOK'),
          title: 'Dune',
          normalizedTitle: 'dune',
          description: 'Sample book record for page-based progress testing.',
          totalUnits: null,
          origin: MetadataOrigin.MANUAL,
          reviewStatus: ReviewStatus.APPROVED,
          createdByUserId: seedIds.admin,
        },
        {
          id: seedIds.nicheTitle,
          mediaTypeId: requiredId(mediaTypes, 'BOOK'),
          title: 'The Last Archive of Nila',
          normalizedTitle: 'the last archive of nila',
          description: 'Demonstrates the manual niche-title review workflow.',
          totalUnits: null,
          origin: MetadataOrigin.MANUAL,
          reviewStatus: ReviewStatus.PENDING_REVIEW,
          createdByUserId: seedIds.user,
        },
      ] as const;

      for (const mediaItem of mediaItems) {
        await tx.mediaItem.upsert({
          where: { id: mediaItem.id },
          update: mediaItem,
          create: mediaItem,
        });
      }

      const mediaGenreData = [
        [seedIds.interstellar, 'adventure'],
        [seedIds.interstellar, 'drama'],
        [seedIds.interstellar, 'science-fiction'],
        [seedIds.breakingBad, 'crime'],
        [seedIds.breakingBad, 'drama'],
        [seedIds.breakingBad, 'thriller'],
        [seedIds.attackOnTitan, 'action'],
        [seedIds.attackOnTitan, 'animation'],
        [seedIds.attackOnTitan, 'drama'],
        [seedIds.onePiece, 'action'],
        [seedIds.onePiece, 'adventure'],
        [seedIds.onePiece, 'fantasy'],
        [seedIds.dune, 'adventure'],
        [seedIds.dune, 'drama'],
        [seedIds.dune, 'science-fiction'],
        [seedIds.nicheTitle, 'fantasy'],
        [seedIds.nicheTitle, 'mystery'],
      ] as const;

      for (const [mediaItemId, genreSlug] of mediaGenreData) {
        const genreId = requiredId(genres, genreSlug);
        await tx.mediaGenre.upsert({
          where: { mediaItemId_genreId: { mediaItemId, genreId } },
          update: {},
          create: { mediaItemId, genreId },
        });
      }

      await tx.mediaUnit.upsert({
        where: { id: seedIds.breakingBadEpisode },
        update: {
          mediaItemId: seedIds.breakingBad,
          unitKind: UnitKind.EPISODE,
          sequenceNumber: new Prisma.Decimal(1),
          seasonNumber: 1,
          title: 'Episode 1',
        },
        create: {
          id: seedIds.breakingBadEpisode,
          mediaItemId: seedIds.breakingBad,
          unitKind: UnitKind.EPISODE,
          sequenceNumber: new Prisma.Decimal(1),
          seasonNumber: 1,
          title: 'Episode 1',
        },
      });

      await tx.externalMapping.upsert({
        where: {
          sourceId_externalId: {
            sourceId: requiredId(sources, 'tmdb'),
            externalId: '157336',
          },
        },
        update: {
          mediaItemId: seedIds.interstellar,
          sourceUrl: 'https://www.themoviedb.org/movie/157336',
        },
        create: {
          id: seedIds.interstellarMapping,
          mediaItemId: seedIds.interstellar,
          sourceId: requiredId(sources, 'tmdb'),
          externalId: '157336',
          sourceUrl: 'https://www.themoviedb.org/movie/157336',
        },
      });

      await tx.externalMapping.upsert({
        where: {
          sourceId_externalId: {
            sourceId: requiredId(sources, 'tmdb'),
            externalId: '1396',
          },
        },
        update: {
          mediaItemId: seedIds.breakingBad,
          sourceUrl: 'https://www.themoviedb.org/tv/1396',
        },
        create: {
          id: seedIds.breakingBadMapping,
          mediaItemId: seedIds.breakingBad,
          sourceId: requiredId(sources, 'tmdb'),
          externalId: '1396',
          sourceUrl: 'https://www.themoviedb.org/tv/1396',
        },
      });

      await tx.libraryEntry.upsert({
        where: {
          userId_mediaItemId: {
            userId: seedIds.user,
            mediaItemId: seedIds.interstellar,
          },
        },
        update: {
          status: LibraryStatus.COMPLETED,
          progressValue: new Prisma.Decimal(100),
          rating: new Prisma.Decimal(9),
          completedAt: seedDate,
        },
        create: {
          id: seedIds.userInterstellarLibrary,
          userId: seedIds.user,
          mediaItemId: seedIds.interstellar,
          status: LibraryStatus.COMPLETED,
          progressValue: new Prisma.Decimal(100),
          rating: new Prisma.Decimal(9),
          startedAt: seedDate,
          completedAt: seedDate,
        },
      });

      await tx.libraryEntry.upsert({
        where: {
          userId_mediaItemId: {
            userId: seedIds.user,
            mediaItemId: seedIds.dune,
          },
        },
        update: {
          status: LibraryStatus.IN_PROGRESS,
          progressValue: new Prisma.Decimal(120),
          rating: new Prisma.Decimal(8.5),
        },
        create: {
          id: seedIds.userDuneLibrary,
          userId: seedIds.user,
          mediaItemId: seedIds.dune,
          status: LibraryStatus.IN_PROGRESS,
          progressValue: new Prisma.Decimal(120),
          rating: new Prisma.Decimal(8.5),
          startedAt: seedDate,
        },
      });

      await tx.libraryEntry.upsert({
        where: {
          userId_mediaItemId: {
            userId: seedIds.admin,
            mediaItemId: seedIds.breakingBad,
          },
        },
        update: {
          status: LibraryStatus.IN_PROGRESS,
          progressValue: new Prisma.Decimal(1),
          currentUnitId: seedIds.breakingBadEpisode,
        },
        create: {
          id: seedIds.adminBreakingBadLibrary,
          userId: seedIds.admin,
          mediaItemId: seedIds.breakingBad,
          status: LibraryStatus.IN_PROGRESS,
          progressValue: new Prisma.Decimal(1),
          currentUnitId: seedIds.breakingBadEpisode,
          startedAt: seedDate,
        },
      });

      await tx.progressEvent.upsert({
        where: { id: seedIds.progressEvent },
        update: {
          libraryEntryId: seedIds.adminBreakingBadLibrary,
          unitId: seedIds.breakingBadEpisode,
          oldProgress: new Prisma.Decimal(0),
          newProgress: new Prisma.Decimal(1),
          note: 'Seed progress event',
          recordedAt: seedDate,
        },
        create: {
          id: seedIds.progressEvent,
          libraryEntryId: seedIds.adminBreakingBadLibrary,
          unitId: seedIds.breakingBadEpisode,
          oldProgress: new Prisma.Decimal(0),
          newProgress: new Prisma.Decimal(1),
          note: 'Seed progress event',
          recordedAt: seedDate,
        },
      });

      await tx.ingestionJob.upsert({
        where: { id: seedIds.ingestionJob },
        update: {
          requestedByUserId: seedIds.user,
          sourceId: requiredId(sources, 'tmdb'),
          kind: IngestionKind.SELECTED_RESULTS,
          status: IngestionStatus.COMPLETED,
          inputReference: 'seed:tmdb:movie:157336',
          candidateCount: 1,
          importedCount: 1,
          skippedCount: 0,
          failedCount: 0,
          startedAt: seedDate,
          completedAt: seedDate,
        },
        create: {
          id: seedIds.ingestionJob,
          requestedByUserId: seedIds.user,
          sourceId: requiredId(sources, 'tmdb'),
          kind: IngestionKind.SELECTED_RESULTS,
          status: IngestionStatus.COMPLETED,
          inputReference: 'seed:tmdb:movie:157336',
          candidateCount: 1,
          importedCount: 1,
          skippedCount: 0,
          failedCount: 0,
          requestedAt: seedDate,
          startedAt: seedDate,
          completedAt: seedDate,
        },
      });

      const normalizedPayload: Prisma.InputJsonObject = {
        provider: 'tmdb',
        externalId: '157336',
        mediaType: 'MOVIE',
        title: 'Interstellar',
        alternateTitles: [],
        genres: ['Adventure', 'Drama', 'Science Fiction'],
        totalUnits: 100,
        sourceUrl: 'https://www.themoviedb.org/movie/157336',
      };

      await tx.ingestionCandidate.upsert({
        where: { id: seedIds.ingestionCandidate },
        update: {
          jobId: seedIds.ingestionJob,
          sourceId: requiredId(sources, 'tmdb'),
          externalId: '157336',
          mediaTypeId: requiredId(mediaTypes, 'MOVIE'),
          normalizedPayload,
          matchMediaId: seedIds.interstellar,
          matchConfidence: new Prisma.Decimal(1),
          proposedAction: ImportAction.REUSE,
          decision: ImportDecision.REUSE,
          validationErrors: [],
        },
        create: {
          id: seedIds.ingestionCandidate,
          jobId: seedIds.ingestionJob,
          sourceId: requiredId(sources, 'tmdb'),
          externalId: '157336',
          mediaTypeId: requiredId(mediaTypes, 'MOVIE'),
          normalizedPayload,
          matchMediaId: seedIds.interstellar,
          matchConfidence: new Prisma.Decimal(1),
          proposedAction: ImportAction.REUSE,
          decision: ImportDecision.REUSE,
          validationErrors: [],
          createdAt: seedDate,
        },
      });

      await tx.recommendation.upsert({
        where: { id: seedIds.recommendation },
        update: {
          userId: seedIds.user,
          mediaItemId: seedIds.attackOnTitan,
          score: new Prisma.Decimal(0.84),
          modelVersion: 'genre-vector-v1',
          reason: "Recommended from the user's preference for drama and adventure.",
          feedback: RecommendationFeedback.NONE,
          generatedAt: seedDate,
        },
        create: {
          id: seedIds.recommendation,
          userId: seedIds.user,
          mediaItemId: seedIds.attackOnTitan,
          score: new Prisma.Decimal(0.84),
          modelVersion: 'genre-vector-v1',
          reason: "Recommended from the user's preference for drama and adventure.",
          feedback: RecommendationFeedback.NONE,
          generatedAt: seedDate,
        },
      });
    },
    { maxWait: 5_000, timeout: 20_000 },
  );

  const [roles, users, mediaTypes, genres, sources, mediaItems, libraryEntries] = await Promise.all(
    [
      prisma.role.count(),
      prisma.user.count(),
      prisma.mediaType.count(),
      prisma.genre.count(),
      prisma.source.count(),
      prisma.mediaItem.count(),
      prisma.libraryEntry.count(),
    ],
  );

  console.log('MediaHub seed complete', {
    roles,
    users,
    mediaTypes,
    genres,
    sources,
    mediaItems,
    libraryEntries,
  });
}

function requiredId(records: Map<string, { id: number }>, key: string): number {
  const record = records.get(key);
  if (!record) {
    throw new Error(`Seed dependency not found: ${key}`);
  }
  return record.id;
}

seedDatabase()
  .catch((error: unknown) => {
    console.error('MediaHub seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
