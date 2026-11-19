import { InternalServerErrorException, Logger } from '@nestjs/common';

import type { SupabaseService } from '../supabase/supabase.service.js';
import { DashboardService } from './dashboard.service.js';

interface Chain {
  [method: string]: ReturnType<typeof vi.fn> | unknown;
}

function createChain(count: number): Chain {
  const chain: Chain = {};
  for (const method of ['select', 'eq', 'neq', 'gt']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ count, error: null }).then(resolve);
  return chain;
}

describe('DashboardService', () => {
  const from = vi.fn();
  const supabase = {
    getClient: () => ({ from }),
  } as unknown as SupabaseService;

  const adminId = 'admin-1';
  let service: DashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new DashboardService(supabase);
  });

  it('compte les documents et les sessions actives de l administrateur', async () => {
    const received = createChain(3);
    const pending = createChain(2);
    const printed = createChain(1);
    const sessions = createChain(2);

    from
      .mockReturnValueOnce(received)
      .mockReturnValueOnce(pending)
      .mockReturnValueOnce(printed)
      .mockReturnValueOnce(sessions);

    await expect(service.summary(adminId)).resolves.toEqual({
      received: 3,
      pending: 2,
      printed: 1,
      activeSessions: 2,
    });

    expect(received.eq).toHaveBeenCalledWith(
      'print_sessions.created_by',
      adminId,
    );
    expect(received.neq).toHaveBeenCalledWith('status', 'deleted');
    expect(pending.eq).toHaveBeenCalledWith('status', 'received');
    expect(printed.eq).toHaveBeenCalledWith('status', 'printed');
    expect(sessions.eq).toHaveBeenCalledWith('created_by', adminId);
    expect(sessions.eq).toHaveBeenCalledWith('status', 'active');
    expect(sessions.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
    expect(from).toHaveBeenNthCalledWith(4, 'print_sessions');
  });

  it('remonte une erreur serveur si un comptage echoue', async () => {
    const failing: Chain = {
      select: vi.fn(),
      eq: vi.fn(),
      neq: vi.fn(),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ count: null, error: { message: 'timeout' } }).then(
          resolve,
        ),
    };
    (failing.select as ReturnType<typeof vi.fn>).mockReturnValue(failing);
    (failing.eq as ReturnType<typeof vi.fn>).mockReturnValue(failing);
    (failing.neq as ReturnType<typeof vi.fn>).mockReturnValue(failing);

    from
      .mockReturnValueOnce(failing)
      .mockReturnValueOnce(createChain(0))
      .mockReturnValueOnce(createChain(0))
      .mockReturnValueOnce(createChain(0));

    await expect(service.summary(adminId)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
