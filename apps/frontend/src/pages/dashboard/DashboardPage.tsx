import {
  ArrowRight,
  Clock,
  FileText,
  Inbox,
  Printer,
  QrCode,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../constants/app';
import { useAuth } from '../../contexts/auth-context';
import { useDocumentsRealtime } from '../../hooks/useDocumentsRealtime';
import { getDashboardSummary } from '../../services/api/dashboard';
import { listDocuments } from '../../services/api/documents';
import type { DashboardSummary } from '../../types/dashboard';
import type { DocumentSummary } from '../../types/document';
import { getApiError } from '../../utils/api-error';
import {
  DOCUMENT_STATUS_LABELS,
  formatDateTime,
  formatSize,
} from '../../utils/document-format';

const RECENT_LIMIT = 5;

/** Tableau de bord : compteurs, derniers depots et mise a jour temps reel. */
export default function DashboardPage() {
  const { admin } = useAuth();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recent, setRecent] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useDocumentsRealtime(() => setReloadToken((token) => token + 1));

  useEffect(() => {
    let active = true;

    void Promise.all([
      getDashboardSummary(),
      listDocuments({ sort: 'desc', page: 1, pageSize: RECENT_LIMIT }),
    ])
      .then(([nextSummary, page]) => {
        if (!active) {
          return;
        }

        setSummary(nextSummary);
        setRecent(page.items);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }

        const { message } = getApiError(requestError);
        setError(
          message ?? 'Impossible de charger le tableau de bord pour le moment.',
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
  }, [reloadToken]);

  const counters = [
    {
      label: 'Documents reçus',
      value: summary?.received,
      icon: Inbox,
      to: ROUTES.adminDocuments,
    },
    {
      label: "En attente d'impression",
      value: summary?.pending,
      icon: Clock,
      to: ROUTES.adminDocuments,
    },
    {
      label: 'Documents imprimés',
      value: summary?.printed,
      icon: Printer,
      to: ROUTES.adminDocuments,
    },
    {
      label: 'Sessions actives',
      value: summary?.activeSessions,
      icon: QrCode,
      to: ROUTES.adminSessions,
    },
  ];

  return (
    <div className="container dashboard-page">
      <header className="page-heading">
        <div>
          <span className="badge">Espace administrateur</span>
          <h1>Tableau de bord</h1>
          <p>
            Bienvenue {admin?.fullName ?? admin?.email}. Les nouveaux dépôts
            apparaissent ici automatiquement.
          </p>
        </div>
        <div className="page-heading__actions">
          <Link className="btn btn--ghost" to={ROUTES.adminSessions}>
            Gérer les sessions
          </Link>
          <Link className="btn btn--primary" to={ROUTES.adminDocuments}>
            Voir les documents
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="stat-grid" aria-label="Compteurs">
        {counters.map((counter) => {
          const Icon = counter.icon;

          return (
            <Link className="stat-card" key={counter.label} to={counter.to}>
              <span className="stat-card__icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="stat-card__value">
                {loading && counter.value === undefined
                  ? '…'
                  : (counter.value ?? 0)}
              </span>
              <span className="stat-card__label">{counter.label}</span>
            </Link>
          );
        })}
      </section>

      <section className="panel dashboard-recent">
        <div className="dashboard-recent__heading">
          <div>
            <h2>Derniers documents</h2>
            <p className="dashboard-live">
              Mise à jour en temps réel, sans recharger la page.
            </p>
          </div>
          <Link className="btn btn--ghost btn--small" to={ROUTES.adminDocuments}>
            Tout voir
          </Link>
        </div>

        {loading && recent.length === 0 ? (
          <p className="empty-state">Chargement des documents…</p>
        ) : recent.length === 0 ? (
          <p className="empty-state">
            Aucun document pour le moment. Les PDF déposés via une session
            apparaîtront ici.
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="documents-table">
              <thead>
                <tr>
                  <th>Fichier</th>
                  <th>Taille</th>
                  <th>Statut</th>
                  <th>Déposé le</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <span className="document-name">
                        <FileText size={15} aria-hidden="true" />
                        {document.originalName}
                      </span>
                    </td>
                    <td>{formatSize(document.sizeBytes)}</td>
                    <td>
                      <span
                        className={`status-badge status-badge--${document.status}`}
                      >
                        {DOCUMENT_STATUS_LABELS[document.status]}
                      </span>
                    </td>
                    <td>{formatDateTime(document.uploadedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
