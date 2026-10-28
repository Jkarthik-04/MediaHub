import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { sign } from 'cookie-signature';

import { createApp } from '../src/app.js';
import {
  getSessionSecret,
  isAniListOAuthConfigured,
  isGoogleBooksOAuthConfigured,
  isGoogleOAuthConfigured,
  isTraktOAuthConfigured,
  sessionCookieName,
  sessionMaxAgeMilliseconds,
} from '../src/config/security.js';
import { disconnectSessionStore } from '../src/config/session.js';
import { prisma } from '../src/utils/prisma.js';

const testUserId = '90000000-0000-4000-8000-000000000001';
const testSessionId = 'phase6-integration-session';
const adminUserId = '00000000-0000-4000-8000-000000000001';
const adminSessionId = 'phase6-admin-session';
const expiredSessionId = 'phase6-expired-session';
const interstellarId = '10000000-0000-4000-8000-000000000001';
const breakingBadId = '10000000-0000-4000-8000-000000000002';
const attackOnTitanId = '10000000-0000-4000-8000-000000000003';
const onePieceId = '10000000-0000-4000-8000-000000000004';
const duneId = '10000000-0000-4000-8000-000000000005';
const nativeFetch = globalThis.fetch;
const server = createApp().listen(0);
const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

type JsonObject = Record<string, unknown>;

const cleanupTestData = async () => {
  await prisma.auditLog.deleteMany({ where: { actorUserId: testUserId } });
  await prisma.userSession.deleteMany({
    where: { sid: { in: [testSessionId, adminSessionId, expiredSessionId] } },
  });
  await prisma.user.deleteMany({ where: { id: testUserId } });
};

const getSessionCookie = (sessionId: string) => {
  const signedSessionId = sign(sessionId, getSessionSecret());
  return `${sessionCookieName}=${encodeURIComponent(`s:${signedSessionId}`)}`;
};

const apiForSession = async (sessionId: string, path: string, init: RequestInit = {}) => {
  const response = await nativeFetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      Cookie: getSessionCookie(sessionId),
      ...init.headers,
    },
  });
  const body = response.status === 204 ? {} : ((await response.json()) as JsonObject);
  return { response, body };
};

const api = (path: string, init: RequestInit = {}) => apiForSession(testSessionId, path, init);
const apiAsAdmin = (path: string, init: RequestInit = {}) =>
  apiForSession(adminSessionId, path, init);

before(async () => {
  await cleanupTestData();
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'USER' } });
  await prisma.user.create({
    data: {
      id: testUserId,
      roleId: role.id,
      googleSubject: 'phase5-integration-test-user',
      email: 'phase5-integration@mediahub.test',
      displayName: 'Phase 5 Integration Test',
    },
  });
  await prisma.userSession.create({
    data: {
      sid: testSessionId,
      sess: {
        cookie: {
          originalMaxAge: sessionMaxAgeMilliseconds,
          expires: new Date(Date.now() + sessionMaxAgeMilliseconds).toISOString(),
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: false,
        },
        passport: { user: testUserId },
      },
      expire: new Date(Date.now() + sessionMaxAgeMilliseconds),
    },
  });
  await prisma.userSession.create({
    data: {
      sid: expiredSessionId,
      sess: {
        cookie: {
          originalMaxAge: sessionMaxAgeMilliseconds,
          expires: new Date(Date.now() - 60_000).toISOString(),
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: false,
        },
        passport: { user: testUserId },
      },
      expire: new Date(Date.now() - 60_000),
    },
  });
  await prisma.userSession.create({
    data: {
      sid: adminSessionId,
      sess: {
        cookie: {
          originalMaxAge: sessionMaxAgeMilliseconds,
          expires: new Date(Date.now() + sessionMaxAgeMilliseconds).toISOString(),
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: false,
        },
        passport: { user: adminUserId },
      },
      expire: new Date(Date.now() + sessionMaxAgeMilliseconds),
    },
  });
});

after(async () => {
  globalThis.fetch = nativeFetch;
  try {
    await cleanupTestData();
  } finally {
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    } finally {
      await disconnectSessionStore();
      await prisma.$disconnect();
    }
  }
});

