import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';

import { AuthService } from '../auth.service.js';
import type { AdminProfile } from '../types/admin-profile.js';
import type { AuthenticatedRequest } from '../types/authenticated-request.js';
import { SupabaseAuthGuard } from './supabase-auth.guard.js';

describe('SupabaseAuthGuard', () => {
  const verifyAccessToken = vi.fn();
  const getActiveAdmin = vi.fn();
  const authService = {
    verifyAccessToken,
    getActiveAdmin,
  } as unknown as AuthService;

  const guard = new SupabaseAuthGuard(authService);
  const admin: AdminProfile = {
    id: 'user-1',
    fullName: 'Admin Test',
    email: 'admin@example.com',
    role: 'admin',
  };

  let request: AuthenticatedRequest;
  let context: ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    request = { headers: {} } as AuthenticatedRequest;
    context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  });

  it('refuse une requete sans token', async () => {
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('refuse un en-tete Authorization mal forme', async () => {
    request.headers.authorization = 'Basic abc';

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuse un token invalide ou expire', async () => {
    request.headers.authorization = 'Bearer bad-token';
    verifyAccessToken.mockRejectedValue(
      new UnauthorizedException('Session invalide ou expiree.'),
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(getActiveAdmin).not.toHaveBeenCalled();
  });

  it('refuse un compte non autorise ou inactif', async () => {
    request.headers.authorization = 'Bearer valid-token';
    verifyAccessToken.mockResolvedValue({ id: 'user-2' });
    getActiveAdmin.mockRejectedValue(
      new ForbiddenException('Ce compte administrateur est desactive.'),
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('attache le profil admin et autorise l acces', async () => {
    request.headers.authorization = 'Bearer valid-token';
    verifyAccessToken.mockResolvedValue({ id: 'user-1' });
    getActiveAdmin.mockResolvedValue(admin);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(getActiveAdmin).toHaveBeenCalledWith('user-1');
    expect(request.admin).toEqual(admin);
  });
});
