import type {
  CreateSessionInput,
  CreatedPrintSession,
  PrintSession,
  PublicPrintSession,
} from '../../types/session';
import type {
  FinalizedDocument,
  UploadAuthorization,
} from '../../types/upload';
import { apiClient } from './client';

export async function listSessions(): Promise<PrintSession[]> {
  const { data } = await apiClient.get<PrintSession[]>('/sessions');
  return data;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<CreatedPrintSession> {
  const { data } = await apiClient.post<CreatedPrintSession>(
    '/sessions',
    input,
  );
  return data;
}

export async function closeSession(id: string): Promise<PrintSession> {
  const { data } = await apiClient.post<PrintSession>(`/sessions/${id}/close`);
  return data;
}

export async function renewSession(
  id: string,
  input: CreateSessionInput,
): Promise<CreatedPrintSession> {
  const { data } = await apiClient.post<CreatedPrintSession>(
    `/sessions/${id}/renew`,
    input,
  );
  return data;
}

export async function getPublicSession(
  token: string,
): Promise<PublicPrintSession> {
  const { data } = await apiClient.get<PublicPrintSession>(
    `/public/sessions/${encodeURIComponent(token)}`,
  );
  return data;
}

export async function authorizeUpload(
  token: string,
  fileName: string,
  sizeBytes: number,
): Promise<UploadAuthorization> {
  const { data } = await apiClient.post<UploadAuthorization>(
    `/public/sessions/${encodeURIComponent(token)}/uploads`,
    { fileName, sizeBytes },
  );
  return data;
}

export async function finalizeUpload(
  token: string,
  intentId: string,
): Promise<FinalizedDocument> {
  const { data } = await apiClient.post<FinalizedDocument>(
    `/public/sessions/${encodeURIComponent(token)}/uploads/${encodeURIComponent(intentId)}/finalize`,
  );
  return data;
}
