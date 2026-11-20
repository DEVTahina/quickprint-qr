import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from '../components/common/ProtectedRoute';
import { ROUTES } from '../constants/app';
import AdminLayout from '../layouts/AdminLayout';
import PublicLayout from '../layouts/PublicLayout';
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import DocumentsPage from '../pages/documents/DocumentsPage';
import HistoryPage from '../pages/history/HistoryPage';
import HomePage from '../pages/home/HomePage';
import SessionsPage from '../pages/sessions/SessionsPage';
import DepositPage from '../pages/student/DepositPage';

// PDF.js est lourd : la visionneuse n'est chargee qu'a l'ouverture d'un apercu.
const DocumentViewerPage = lazy(
  () => import('../pages/documents/DocumentViewerPage'),
);

/** Table des routes de l'application. */
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path={ROUTES.adminLogin} element={<LoginPage />} />
        <Route path="/depot/:token" element={<DepositPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path={ROUTES.adminDashboard} element={<DashboardPage />} />
          <Route path={ROUTES.adminSessions} element={<SessionsPage />} />
          <Route path={ROUTES.adminDocuments} element={<DocumentsPage />} />
          <Route path={ROUTES.adminHistory} element={<HistoryPage />} />
          <Route
            path={`${ROUTES.adminDocuments}/:id/apercu`}
            element={
              <Suspense
                fallback={<p className="empty-state">Chargement de l'aperçu…</p>}
              >
                <DocumentViewerPage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}
