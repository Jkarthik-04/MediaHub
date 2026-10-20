import { Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from './auth/RequireAuth';
import { RequireRole } from './auth/RequireRole';
import { AppShell } from './components/AppShell';
import { AdminPage } from './pages/AdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { MediaDetailsPage } from './pages/MediaDetailsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { ReadingPage } from './pages/ReadingPage';
import { WatchingPage } from './pages/WatchingPage';
import { LoginPage } from './pages/LoginPage';

function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="discovery" element={<DiscoveryPage />} />
          <Route path="reading" element={<ReadingPage />} />
          <Route path="watching" element={<WatchingPage />} />
          <Route path="media/:mediaId" element={<MediaDetailsPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route
            path="admin"
            element={
              <RequireRole role="ADMIN">
                <AdminPage />
              </RequireRole>
            }
          />
          <Route path="home" element={<Navigate replace to="/" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

export default App;
