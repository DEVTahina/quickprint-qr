import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';

import { SupabaseService } from '../supabase/supabase.service.js';
import type { AdminProfile } from './types/admin-profile.js';

interface AdminProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Verifie le JWT aupres de Supabase Auth. Une simple decodification locale
   * ne suffit pas : le token doit etre valide, non expire et non revoque.
   */
  async verifyAccessToken(accessToken: string): Promise<User> {
    const { data, error } = await this.supabase
      .getClient()
      .auth.getUser(accessToken);

    if (error || !data.user) {
      throw new UnauthorizedException('Session invalide ou expiree.');
    }

    return data.user;
  }

  /**
   * Verifie que l'utilisateur Auth possede un profil admin actif.
   * Le role et l'activation sont lus en base, jamais dans le token.
   */
  async getActiveAdmin(userId: string): Promise<AdminProfile> {
    const { data, error } = await this.supabase
      .getClient()
      .from('admin_profiles')
      .select('id, full_name, email, role, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Impossible de verifier le profil administrateur : ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Impossible de verifier les droits administrateur.',
      );
    }

    const profile = data as AdminProfileRow | null;

    if (!profile) {
      throw new ForbiddenException(
        "Ce compte n'est pas autorise a acceder a l'espace administrateur.",
      );
    }

    if (!profile.is_active) {
      throw new ForbiddenException('Ce compte administrateur est desactive.');
    }

    if (profile.role !== 'admin') {
      throw new ForbiddenException(
        "Ce compte ne dispose pas du role administrateur.",
      );
    }

    return {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      role: 'admin',
    };
  }
}
