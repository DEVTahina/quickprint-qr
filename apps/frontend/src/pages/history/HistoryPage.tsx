import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { documentViewerPath } from '../../constants/app';
import { listDocuments } from '../../services/api/documents';
import { listPrintBatches } from '../../services/api/print-batches';
import type { DocumentPage, DocumentStatus } from '../../types/document';
import type {
  PrintBatchPage,
  PrintBatchStatus,
} from '../../types/print-batch';
import { getApiError } from '../../utils/api-error';
import {
  DOCUMENT_STATUS_LABELS,
  formatDateTime,
  formatSize,
} from '../../utils/document-format';

const PAGE_SIZE = 20;

const DOCUMENT_STATUS_OPTIONS: Array<{
  value: DocumentStatus;
  label: string;
}> = [
  { value: 'received', label: 'Reçu' },
  { value: 'printed', label: 'Imprimé' },
  { value: 'deleted', label: 'Supprimé' },
];

const BATCH_STATUS_LABELS: Record<PrintBatchStatus, string> = {
  pending: 'En attente',
  processing: 'En cours',
  completed: 'Terminé',
  failed: 'Échec',
};

const BATCH_STATUS_OPTIONS: Array<{
  value: PrintBatchStatus;
  label: string;
}> = [
  { value: 'pending', label: 'En attente' },
  { value: 'processing', label: 'En cours' },
  { value: 'completed', label: 'Terminé' },
  { value: 'failed', label: 'Échec' },
];

function startOfDayToIso(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}

function endOfDayToIso(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}

function Pagination({
  page,
  totalPages,
  loading,
  label,
  onChange,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  label: string;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label={label}>
      <button
        className="btn btn--ghost btn--small"
        type="button"
        onClick={() => onChange(page - 1)}
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
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages || loading}
      >
        Suivant
        <ChevronRight size={15} aria-hidden="true" />
      </button>
    </nav>
  );
}

