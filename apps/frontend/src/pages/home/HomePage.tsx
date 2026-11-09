import { ArrowRight, Lock, Printer, QrCode, ShieldCheck, Smartphone, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';

import { APP_DESCRIPTION, APP_NAME, APP_SLOGAN, ROUTES } from '../../constants/app';

const steps = [
  {
    icon: Smartphone,
    title: '1. Scannez',
    text: "Le QR Code affiché à l'imprimerie ouvre la page de dépôt sur votre téléphone.",
  },
  {
    icon: UploadCloud,
    title: '2. Envoyez',
    text: 'Sélectionnez un ou plusieurs PDF. Aucun compte et aucune application ne sont nécessaires.',
  },
  {
    icon: Printer,
    title: '3. Imprimez',
    text: "L'administrateur reçoit les documents, les prévisualise et lance l'impression.",
  },
];

const advantages = [
  {
    icon: Lock,
    title: 'Stockage privé',
    text: 'Les fichiers sont conservés dans un espace privé, accessibles uniquement à l’administrateur autorisé.',
  },
  {
    icon: ShieldCheck,
    title: 'Dépôt contrôlé',
    text: 'Chaque dépôt est lié à une session temporaire avec expiration et limite de fichiers.',
  },
  {
    icon: QrCode,
    title: 'Sans installation',
    text: 'Une simple page web suffit : l’étudiant utilise sa propre connexion Internet.',
  },
];

/** Page d'accueil temporaire de la Phase 1. */
export default function HomePage() {
  return (
    <div className="container">
      <section className="hero">
        <div>
          <span className="badge">Phase 1 — interface temporaire</span>
          <h1>
            Vos PDF à l’imprimerie,
            <br />
            en un scan.
          </h1>
          <p className="lead">{APP_DESCRIPTION}</p>

          <div className="hero__actions">
            <Link className="btn btn--primary" to={ROUTES.adminLogin}>
              Espace administrateur
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a className="btn btn--ghost" href="#fonctionnement">
              Voir le parcours
            </a>
          </div>

          <p className="hero__note">
            {APP_NAME} — <strong>{APP_SLOGAN}</strong>
          </p>
        </div>

        <aside className="qr-card" aria-label="Aperçu du parcours de dépôt">
          <div className="qr-card__icon" aria-hidden="true">
            <QrCode size={76} strokeWidth={1.35} />
          </div>
          <p className="qr-card__title">Session de réception</p>
          <p className="qr-card__text">
            Le QR Code réel sera généré à la Phase 4, après la connexion sécurisée de
            l’administrateur.
          </p>
          <span className="qr-card__status">Bientôt disponible</span>
        </aside>
      </section>

      <section id="fonctionnement" className="section">
        <div className="section__heading">
          <h2>Comment ça marche</h2>
          <p>Un parcours simple, du téléphone de l’étudiant à l’imprimante.</p>
        </div>

        <div className="grid grid--3">
          {steps.map(({ icon: Icon, title, text }) => (
            <article className="card" key={title}>
              <span className="card__icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__heading">
          <h2>Pensé pour la sécurité</h2>
          <p>Les contrôles essentiels sont appliqués côté serveur, pas seulement dans l’interface.</p>
        </div>

        <div className="grid grid--3">
          {advantages.map(({ icon: Icon, title, text }) => (
            <article className="card card--muted" key={title}>
              <span className="card__icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="notice">
        <h2>Prochaines étapes</h2>
        <p>
          Cette page est volontairement temporaire. L’authentification réelle, les sessions
          de réception, l’envoi des PDF et l’impression seront ajoutés progressivement au
          cours des phases 3 à 7.
        </p>
      </section>
    </div>
  );
}