test('MediaHub API security and core workflow', async (t) => {
  await t.test('reports health and rejects requests without a user', async () => {
    const live = await nativeFetch(`${baseUrl}/health/live`);
    assert.equal(live.status, 200);
    assert.equal(live.headers.get('x-content-type-options'), 'nosniff');

    const corsResponse = await nativeFetch(`${baseUrl}/health/live`, {
      headers: { Origin: 'http://localhost:5174' },
    });
    assert.equal(corsResponse.headers.get('access-control-allow-origin'), 'http://localhost:5174');

    const ready = await nativeFetch(`${baseUrl}/health/ready`);
    assert.equal(ready.status, 200);

    const oauthResponse = await nativeFetch(`${baseUrl}/auth/google`, { redirect: 'manual' });
    if (isGoogleOAuthConfigured()) {
      assert.equal(oauthResponse.status, 302);
      assert.match(oauthResponse.headers.get('location') ?? '', /accounts\.google\.com/);
    } else {
      assert.equal(oauthResponse.status, 503);
      const oauthError = (await oauthResponse.json()) as { error: { code: string } };
      assert.equal(oauthError.error.code, 'OAUTH_NOT_CONFIGURED');
    }

    const unauthorized = await nativeFetch(`${baseUrl}/library`);
    assert.equal(unauthorized.status, 401);
    const body = (await unauthorized.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'AUTHENTICATION_REQUIRED');

    const headerOnly = await nativeFetch(`${baseUrl}/library`, {
      headers: { 'x-user-id': testUserId },
    });
    assert.equal(headerOnly.status, 401);

    const profile = await api('/auth/me');
    assert.equal(profile.response.status, 200);
    const profileData = profile.body.data as { id: string; role: string };
    assert.equal(profileData.id, testUserId);
    assert.equal(profileData.role, 'USER');

    const connections = await api('/connections');
    assert.equal(connections.response.status, 200);
    const connectionProviders = connections.body.data as Array<{ key: string; mode: string }>;
    assert.deepEqual(
      connectionProviders.map(({ key }) => key),
      ['anilist', 'trakt', 'google-books'],
    );
    const serializedConnections = JSON.stringify(connections.body);
    assert.equal(serializedConnections.includes('accessTokenEncrypted'), false);
    assert.equal(serializedConnections.includes('refreshTokenEncrypted'), false);

    const missingAniListSync = await api('/connections/anilist/sync', { method: 'POST' });
    assert.equal(missingAniListSync.response.status, 404);
    const missingSyncError = missingAniListSync.body.error as { code: string };
    assert.equal(missingSyncError.code, 'USER_CONNECTION_NOT_FOUND');

    const missingTraktSync = await api('/connections/trakt/sync', { method: 'POST' });
    assert.equal(missingTraktSync.response.status, 404);
    const missingTraktSyncError = missingTraktSync.body.error as { code: string };
    assert.equal(missingTraktSyncError.code, 'USER_CONNECTION_NOT_FOUND');

    const missingGoogleBooksSync = await api('/connections/google-books/sync', {
      method: 'POST',
    });
    assert.equal(missingGoogleBooksSync.response.status, 404);
    const missingGoogleBooksSyncError = missingGoogleBooksSync.body.error as { code: string };
    assert.equal(missingGoogleBooksSyncError.code, 'USER_CONNECTION_NOT_FOUND');

    const aniListConnect = await nativeFetch(`${baseUrl}/connections/anilist/connect`, {
      headers: { Cookie: getSessionCookie(testSessionId) },
      redirect: 'manual',
    });
    if (isAniListOAuthConfigured()) {
      assert.equal(aniListConnect.status, 302);
      assert.match(aniListConnect.headers.get('location') ?? '', /^https:\/\/anilist\.co\//);
    } else {
      assert.equal(aniListConnect.status, 503);
      const connectionError = (await aniListConnect.json()) as { error: { code: string } };
      assert.equal(connectionError.error.code, 'CONNECTION_NOT_CONFIGURED');
    }

    const traktConnect = await nativeFetch(`${baseUrl}/connections/trakt/connect`, {
      headers: { Cookie: getSessionCookie(testSessionId) },
      redirect: 'manual',
    });
    if (isTraktOAuthConfigured()) {
      assert.equal(traktConnect.status, 302);
      const location = new URL(traktConnect.headers.get('location') ?? '');
      assert.equal(location.origin, 'https://trakt.tv');
      assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(location.searchParams.get('code_challenge'));
    } else {
      assert.equal(traktConnect.status, 503);
      const connectionError = (await traktConnect.json()) as { error: { code: string } };
      assert.equal(connectionError.error.code, 'CONNECTION_NOT_CONFIGURED');
    }

    const googleBooksConnect = await nativeFetch(`${baseUrl}/connections/google-books/connect`, {
      headers: { Cookie: getSessionCookie(testSessionId) },
      redirect: 'manual',
    });
    if (isGoogleBooksOAuthConfigured()) {
      assert.equal(googleBooksConnect.status, 302);
      const location = new URL(googleBooksConnect.headers.get('location') ?? '');
      assert.equal(location.origin, 'https://accounts.google.com');
      assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
      assert.match(location.searchParams.get('scope') ?? '', /googleapis\.com\/auth\/books/);
    } else {
      assert.equal(googleBooksConnect.status, 503);
      const connectionError = (await googleBooksConnect.json()) as { error: { code: string } };
      assert.equal(connectionError.error.code, 'CONNECTION_NOT_CONFIGURED');
    }

    const expired = await apiForSession(expiredSessionId, '/auth/me');
    assert.equal(expired.response.status, 401);

    const userAdminRequest = await api('/admin/overview');
    assert.equal(userAdminRequest.response.status, 403);
    const userAdminError = userAdminRequest.body.error as { code: string };
    assert.equal(userAdminError.code, 'FORBIDDEN');

    const adminRequest = await apiAsAdmin('/admin/overview');
    assert.equal(adminRequest.response.status, 200);
    const adminOverview = adminRequest.body.data as { activeUsers: number; enabledSources: number };
    assert.ok(adminOverview.activeUsers >= 2);
    assert.ok(adminOverview.enabledSources >= 1);

    const userManualQueue = await api('/admin/manual-media/pending');
    assert.equal(userManualQueue.response.status, 403);
    const adminManualQueue = await apiAsAdmin('/admin/manual-media/pending');
    assert.equal(adminManualQueue.response.status, 200);
    assert.ok(Array.isArray(adminManualQueue.body.data));

    const otherUsersEntry = await api('/library/30000000-0000-4000-8000-000000000003', {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'Attempted cross-user update' }),
    });
    assert.equal(otherUsersEntry.response.status, 404);
    const ownershipError = otherUsersEntry.body.error as { code: string };
    assert.equal(ownershipError.code, 'LIBRARY_ENTRY_NOT_FOUND');
  });

  await t.test('returns standard validation and missing-record errors', async () => {
    const invalid = await api('/library', {
      method: 'POST',
      body: JSON.stringify({ mediaItemId: interstellarId, rating: 9.3 }),
    });
    assert.equal(invalid.response.status, 400);
    const invalidError = invalid.body.error as {
      code: string;
      details: Array<{ field: string }>;
      requestId: string;
    };
    assert.equal(invalidError.code, 'VALIDATION_ERROR');
    assert.equal(invalidError.details[0]?.field, 'rating');
    assert.ok(invalidError.requestId);

    const missing = await api('/media/99999999-9999-4999-8999-999999999999');
    assert.equal(missing.response.status, 404);
    const missingError = missing.body.error as { code: string };
    assert.equal(missingError.code, 'MEDIA_NOT_FOUND');
  });

  await t.test('paginates and sorts the media catalogue', async () => {
    const firstPage = await api('/media?page=1&limit=2&sort=title:asc');
    const secondPage = await api('/media?page=2&limit=2&sort=title:asc');
    assert.equal(firstPage.response.status, 200);
    assert.equal(secondPage.response.status, 200);

    const firstData = firstPage.body.data as Array<{ id: string; title: string }>;
    const secondData = secondPage.body.data as Array<{ id: string; title: string }>;
    const firstMeta = firstPage.body.meta as {
      page: number;
      limit: number;
      totalItems: number;
      totalPages: number;
    };
    const secondMeta = secondPage.body.meta as { page: number; limit: number };

    assert.equal(firstData.length, 2);
    assert.equal(secondData.length, 2);
    assert.equal(firstMeta.page, 1);
    assert.equal(firstMeta.limit, 2);
    assert.ok(firstMeta.totalItems >= 4);
    assert.equal(firstMeta.totalPages, Math.ceil(firstMeta.totalItems / 2));
    assert.equal(secondMeta.page, 2);
    assert.equal(secondMeta.limit, 2);
    assert.notEqual(firstData[0]?.id, secondData[0]?.id);
    assert.deepEqual(
      firstData.map((item) => item.title),
      firstData.map((item) => item.title).toSorted((left, right) => left.localeCompare(right)),
    );
  });

  await t.test('normalizes an Open Library discovery response', async () => {
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.hostname !== 'openlibrary.org') return nativeFetch(input, init);

      return new Response(
        JSON.stringify({
          start: 0,
          numFound: 1,
          docs: [
            {
              key: '/works/OLTESTW',
              title: 'Integration Test Book',
              author_name: ['MediaHub'],
              first_publish_year: 2026,
              subject: ['Science Fiction', 'science fiction'],
              number_of_pages_median: 320,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const { response, body } = await api(
      '/discovery/search?q=phase5-integration&type=BOOK&provider=open-library&page=1&limit=5',
    );
    assert.equal(response.status, 200);
    const data = body.data as Array<Record<string, unknown>>;
    assert.equal(data[0]?.provider, 'open-library');
    assert.equal(data[0]?.externalId, 'OLTESTW');
    assert.deepEqual(data[0]?.genres, ['Science Fiction']);
    assert.equal(data[0]?.totalUnits, 320);
  });

  await t.test('prevents duplicate imports for the same user and media type', async () => {
    const duneImport = {
      provider: 'open-library',
      externalId: 'OL-DUPLICATE-DUNE',
      mediaType: 'BOOK',
      title: 'Dune',
      alternateTitles: [],
      genres: ['Science Fiction'],
      sourceUrl: 'https://openlibrary.org/works/OL-DUPLICATE-DUNE',
    };
    const initialPreview = await api('/imports/preview', {
      method: 'POST',
      body: JSON.stringify({ items: [duneImport], defaultLibraryStatus: 'PLANNED' }),
    });
    assert.equal(initialPreview.response.status, 201);
    const initialData = initialPreview.body.data as {
      id: string;
      candidates: Array<{ id: string; match: { id: string } | null }>;
    };
    assert.equal(initialData.candidates[0]?.match?.id, duneId);

    const addedDune = await api('/library', {
      method: 'POST',
      body: JSON.stringify({ mediaItemId: duneId, status: 'PLANNED' }),
    });
    assert.equal(addedDune.response.status, 201);
    const duneEntry = addedDune.body.data as { id: string };

    const staleConfirmation = await api(`/imports/${initialData.id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        decisions: [
          {
            candidateId: initialData.candidates[0]?.id,
            action: 'REUSE',
            mediaItemId: duneId,
          },
        ],
      }),
    });
    assert.equal(staleConfirmation.response.status, 409);
    const staleConfirmationError = staleConfirmation.body.error as {
      code: string;
      message: string;
    };
    assert.equal(staleConfirmationError.code, 'LIBRARY_ENTRY_EXISTS');
    assert.equal(staleConfirmationError.message, 'This title already exists in your list.');

    const duplicatePreview = await api('/imports/preview', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ ...duneImport, externalId: 'OL-DUPLICATE-DUNE-SECOND' }],
        defaultLibraryStatus: 'PLANNED',
      }),
    });
    assert.equal(duplicatePreview.response.status, 409);
    const duplicatePreviewError = duplicatePreview.body.error as { code: string; message: string };
    assert.equal(duplicatePreviewError.code, 'LIBRARY_ENTRY_EXISTS');
    assert.equal(duplicatePreviewError.message, 'This title already exists in your list.');

    const differentType = await api('/imports/preview', {
      method: 'POST',
      body: JSON.stringify({
        items: [
          {
            provider: 'jikan',
            externalId: 'DUPLICATE-TITLE-DIFFERENT-TYPE',
            mediaType: 'ANIME',
            title: 'Dune',
            alternateTitles: [],
            genres: [],
            sourceUrl: 'https://myanimelist.net/anime/999999/Dune',
          },
        ],
        defaultLibraryStatus: 'PLANNED',
      }),
    });
    assert.equal(differentType.response.status, 201);
    const differentTypeData = differentType.body.data as {
      candidates: Array<{ proposedAction: string }>;
    };
    assert.equal(differentTypeData.candidates[0]?.proposedAction, 'CREATE');

    const removedDune = await api(`/library/${duneEntry.id}`, { method: 'DELETE' });
    assert.equal(removedDune.response.status, 204);
  });

  await t.test(
    'prevents direct duplicate library additions for every supported media type',
    async () => {
      const mediaByType = [
        { type: 'MOVIE', mediaItemId: interstellarId },
        { type: 'TV', mediaItemId: breakingBadId },
        { type: 'ANIME', mediaItemId: attackOnTitanId },
        { type: 'BOOK', mediaItemId: duneId },
        { type: 'MANGA', mediaItemId: onePieceId },
      ];
      const createdEntryIds: string[] = [];

      try {
        for (const { type, mediaItemId } of mediaByType) {
          const created = await api('/library', {
            method: 'POST',
            body: JSON.stringify({ mediaItemId, status: 'PLANNED' }),
          });
          assert.equal(created.response.status, 201, `${type} should allow a new library entry`);
          createdEntryIds.push((created.body.data as { id: string }).id);

          const duplicate = await api('/library', {
            method: 'POST',
            body: JSON.stringify({ mediaItemId, status: 'PLANNED' }),
          });
          assert.equal(duplicate.response.status, 409, `${type} should reject a duplicate entry`);
          assert.equal((duplicate.body.error as { code: string }).code, 'LIBRARY_ENTRY_EXISTS');
        }
      } finally {
        await Promise.all(createdEntryIds.map((id) => api(`/library/${id}`, { method: 'DELETE' })));
      }
    },
  );

  await t.test('previews and skips a staged import', async () => {
    const preview = await api('/imports/preview', {
      method: 'POST',
      body: JSON.stringify({
        items: [
          {
            provider: 'open-library',
            externalId: 'OL-PHASE5-SKIP',
            mediaType: 'BOOK',
            title: 'Temporary Import Candidate',
            alternateTitles: [],
            genres: ['Testing'],
            sourceUrl: 'https://openlibrary.org/works/OL-PHASE5-SKIP',
          },
        ],
        defaultLibraryStatus: 'PLANNED',
      }),
    });
    assert.equal(preview.response.status, 201);
    const previewData = preview.body.data as {
      id: string;
      status: string;
      candidates: Array<{ id: string; proposedAction: string }>;
    };
    assert.equal(previewData.status, 'PREVIEW_READY');
    assert.equal(previewData.candidates[0]?.proposedAction, 'CREATE');

    const confirmed = await api(`/imports/${previewData.id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        decisions: [{ candidateId: previewData.candidates[0]?.id, action: 'SKIP' }],
      }),
    });
    assert.equal(confirmed.response.status, 200);
    const confirmedData = confirmed.body.data as {
      status: string;
      counts: { skipped: number };
    };
    assert.equal(confirmedData.status, 'COMPLETED');
    assert.equal(confirmedData.counts.skipped, 1);
  });

  await t.test('rolls back every import decision when confirmation fails', async () => {
    const preview = await api('/imports/preview', {
      method: 'POST',
      body: JSON.stringify({
        items: [
          {
            provider: 'open-library',
            externalId: 'OL-PHASE5-ROLLBACK-1',
            mediaType: 'BOOK',
            title: 'Rollback Candidate One',
            alternateTitles: [],
            genres: [],
            sourceUrl: 'https://openlibrary.org/works/OL-PHASE5-ROLLBACK-1',
          },
          {
            provider: 'open-library',
            externalId: 'OL-PHASE5-ROLLBACK-2',
            mediaType: 'BOOK',
            title: 'Rollback Candidate Two',
            alternateTitles: [],
            genres: [],
            sourceUrl: 'https://openlibrary.org/works/OL-PHASE5-ROLLBACK-2',
          },
        ],
        defaultLibraryStatus: 'PLANNED',
      }),
    });
    assert.equal(preview.response.status, 201);
    const previewData = preview.body.data as {
      id: string;
      candidates: Array<{ id: string }>;
    };
    assert.equal(previewData.candidates.length, 2);

    const failedConfirmation = await api(`/imports/${previewData.id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        decisions: [
          { candidateId: previewData.candidates[0]?.id, action: 'SKIP' },
          {
            candidateId: previewData.candidates[1]?.id,
            action: 'REUSE',
            mediaItemId: '99999999-9999-4999-8999-999999999999',
          },
        ],
      }),
    });
    assert.equal(failedConfirmation.response.status, 400);
    const failure = failedConfirmation.body.error as { code: string };
    assert.equal(failure.code, 'INVALID_REUSE_TARGET');

    const unchanged = await api(`/imports/${previewData.id}`);
    assert.equal(unchanged.response.status, 200);
    const unchangedData = unchanged.body.data as {
      status: string;
      counts: { skipped: number; imported: number };
      candidates: Array<{ decision: string }>;
    };
    assert.equal(unchangedData.status, 'PREVIEW_READY');
    assert.equal(unchangedData.counts.skipped, 0);
    assert.equal(unchangedData.counts.imported, 0);
    assert.deepEqual(
      unchangedData.candidates.map((candidate) => candidate.decision),
      ['UNDECIDED', 'UNDECIDED'],
    );
  });

  await t.test('manages library progress and updates dashboard totals', async () => {
    const created = await api('/library', {
      method: 'POST',
      body: JSON.stringify({ mediaItemId: interstellarId, status: 'PLANNED' }),
    });
    assert.equal(created.response.status, 201);
    const entry = created.body.data as { id: string };

    const duplicate = await api('/library', {
      method: 'POST',
      body: JSON.stringify({ mediaItemId: interstellarId, status: 'PLANNED' }),
    });
    assert.equal(duplicate.response.status, 409);

    const progress = await api(`/library/${entry.id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ progressValue: 100, note: 'Integration test completion' }),
    });
    assert.equal(progress.response.status, 200);
    const progressData = progress.body.data as { status: string; progressValue: number };
    assert.equal(progressData.status, 'COMPLETED');
    assert.equal(progressData.progressValue, 100);

    const updated = await api(`/library/${entry.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ rating: 9, notes: 'Verified by integration test' }),
    });
    assert.equal(updated.response.status, 200);

    const auditCount = await prisma.auditLog.count({
      where: { actorUserId: testUserId, entityId: entry.id },
    });
    assert.ok(auditCount >= 2);

    const library = await api('/library?status=COMPLETED&section=WATCHING');
    assert.equal(library.response.status, 200);
    const libraryMeta = library.body.meta as { totalItems: number };
    assert.equal(libraryMeta.totalItems, 1);

    const dashboard = await api('/dashboard/summary');
    assert.equal(dashboard.response.status, 200);
    const dashboardData = dashboard.body.data as {
      overview: {
        totalTitles: number;
        byStatus: Array<{ status: string; count: number }>;
      };
    };
    assert.equal(dashboardData.overview.totalTitles, 1);
    assert.equal(
      dashboardData.overview.byStatus.find((item) => item.status === 'COMPLETED')?.count,
      1,
    );

    const removed = await api(`/library/${entry.id}`, { method: 'DELETE' });
    assert.equal(removed.response.status, 204);
  });

  await t.test('generates explainable recommendations and records feedback', async () => {
    const created = await api('/library', {
      method: 'POST',
      body: JSON.stringify({ mediaItemId: interstellarId, status: 'COMPLETED', rating: 9 }),
    });
    assert.equal(created.response.status, 201);
    const entry = created.body.data as { id: string };

    try {
      const refreshed = await api('/recommendations/refresh?limit=5', { method: 'POST' });
      assert.equal(refreshed.response.status, 200);
      const recommendations = refreshed.body.data as Array<{
        id: string;
        score: number;
        reason: string;
        modelVersion: string;
        mediaItem: { id: string; genres: Array<{ slug: string }> };
      }>;
      assert.ok(recommendations.length > 0);
      assert.equal(
        recommendations.some((item) => item.mediaItem.id === interstellarId),
        false,
      );
      assert.equal(recommendations[0]?.modelVersion, 'genre-vector-v1');
      assert.ok((recommendations[0]?.score ?? 0) > 0);
      assert.match(recommendations[0]?.reason ?? '', /Matches your interest in/);
      assert.ok((recommendations[0]?.mediaItem.genres.length ?? 0) > 0);

      const recommendationId = recommendations[0]?.id;
      assert.ok(recommendationId);
      const feedback = await api(`/recommendations/${recommendationId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback: 'NOT_INTERESTED' }),
      });
      assert.equal(feedback.response.status, 200);

      const current = await api('/recommendations?limit=5');
      assert.equal(current.response.status, 200);
      const currentRecommendations = current.body.data as Array<{ id: string }>;
      assert.equal(
        currentRecommendations.some((item) => item.id === recommendationId),
        false,
      );
    } finally {
      await api(`/library/${entry.id}`, { method: 'DELETE' });
    }
  });

  await t.test('logs out and invalidates the server-side session', async () => {
    const loggedOut = await api('/auth/logout', { method: 'POST' });
    assert.equal(loggedOut.response.status, 204);

    const profileAfterLogout = await api('/auth/me');
    assert.equal(profileAfterLogout.response.status, 401);
  });
});
