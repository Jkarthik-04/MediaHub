import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

import { createApp } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

const testUserId = '90000000-0000-4000-8000-000000000001';
const interstellarId = '10000000-0000-4000-8000-000000000001';
const nativeFetch = globalThis.fetch;
const server = createApp().listen(0);
const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

type JsonObject = Record<string, unknown>;

const cleanupTestData = async () => {
  await prisma.auditLog.deleteMany({ where: { actorUserId: testUserId } });
  await prisma.user.deleteMany({ where: { id: testUserId } });
};

const api = async (path: string, init: RequestInit = {}) => {
  const response = await nativeFetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-user-id': testUserId,
      ...init.headers,
    },
  });
  const body = response.status === 204 ? {} : ((await response.json()) as JsonObject);
  return { response, body };
};

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
});

after(async () => {
  globalThis.fetch = nativeFetch;
  await cleanupTestData();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

test('Phase 5 API workflow', async (t) => {
  await t.test('reports health and rejects requests without a user', async () => {
    const live = await nativeFetch(`${baseUrl}/health/live`);
    assert.equal(live.status, 200);

    const ready = await nativeFetch(`${baseUrl}/health/ready`);
    assert.equal(ready.status, 200);

    const unauthorized = await nativeFetch(`${baseUrl}/library`);
    assert.equal(unauthorized.status, 401);
    const body = (await unauthorized.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'AUTHENTICATION_REQUIRED');
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
});
