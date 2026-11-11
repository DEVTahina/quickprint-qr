import { createHash } from 'node:crypto';

import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { AdminProfile } from '../auth/types/admin-profile.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { SessionsService } from './sessions.service.js';

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
}

type QueryChain = Record<string, ReturnType<typeof vi.fn>>;

function createChain(result: QueryResult = { data: null, error: null }): QueryChain {
  const chain: QueryChain = {};

  for (const method of [
    'select',
    'insert',
    'update',
    'eq',
    'gt',
    'order',
    'limit',
    'single',
    'maybeSingle',
    'then',
  ]) {
    chain[method] = vi.fn();
  }

  for (const method of ['select', 'insert', 'update', 'eq', 'gt', 'order']) {
    chain[method].mockReturnValue(chain);
  }

  chain.limit.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  chain.maybeSingle.mockResolvedValue(result);
  chain.then.mockImplementation((resolve: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(resolve),
  );

  return chain;
}

describe('SessionsService', () => {
  const from = vi.fn();
  const supabase = {
    getClient: () => ({ from }),
  } as unknown as SupabaseService;

  const admin: AdminProfile = {
    id: 'admin-1',
    fullName: 'Admin Test',
    email: 'admin@example.com',
    role: 'admin',
  };

  const now = new Date('2026-11-11T15:00:00.000Z');

  function sessionRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'session-1',
      status: 'active',
      expires_at: new Date(now.getTime() + 3_600_000).toISOString(),
      max_files: 5,
      created_at: now.toISOString(),
      closed_at: null,
      ...overrides,
    };
  }

  let service: SessionsService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new SessionsService(supabase);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('stocke uniquement le hash et retourne le token brut une fois', async () => {
      const closeChain = createChain({ error: null });
      const insertChain = createChain({
        data: sessionRow({ max_files: 8 }),
        error: null,
      });
      from.mockReturnValueOnce(closeChain).mockReturnValueOnce(insertChain);

      const result = await service.create(admin, {
        expiresInMinutes: 60,
        maxFiles: 8,
      });

      expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(result.session).not.toHaveProperty('token');
      expect(result.session.status).toBe('active');
      expect(result.session.maxFiles).toBe(8);

      expect(closeChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'closed' }),
      );
      expect(insertChain.insert).toHaveBeenCalledWith({
        created_by: admin.id,
        token_hash: createHash('sha256').update(result.token).digest('hex'),
        expires_at: new Date(now.getTime() + 3_600_000).toISOString(),
        max_files: 8,
      });
    });

    it('applique les valeurs par defaut', async () => {
      const closeChain = createChain({ error: null });
      const insertChain = createChain({
        data: sessionRow({ max_files: 5 }),
        error: null,
      });
      from.mockReturnValueOnce(closeChain).mockReturnValueOnce(insertChain);

      await service.create(admin, {});

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          max_files: 5,
          expires_at: new Date(now.getTime() + 7_200_000).toISOString(),
        }),
      );
    });

    it('signale une erreur de creation', async () => {
      from
        .mockReturnValueOnce(createChain({ error: null }))
        .mockReturnValueOnce(
          createChain({ data: null, error: { message: 'insert failed' } }),
        );

      await expect(service.create(admin, {})).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('list', () => {
    it('calcule les statuts actif, expire et ferme sans exposer le token', async () => {
      const rows = [
        sessionRow({ id: 'active' }),
        sessionRow({
          id: 'expired',
          expires_at: new Date(now.getTime() - 60_000).toISOString(),
        }),
        sessionRow({
          id: 'closed',
          status: 'closed',
          closed_at: now.toISOString(),
        }),
      ];
      from.mockReturnValue(createChain({ data: rows, error: null }));

      const result = await service.list(admin.id);

      expect(result.map((session) => session.status)).toEqual([
        'active',
        'expired',
        'closed',
      ]);
      expect(result[0]).not.toHaveProperty('token');
    });

    it('signale une erreur de lecture', async () => {
      from.mockReturnValue(
        createChain({ data: null, error: { message: 'read failed' } }),
      );

      await expect(service.list(admin.id)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('findOne', () => {
    it("ne retourne pas une session appartenant a un autre administrateur", async () => {
      const chain = createChain({ data: null, error: null });
      from.mockReturnValue(chain);

      await expect(service.findOne(admin.id, 'session-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(chain.eq).toHaveBeenCalledWith('created_by', admin.id);
    });
  });

  describe('close', () => {
    it('ferme une session active', async () => {
      const fetchChain = createChain({ data: sessionRow(), error: null });
      const updateChain = createChain({ data: [{ id: 'session-1' }], error: null });
      from.mockReturnValueOnce(fetchChain).mockReturnValueOnce(updateChain);

      const result = await service.close(admin.id, 'session-1');

      expect(result.status).toBe('closed');
      expect(result.closedAt).toBe(now.toISOString());
      expect(updateChain.update).toHaveBeenCalledWith({
        status: 'closed',
        closed_at: now.toISOString(),
      });
    });

    it('refuse une session deja fermee', async () => {
      from.mockReturnValue(
        createChain({
          data: sessionRow({ status: 'closed', closed_at: now.toISOString() }),
          error: null,
        }),
      );

      await expect(service.close(admin.id, 'session-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('refuse une session expiree', async () => {
      from.mockReturnValue(
        createChain({
          data: sessionRow({
            expires_at: new Date(now.getTime() - 1_000).toISOString(),
          }),
          error: null,
        }),
      );

      await expect(service.close(admin.id, 'session-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('renew', () => {
    it('ferme l ancienne session et retourne un nouveau token', async () => {
      const fetchChain = createChain({
        data: sessionRow({ max_files: 8 }),
        error: null,
      });
      const closeChain = createChain({ error: null });
      const insertChain = createChain({
        data: sessionRow({ id: 'session-2', max_files: 8 }),
        error: null,
      });
      from
        .mockReturnValueOnce(fetchChain)
        .mockReturnValueOnce(closeChain)
        .mockReturnValueOnce(insertChain);

      const result = await service.renew(admin, 'session-1', {});

      expect(result.session.id).toBe('session-2');
      expect(result.session.maxFiles).toBe(8);
      expect(result.token).toHaveLength(43);
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ max_files: 8 }),
      );
    });

    it('refuse de renouveler une session fermee', async () => {
      from.mockReturnValue(
        createChain({
          data: sessionRow({ status: 'closed', closed_at: now.toISOString() }),
          error: null,
        }),
      );

      await expect(service.renew(admin, 'session-1', {})).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('inspectToken', () => {
    it('refuse un token mal forme sans interroger la base', async () => {
      await expect(service.inspectToken('invalid')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(from).not.toHaveBeenCalled();
    });

    it('refuse un token inconnu', async () => {
      from.mockReturnValue(createChain({ data: null, error: null }));

      await expect(
        service.inspectToken('A'.repeat(43)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('valide une session active', async () => {
      from.mockReturnValue(
        createChain({ data: sessionRow(), error: null }),
      );

      await expect(service.inspectToken('A'.repeat(43))).resolves.toEqual({
        valid: true,
        status: 'active',
        expiresAt: sessionRow().expires_at,
        maxFiles: 5,
      });
    });

    it('refuse une session expiree', async () => {
      from.mockReturnValue(
        createChain({
          data: sessionRow({
            expires_at: new Date(now.getTime() - 1_000).toISOString(),
          }),
          error: null,
        }),
      );

      await expect(service.inspectToken('A'.repeat(43))).resolves.toEqual(
        expect.objectContaining({ valid: false, status: 'expired' }),
      );
    });

    it('refuse une session fermee', async () => {
      from.mockReturnValue(
        createChain({
          data: sessionRow({
            status: 'closed',
            closed_at: now.toISOString(),
          }),
          error: null,
        }),
      );

      await expect(service.inspectToken('A'.repeat(43))).resolves.toEqual(
        expect.objectContaining({ valid: false, status: 'closed' }),
      );
    });
  });
});
