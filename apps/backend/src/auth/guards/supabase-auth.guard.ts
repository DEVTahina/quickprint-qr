import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthService } from '../auth.service.js';
import type { AuthenticatedRequest } from '../types/authenticated-request.js';

/**
 * Guard des routes administrateur.
 *
 * 1. Extrait le token Bearer de l'en-tete Authorization.
 * 2. Le fait verifier par Supabase Auth.
 * 3. Verifie dans admin_profiles que le compte est admin et actif.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException(
        "Token d'authentification manquant.",
      );
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException(
        "En-tete Authorization invalide : format Bearer attendu.",
      );
    }

    const user = await this.authService.verifyAccessToken(token);
    const admin = await this.authService.getActiveAdmin(user.id);

    request.admin = admin;

    return true;
  }
}
