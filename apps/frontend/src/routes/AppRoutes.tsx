import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from '../components/common/ProtectedRoute';
import { ROUTES } from '../constants/app';
import AdminLayout from '../layouts/AdminLayout';
import PublicLayout from '../layouts/PublicLayout';
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import HomePage from '../pages/home/HomePage';
import SessionsPage from '../pages/sessions/SessionsPage';
import DepositPage from '../pages/student/DepositPage';

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
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}
