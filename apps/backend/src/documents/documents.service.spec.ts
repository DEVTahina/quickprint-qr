import {
  BadRequestException,
  GoneException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { SupabaseService } from '../supabase/supabase.service.js';
import { DocumentsService } from './documents.service.js';

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

type QueryChain = Record<string, ReturnType<typeof vi.fn>>;

function createChain(
  result: QueryResult = { data: [], error: null, count: 0 },
  single?: QueryResult,
): QueryChain {
  const chain: QueryChain = {};

  for (const method of [
    'select',
    'eq',
    'neq',
    'in',
    'update',
    'ilike',
    'gte',
    'lte',
    'order',
    'range',
    'maybeSingle',
    'then',
  ]) {
    chain[method] = vi.fn();
  }

  for (const method of [
    'select',
    'eq',
    'neq',
    'in',
    'update',
    'ilike',
    'gte',
    'lte',
    'order',
    'range',
  ]) {
    chain[method].mockReturnValue(chain);
  }

  chain.maybeSingle.mockResolvedValue(single ?? { data: null, error: null });

  chain.then.mockImplementation((resolve: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(resolve),
  );

  return chain;
}

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    session_id: 'session-1',
    original_name: 'QTC-WT-2026-00293069-a4.pdf',
    size_bytes: 1_281_272,
    pages_count: null,
    status: 'received',
    uploaded_at: '2026-11-19T08:32:52.117Z',
    printed_at: null,
    deleted_at: null,
    print_sessions: {
      id: 'session-1',
      created_at: '2026-11-19T08:31:24.860Z',
      status: 'closed',
      created_by: 'admin-1',
    },
    ...overrides,
  };
}

