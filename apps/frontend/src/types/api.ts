/** Reponse de la route GET /health du backend. */
export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
}

/** Format d'erreur renvoye par l'API NestJS. */
export interface ApiErrorPayload {
  statusCode: number;
  message: string | string[];
  error?: string;
}
