/** Statuts prevus par l'enum PostgreSQL `print_batch_status`. */
export type PrintBatchStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Lot d'impression tel que renvoye par l'API. */
export interface PrintBatch {
  id: string;
  totalDocuments: number;
  status: PrintBatchStatus;
  createdAt: string;
  completedAt: string | null;
}

/** Cloture d'un lot, avec le nombre de documents passes en imprime. */
export interface PrintBatchCompletion extends PrintBatch {
  markedPrinted: number;
}

/** Document d'un lot, dans l'ordre d'impression conserve. */
export interface PrintBatchDocumentSummary {
  documentId: string;
  originalName: string;
  printOrder: number;
  status: 'received' | 'printed' | 'deleted';
}

/** Lot enrichi de sa composition, pour la page d'historique. */
export interface PrintBatchHistoryItem extends PrintBatch {
  documents: PrintBatchDocumentSummary[];
}

/** Page de lots d'impression filtres. */
export interface PrintBatchPage {
  items: PrintBatchHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const MAX_BATCH_DOCUMENTS = 100;
