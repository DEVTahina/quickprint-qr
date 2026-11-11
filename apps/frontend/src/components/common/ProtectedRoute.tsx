import { ShieldAlert } from 'lucide-react';
import { Navigate, Outlet } from 'react-router-dom';

import { ROUTES } from '../../constants/app';
import { useAuth } from '../../contexts/auth-context';

/** N'affiche les routes admin qu'apres validation du profil par le backend. */
export default function ProtectedRoute() {
  const { status, error, signOut, retry } = useAuth();

  if (status === 'loading') {
    return (
      <div className="container auth-page">
        <p className="form-note" role="status">
          Verification de la session…
        </p>
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to={ROUTES.adminLogin} replace />;
  }

  if (status === 'unauthorized' || status === 'error') {
    return (
      <div className="container auth-page">
        <section className="auth-card">
          <span className="card__icon" aria-hidden="true">
            <ShieldAlert size={22} />
          </span>
          <h1>{status === 'error' ? 'Service indisponible' : 'Acces refuse'}</h1>
          <p className="form-note">
            {error ??
              "Vous n'avez pas les droits necessaires pour acceder a cet espace."}
          </p>

          <div className="hero__actions">
            {status === 'error' ? (
              <button
                className="btn btn--primary"
                type="button"
                onClick={() => void retry()}
              >
                Reessayer
              </button>
            ) : null}
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => void signOut()}
            >
              Se deconnecter
            </button>
          </div>
        </section>
      </div>
    );
  }

  return <Outlet />;
}
