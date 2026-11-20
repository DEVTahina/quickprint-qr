export type PrintBatchStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Lot d'impression renvoye par l'API. */
export interface PrintBatch {
  id: string;
  totalDocuments: number;
  status: PrintBatchStatus;
  createdAt: string;
  completedAt: string | null;
}

/** Cloture d'un lot : documents effectivement passes en imprime. */
export interface PrintBatchCompletion extends PrintBatch {
  markedPrinted: number;
}

/** Document d'un lot, conserve dans l'ordre d'impression. */
export interface PrintBatchDocumentSummary {
  documentId: string;
  originalName: string;
  printOrder: number;
  status: 'received' | 'printed' | 'deleted';
}

/** Lot enrichi de sa composition pour l'historique. */
export interface PrintBatchHistoryItem extends PrintBatch {
  documents: PrintBatchDocumentSummary[];
}

/** Reponse paginee de GET /print-batches. */
export interface PrintBatchPage {
  items: PrintBatchHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Criteres de l'historique des lots. */
export interface PrintBatchFilters {
  status?: PrintBatchStatus;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}
