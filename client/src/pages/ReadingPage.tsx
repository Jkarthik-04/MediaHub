import { LibraryPage } from './LibraryPage';
export function ReadingPage() {
  return (
    <LibraryPage
      description="Track books and manga, including page, chapter, and volume progress."
      tabs={['Books', 'Manga']}
      title="Reading"
    />
  );
}
