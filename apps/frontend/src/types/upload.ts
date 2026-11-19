/** Autorisation temporaire renvoyée par le backend avant l'envoi direct. */
export interface UploadAuthorization {
  intentId: string;
  signedUrl: string;
  token: string;
  path: string;
  expiresAt: string;
}

/** Document confirmé après vérification du PDF par le backend. */
export interface FinalizedDocument {
  id: string;
  originalName: string;
  sizeBytes: number;
  uploadedAt: string;
}