describe('DocumentsService', () => {
  const from = vi.fn();
  const storageFrom = vi.fn();
  const supabase = {
    getClient: () => ({
      from,
      storage: { from: storageFrom },
    }),
  } as unknown as SupabaseService;

  const adminId = 'admin-1';

  let service: DocumentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new DocumentsService(supabase);
  });

  it('combine les filtres, trie par date decroissante et pagine', async () => {
    const chain = createChain({
      data: [documentRow()],
      error: null,
      count: 1,
    });
    from.mockReturnValueOnce(chain);

    const result = await service.list(adminId, {
      search: 'QTC',
      status: 'received',
      sessionId: 'session-1',
      dateFrom: '2026-11-01T00:00:00.000Z',
      dateTo: '2026-11-30T23:59:59.999Z',
      page: 2,
      pageSize: 10,
    });

    expect(chain.eq).toHaveBeenCalledWith('print_sessions.created_by', adminId);
    expect(chain.eq).toHaveBeenCalledWith('status', 'received');
    expect(chain.eq).toHaveBeenCalledWith('session_id', 'session-1');
    expect(chain.ilike).toHaveBeenCalledWith('original_name', '%QTC%');
    expect(chain.gte).toHaveBeenCalledWith(
      'uploaded_at',
      '2026-11-01T00:00:00.000Z',
    );
    expect(chain.lte).toHaveBeenCalledWith(
      'uploaded_at',
      '2026-11-30T23:59:59.999Z',
    );
    expect(chain.order).toHaveBeenCalledWith('uploaded_at', {
      ascending: false,
    });
    expect(chain.range).toHaveBeenCalledWith(10, 19);

    expect(result).toEqual({
      items: [
        {
          id: 'document-1',
          sessionId: 'session-1',
          session: {
            id: 'session-1',
            createdAt: '2026-11-19T08:31:24.860Z',
            status: 'closed',
          },
          originalName: 'QTC-WT-2026-00293069-a4.pdf',
          sizeBytes: 1_281_272,
          pagesCount: null,
          status: 'received',
          uploadedAt: '2026-11-19T08:32:52.117Z',
          printedAt: null,
          deletedAt: null,
        },
      ],
      total: 1,
      page: 2,
      pageSize: 10,
      totalPages: 1,
    });
  });

  it('trie par date croissante quand sort=asc', async () => {
    const chain = createChain({ data: [], error: null, count: 0 });
    from.mockReturnValueOnce(chain);

    await service.list(adminId, { sort: 'asc' });

    expect(chain.order).toHaveBeenCalledWith('uploaded_at', {
      ascending: true,
    });
    expect(chain.range).toHaveBeenCalledWith(0, 19);
  });

  it('neutralise les jokers LIKE de la recherche', async () => {
    const chain = createChain({ data: [], error: null, count: 0 });
    from.mockReturnValueOnce(chain);

    await service.list(adminId, { search: '100%_test' });

    expect(chain.ilike).toHaveBeenCalledWith(
      'original_name',
      '%100\\%\\_test%',
    );
  });

  it('refuse une periode inversee', async () => {
    await expect(
      service.list(adminId, {
        dateFrom: '2026-11-30T00:00:00.000Z',
        dateTo: '2026-11-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(from).not.toHaveBeenCalled();
  });

  it('remonte une erreur serveur si la base echoue', async () => {
    const chain = createChain({
      data: null,
      error: { message: 'timeout' },
      count: null,
    });
    from.mockReturnValueOnce(chain);

    await expect(service.list(adminId, {})).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('gere une session absente dans la jointure', async () => {
    const chain = createChain({
      data: [documentRow({ print_sessions: null })],
      error: null,
      count: 1,
    });
    from.mockReturnValueOnce(chain);

    const result = await service.list(adminId, {});

    expect(result.items[0]?.session).toBeNull();
    expect(result.total).toBe(1);
  });

  describe('preview', () => {
    const ownedRow = {
      id: 'document-1',
      storage_path: 'sessions/session-1/document-1.pdf',
      status: 'received',
      print_sessions: { created_by: adminId },
    };

    it('signe une URL temporaire pour un document de l administrateur', async () => {
      const chain = createChain(
        { data: null, error: null, count: null },
        { data: ownedRow, error: null },
      );
      const createSignedUrl = vi
        .fn()
        .mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null });
      from.mockReturnValueOnce(chain);
      storageFrom.mockReturnValueOnce({ createSignedUrl, remove: vi.fn() });

      const result = await service.preview(adminId, 'document-1');

      expect(chain.eq).toHaveBeenCalledWith(
        'print_sessions.created_by',
        adminId,
      );
      expect(createSignedUrl).toHaveBeenCalledWith(
        'sessions/session-1/document-1.pdf',
        60,
      );
      expect(result.url).toBe('https://signed');
      expect(result.id).toBe('document-1');
    });

    it('renvoie 404 pour un document inconnu', async () => {
      from.mockReturnValueOnce(createChain());

      await expect(
        service.preview(adminId, 'document-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse la consultation d un document supprime', async () => {
      from.mockReturnValueOnce(
        createChain(undefined, {
          data: { ...ownedRow, status: 'deleted' },
          error: null,
        }),
      );

      await expect(
        service.preview(adminId, 'document-1'),
      ).rejects.toBeInstanceOf(GoneException);
    });
  });

  describe('updateStatus', () => {
    it('applique le statut imprime et horodate la selection', async () => {
      const owned = createChain({
        data: [
          { id: 'document-1', storage_path: 'a.pdf', status: 'received' },
          { id: 'document-2', storage_path: 'b.pdf', status: 'received' },
        ],
        error: null,
      });
      const update = createChain({ data: null, error: null });
      from.mockReturnValueOnce(owned).mockReturnValueOnce(update);

      const result = await service.updateStatus(
        adminId,
        ['document-1', 'document-2', 'document-1'],
        'printed',
      );

      expect(result).toEqual({ updated: 2 });
      expect(update.update).toHaveBeenCalledWith({
        status: 'printed',
        printed_at: expect.any(String),
      });
      expect(update.in).toHaveBeenCalledWith('id', [
        'document-1',
        'document-2',
      ]);
    });

    it('refuse la selection si un document est hors perimetre', async () => {
      from.mockReturnValueOnce(
        createChain({
          data: [
            { id: 'document-1', storage_path: 'a.pdf', status: 'received' },
          ],
          error: null,
        }),
      );

      await expect(
        service.updateStatus(adminId, ['document-1', 'document-2'], 'printed'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse de changer le statut d un document supprime', async () => {
      from.mockReturnValueOnce(
        createChain({
          data: [
            { id: 'document-1', storage_path: 'a.pdf', status: 'deleted' },
          ],
          error: null,
        }),
      );

      await expect(
        service.updateStatus(adminId, ['document-1'], 'received'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('softDelete', () => {
    it('marque les documents supprimes et retire les fichiers', async () => {
      const owned = createChain({
        data: [
          { id: 'document-1', storage_path: 'a.pdf', status: 'received' },
          { id: 'document-2', storage_path: 'b.pdf', status: 'printed' },
        ],
        error: null,
      });
      const update = createChain({ data: null, error: null });
      const remove = vi.fn().mockResolvedValue({ data: [], error: null });
      from.mockReturnValueOnce(owned).mockReturnValueOnce(update);
      storageFrom.mockReturnValueOnce({ createSignedUrl: vi.fn(), remove });

      const result = await service.softDelete(adminId, [
        'document-1',
        'document-2',
      ]);

      expect(result).toEqual({ deleted: 2 });
      expect(update.update).toHaveBeenCalledWith({
        status: 'deleted',
        deleted_at: expect.any(String),
      });
      expect(remove).toHaveBeenCalledWith(['a.pdf', 'b.pdf']);
    });

    it('ignore les documents deja supprimes', async () => {
      from.mockReturnValueOnce(
        createChain({
          data: [
            { id: 'document-1', storage_path: 'a.pdf', status: 'deleted' },
          ],
          error: null,
        }),
      );

      await expect(
        service.softDelete(adminId, ['document-1']),
      ).resolves.toEqual({ deleted: 0 });
      expect(storageFrom).not.toHaveBeenCalled();
    });
  });
});
