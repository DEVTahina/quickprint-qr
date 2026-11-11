import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Plus,
  QrCode,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../constants/app';
import {
  closeSession,
  createSession,
  listSessions,
  renewSession,
} from '../../services/api/sessions';
import type {
  CreateSessionInput,
  CreatedPrintSession,
  PrintSession,
  PrintSessionStatus,
} from '../../types/session';
import { getApiError } from '../../utils/api-error';

const STATUS_LABELS: Record<PrintSessionStatus, string> = {
  active: 'Active',
  expired: 'Expirée',
  closed: 'Fermée',
};

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function effectiveStatus(
  session: PrintSession,
  now: number,
): PrintSessionStatus {
  if (session.status === 'closed') {
    return 'closed';
  }

  if (
    session.status === 'expired' ||
    new Date(session.expiresAt).getTime() <= now
  ) {
    return 'expired';
  }

  return 'active';
}

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function formatRemaining(expiresAt: string, now: number): string {
  const remaining = new Date(expiresAt).getTime() - now;

  if (remaining <= 0) {
    return 'Expirée';
  }

  const totalMinutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

/** Gestion des sessions de reception et affichage du QR Code temporaire. */
export default function SessionsPage() {
  const [sessions, setSessions] = useState<PrintSession[]>([]);
  const [created, setCreated] = useState<CreatedPrintSession | null>(null);
  const [form, setForm] = useState<CreateSessionInput>({
    expiresInMinutes: 120,
    maxFiles: 5,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadSessions = useCallback(async () => {
    try {
      const data = await listSessions();
      setSessions(data);
      setError(null);
    } catch (requestError) {
      const { message } = getApiError(requestError);
      setError(
        message ?? 'Impossible de charger les sessions. Veuillez réessayer.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void listSessions()
      .then((data) => {
        if (active) {
          setSessions(data);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }

        const { message } = getApiError(requestError);
        setError(
          message ?? 'Impossible de charger les sessions. Veuillez réessayer.',
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
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setCopied(false);

    try {
      const result = await createSession(form);
      setCreated(result);
      await loadSessions();
    } catch (requestError) {
      const { message } = getApiError(requestError);
      setError(
        message ?? 'Impossible de créer la session. Veuillez réessayer.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose(id: string) {
    if (
      !window.confirm(
        'Fermer cette session ? Le QR Code correspondant ne fonctionnera plus.',
      )
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await closeSession(id);
      if (created?.session.id === id) {
        setCreated(null);
      }
      await loadSessions();
    } catch (requestError) {
      const { message } = getApiError(requestError);
      setError(
        message ?? 'Impossible de fermer la session. Veuillez réessayer.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRenew(id: string) {
    setSubmitting(true);
    setError(null);
    setCopied(false);

    try {
      const result = await renewSession(id, form);
      setCreated(result);
      await loadSessions();
    } catch (requestError) {
      const { message } = getApiError(requestError);
      setError(
        message ?? 'Impossible de renouveler la session. Veuillez réessayer.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const activeSession =
    sessions.find((session) => effectiveStatus(session, now) === 'active') ??
    null;
  const qrToken =
    created && effectiveStatus(created.session, now) === 'active'
      ? created.token
      : null;
  const depositUrl = qrToken
    ? new URL(`/depot/${encodeURIComponent(qrToken)}`, window.location.origin)
        .toString()
    : null;

  async function copyDepositLink() {
    if (!depositUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(depositUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      window.prompt('Copiez ce lien de dépôt :', depositUrl);
    }
  }

  return (
    <div className="container sessions-page">
      <header className="page-heading">
        <div>
          <span className="badge">Sessions temporaires</span>
          <h1>Sessions de réception</h1>
          <p>
            Ouvrez une session temporaire, affichez son QR Code puis fermez-la
            lorsque la réception est terminée.
          </p>
        </div>
        <Link className="btn btn--ghost" to={ROUTES.adminDashboard}>
          Tableau de bord
        </Link>
      </header>

      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="sessions-layout">
        <section className="panel">
          <h2>Nouvelle session</h2>
          <p className="panel__intro">
            Le QR Code est valable pendant la durée choisie. Une seule session
            peut être active à la fois.
          </p>

          <form className="session-form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="expiresInMinutes">Durée de validité</label>
              <select
                id="expiresInMinutes"
                className="field__select"
                value={form.expiresInMinutes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expiresInMinutes: Number(event.target.value),
                  }))
                }
                disabled={submitting}
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 heure</option>
                <option value={120}>2 heures</option>
                <option value={240}>4 heures</option>
                <option value={480}>8 heures</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="maxFiles">Nombre maximal de fichiers</label>
              <input
                id="maxFiles"
                className="field__input"
                type="number"
                min={1}
                max={20}
                value={form.maxFiles}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxFiles: Number(event.target.value),
                  }))
                }
                disabled={submitting}
                required
              />
            </div>

            <button
              className="btn btn--primary btn--block"
              type="submit"
              disabled={submitting}
            >
              <Plus size={17} aria-hidden="true" />
              {submitting ? 'Création…' : 'Créer la session'}
            </button>
          </form>

          <p className="form-note">
            Le lien secret du QR Code n’est affiché qu’une seule fois, au moment
            de la création. Il n’est jamais enregistré en clair.
          </p>
        </section>

        <section className="panel panel--qr">
          <div className="panel__heading">
            <span className="card__icon" aria-hidden="true">
              <QrCode size={21} />
            </span>
            <div>
              <h2>QR Code de dépôt</h2>
              <p className="panel__intro">
                À scanner par les étudiants avec leur téléphone.
              </p>
            </div>
          </div>

          {depositUrl && created ? (
            <>
              <div className="qr-code">
                <QRCodeSVG
                  value={depositUrl}
                  size={220}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  title="QR Code de la session de réception"
                />
              </div>

              <p className="qr-url" title={depositUrl}>
                {depositUrl}
              </p>

              <div className="qr-actions">
                <button
                  className="btn btn--ghost btn--small"
                  type="button"
                  onClick={() => void copyDepositLink()}
                >
                  {copied ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <Copy size={15} aria-hidden="true" />
                  )}
                  {copied ? 'Lien copié' : 'Copier le lien'}
                </button>
                <a
                  className="btn btn--ghost btn--small"
                  href={depositUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                  Ouvrir
                </a>
              </div>

              <dl className="session-details">
                <div>
                  <dt>
                    <Clock size={15} aria-hidden="true" /> Expiration
                  </dt>
                  <dd>
                    {formatDateTime(created.session.expiresAt)}
                    <span className="session-details__hint">
                      {formatRemaining(created.session.expiresAt, now)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>
                    <FileText size={15} aria-hidden="true" /> Fichiers
                  </dt>
                  <dd>{created.session.maxFiles} maximum</dd>
                </div>
              </dl>

              <div className="session-actions">
                <button
                  className="btn btn--ghost btn--small"
                  type="button"
                  onClick={() => void handleClose(created.session.id)}
                  disabled={submitting}
                >
                  <XCircle size={15} aria-hidden="true" />
                  Fermer la session
                </button>
                <button
                  className="btn btn--primary btn--small"
                  type="button"
                  onClick={() => void handleRenew(created.session.id)}
                  disabled={submitting}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Renouveler le QR
                </button>
              </div>
            </>
          ) : (
            <div className="qr-placeholder">
              <QrCode size={54} strokeWidth={1.25} aria-hidden="true" />
              <p>
                {activeSession
                  ? "La session active a déjà été créée. Pour protéger son lien, le QR Code n'est plus réaffiché après rechargement."
                  : 'Aucune session active. Créez une session pour afficher son QR Code.'}
              </p>
              {activeSession ? (
                <button
                  className="btn btn--primary btn--small"
                  type="button"
                  onClick={() => void handleRenew(activeSession.id)}
                  disabled={submitting}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Renouveler la session active
                </button>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <section className="panel sessions-history">
        <div className="panel__heading panel__heading--between">
          <div>
            <h2>Historique</h2>
            <p className="panel__intro">
              Vos 50 dernières sessions, avec leur statut effectif.
            </p>
          </div>
          <button
            className="btn btn--ghost btn--small"
            type="button"
            onClick={() => void loadSessions()}
            disabled={submitting}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Actualiser
          </button>
        </div>

        {loading ? (
          <p className="empty-state">Chargement des sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="empty-state">
            Aucune session pour le moment. Créez la première session ci-dessus.
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Créée le</th>
                  <th>Expiration</th>
                  <th>Fichiers</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const status = effectiveStatus(session, now);

                  return (
                    <tr key={session.id}>
                      <td>{formatDateTime(session.createdAt)}</td>
                      <td>{formatDateTime(session.expiresAt)}</td>
                      <td>{session.maxFiles}</td>
                      <td>
                        <span className={`status-badge status-badge--${status}`}>
                          {STATUS_LABELS[status]}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {status === 'active' ? (
                            <button
                              className="btn btn--ghost btn--small"
                              type="button"
                              onClick={() => void handleClose(session.id)}
                              disabled={submitting}
                            >
                              Fermer
                            </button>
                          ) : null}
                          {status !== 'closed' ? (
                            <button
                              className="btn btn--ghost btn--small"
                              type="button"
                              onClick={() => void handleRenew(session.id)}
                              disabled={submitting}
                            >
                              Renouveler
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
