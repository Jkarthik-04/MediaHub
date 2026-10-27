import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { ConfirmationDialog } from '../src/components/ConfirmationDialog';
import { EmptyState, ErrorState, LoadingState, SkeletonLoader } from '../src/components/PageStates';
import { MediaCard } from '../src/components/MediaCard';
import { Pagination } from '../src/components/Pagination';
import { StatusBadge } from '../src/components/StatusBadge';

test('shared state components render accessible loading, empty and error feedback', () => {
  const loading = renderToStaticMarkup(createElement(LoadingState, { label: 'Loading library' }));
  const skeleton = renderToStaticMarkup(createElement(SkeletonLoader));
  const empty = renderToStaticMarkup(
    createElement(EmptyState, { title: 'Nothing here', children: 'Add a title to begin.' }),
  );
  const error = renderToStaticMarkup(
    createElement(ErrorState, { title: 'Request failed', children: 'Try again.' }),
  );

  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /Loading library/);
  assert.match(skeleton, /skeleton-list/);
  assert.match(empty, /Nothing here/);
  assert.match(error, /Request failed/);
});

test('shared media and status components link to catalogue details and label the status', () => {
  const card = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(MediaCard, {
        id: 'internal-media-id',
        title: 'Test title',
        type: 'BOOK',
        coverUrl: null,
        detail: '120 pages',
      }),
    ),
  );
  const badge = renderToStaticMarkup(createElement(StatusBadge, { status: 'IN_PROGRESS' }));

  assert.match(card, /\/media\/internal-media-id/);
  assert.match(card, /Test title/);
  assert.match(badge, /IN PROGRESS/);
});

test('pagination and confirmation controls expose the correct labels', () => {
  const pagination = renderToStaticMarkup(
    createElement(Pagination, { page: 2, totalPages: 4, onChange: () => undefined }),
  );
  const dialog = renderToStaticMarkup(
    createElement(ConfirmationDialog, {
      title: 'Remove title?',
      description: 'The library entry will be removed.',
      confirmLabel: 'Remove',
      onCancel: () => undefined,
      onConfirm: () => undefined,
    }),
  );

  assert.match(pagination, /Page 2 of 4/);
  assert.match(pagination, /Previous/);
  assert.match(pagination, /Next/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /Remove/);
});
