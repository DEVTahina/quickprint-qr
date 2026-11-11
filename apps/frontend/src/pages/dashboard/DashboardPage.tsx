import { ArrowRight, QrCode, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../constants/app';
import { useAuth } from '../../contexts/auth-context';

/** Accueil de l'espace administrateur. */
export default function DashboardPage() {
  const { admin } = useAuth();

  return (
    <div className="container">
      <section className="dashboard-card">
        <span className="card__icon" aria-hidden="true">
          <ShieldCheck size={22} />
        </span>
        <span className="badge">Authentification vérifiée par le serveur</span>
        <h1>Espace administrateur</h1>
        <p>
          Bienvenue {admin?.fullName ?? admin?.email}. Votre accès administrateur
          a été vérifié par le serveur.
        </p>
        <p>
          Créez une session temporaire pour afficher le QR Code de dépôt à vos
          étudiants.
        </p>
        <Link
          className="btn btn--primary dashboard-card__action"
          to={ROUTES.adminSessions}
        >
          <QrCode size={17} aria-hidden="true" />
          Gérer les sessions
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
