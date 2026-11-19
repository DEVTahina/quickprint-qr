import type { PrintSessionStatus } from './session';

/** Statut d'un PDF depose. */
export type DocumentStatus = 'received' | 'printed' | 'deleted';

export type DocumentSortOrder = 'asc' | 'desc';

/** Statuts applicables depuis la liste ; la suppression a son propre flux. */
export type MutableDocumentStatus = Exclude<DocumentStatus, 'deleted'>;

/** Session d'origine d'un document, sans token secret. */
export interface DocumentSession {
  id: string;
  createdAt: string;
  status: PrintSessionStatus;
}

/** Metadonnees d'un document renvoyees par l'API. */
export interface DocumentSummary {
  id: string;
  sessionId: string;
  session: DocumentSession | null;
  originalName: string;
  sizeBytes: number;
  pagesCount: number | null;
  status: DocumentStatus;
  uploadedAt: string;
  printedAt: string | null;
  deletedAt: string | null;
}

/** Reponse paginee de GET /documents. */
export interface DocumentPage {
  items: DocumentSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** URL signee temporaire renvoyee par GET /documents/:id/preview. */
export interface DocumentPreview {
  id: string;
  url: string;
  expiresAt: string;
}

/** Resultat d'une action groupee. */
export interface DocumentStatusUpdate {
  updated: number;
}

export interface DocumentDeletion {
  deleted: number;
}

/** Criteres envoyes au backend : tous combines avec un ET logique. */
export interface DocumentFilters {
  search?: string;
  status?: DocumentStatus;
  sessionId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort: DocumentSortOrder;
  page: number;
  pageSize: number;
}
