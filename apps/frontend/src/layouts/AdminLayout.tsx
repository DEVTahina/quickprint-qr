import { LogOut, QrCode } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';

import { APP_NAME, APP_SLOGAN, ROUTES } from '../constants/app';
import { useAuth } from '../contexts/auth-context';

/** En-tete et contenu de l'espace administrateur authentifie. */
export default function AdminLayout() {
  const { admin, signOut } = useAuth();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container site-header__inner">
          <Link
            className="brand"
            to={ROUTES.adminDashboard}
            aria-label={`${APP_NAME} — tableau de bord`}
          >
            <span className="brand__mark" aria-hidden="true">
              <QrCode size={20} />
            </span>
            <span className="brand__text">
              <strong>{APP_NAME}</strong>
              <small>{APP_SLOGAN}</small>
            </span>
          </Link>

          <div className="admin-session">
            <span className="admin-session__email">{admin?.email}</span>
            <button
              className="btn btn--ghost btn--small"
              type="button"
              onClick={() => void signOut()}
            >
              <LogOut size={16} aria-hidden="true" />
              Deconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>
    </div>
  );
}
