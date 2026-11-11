/** Statut effectif d'une session de reception. */
export type PrintSessionStatus = 'active' | 'expired' | 'closed';

/** Metadonnees d'une session, sans token secret. */
export interface PrintSession {
  id: string;
  status: PrintSessionStatus;
  expiresAt: string;
  maxFiles: number;
  createdAt: string;
  closedAt: string | null;
}

/** Reponse de creation ou de renouvellement : le token n'apparait qu'ici. */
export interface CreatedPrintSession {
  session: PrintSession;
  token: string;
}

/** Reponse publique utilisee par la page ouverte apres le scan du QR Code. */
export interface PublicPrintSession {
  valid: boolean;
  status: PrintSessionStatus;
  expiresAt: string;
  maxFiles: number;
}

export interface CreateSessionInput {
  expiresInMinutes: number;
  maxFiles: number;
}
