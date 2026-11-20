import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { SupabaseService } from '../supabase/supabase.service.js';
import { MaintenanceService } from './maintenance.service.js';

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
}

type QueryChain = Record<string, ReturnType<typeof vi.fn>>;

function createChain(result: QueryResult = { data: null, error: null }): QueryChain {
  const chain: QueryChain = {};

  for (const method of [
    'update',
    'eq',
    'lte',
    'select',
    'limit',
    'is',
    'delete',
    'in',
    'then',
  ]) {
    chain[method] = vi.fn();
  }

  for (const method of [
    'update',
    'eq',
    'lte',
    'select',
    'limit',
    'is',
    'delete',
    'in',
  ]) {
    chain[method].mockReturnValue(chain);
  }

  chain.then.mockImplementation((resolve: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(resolve),
  );

  return chain;
}

describe('MaintenanceService', () => {
  const now = new Date('2026-11-19T12:00:00.000Z');
  const from = vi.fn();
  const remove = vi.fn();
  const storageFrom = vi.fn(() => ({ remove }));
  const supabase = {
    getClient: () => ({
      from,
      storage: { from: storageFrom },
    }),
  } as unknown as SupabaseService;
  const config = {
    get: (key: string) => (key === 'NODE_ENV' ? 'test' : undefined),
  } as unknown as ConfigService;

  let service: MaintenanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    remove.mockResolvedValue({ error: null });
    service = new MaintenanceService(supabase, config);
  });

  it('expire les sessions depassees et nettoie les envois abandonnes', async () => {
    const expired = createChain({
      data: [{ id: 'session-1' }, { id: 'session-2' }],
      error: null,
    });
    const intents = createChain({
      data: [
        {
          id: 'intent-1',
          storage_path: 'sessions/session-1/intent-1.pdf',
        },
      ],
      error: null,
    });
    const deleted = createChain({ data: null, error: null });

    from
      .mockReturnValueOnce(expired)
      .mockReturnValueOnce(intents)
      .mockReturnValueOnce(deleted);

    const result = await service.run(now);

    expect(expired.eq).toHaveBeenCalledWith('status', 'active');
    expect(expired.lte).toHaveBeenCalledWith(
      'expires_at',
      now.toISOString(),
    );
    expect(intents.is).toHaveBeenCalledWith('consumed_at', null);
    expect(storageFrom).toHaveBeenCalledWith('quickprint-documents');
    expect(remove).toHaveBeenCalledWith([
      'sessions/session-1/intent-1.pdf',
    ]);
    expect(deleted.in).toHaveBeenCalledWith('id', ['intent-1']);
    expect(result).toEqual({ expiredSessions: 2, deletedIntents: 1 });
  });

  it('conserve les envois si le stockage ne peut pas etre nettoye', async () => {
    const expired = createChain({ data: [], error: null });
    const intents = createChain({
      data: [{ id: 'intent-1', storage_path: 'sessions/session-1/a.pdf' }],
      error: null,
    });

    from.mockReturnValueOnce(expired).mockReturnValueOnce(intents);
    remove.mockResolvedValue({ error: { message: 'storage' } });

    const result = await service.run(now);

    expect(from).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ expiredSessions: 0, deletedIntents: 0 });
  });

  it('ne bloque pas le nettoyage des envois si les sessions echouent', async () => {
    const expired = createChain({
      data: null,
      error: { message: 'db' },
    });
    const intents = createChain({ data: [], error: null });

    from.mockReturnValueOnce(expired).mockReturnValueOnce(intents);

    const result = await service.run(now);

    expect(result).toEqual({ expiredSessions: 0, deletedIntents: 0 });
  });

  it('ignore un declenchement concurrent', async () => {
    const expired = createChain({ data: [], error: null });
    const intents = createChain({ data: [], error: null });

    from.mockReturnValueOnce(expired).mockReturnValueOnce(intents);

    const [first, second] = await Promise.all([service.run(now), service.run(now)]);

    // Le second appel voit `running=true` et ne lance aucune requete.
    expect(first.expiredSessions).toBe(0);
    expect(second.expiredSessions).toBe(0);
    expect(from).toHaveBeenCalledTimes(2);
  });
});
