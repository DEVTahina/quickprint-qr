import { QrCode } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';

import { APP_NAME, APP_SLOGAN, ROUTES } from '../constants/app';

/** Enveloppe commune aux pages publiques. */
export default function PublicLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container site-header__inner">
          <Link className="brand" to={ROUTES.home} aria-label={`${APP_NAME} — accueil`}>
            <span className="brand__mark" aria-hidden="true">
              <QrCode size={20} />
            </span>
            <span className="brand__text">
              <strong>{APP_NAME}</strong>
              <small>{APP_SLOGAN}</small>
            </span>
          </Link>

          <nav className="site-nav" aria-label="Navigation principale">
            <Link to={ROUTES.adminLogin}>Espace administrateur</Link>
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>
            {APP_NAME} — soumission sécurisée de documents PDF et gestion d'impression.
          </p>
        </div>
      </footer>
    </div>
  );
}
