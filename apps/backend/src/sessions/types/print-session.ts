/** Statut effectif d'une session, calcule a partir des dates si necessaire. */
export type PrintSessionStatus = 'active' | 'expired' | 'closed';

/** Metadonnees d'une session exposees a l'administrateur. */
export interface PrintSessionSummary {
  id: string;
  status: PrintSessionStatus;
  expiresAt: string;
  maxFiles: number;
  createdAt: string;
  closedAt: string | null;
}

/**
 * Session creee : le token brut est present uniquement dans cette reponse.
 * Il n'est jamais stocke en clair ni renvoye par les routes de lecture.
 */
export interface CreatedPrintSession {
  session: PrintSessionSummary;
  token: string;
}

/** Informations non sensibles exposees a la page publique du QR Code. */
export interface PublicPrintSession {
  valid: boolean;
  status: PrintSessionStatus;
  expiresAt: string;
  maxFiles: number;
}
