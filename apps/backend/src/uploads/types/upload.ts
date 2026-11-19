/** Session minimale nécessaire pour autoriser un envoi. */
export interface UploadSessionAccess {
  id: string;
  status: 'active' | 'expired' | 'closed';
  expiresAt: string;
  maxFiles: number;
}

/** Autorisation temporaire d'envoi direct vers Supabase Storage. */
export interface UploadAuthorization {
  intentId: string;
  signedUrl: string;
  token: string;
  path: string;
  expiresAt: string;
}

/** Document créé après vérification réelle du PDF. */
export interface FinalizedDocument {
  id: string;
  originalName: string;
  sizeBytes: number;
  uploadedAt: string;
}
