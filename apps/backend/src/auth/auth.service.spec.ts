import {
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';

import type { SupabaseService } from '../supabase/supabase.service.js';
import { AuthService } from './auth.service.js';

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

describe('AuthService', () => {
  const getUser = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn();
  const select = vi.fn();
  const from = vi.fn();

  const supabase = {
    getClient: () => ({ auth: { getUser }, from }),
  } as unknown as SupabaseService;

  let service: AuthService;

  const activeProfile: ProfileRow = {
    id: 'user-1',
    full_name: 'Admin Test',
    email: 'admin@example.com',
    role: 'admin',
    is_active: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ maybeSingle });
    from.mockReturnValue({ select });
    service = new AuthService(supabase);
  });

  describe('verifyAccessToken', () => {
    it('refuse un token invalide ou expire', async () => {
      getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid JWT' },
      });

      await expect(service.verifyAccessToken('bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('retourne l utilisateur pour un token valide', async () => {
      const user = { id: 'user-1' } as User;
      getUser.mockResolvedValue({ data: { user }, error: null });

      await expect(service.verifyAccessToken('good-token')).resolves.toBe(user);
      expect(getUser).toHaveBeenCalledWith('good-token');
    });
  });

  describe('getActiveAdmin', () => {
    it('retourne le profil admin actif', async () => {
      maybeSingle.mockResolvedValue({ data: activeProfile, error: null });

      await expect(service.getActiveAdmin('user-1')).resolves.toEqual({
        id: 'user-1',
        fullName: 'Admin Test',
        email: 'admin@example.com',
        role: 'admin',
      });
    });

    it('refuse un compte sans profil administrateur', async () => {
      maybeSingle.mockResolvedValue({ data: null, error: null });

      await expect(service.getActiveAdmin('user-2')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuse un compte administrateur desactive', async () => {
      maybeSingle.mockResolvedValue({
        data: { ...activeProfile, is_active: false },
        error: null,
      });

      await expect(service.getActiveAdmin('user-1')).rejects.toThrow(
        'Ce compte administrateur est desactive.',
      );
    });

    it('refuse un profil sans role administrateur', async () => {
      maybeSingle.mockResolvedValue({
        data: { ...activeProfile, role: 'student' },
        error: null,
      });

      await expect(service.getActiveAdmin('user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('signale une erreur de lecture de la base', async () => {
      maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'connection refused' },
      });

      await expect(service.getActiveAdmin('user-1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
