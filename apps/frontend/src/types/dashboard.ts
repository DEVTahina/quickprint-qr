/** Compteurs renvoyes par GET /dashboard/summary. */
export interface DashboardSummary {
  received: number;
  pending: number;
  printed: number;
  activeSessions: number;
}
