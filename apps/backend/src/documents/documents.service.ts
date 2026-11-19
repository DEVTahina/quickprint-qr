import {
  BadRequestException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { SupabaseService } from '../supabase/supabase.service.js';
import type { PrintSessionStatus } from '../sessions/types/print-session.js';
import type { ListDocumentsDto } from './dto/list-documents.dto.js';
import type {
  DocumentDeletion,
  DocumentPage,
  DocumentPreview,
  DocumentStatus,
  DocumentStatusUpdate,
  DocumentSummary,
  MutableDocumentStatus,
} from './types/document.js';

const DEFAULT_PAGE_SIZE = 20;
const BUCKET = 'quickprint-documents';
const PREVIEW_URL_TTL_SECONDS = 60;

/**
 * La jointure est `!inner` pour pouvoir limiter les resultats aux sessions de
 * l'administrateur connecte. Le chemin de stockage n'est jamais expose.
 */
const DOCUMENT_COLUMNS = [
  'id',
  'session_id',
  'original_name',
  'size_bytes',
  'pages_count',
  'status',
  'uploaded_at',
  'printed_at',
  'deleted_at',
  'print_sessions!inner (id, created_at, status, created_by)',
].join(', ');

interface DocumentSessionRow {
  id: string;
  created_at: string;
  status: PrintSessionStatus;
  created_by: string;
}

interface OwnedDocumentRow {
  id: string;
  storage_path: string;
  status: DocumentStatus;
  print_sessions: { created_by: string } | { created_by: string }[] | null;
}

interface DocumentRow {
  id: string;
  session_id: string;
  original_name: string;
  size_bytes: number;
  pages_count: number | null;
  status: DocumentStatus;
  uploaded_at: string;
  printed_at: string | null;
  deleted_at: string | null;
  print_sessions: DocumentSessionRow | DocumentSessionRow[] | null;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Liste les documents des sessions de l'administrateur connecte.
   * Tous les criteres fournis sont combines avec un ET logique.
   */
  async list(
    adminId: string,
    query: ListDocumentsDto,
  ): Promise<DocumentPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    if (
      query.dateFrom &&
      query.dateTo &&
      new Date(query.dateFrom).getTime() > new Date(query.dateTo).getTime()
    ) {
      throw new BadRequestException(
        'La date de debut doit preceder la date de fin.',
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = this.supabase
      .getClient()
      .from('documents')
      .select(DOCUMENT_COLUMNS, { count: 'exact' })
      .eq('print_sessions.created_by', adminId);

    const search = query.search?.trim();

    if (search) {
      request = request.ilike(
        'original_name',
        `%${this.escapeLikePattern(search)}%`,
      );
    }

    if (query.status) {
      request = request.eq('status', query.status);
    }

    if (query.sessionId) {
      request = request.eq('session_id', query.sessionId);
    }

    if (query.dateFrom) {
      request = request.gte('uploaded_at', query.dateFrom);
    }

    if (query.dateTo) {
      request = request.lte('uploaded_at', query.dateTo);
    }

    const { data, error, count } = await request
      .order('uploaded_at', { ascending: query.sort === 'asc' })
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      this.logger.error(
        `Impossible de lire les documents : ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Impossible de charger les documents pour le moment.',
      );
    }

    const total = count ?? 0;

    return {
      items: ((data ?? []) as unknown as DocumentRow[]).map((row) =>
        this.toSummary(row),
      ),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Retourne une URL signee de courte duree vers le PDF prive.
   * Le statut et le perimetre de l'administrateur sont verifies avant.
   */
  async preview(adminId: string, id: string): Promise<DocumentPreview> {
    const { data, error } = await this.supabase
      .getClient()
      .from('documents')
      .select('id, storage_path, status, print_sessions!inner(created_by)')
      .eq('id', id)
      .eq('print_sessions.created_by', adminId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Impossible de lire le document : ${error.message}`);
      throw new InternalServerErrorException(
        'Impossible de preparer la consultation du document.',
      );
    }

    if (!data) {
      throw new NotFoundException('Document introuvable.');
    }

    const row = data as unknown as OwnedDocumentRow;

    if (row.status === 'deleted') {
      throw new GoneException('Ce document a ete supprime.');
    }

    const { data: signed, error: signError } = await this.supabase
      .getClient()
      .storage.from(BUCKET)
      .createSignedUrl(row.storage_path, PREVIEW_URL_TTL_SECONDS);

    if (signError || !signed) {
      this.logger.error('Impossible de signer l URL de consultation.');
      throw new InternalServerErrorException(
        'Impossible de preparer la consultation du document.',
      );
    }

    return {
      id: row.id,
      url: signed.signedUrl,
      expiresAt: new Date(
        Date.now() + PREVIEW_URL_TTL_SECONDS * 1_000,
      ).toISOString(),
    };
  }

  /**
   * Applique un statut a une selection de documents de l'administrateur.
   * Aucune ecriture partielle : la selection est validee avant la mise a jour.
   */
  async updateStatus(
    adminId: string,
    ids: string[],
    status: MutableDocumentStatus,
  ): Promise<DocumentStatusUpdate> {
    const uniqueIds = [...new Set(ids)];
    const rows = await this.requireOwnedDocuments(adminId, uniqueIds);

    if (rows.some((row) => row.status === 'deleted')) {
      throw new BadRequestException(
        "Un document supprime ne peut pas changer de statut.",
      );
    }

    const { error } = await this.supabase
      .getClient()
      .from('documents')
      .update({
        status,
        printed_at: status === 'printed' ? new Date().toISOString() : null,
      })
      .in('id', uniqueIds);

    if (error) {
      this.logger.error(
        `Impossible de changer le statut des documents : ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Impossible de mettre a jour les documents selectionnes.',
      );
    }

    return { updated: uniqueIds.length };
  }

  /**
   * Supprime logiquement les documents puis retire les objets du bucket prive.
   * Le retrait du stockage reste best-effort : la base fait foi.
   */
  async softDelete(
    adminId: string,
    ids: string[],
  ): Promise<DocumentDeletion> {
    const uniqueIds = [...new Set(ids)];
    const rows = await this.requireOwnedDocuments(adminId, uniqueIds);
    const toDelete = rows.filter((row) => row.status !== 'deleted');

    if (toDelete.length === 0) {
      return { deleted: 0 };
    }

    const { error } = await this.supabase
      .getClient()
      .from('documents')
      .update({ status: 'deleted', deleted_at: new Date().toISOString() })
      .in(
        'id',
        toDelete.map((row) => row.id),
      );

    if (error) {
      this.logger.error(
        `Impossible de supprimer les documents : ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Impossible de supprimer les documents selectionnes.',
      );
    }

    const { error: removeError } = await this.supabase
      .getClient()
      .storage.from(BUCKET)
      .remove(toDelete.map((row) => row.storage_path));

    if (removeError) {
      this.logger.warn(
        'Documents marques supprimes, mais fichiers non retires du stockage.',
      );
    }

    return { deleted: toDelete.length };
  }

  /**
   * Verifie que chaque identifiant appartient a une session de l'administrateur.
   * Un identifiant inconnu ou hors perimetre invalide toute la selection.
   */
  private async requireOwnedDocuments(
    adminId: string,
    uniqueIds: string[],
  ): Promise<OwnedDocumentRow[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('documents')
      .select('id, storage_path, status, print_sessions!inner(created_by)')
      .in('id', uniqueIds)
      .eq('print_sessions.created_by', adminId);

    if (error) {
      this.logger.error(
        `Impossible de verifier les documents : ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Impossible de verifier les documents selectionnes.',
      );
    }

    const rows = (data ?? []) as unknown as OwnedDocumentRow[];

    if (rows.length !== uniqueIds.length) {
      throw new NotFoundException(
        'Un ou plusieurs documents sont introuvables.',
      );
    }

    return rows;
  }

  private toSummary(row: DocumentRow): DocumentSummary {
    const session = Array.isArray(row.print_sessions)
      ? (row.print_sessions[0] ?? null)
      : row.print_sessions;

    return {
      id: row.id,
      sessionId: row.session_id,
      session: session
        ? {
            id: session.id,
            createdAt: session.created_at,
            status: session.status,
          }
        : null,
      originalName: row.original_name,
      sizeBytes: row.size_bytes,
      pagesCount: row.pages_count,
      status: row.status,
      uploadedAt: row.uploaded_at,
      printedAt: row.printed_at,
      deletedAt: row.deleted_at,
    };
  }

  /**
   * Neutralise les jokers LIKE saisis par l'utilisateur : la recherche reste
   * une recherche de texte, sans motif implicite.
   */
  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
  }
}
