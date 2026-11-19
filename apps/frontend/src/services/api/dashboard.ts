import type { DashboardSummary } from '../../types/dashboard';
import { apiClient } from './client';

/** Compteurs du tableau de bord, limites aux sessions de l'administrateur. */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>('/dashboard/summary');
  return data;
}
