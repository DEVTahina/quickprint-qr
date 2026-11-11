import {
  ArrowLeft,
  Clock,
  FileText,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { APP_NAME, ROUTES } from '../../constants/app';
import { getPublicSession } from '../../services/api/sessions';
import type { PublicPrintSession } from '../../types/session';
import { getApiError } from '../../utils/api-error';

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Page publique ouverte apres le scan du QR Code. */
export default function DepositPage() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<PublicPrintSession | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(
    token ? null : 'Lien de session invalide.',
  );

  useEffect(() => {
    let active = true;

    if (!token) {
      return;
    }

    void getPublicSession(token)
      .then((data) => {
        if (active) {
          setSession(data);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }

        const { status, message } = getApiError(requestError);
        setError(
          status === 404
            ? 'Ce lien ne correspond à aucune session. Vérifiez le QR Code.'
            : (message ??
              'Impossible de vérifier la session. Vérifiez votre connexion.'),
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="container deposit-page">
      <section className="deposit-card">
        <Link className="back-link" to={ROUTES.home}>
          <ArrowLeft size={16} aria-hidden="true" />
          Accueil {APP_NAME}
        </Link>

        {loading ? (
          <p className="empty-state">Vérification de la session…</p>
        ) : error ? (
          <div className="deposit-card__body">
            <span className="deposit-icon deposit-icon--error" aria-hidden="true">
              <XCircle size={30} />
            </span>
            <h1>Session inaccessible</h1>
            <p>{error}</p>
            <p className="form-note">
              Demandez à l’imprimerie de créer une nouvelle session.
            </p>
          </div>
        ) : session ? (
          <div className="deposit-card__body">
            <span
              className={`deposit-icon ${
                session.valid
                  ? 'deposit-icon--success'
                  : 'deposit-icon--error'
              }`}
              aria-hidden="true"
            >
              {session.valid ? <UploadCloud size={30} /> : <XCircle size={30} />}
            </span>
            <h1>
              {session.valid ? 'Session ouverte' : 'Session indisponible'}
            </h1>
            <p>
              {session.valid
                ? 'Le QR Code est valide. Vous pourrez envoyer vos fichiers PDF depuis cette page.'
                : session.status === 'closed'
                  ? 'Cette session a été fermée par l’imprimerie.'
                  : 'Cette session a expiré. Demandez un nouveau QR Code.'}
            </p>

            <dl className="session-details session-details--centered">
              <div>
                <dt>
                  <Clock size={15} aria-hidden="true" /> Expiration
                </dt>
                <dd>{dateTimeFormatter.format(new Date(session.expiresAt))}</dd>
              </div>
              <div>
                <dt>
                  <FileText size={15} aria-hidden="true" /> Fichiers
                </dt>
                <dd>{session.maxFiles} maximum</dd>
              </div>
            </dl>

            {session.valid ? (
              <p className="notice notice--inline">
                <ShieldCheck size={17} aria-hidden="true" />
                L’envoi des fichiers PDF sera disponible très bientôt. Cette page
                vérifie déjà le lien auprès du serveur.
              </p>
            ) : (
              <p className="form-note">
                Aucun fichier ne peut être déposé avec ce lien.
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
