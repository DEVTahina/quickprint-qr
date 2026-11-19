import type { PrintSessionStatus } from '../../sessions/types/print-session.js';

export type DocumentStatus = 'received' | 'printed' | 'deleted';

/** Statuts qu'un administrateur peut appliquer depuis la liste. */
export type MutableDocumentStatus = Exclude<DocumentStatus, 'deleted'>;

export type DocumentSortOrder = 'asc' | 'desc';

/** Session d'origine d'un document, sans token secret. */
export interface DocumentSession {
  id: string;
  createdAt: string;
  status: PrintSessionStatus;
}

/** Metadonnees d'un PDF depose, sans chemin de stockage. */
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

/** Acces temporaire a un PDF prive, sans exposer le chemin de stockage. */
export interface DocumentPreview {
  id: string;
  url: string;
  expiresAt: string;
}

/** Resultat d'un changement de statut individuel ou groupe. */
export interface DocumentStatusUpdate {
  updated: number;
}

/** Resultat d'une suppression individuelle ou groupee. */
export interface DocumentDeletion {
  deleted: number;
}

/** Page de resultats renvoyee a l'espace administrateur. */
export interface DocumentPage {
  items: DocumentSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
