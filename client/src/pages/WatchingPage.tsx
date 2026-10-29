import { LibraryPage } from './LibraryPage';
export function WatchingPage() {
  return (
    <LibraryPage
      description="Track movies, television, and anime from one focused library."
      tabs={['Movies', 'TV', 'Anime']}
      title="Watching"
    />
  );
}
