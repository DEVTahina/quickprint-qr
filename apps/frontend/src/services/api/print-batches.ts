import type {
  PrintBatch,
  PrintBatchCompletion,
  PrintBatchFilters,
  PrintBatchPage,
} from '../../types/print-batch';
import { apiClient } from './client';

/** Historique pagine des lots, avec leur composition ordonnee. */
export async function listPrintBatches(
  filters: PrintBatchFilters,
): Promise<PrintBatchPage> {
  const params: Record<string, string | number> = {
    sort: filters.sort ?? 'desc',
    page: filters.page,
    pageSize: filters.pageSize,
  };

  if (filters.status) {
    params.status = filters.status;
  }

  if (filters.dateFrom) {
    params.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    params.dateTo = filters.dateTo;
  }

  const { data } = await apiClient.get<PrintBatchPage>('/print-batches', {
    params,
  });
  return data;
}

/** Enregistre un lot dans l'ordre d'impression demande. */
export async function createPrintBatch(
  documentIds: string[],
): Promise<PrintBatch> {
  const { data } = await apiClient.post<PrintBatch>('/print-batches', {
    documentIds,
  });
  return data;
}

/** Cloture le lot ; `markPrinted` reste une decision de l'administrateur. */
export async function completePrintBatch(
  batchId: string,
  markPrinted: boolean,
): Promise<PrintBatchCompletion> {
  const { data } = await apiClient.patch<PrintBatchCompletion>(
    `/print-batches/${encodeURIComponent(batchId)}/complete`,
    { markPrinted },
  );
  return data;
}
