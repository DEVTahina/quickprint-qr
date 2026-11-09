import { Navigate, Route, Routes } from 'react-router-dom';

import { ROUTES } from '../constants/app';
import PublicLayout from '../layouts/PublicLayout';
import LoginPage from '../pages/auth/LoginPage';
import HomePage from '../pages/home/HomePage';

/** Table des routes de l'application. */
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path={ROUTES.adminLogin} element={<LoginPage />} />
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}
