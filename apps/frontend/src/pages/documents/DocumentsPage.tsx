import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES, documentViewerPath } from '../../constants/app';
import { useDocumentsRealtime } from '../../hooks/useDocumentsRealtime';
import {
  deleteDocuments,
  listDocuments,
  updateDocumentsStatus,
} from '../../services/api/documents';
import { completePrintBatch } from '../../services/api/print-batches';
import { listSessions } from '../../services/api/sessions';
import type { PrintJob } from '../../utils/print-pdf';
import type {
  DocumentPage,
  DocumentSortOrder,
  DocumentStatus,
  MutableDocumentStatus,
} from '../../types/document';
import type { PrintSession } from '../../types/session';
import { getApiError } from '../../utils/api-error';
import {
  DOCUMENT_STATUS_LABELS,
  formatDateTime,
  formatSize,
} from '../../utils/document-format';

const PAGE_SIZE = 20;

const SESSION_STATUS_LABELS = {
  active: 'Active',
  expired: 'Expirée',
  closed: 'Fermée',
} as const;

/** Convertit une date de formulaire (heure locale) en instant ISO. */
function startOfDayToIso(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}

function endOfDayToIso(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}

/** Liste des PDF deposes, avec recherche, filtres, tri et pagination. */
export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState<DocumentStatus | ''>('');
  const [sessionId, setSessionId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<DocumentSortOrder>('desc');
  const [page, setPage] = useState(1);

  const [sessions, setSessions] = useState<PrintSession[]>([]);
  const [result, setResult] = useState<DocumentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);

  const lastRealtimeEvent = useDocumentsRealtime(() =>
    setReloadToken((token) => token + 1),
  );

  useEffect(() => {
    if (!lastRealtimeEvent) {
      return;
    }

    setNotice('Un nouveau document vient d’être déposé.');
    const timer = window.setTimeout(() => setNotice(null), 6_000);

    return () => window.clearTimeout(timer);
  }, [lastRealtimeEvent]);

  // La recherche est appliquee apres une courte pause pour eviter une requete
  // par frappe clavier.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;

    void listSessions()
      .then((data) => {
        if (active) {
          setSessions(data);
        }
      })
      .catch(() => {
        // Le filtre par session reste simplement indisponible.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void listDocuments({
      search: appliedSearch || undefined,
      status: status || undefined,
      sessionId: sessionId || undefined,
      dateFrom: startOfDayToIso(dateFrom),
      dateTo: endOfDayToIso(dateTo),
      sort,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((data) => {
        if (active) {
          setResult(data);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }

        const { message } = getApiError(requestError);
        setError(
          message ?? 'Impossible de charger les documents. Veuillez réessayer.',
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
  }, [appliedSearch, status, sessionId, dateFrom, dateTo, sort, page, reloadToken]);

  // Une selection ne survit pas a un changement de page ou de filtre : les
  // identifiants absents du resultat courant sont retires.
  useEffect(() => {
    if (!result) {
      return;
    }

    const visibleIds = new Set(result.items.map((item) => item.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [result]);

  function updatePage(nextPage: number) {
    setPage(Math.max(1, nextPage));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /** Rang de selection (1..N), utilise pour l'ordre d'impression. */
  function selectionOrder(id: string): number {
    return selectedIds.has(id) ? [...selectedIds].indexOf(id) + 1 : 0;
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      if (items.every((item) => current.has(item.id))) {
        return new Set();
      }

      return new Set(items.map((item) => item.id));
    });
  }

  async function runAction(
    key: string,
    action: () => Promise<unknown>,
    successMessage: string,
  ) {
    setBusyAction(key);
    setActionError(null);

    try {
      await action();
      setSelectedIds(new Set());
      setNotice(successMessage);
      setReloadToken((token) => token + 1);
      window.setTimeout(() => setNotice(null), 6_000);
    } catch (requestError: unknown) {
      const { message } = getApiError(requestError);
      setActionError(
        message ?? 'Action impossible. Veuillez réessayer.',
      );
    } finally {
      setBusyAction(null);
    }
  }

  function changeStatus(ids: string[], status: MutableDocumentStatus) {
    const label = status === 'printed' ? 'imprimé' : 'de nouveau en attente';

    void runAction(
      `status-${status}`,
      () => updateDocumentsStatus(ids, status),
      `${ids.length} document${ids.length > 1 ? 's' : ''} marqué${ids.length > 1 ? 's' : ''} ${label}.`,
    );
  }

  function removeDocuments(ids: string[]) {
    const confirmed = window.confirm(
      `Supprimer ${ids.length} document${ids.length > 1 ? 's' : ''} ? Le fichier sera retiré du stockage privé.`,
    );

    if (!confirmed) {
      return;
    }

    void runAction(
      'delete',
      () => deleteDocuments(ids),
      `${ids.length} document${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''}.`,
    );
  }

  async function printSelection(ids: string[]) {
    setBusyAction('print');
    setActionError(null);
    setNotice(null);

    try {
      // pdf-lib n'est charge qu'au premier lancement d'une impression.
      const { printDocuments } = await import('../../utils/print-pdf');
      const job = await printDocuments(ids);
      setPrintJob(job);
    } catch (printError: unknown) {
      const { message } = getApiError(printError);
      setActionError(
        message ??
          (printError instanceof Error
            ? printError.message
            : "L'impression n'a pas pu être préparée."),
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function finishPrint(markPrinted: boolean) {
    if (!printJob) {
      return;
    }

    setBusyAction('finish-print');
    setActionError(null);

    try {
      await completePrintBatch(printJob.batchId, markPrinted);
      setSelectedIds(new Set());
      setPrintJob(null);
      setNotice(
        markPrinted
          ? `${printJob.totalDocuments} document${printJob.totalDocuments > 1 ? 's' : ''} marqué${printJob.totalDocuments > 1 ? 's' : ''} imprimé${printJob.totalDocuments > 1 ? 's' : ''}.`
          : "Lot d'impression clôturé ; les statuts restent inchangés.",
      );
      setReloadToken((token) => token + 1);
      window.setTimeout(() => setNotice(null), 6_000);
    } catch (requestError: unknown) {
      const { message } = getApiError(requestError);
      setActionError(
        message ?? "Impossible de finaliser le lot d'impression.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    setSessionId('');
    setDateFrom('');
    setDateTo('');
    setSort('desc');
    setPage(1);
  }

  const hasActiveFilters =
    appliedSearch !== '' ||
    status !== '' ||
    sessionId !== '' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    sort !== 'desc';

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 0;
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const isBusy = busyAction !== null;

  return (
    <div className="container documents-page">
      <header className="page-heading">
        <div>
          <span className="badge">Documents reçus</span>
          <h1>Documents</h1>
          <p>
            Tous les PDF déposés via les sessions de réception, du plus récent au
            plus ancien. Combinez la recherche et les filtres pour retrouver un
            fichier.
          </p>
        </div>
        <div className="page-heading__actions">
          <Link className="btn btn--ghost" to={ROUTES.adminSessions}>
            Sessions
          </Link>
          <Link className="btn btn--ghost" to={ROUTES.adminDashboard}>
            Tableau de bord
          </Link>
        </div>
      </header>

      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}

      {actionError ? (
        <p className="alert alert--error" role="alert">
          {actionError}
        </p>
      ) : null}

      {notice ? (
        <p className="realtime-notice" role="status">
          {notice}
        </p>
      ) : null}

      {printJob ? (
        <div className="print-confirm" role="status">
          <p>
            Lot de {printJob.totalDocuments} document
            {printJob.totalDocuments > 1 ? 's' : ''} préparé : la boîte
            d'impression de votre navigateur a été ouverte. Marquer ces
            documents comme imprimés ?
          </p>
          <div className="print-confirm__actions">
            <button
              className="btn btn--primary btn--small"
              type="button"
              disabled={isBusy}
              onClick={() => void finishPrint(true)}
            >
              Oui, marquer imprimés
            </button>
            <button
              className="btn btn--ghost btn--small"
              type="button"
              disabled={isBusy}
              onClick={() => void finishPrint(false)}
            >
              Non, laisser en attente
            </button>
          </div>
        </div>
      ) : null}

      <section className="panel">
        <div className="filters">
          <div className="field filters__search">
            <label htmlFor="documentSearch">Recherche par nom de fichier</label>
            <div className="field__control">
              <Search size={16} aria-hidden="true" />
              <input
                id="documentSearch"
                type="search"
                placeholder="QTC, copie, 2026…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="documentStatus">Statut</label>
            <select
              id="documentStatus"
              className="field__select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as DocumentStatus | '');
                setPage(1);
              }}
            >
              <option value="">Tous les statuts</option>
              <option value="received">Reçu</option>
              <option value="printed">Imprimé</option>
              <option value="deleted">Supprimé</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="documentSession">Session</label>
            <select
              id="documentSession"
              className="field__select"
              value={sessionId}
              onChange={(event) => {
                setSessionId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Toutes les sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {formatDateTime(session.createdAt)} —{' '}
                  {SESSION_STATUS_LABELS[session.status]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="documentDateFrom">Déposé du</label>
            <input
              id="documentDateFrom"
              className="field__input"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="documentDateTo">au</label>
            <input
              id="documentDateTo"
              className="field__input"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="documentSort">Tri</label>
            <select
              id="documentSort"
              className="field__select"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as DocumentSortOrder);
                setPage(1);
              }}
            >
              <option value="desc">Plus récent d'abord</option>
              <option value="asc">Plus ancien d'abord</option>
            </select>
          </div>

          <div className="filters__actions">
            <button
              className="btn btn--ghost btn--small"
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters && search === ''}
            >
              <X size={15} aria-hidden="true" />
              Réinitialiser
            </button>
            <button
              className="btn btn--ghost btn--small"
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              disabled={loading}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Actualiser
            </button>
          </div>
        </div>

        {selectedIds.size > 0 ? (
          <div className="bulk-bar">
            <span className="bulk-bar__count">
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''} · ordre
              de sélection
            </span>
            <div className="bulk-bar__actions">
              <button
                className="btn btn--primary btn--small"
                type="button"
                disabled={isBusy}
                onClick={() => void printSelection([...selectedIds])}
              >
                <Printer size={15} aria-hidden="true" />
                Imprimer la sélection
              </button>
              <button
                className="btn btn--ghost btn--small"
                type="button"
                disabled={isBusy}
                onClick={() => changeStatus([...selectedIds], 'printed')}
              >
                <Printer size={15} aria-hidden="true" />
                Marquer imprimé
              </button>
              <button
                className="btn btn--ghost btn--small"
                type="button"
                disabled={isBusy}
                onClick={() => changeStatus([...selectedIds], 'received')}
              >
                <RotateCcw size={15} aria-hidden="true" />
                Remettre en attente
              </button>
              <button
                className="btn btn--danger btn--small"
                type="button"
                disabled={isBusy}
                onClick={() => removeDocuments([...selectedIds])}
              >
                <Trash2 size={15} aria-hidden="true" />
                Supprimer
              </button>
              <button
                className="btn btn--ghost btn--small"
                type="button"
                disabled={isBusy}
                onClick={() => setSelectedIds(new Set())}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : null}

        <div className="documents-summary">
          {loading ? (
            <span>Chargement des documents…</span>
          ) : (
            <span>
              {total === 0
                ? 'Aucun document'
                : `${firstRow}–${lastRow} sur ${total} document${total > 1 ? 's' : ''}`}
            </span>
          )}
        </div>

        {loading && items.length === 0 ? (
          <p className="empty-state">Chargement des documents…</p>
        ) : items.length === 0 ? (
          <p className="empty-state">
            {hasActiveFilters
              ? 'Aucun document ne correspond à ces critères. Modifiez la recherche ou réinitialisez les filtres.'
              : 'Aucun document pour le moment. Les PDF déposés via une session apparaîtront ici.'}
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="documents-table">
              <thead>
                <tr>
                  <th className="documents-select">
                    <input
                      type="checkbox"
                      aria-label="Sélectionner tous les documents de la page"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      disabled={isBusy}
                    />
                  </th>
                  <th>Fichier</th>
                  <th>Session</th>
                  <th>Taille</th>
                  <th>Pages</th>
                  <th>Statut</th>
                  <th>Déposé le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((document) => (
                  <tr
                    key={document.id}
                    className={
                      selectedIds.has(document.id) ? 'is-selected' : undefined
                    }
                  >
                    <td className="documents-select">
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${document.originalName}`}
                        checked={selectedIds.has(document.id)}
                        onChange={() => toggleSelected(document.id)}
                        disabled={isBusy}
                      />
                    </td>
                    <td>
                      <span className="document-name">
                        {selectionOrder(document.id) > 0 ? (
                          <span className="selection-order" aria-hidden="true">
                            {selectionOrder(document.id)}
                          </span>
                        ) : (
                          <FileText size={15} aria-hidden="true" />
                        )}
                        <Link
                          className="document-name__link"
                          to={documentViewerPath(document.id)}
                          title="Ouvrir l'aperçu"
                        >
                          {document.originalName}
                        </Link>
                      </span>
                    </td>
                    <td>
                      {document.session ? (
                        formatDateTime(document.session.createdAt)
                      ) : (
                        <span className="documents-muted">Session supprimée</span>
                      )}
                    </td>
                    <td>{formatSize(document.sizeBytes)}</td>
                    <td>{document.pagesCount ?? '—'}</td>
                    <td>
                      <span
                        className={`status-badge status-badge--${document.status}`}
                      >
                        {DOCUMENT_STATUS_LABELS[document.status]}
                      </span>
                    </td>
                    <td>{formatDateTime(document.uploadedAt)}</td>
                    <td>
                      <div className="table-actions">
                        {document.status !== 'deleted' ? (
                          <Link
                            className="btn btn--ghost btn--small"
                            to={documentViewerPath(document.id)}
                            title="Ouvrir l'aperçu"
                            aria-label={`Ouvrir l'aperçu de ${document.originalName}`}
                          >
                            <Eye size={15} aria-hidden="true" />
                          </Link>
                        ) : (
                          <button
                            className="btn btn--ghost btn--small"
                            type="button"
                            title="Document supprimé"
                            aria-label={`${document.originalName} est supprimé`}
                            disabled
                          >
                            <Eye size={15} aria-hidden="true" />
                          </button>
                        )}
                        {document.status === 'printed' ? (
                          <button
                            className="btn btn--ghost btn--small"
                            type="button"
                            title="Remettre en attente"
                            aria-label={`Remettre ${document.originalName} en attente`}
                            disabled={isBusy}
                            onClick={() =>
                              changeStatus([document.id], 'received')
                            }
                          >
                            <RotateCcw size={15} aria-hidden="true" />
                          </button>
                        ) : document.status === 'received' ? (
                          <button
                            className="btn btn--ghost btn--small"
                            type="button"
                            title="Marquer imprimé"
                            aria-label={`Marquer ${document.originalName} imprimé`}
                            disabled={isBusy}
                            onClick={() =>
                              changeStatus([document.id], 'printed')
                            }
                          >
                            <Printer size={15} aria-hidden="true" />
                          </button>
                        ) : null}
                        {document.status !== 'deleted' ? (
                          <button
                            className="btn btn--ghost btn--small btn--danger-ghost"
                            type="button"
                            title="Supprimer"
                            aria-label={`Supprimer ${document.originalName}`}
                            disabled={isBusy}
                            onClick={() => removeDocuments([document.id])}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <nav className="pagination" aria-label="Pagination des documents">
            <button
              className="btn btn--ghost btn--small"
              type="button"
              onClick={() => updatePage(page - 1)}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft size={15} aria-hidden="true" />
              Précédent
            </button>
            <span>
              Page {page} sur {totalPages}
            </span>
            <button
              className="btn btn--ghost btn--small"
              type="button"
              onClick={() => updatePage(page + 1)}
              disabled={page >= totalPages || loading}
            >
              Suivant
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