/** Historique en lecture seule des documents et des lots d'impression. */
export default function HistoryPage() {
  const [tab, setTab] = useState<'documents' | 'batches'>('documents');

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus | ''>('');
  const [documentDateFrom, setDocumentDateFrom] = useState('');
  const [documentDateTo, setDocumentDateTo] = useState('');
  const [documentPage, setDocumentPage] = useState(1);
  const [documentResult, setDocumentResult] = useState<DocumentPage | null>(
    null,
  );
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentsReload, setDocumentsReload] = useState(0);

  const [batchStatus, setBatchStatus] = useState<PrintBatchStatus | ''>('');
  const [batchDateFrom, setBatchDateFrom] = useState('');
  const [batchDateTo, setBatchDateTo] = useState('');
  const [batchPage, setBatchPage] = useState(1);
  const [batchResult, setBatchResult] = useState<PrintBatchPage | null>(null);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [batchesReload, setBatchesReload] = useState(0);

  // La recherche attend une courte pause pour ne pas lancer une requete par
  // frappe clavier.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setDocumentPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (tab !== 'documents') {
      return;
    }

    let active = true;
    setDocumentsLoading(true);

    void listDocuments({
      search: appliedSearch || undefined,
      status: documentStatus || undefined,
      dateFrom: startOfDayToIso(documentDateFrom),
      dateTo: endOfDayToIso(documentDateTo),
      sort: 'desc',
      page: documentPage,
      pageSize: PAGE_SIZE,
    })
      .then((data) => {
        if (active) {
          setDocumentResult(data);
          setDocumentsError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          const { message } = getApiError(requestError);
          setDocumentsError(
            message ?? "Impossible de charger l'historique des documents.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setDocumentsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    tab,
    appliedSearch,
    documentStatus,
    documentDateFrom,
    documentDateTo,
    documentPage,
    documentsReload,
  ]);

  useEffect(() => {
    if (tab !== 'batches') {
      return;
    }

    let active = true;
    setBatchesLoading(true);

    void listPrintBatches({
      status: batchStatus || undefined,
      dateFrom: startOfDayToIso(batchDateFrom),
      dateTo: endOfDayToIso(batchDateTo),
      sort: 'desc',
      page: batchPage,
      pageSize: PAGE_SIZE,
    })
      .then((data) => {
        if (active) {
          setBatchResult(data);
          setBatchesError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          const { message } = getApiError(requestError);
          setBatchesError(
            message ?? "Impossible de charger l'historique des impressions.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setBatchesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    tab,
    batchStatus,
    batchDateFrom,
    batchDateTo,
    batchPage,
    batchesReload,
  ]);

  const documents = documentResult?.items ?? [];
  const batches = batchResult?.items ?? [];
  const documentsTotal = documentResult?.total ?? 0;
  const batchesTotal = batchResult?.total ?? 0;
  const documentsTotalPages = documentResult?.totalPages ?? 0;
  const batchesTotalPages = batchResult?.totalPages ?? 0;

  const hasDocumentFilters =
    appliedSearch !== '' ||
    documentStatus !== '' ||
    documentDateFrom !== '' ||
    documentDateTo !== '';

  const hasBatchFilters =
    batchStatus !== '' || batchDateFrom !== '' || batchDateTo !== '';

  function resetDocumentFilters() {
    setSearch('');
    setAppliedSearch('');
    setDocumentStatus('');
    setDocumentDateFrom('');
    setDocumentDateTo('');
    setDocumentPage(1);
  }

  function resetBatchFilters() {
    setBatchStatus('');
    setBatchDateFrom('');
    setBatchDateTo('');
    setBatchPage(1);
  }

  return (
    <div className="container history-page">
      <header className="page-heading">
        <div>
          <span className="badge">Traçabilité</span>
          <h1>Historique</h1>
          <p>
            Retrouvez les documents déposés, y compris ceux qui ont été
            supprimés, ainsi que les lots d'impression lancés depuis
            l'application.
          </p>
        </div>
        <div className="page-heading__actions">
          <Link className="btn btn--ghost" to="/admin/documents">
            Documents
          </Link>
          <Link className="btn btn--ghost" to="/admin">
            Tableau de bord
          </Link>
        </div>
      </header>

      <div className="history-tabs" role="tablist" aria-label="Historique">
        <button
          className={`history-tabs__btn${tab === 'documents' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'documents'}
          onClick={() => setTab('documents')}
        >
          <FileText size={16} aria-hidden="true" />
          Documents
          {documentResult ? (
            <span className="history-tabs__count">{documentsTotal}</span>
          ) : null}
        </button>
        <button
          className={`history-tabs__btn${tab === 'batches' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'batches'}
          onClick={() => setTab('batches')}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Lots d'impression
          {batchResult ? (
            <span className="history-tabs__count">{batchesTotal}</span>
          ) : null}
        </button>
      </div>

      {tab === 'documents' ? (
        <section className="panel" role="tabpanel">
          <div className="filters">
            <div className="field filters__search">
              <label htmlFor="historySearch">
                Recherche par nom de fichier
              </label>
              <div className="field__control">
                <Search size={16} aria-hidden="true" />
                <input
                  id="historySearch"
                  type="search"
                  placeholder="QTC, copie, 2026…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="historyStatus">Statut</label>
              <select
                id="historyStatus"
                className="field__select"
                value={documentStatus}
                onChange={(event) => {
                  setDocumentStatus(event.target.value as DocumentStatus | '');
                  setDocumentPage(1);
                }}
              >
                <option value="">Tous les statuts</option>
                {DOCUMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="historyDateFrom">Déposé du</label>
              <input
                id="historyDateFrom"
                className="field__input"
                type="date"
                value={documentDateFrom}
                max={documentDateTo || undefined}
                onChange={(event) => {
                  setDocumentDateFrom(event.target.value);
                  setDocumentPage(1);
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="historyDateTo">au</label>
              <input
                id="historyDateTo"
                className="field__input"
                type="date"
                value={documentDateTo}
                min={documentDateFrom || undefined}
                onChange={(event) => {
                  setDocumentDateTo(event.target.value);
                  setDocumentPage(1);
                }}
              />
            </div>

            <div className="filters__actions">
              <button
                className="btn btn--ghost btn--small"
                type="button"
                onClick={resetDocumentFilters}
                disabled={!hasDocumentFilters && search === ''}
              >
                <X size={15} aria-hidden="true" />
                Réinitialiser
              </button>
              <button
                className="btn btn--ghost btn--small"
                type="button"
                onClick={() => setDocumentsReload((value) => value + 1)}
                disabled={documentsLoading}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Actualiser
              </button>
            </div>
          </div>

          {documentsError ? (
            <p className="alert alert--error" role="alert">
              {documentsError}
            </p>
          ) : null}

          <div className="documents-summary">
            {documentsLoading ? (
              <span>Chargement de l'historique…</span>
            ) : (
              <span>
                {documentsTotal === 0
                  ? 'Aucun document'
                  : `${documentsTotal} document${documentsTotal > 1 ? 's' : ''} dans l'historique`}
              </span>
            )}
          </div>

          {!documentsLoading && documents.length === 0 ? (
            <p className="empty-state">
              {hasDocumentFilters
                ? 'Aucun document ne correspond à ces critères.'
                : 'Aucun document déposé pour le moment.'}
            </p>
          ) : (
            <div className="table-wrapper">
              <table className="documents-table history-table">
                <thead>
                  <tr>
                    <th>Fichier</th>
                    <th>Session</th>
                    <th>Taille</th>
                    <th>Statut</th>
                    <th>Déposé le</th>
                    <th>Imprimé le</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <span className="document-name">
                          <FileText size={15} aria-hidden="true" />
                          {document.originalName}
                        </span>
                      </td>
                      <td>
                        {document.session
                          ? formatDateTime(document.session.createdAt)
                          : '—'}
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
                      <td>
                        {document.printedAt
                          ? formatDateTime(document.printedAt)
                          : '—'}
                      </td>
                      <td>
                        {document.status !== 'deleted' ? (
                          <Link
                            className="btn btn--ghost btn--small"
                            to={documentViewerPath(document.id)}
                            title="Consulter le PDF"
                            aria-label={`Consulter ${document.originalName}`}
                          >
                            <Eye size={15} aria-hidden="true" />
                          </Link>
                        ) : (
                          <span className="documents-muted">
                            {document.deletedAt
                              ? `Supprimé le ${formatDateTime(document.deletedAt)}`
                              : 'Supprimé'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={documentPage}
            totalPages={documentsTotalPages}
            loading={documentsLoading}
            label="Pagination de l'historique des documents"
            onChange={setDocumentPage}
          />
        </section>
      ) : (
        <section className="panel" role="tabpanel">
          <div className="filters">
            <div className="field">
              <label htmlFor="batchStatus">Statut du lot</label>
              <select
                id="batchStatus"
                className="field__select"
                value={batchStatus}
                onChange={(event) => {
                  setBatchStatus(event.target.value as PrintBatchStatus | '');
                  setBatchPage(1);
                }}
              >
                <option value="">Tous les statuts</option>
                {BATCH_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="batchDateFrom">Créé du</label>
              <input
                id="batchDateFrom"
                className="field__input"
                type="date"
                value={batchDateFrom}
                max={batchDateTo || undefined}
                onChange={(event) => {
                  setBatchDateFrom(event.target.value);
                  setBatchPage(1);
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="batchDateTo">au</label>
              <input
                id="batchDateTo"
                className="field__input"
                type="date"
                value={batchDateTo}
                min={batchDateFrom || undefined}
                onChange={(event) => {
                  setBatchDateTo(event.target.value);
                  setBatchPage(1);
                }}
              />
            </div>

            <div className="filters__actions">
              <button
                className="btn btn--ghost btn--small"
                type="button"
                onClick={resetBatchFilters}
                disabled={!hasBatchFilters}
              >
                <X size={15} aria-hidden="true" />
                Réinitialiser
              </button>
              <button
                className="btn btn--ghost btn--small"
                type="button"
                onClick={() => setBatchesReload((value) => value + 1)}
                disabled={batchesLoading}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Actualiser
              </button>
            </div>
          </div>

          {batchesError ? (
            <p className="alert alert--error" role="alert">
              {batchesError}
            </p>
          ) : null}

          <div className="documents-summary">
            {batchesLoading ? (
              <span>Chargement de l'historique…</span>
            ) : (
              <span>
                {batchesTotal === 0
                  ? 'Aucun lot'
                  : `${batchesTotal} lot${batchesTotal > 1 ? 's' : ''} d'impression`}
              </span>
            )}
          </div>

          {!batchesLoading && batches.length === 0 ? (
            <p className="empty-state">
              {hasBatchFilters
                ? 'Aucun lot ne correspond à ces critères.'
                : "Aucun lot d'impression n'a encore été lancé."}
            </p>
          ) : (
            <div className="table-wrapper">
              <table className="documents-table history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Documents</th>
                    <th>Composition</th>
                    <th>Clôturé le</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td>{formatDateTime(batch.createdAt)}</td>
                      <td>
                        <span
                          className={`status-badge status-badge--${batch.status}`}
                        >
                          {BATCH_STATUS_LABELS[batch.status]}
                        </span>
                      </td>
                      <td>{batch.totalDocuments}</td>
                      <td>
                        <ol className="batch-documents">
                          {batch.documents.map((document) => (
                            <li key={document.documentId}>
                              {document.status !== 'deleted' ? (
                                <Link
                                  className="document-name__link"
                                  to={documentViewerPath(document.documentId)}
                                >
                                  {document.originalName}
                                </Link>
                              ) : (
                                <span>
                                  {document.originalName}{' '}
                                  <span className="documents-muted">
                                    (supprimé)
                                  </span>
                                </span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </td>
                      <td>
                        {batch.completedAt
                          ? formatDateTime(batch.completedAt)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={batchPage}
            totalPages={batchesTotalPages}
            loading={batchesLoading}
            label="Pagination de l'historique des impressions"
            onChange={setBatchPage}
          />
        </section>
      )}
    </div>
  );
}
