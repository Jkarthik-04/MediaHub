import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { AdminPage } from './pages/AdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { MediaDetailsPage } from './pages/MediaDetailsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { ReadingPage } from './pages/ReadingPage';
import { WatchingPage } from './pages/WatchingPage';

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="discovery" element={<DiscoveryPage />} />
        <Route path="reading" element={<ReadingPage />} />
        <Route path="watching" element={<WatchingPage />} />
        <Route path="media/:mediaId" element={<MediaDetailsPage />} />
        <Route path="recommendations" element={<RecommendationsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="home" element={<Navigate replace to="/" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
