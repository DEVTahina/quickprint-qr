import type {
  DocumentDeletion,
  DocumentFilters,
  DocumentPage,
  DocumentPreview,
  DocumentStatusUpdate,
  MutableDocumentStatus,
} from '../../types/document';
import { apiClient } from './client';

/** Liste paginee des documents, filtres combines cote serveur. */
export async function listDocuments(
  filters: DocumentFilters,
): Promise<DocumentPage> {
  const params: Record<string, string | number> = {
    sort: filters.sort,
    page: filters.page,
    pageSize: filters.pageSize,
  };

  if (filters.search) {
    params.search = filters.search;
  }

  if (filters.status) {
    params.status = filters.status;
  }

  if (filters.sessionId) {
    params.sessionId = filters.sessionId;
  }

  if (filters.dateFrom) {
    params.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    params.dateTo = filters.dateTo;
  }

  const { data } = await apiClient.get<DocumentPage>('/documents', { params });
  return data;
}

/** Demande une URL signee de 60 secondes pour consulter un PDF prive. */
export async function previewDocument(id: string): Promise<DocumentPreview> {
  const { data } = await apiClient.get<DocumentPreview>(
    `/documents/${encodeURIComponent(id)}/preview`,
  );
  return data;
}

/** Applique le statut recu ou imprime a une selection de documents. */
export async function updateDocumentsStatus(
  ids: string[],
  status: MutableDocumentStatus,
): Promise<DocumentStatusUpdate> {
  const { data } = await apiClient.patch<DocumentStatusUpdate>('/documents/status', {
    ids,
    status,
  });
  return data;
}

/** Supprime logiquement les documents et retire les fichiers du stockage. */
export async function deleteDocuments(
  ids: string[],
): Promise<DocumentDeletion> {
  const { data } = await apiClient.post<DocumentDeletion>('/documents/delete', {
    ids,
  });
  return data;
}
