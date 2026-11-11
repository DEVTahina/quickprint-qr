import axios from 'axios';

import type { ApiErrorPayload } from '../types/api';

export interface ApiErrorInfo {
  status?: number;
  message?: string;
}

/** Extrait le statut et le message d'une erreur renvoyee par l'API NestJS. */
export function getApiError(error: unknown): ApiErrorInfo {
  if (!axios.isAxiosError<ApiErrorPayload>(error)) {
    return {};
  }

  const payload = error.response?.data;
  const message = Array.isArray(payload?.message)
    ? payload.message.join(' ')
    : payload?.message;

  return { status: error.response?.status, message };
}
