import type { Request } from 'express';

import type { AdminProfile } from './admin-profile.js';

/** Requete HTTP dont le profil admin a ete valide par le guard. */
export interface AuthenticatedRequest extends Request {
  admin?: AdminProfile;
}
