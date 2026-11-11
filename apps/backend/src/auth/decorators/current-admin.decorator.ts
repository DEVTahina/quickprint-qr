import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import type { AdminProfile } from '../types/admin-profile.js';
import type { AuthenticatedRequest } from '../types/authenticated-request.js';

/** Recupere le profil admin attache a la requete par SupabaseAuthGuard. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminProfile => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.admin) {
      throw new UnauthorizedException('Administrateur non authentifie.');
    }

    return request.admin;
  },
);
