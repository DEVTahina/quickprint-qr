/** Compteurs affiches sur le tableau de bord administrateur. */
export interface DashboardSummary {
  /** Documents non supprimes, toutes sessions confondues. */
  received: number;
  /** Documents encore en attente d'impression. */
  pending: number;
  /** Documents marques comme imprimes. */
  printed: number;
  /** Sessions actives et non expirees. */
  activeSessions: number;
}
