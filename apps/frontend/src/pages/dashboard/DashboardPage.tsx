import { ShieldCheck } from 'lucide-react';

import { useAuth } from '../../contexts/auth-context';

/** Accueil de l'espace administrateur ; les sessions arrivent en Phase 4. */
export default function DashboardPage() {
  const { admin } = useAuth();

  return (
    <div className="container">
      <section className="dashboard-card">
        <span className="card__icon" aria-hidden="true">
          <ShieldCheck size={22} />
        </span>
        <span className="badge">Phase 3 — authentification active</span>
        <h1>Espace administrateur</h1>
        <p>
          Bienvenue {admin?.fullName ?? admin?.email}. Votre acces administrateur a ete
          verifie par le serveur.
        </p>
        <p className="form-note">
          La creation des sessions et la generation des QR Codes seront ajoutees a la
          Phase 4.
        </p>
      </section>
    </div>
  );
}
