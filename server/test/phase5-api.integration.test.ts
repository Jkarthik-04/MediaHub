import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { sign } from 'cookie-signature';

import { createApp } from '../src/app.js';
import {
  getSessionSecret,
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
  await cleanupTestData();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await disconnectSessionStore();
  await prisma.$disconnect();
});

test('MediaHub API security and core workflow', async (t) => {
  await t.test('reports health and rejects requests without a user', async () => {
    const live = await nativeFetch(`${baseUrl}/health/live`);
    assert.equal(live.status, 200);
    assert.equal(live.headers.get('x-content-type-options'), 'nosniff');

    const corsResponse = await nativeFetch(`${baseUrl}/health/live`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(corsResponse.headers.get('access-control-allow-origin'), 'http://localhost:5173');

    const ready = await nativeFetch(`${baseUrl}/health/ready`);
    assert.equal(ready.status, 200);

    const oauthUnavailable = await nativeFetch(`${baseUrl}/auth/google`, { redirect: 'manual' });
    assert.equal(oauthUnavailable.status, 503);
    const oauthError = (await oauthUnavailable.json()) as { error: { code: string } };
    assert.equal(oauthError.error.code, 'OAUTH_NOT_CONFIGURED');

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

  await t.test('logs out and invalidates the server-side session', async () => {
    const loggedOut = await api('/auth/logout', { method: 'POST' });
    assert.equal(loggedOut.response.status, 204);

    const profileAfterLogout = await api('/auth/me');
    assert.equal(profileAfterLogout.response.status, 401);
  });
});
