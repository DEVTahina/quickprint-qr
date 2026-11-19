import {
  BadRequestException,
  ConflictException,
  GoneException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { SessionsService } from '../sessions/sessions.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { UploadsService } from './uploads.service.js';

interface QueryResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

type QueryChain = Record<string, ReturnType<typeof vi.fn>>;

function createChain(result: QueryResult = { data: null, error: null }): QueryChain {
  const chain: QueryChain = {};

  for (const method of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'is',
    'gt',
    'lte',
    'in',
    'limit',
    'single',
    'maybeSingle',
    'then',
  ]) {
    chain[method] = vi.fn();
  }

  for (const method of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'is',
    'gt',
    'lte',
    'in',
    'limit',
  ]) {
    chain[method].mockReturnValue(chain);
  }

  chain.single.mockResolvedValue(result);
  chain.maybeSingle.mockResolvedValue(result);
  chain.then.mockImplementation((resolve: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(resolve),
  );

  return chain;
}

function pdfBlob(content = '%PDF-1.7\ncontenu de test'): Blob {
  return new Blob([content], { type: 'application/pdf' });
}

describe('UploadsService', () => {
  const now = new Date('2026-11-16T10:00:00.000Z');
  const session = {
    id: 'session-1',
    status: 'active' as const,
    expiresAt: new Date(now.getTime() + 3_600_000).toISOString(),
    maxFiles: 5,
  };

  const from = vi.fn();
  const storageFrom = vi.fn();
  const storage = {
    createSignedUploadUrl: vi.fn(),
    download: vi.fn(),
    remove: vi.fn(),
  };
  const supabase = {
    getClient: () => ({
      from,
      storage: { from: storageFrom },
    }),
  } as unknown as SupabaseService;
  const sessions = {
    resolveToken: vi.fn(),
  } as unknown as SessionsService;
  const config = {
    get: (key: string) => {
      if (key === 'MAX_PDF_SIZE_BYTES') {
        return 20_971_520;
      }

      if (key === 'UPLOAD_INTENT_TTL_SECONDS') {
        return 900;
      }

      return undefined;
    },
  } as unknown as ConfigService;

  function intentRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'intent-1',
      session_id: session.id,
      original_name: 'CV.pdf',
      storage_path: 'sessions/session-1/intent-1.pdf',
      declared_size_bytes: 1024,
      expires_at: new Date(now.getTime() + 900_000).toISOString(),
      consumed_at: null,
      ...overrides,
    };
  }

  function documentRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'intent-1',
      original_name: 'CV.pdf',
      size_bytes: 1024,
      uploaded_at: now.toISOString(),
      ...overrides,
    };
  }

  let service: UploadsService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    storageFrom.mockReturnValue(storage);
    storage.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: 'https://storage.example/upload?token=secret',
        token: 'secret',
        path: 'sessions/session-1/intent-1.pdf',
      },
      error: null,
    });
    storage.remove.mockResolvedValue({ data: [], error: null });
    (sessions.resolveToken as ReturnType<typeof vi.fn>).mockResolvedValue(session);

    service = new UploadsService(supabase, sessions, config);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('authorize', () => {
    it("génère un chemin serveur et réserve l'envoi", async () => {
      from
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null, count: 2 }))
        .mockReturnValueOnce(createChain({ data: null, error: null, count: 1 }))
        .mockReturnValueOnce(createChain({ error: null }));

      const result = await service.authorize('A'.repeat(43), {
        fileName: 'Mon CV.pdf',
        sizeBytes: 1_024,
      });

      expect(result).toEqual(
        expect.objectContaining({
          token: 'secret',
          signedUrl: 'https://storage.example/upload?token=secret',
          path: 'sessions/session-1/intent-1.pdf',
        }),
      );
      expect(result.intentId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(storage.createSignedUploadUrl).toHaveBeenCalledWith(
        `sessions/session-1/${result.intentId}.pdf`,
        { upsert: false },
      );

      const intentInsert = from.mock.results[3]?.value as QueryChain;
      expect(intentInsert.insert).toHaveBeenCalledWith({
        id: result.intentId,
        session_id: session.id,
        original_name: 'Mon CV.pdf',
        storage_path: `sessions/session-1/${result.intentId}.pdf`,
        declared_size_bytes: 1_024,
        expires_at: new Date(now.getTime() + 900_000).toISOString(),
      });
    });

    it('refuse un token inconnu', async () => {
      (sessions.resolveToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.authorize('A'.repeat(43), {
          fileName: 'CV.pdf',
          sizeBytes: 1_024,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(from).not.toHaveBeenCalled();
    });

    it('refuse une session fermée ou expirée', async () => {
      (sessions.resolveToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...session,
        status: 'closed',
      });

      await expect(
        service.authorize('A'.repeat(43), {
          fileName: 'CV.pdf',
          sizeBytes: 1_024,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuse un nom qui ne se termine pas par .pdf', async () => {
      await expect(
        service.authorize('A'.repeat(43), {
          fileName: 'script.exe',
          sizeBytes: 1_024,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(from).not.toHaveBeenCalled();
    });

    it('refuse un nom contenant des caractères de contrôle', async () => {
      await expect(
        service.authorize('A'.repeat(43), {
          fileName: 'CV\u0000.pdf',
          sizeBytes: 1_024,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un fichier au-delà de la limite configurée', async () => {
      await expect(
        service.authorize('A'.repeat(43), {
          fileName: 'CV.pdf',
          sizeBytes: 20_971_521,
        }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('refuse quand la limite de fichiers est atteinte', async () => {
      from
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null, count: 3 }))
        .mockReturnValueOnce(createChain({ data: null, error: null, count: 2 }));

      await expect(
        service.authorize('A'.repeat(43), {
          fileName: 'CV.pdf',
          sizeBytes: 1_024,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
    });

    it("signale une erreur de création d'URL signée", async () => {
      from
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null, count: 0 }))
        .mockReturnValueOnce(createChain({ data: null, error: null, count: 0 }));
      storage.createSignedUploadUrl.mockResolvedValue({
        data: null,
        error: { message: 'storage unavailable' },
      });

      await expect(
        service.authorize('A'.repeat(43), {
          fileName: 'CV.pdf',
          sizeBytes: 1_024,
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('finalize', () => {
    it('vérifie le PDF réel puis insère le document', async () => {
      from
        .mockReturnValueOnce(createChain({ data: intentRow(), error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null, count: 2 }))
        .mockReturnValueOnce(
          createChain({ data: documentRow({ size_bytes: 24 }), error: null }),
        )
        .mockReturnValueOnce(createChain({ error: null }));
      storage.download.mockResolvedValue({
        data: pdfBlob(),
        error: null,
      });

      const result = await service.finalize('A'.repeat(43), 'intent-1');

      expect(result).toEqual({
        id: 'intent-1',
        originalName: 'CV.pdf',
        sizeBytes: Buffer.byteLength('%PDF-1.7\ncontenu de test'),
        uploadedAt: now.toISOString(),
      });
      expect(storage.download).toHaveBeenCalledWith(
        'sessions/session-1/intent-1.pdf',
      );

      const documentInsert = from.mock.results[3]?.value as QueryChain;
      expect(documentInsert.insert).toHaveBeenCalledWith({
        id: 'intent-1',
        session_id: session.id,
        original_name: 'CV.pdf',
        storage_path: 'sessions/session-1/intent-1.pdf',
        mime_type: 'application/pdf',
        size_bytes: Buffer.byteLength('%PDF-1.7\ncontenu de test'),
        uploaded_at: now.toISOString(),
      });
    });

    it('retourne le document existant sans retélécharger', async () => {
      from
        .mockReturnValueOnce(createChain({ data: intentRow(), error: null }))
        .mockReturnValueOnce(
          createChain({ data: documentRow(), error: null }),
        );

      await expect(
        service.finalize('A'.repeat(43), 'intent-1'),
      ).resolves.toEqual(
        expect.objectContaining({ id: 'intent-1', originalName: 'CV.pdf' }),
      );
      expect(storage.download).not.toHaveBeenCalled();
    });

    it('refuse et supprime un objet qui n’est pas un PDF', async () => {
      from
        .mockReturnValueOnce(createChain({ data: intentRow(), error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null, count: 0 }))
        .mockReturnValueOnce(createChain({ error: null }));
      storage.download.mockResolvedValue({
        data: pdfBlob('pas un pdf'),
        error: null,
      });

      await expect(
        service.finalize('A'.repeat(43), 'intent-1'),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      expect(storage.remove).toHaveBeenCalledWith([
        'sessions/session-1/intent-1.pdf',
      ]);
    });

    it('refuse un objet qui dépasse la taille maximale', async () => {
      const smallLimitConfig = {
        get: (key: string) =>
          key === 'MAX_PDF_SIZE_BYTES'
            ? 10
            : key === 'UPLOAD_INTENT_TTL_SECONDS'
              ? 900
              : undefined,
      } as unknown as ConfigService;
      const limitedService = new UploadsService(
        supabase,
        sessions,
        smallLimitConfig,
      );

      from
        .mockReturnValueOnce(createChain({ data: intentRow(), error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null, count: 0 }))
        .mockReturnValueOnce(createChain({ error: null }));
      storage.download.mockResolvedValue({
        data: pdfBlob('%PDF-123456'),
        error: null,
      });

      await expect(
        limitedService.finalize('A'.repeat(43), 'intent-1'),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it("refuse une autorisation expirée et nettoie l'objet", async () => {
      from
        .mockReturnValueOnce(
          createChain({
            data: intentRow({
              expires_at: new Date(now.getTime() - 1_000).toISOString(),
            }),
            error: null,
          }),
        )
        .mockReturnValueOnce(createChain({ data: null, error: null }))
        .mockReturnValueOnce(createChain({ error: null }));

      await expect(
        service.finalize('A'.repeat(43), 'intent-1'),
      ).rejects.toBeInstanceOf(GoneException);
      expect(storage.remove).toHaveBeenCalled();
    });

    it("refuse quand le fichier n'a pas été reçu", async () => {
      from
        .mockReturnValueOnce(createChain({ data: intentRow(), error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null, count: 0 }));
      storage.download.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(
        service.finalize('A'.repeat(43), 'intent-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuse quand la session a atteint sa limite', async () => {
      from
        .mockReturnValueOnce(createChain({ data: intentRow(), error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null }))
        .mockReturnValueOnce(createChain({ data: null, error: null, count: 5 }))
        .mockReturnValueOnce(createChain({ error: null }));

      await expect(
        service.finalize('A'.repeat(43), 'intent-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(storage.download).not.toHaveBeenCalled();
    });
  });
});
