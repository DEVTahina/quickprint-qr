import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { SupabaseService } from '../supabase/supabase.service.js';
import { PrintBatchesService } from './print-batches.service.js';

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
}

type QueryChain = Record<string, ReturnType<typeof vi.fn>>;

function createChain(
  result: QueryResult = { data: null, error: null },
  single?: QueryResult,
): QueryChain {
  const chain: QueryChain = {};

  for (const method of [
    'select',
    'eq',
    'gte',
    'lte',
    'in',
    'insert',
    'update',
    'delete',
    'order',
    'range',
    'maybeSingle',
    'single',
    'then',
  ]) {
    chain[method] = vi.fn();
  }

  for (const method of [
    'select',
    'eq',
    'gte',
    'lte',
    'in',
    'insert',
    'update',
    'delete',
    'order',
    'range',
  ]) {
    chain[method].mockReturnValue(chain);
  }

  chain.maybeSingle.mockResolvedValue(single ?? { data: null, error: null });
  chain.single.mockResolvedValue(single ?? { data: null, error: null });

  chain.then.mockImplementation((resolve: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(resolve),
  );

  return chain;
}

const batchRow = {
  id: 'batch-1',
  total_documents: 2,
  status: 'pending',
  created_at: '2026-11-19T12:40:00.000Z',
  completed_at: null,
};

describe('PrintBatchesService', () => {
  const from = vi.fn();
  const supabase = {
    getClient: () => ({ from }),
  } as unknown as SupabaseService;

  const adminId = 'admin-1';

  let service: PrintBatchesService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new PrintBatchesService(supabase);
  });

  describe('list', () => {
    it('pagine les lots et restitue leur composition dans l ordre', async () => {
      const history = createChain({
        count: 1,
        error: null,
        data: [
          {
            ...batchRow,
            status: 'completed',
            completed_at: '2026-11-19T12:50:00.000Z',
            print_batch_documents: [
              {
                print_order: 2,
                document_id: 'document-2',
                documents: {
                  id: 'document-2',
                  original_name: 'second.pdf',
                  status: 'printed',
                },
              },
              {
                print_order: 1,
                document_id: 'document-1',
                documents: {
                  id: 'document-1',
                  original_name: 'premier.pdf',
                  status: 'received',
                },
              },
            ],
          },
        ],
      });

      from.mockReturnValueOnce(history);

      const result = await service.list(adminId, { page: 1, pageSize: 20 });

      expect(history.eq).toHaveBeenCalledWith('admin_id', adminId);
      expect(history.order).toHaveBeenNthCalledWith(1, 'created_at', {
        ascending: false,
      });
      expect(history.range).toHaveBeenCalledWith(0, 19);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.items[0].documents).toEqual([
        {
          documentId: 'document-1',
          originalName: 'premier.pdf',
          printOrder: 1,
          status: 'received',
        },
        {
          documentId: 'document-2',
          originalName: 'second.pdf',
          printOrder: 2,
          status: 'printed',
        },
      ]);
    });

    it('combine le statut et la periode de creation', async () => {
      const history = createChain({ count: 0, error: null, data: [] });
      from.mockReturnValueOnce(history);

      await service.list(adminId, {
        status: 'completed',
        dateFrom: '2026-11-01T00:00:00.000Z',
        dateTo: '2026-11-30T23:59:59.999Z',
        sort: 'asc',
        page: 2,
        pageSize: 10,
      });

      expect(history.eq).toHaveBeenCalledWith('status', 'completed');
      expect(history.gte).toHaveBeenCalledWith(
        'created_at',
        '2026-11-01T00:00:00.000Z',
      );
      expect(history.lte).toHaveBeenCalledWith(
        'created_at',
        '2026-11-30T23:59:59.999Z',
      );
      expect(history.range).toHaveBeenCalledWith(10, 19);
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

    it('signale une erreur de lecture', async () => {
      from.mockReturnValueOnce(
        createChain({ data: null, error: { message: 'db' } }),
      );

      await expect(service.list(adminId, {})).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('create', () => {
    it('enregistre le lot dans l ordre de selection', async () => {
      const owned = createChain({
        data: [
          { id: 'document-1', status: 'received' },
          { id: 'document-2', status: 'printed' },
        ],
        error: null,
      });
      const batch = createChain(undefined, { data: batchRow, error: null });
      const links = createChain({ data: null, error: null });

      from
        .mockReturnValueOnce(owned)
        .mockReturnValueOnce(batch)
        .mockReturnValueOnce(links);

      const result = await service.create(adminId, [
        'document-2',
        'document-1',
      ]);

      expect(owned.eq).toHaveBeenCalledWith(
        'print_sessions.created_by',
        adminId,
      );
      expect(links.insert).toHaveBeenCalledWith([
        {
          batch_id: 'batch-1',
          document_id: 'document-2',
          print_order: 1,
        },
        {
          batch_id: 'batch-1',
          document_id: 'document-1',
          print_order: 2,
        },
      ]);
      expect(result).toEqual({
        id: 'batch-1',
        totalDocuments: 2,
        status: 'pending',
        createdAt: '2026-11-19T12:40:00.000Z',
        completedAt: null,
      });
    });

    it('dedoublonne les identifiants avant creation', async () => {
      const owned = createChain({
        data: [{ id: 'document-1', status: 'received' }],
        error: null,
      });
      const batch = createChain(undefined, {
        data: { ...batchRow, total_documents: 1 },
        error: null,
      });
      const links = createChain({ data: null, error: null });

      from
        .mockReturnValueOnce(owned)
        .mockReturnValueOnce(batch)
        .mockReturnValueOnce(links);

      await service.create(adminId, ['document-1', 'document-1']);

      expect(links.insert).toHaveBeenCalledWith([
        {
          batch_id: 'batch-1',
          document_id: 'document-1',
          print_order: 1,
        },
      ]);
    });

    it('refuse un document hors perimetre', async () => {
      from.mockReturnValueOnce(
        createChain({
          data: [{ id: 'document-1', status: 'received' }],
          error: null,
        }),
      );

      await expect(
        service.create(adminId, ['document-1', 'document-2']),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse un document supprime', async () => {
      from.mockReturnValueOnce(
        createChain({
          data: [{ id: 'document-1', status: 'deleted' }],
          error: null,
        }),
      );

      await expect(
        service.create(adminId, ['document-1']),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('supprime le lot si sa composition echoue', async () => {
      const owned = createChain({
        data: [{ id: 'document-1', status: 'received' }],
        error: null,
      });
      const batch = createChain(undefined, { data: batchRow, error: null });
      const links = createChain({
        data: null,
        error: { message: 'constraint' },
      });
      const cleanup = createChain({ data: null, error: null });

      from
        .mockReturnValueOnce(owned)
        .mockReturnValueOnce(batch)
        .mockReturnValueOnce(links)
        .mockReturnValueOnce(cleanup);

      await expect(
        service.create(adminId, ['document-1']),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(cleanup.delete).toHaveBeenCalled();
      expect(cleanup.eq).toHaveBeenCalledWith('id', 'batch-1');
    });
  });

  describe('complete', () => {
    it('marque les documents recus comme imprimes et cloture le lot', async () => {
      const batch = createChain(undefined, { data: batchRow, error: null });
      const links = createChain({
        data: [
          { document_id: 'document-1', print_order: 1 },
          { document_id: 'document-2', print_order: 2 },
        ],
        error: null,
      });
      const updateDocuments = createChain({
        data: [{ id: 'document-1' }],
        error: null,
      });
      const completed = createChain(undefined, {
        data: {
          ...batchRow,
          status: 'completed',
          completed_at: '2026-11-19T12:50:00.000Z',
        },
        error: null,
      });

      from
        .mockReturnValueOnce(batch)
        .mockReturnValueOnce(links)
        .mockReturnValueOnce(updateDocuments)
        .mockReturnValueOnce(completed);

      const result = await service.complete(adminId, 'batch-1', true);

      expect(updateDocuments.update).toHaveBeenCalledWith({
        status: 'printed',
        printed_at: expect.any(String),
      });
      expect(updateDocuments.in).toHaveBeenCalledWith('id', [
        'document-1',
        'document-2',
      ]);
      expect(updateDocuments.eq).toHaveBeenCalledWith('status', 'received');
      expect(completed.update).toHaveBeenCalledWith({
        status: 'completed',
        completed_at: expect.any(String),
      });
      expect(result.markedPrinted).toBe(1);
      expect(result.status).toBe('completed');
    });

    it('cloture sans toucher aux statuts quand markPrinted=false', async () => {
      const batch = createChain(undefined, { data: batchRow, error: null });
      const links = createChain({ data: [], error: null });
      const completed = createChain(undefined, {
        data: {
          ...batchRow,
          status: 'completed',
          completed_at: '2026-11-19T12:50:00.000Z',
        },
        error: null,
      });

      from
        .mockReturnValueOnce(batch)
        .mockReturnValueOnce(links)
        .mockReturnValueOnce(completed);

      const result = await service.complete(adminId, 'batch-1', false);

      expect(from).toHaveBeenCalledTimes(3);
      expect(result.markedPrinted).toBe(0);
    });

    it('refuse un lot inconnu ou hors perimetre', async () => {
      from.mockReturnValueOnce(createChain());

      await expect(
        service.complete(adminId, 'batch-1', true),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('est idempotent pour un lot deja termine', async () => {
      from.mockReturnValueOnce(
        createChain(undefined, {
          data: {
            ...batchRow,
            status: 'completed',
            completed_at: '2026-11-19T12:50:00.000Z',
          },
          error: null,
        }),
      );

      const result = await service.complete(adminId, 'batch-1', true);

      expect(result.markedPrinted).toBe(0);
      expect(from).toHaveBeenCalledTimes(1);
    });
  });
});
