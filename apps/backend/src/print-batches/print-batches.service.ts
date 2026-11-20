import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { SupabaseService } from '../supabase/supabase.service.js';
import type { DocumentStatus } from '../documents/types/document.js';
import type { ListPrintBatchesDto } from './dto/list-print-batches.dto.js';
import type {
  PrintBatch,
  PrintBatchCompletion,
  PrintBatchDocumentSummary,
  PrintBatchHistoryItem,
  PrintBatchPage,
  PrintBatchStatus,
} from './types/print-batch.js';

const DEFAULT_PAGE_SIZE = 20;
const BATCH_COLUMNS = 'id, total_documents, status, created_at, completed_at';
const HISTORY_COLUMNS = [
  BATCH_COLUMNS,
  'print_batch_documents (print_order, document_id, documents (id, original_name, status))',
].join(', ');

interface HistoryDocumentRow {
  id: string;
  original_name: string;
  status: DocumentStatus;
}

interface HistoryLinkRow {
  print_order: number;
  document_id: string;
  documents: HistoryDocumentRow | HistoryDocumentRow[] | null;
}

interface HistoryBatchRow {
  id: string;
  total_documents: number;
  status: PrintBatchStatus;
  created_at: string;
  completed_at: string | null;
  print_batch_documents: HistoryLinkRow[] | null;
}

interface OwnedPrintDocumentRow {
  id: string;
  status: DocumentStatus;
}

interface PrintBatchRow {
  id: string;
  total_documents: number;
  status: PrintBatchStatus;
  created_at: string;
  completed_at: string | null;
}

interface PrintBatchDocumentRow {
  document_id: string;
  print_order: number;
}

@Injectable()
export class PrintBatchesService {
  private readonly logger = new Logger(PrintBatchesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Historique des lots de l'administrateur connecte, avec leur composition.
   * Les filtres fournis sont combines avec un ET logique.
   */
  async list(
    adminId: string,
    query: ListPrintBatchesDto,
  ): Promise<PrintBatchPage> {
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
      .from('print_batches')
      .select(HISTORY_COLUMNS, { count: 'exact' })
      .eq('admin_id', adminId);

    if (query.status) {
      request = request.eq('status', query.status);
    }

    if (query.dateFrom) {
      request = request.gte('created_at', query.dateFrom);
    }

    if (query.dateTo) {
      request = request.lte('created_at', query.dateTo);
    }

    const { data, error, count } = await request
      .order('created_at', { ascending: query.sort === 'asc' })
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      this.logger.error(
        `Impossible de lire les lots d impression : ${error.message}`,
      );
      throw new InternalServerErrorException(
        "Impossible de charger l'historique des impressions pour le moment.",
      );
    }

    const total = count ?? 0;

    return {
      items: ((data ?? []) as unknown as HistoryBatchRow[]).map((row) =>
        this.toHistoryItem(row),
      ),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Enregistre un lot dans l'ordre de selection demande.
   *
   * Toute la selection est verifiee avant la premiere ecriture : un document
   * inconnu, supprime ou hors perimetre annule le lot entier.
   */
  async create(adminId: string, documentIds: string[]): Promise<PrintBatch> {
    const uniqueIds = [...new Set(documentIds)];

    await this.requirePrintableDocuments(adminId, uniqueIds);

    const { data, error } = await this.supabase
      .getClient()
      .from('print_batches')
      .insert({
        admin_id: adminId,
        total_documents: uniqueIds.length,
      })
      .select(BATCH_COLUMNS)
      .single();

    if (error || !data) {
      this.logger.error(
        `Impossible de creer le lot d impression : ${error?.message ?? 'reponse vide'}`,
      );
      throw new InternalServerErrorException(
        "Impossible d'enregistrer le lot d'impression.",
      );
    }

    const batch = data as unknown as PrintBatchRow;

    const { error: linkError } = await this.supabase
      .getClient()
      .from('print_batch_documents')
      .insert(
        uniqueIds.map((documentId, index) => ({
          batch_id: batch.id,
          document_id: documentId,
          print_order: index + 1,
        })),
      );

    if (linkError) {
      // Suppression en cascade des lignes deja creees : le lot ne doit pas
      // rester incomplet dans l'historique.
      await this.supabase
        .getClient()
        .from('print_batches')
        .delete()
        .eq('id', batch.id)
        .eq('admin_id', adminId);

      this.logger.error(
        `Impossible de composer le lot d impression : ${linkError.message}`,
      );
      throw new InternalServerErrorException(
        "Impossible d'enregistrer le lot d'impression.",
      );
    }

    return this.toBatch(batch);
  }

  /**
   * Cloture un lot. Le marquage « imprime » reste une decision explicite de
   * l'administrateur, jamais une consequence du clic sur Imprimer.
   */
  async complete(
    adminId: string,
    batchId: string,
    markPrinted: boolean,
  ): Promise<PrintBatchCompletion> {
    const { data, error } = await this.supabase
      .getClient()
      .from('print_batches')
      .select(BATCH_COLUMNS)
      .eq('id', batchId)
      .eq('admin_id', adminId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Impossible de lire le lot d impression : ${error.message}`,
      );
      throw new InternalServerErrorException(
        "Impossible de finaliser le lot d'impression.",
      );
    }

    if (!data) {
      throw new NotFoundException("Lot d'impression introuvable.");
    }

    const batch = data as unknown as PrintBatchRow;

    if (batch.status === 'completed') {
      return { ...this.toBatch(batch), markedPrinted: 0 };
    }

    const { data: links, error: linkError } = await this.supabase
      .getClient()
      .from('print_batch_documents')
      .select('document_id, print_order')
      .eq('batch_id', batchId)
      .order('print_order', { ascending: true });

    if (linkError) {
      this.logger.error(
        `Impossible de lire la composition du lot : ${linkError.message}`,
      );
      throw new InternalServerErrorException(
        "Impossible de finaliser le lot d'impression.",
      );
    }

    const documentIds = (
      (links ?? []) as unknown as PrintBatchDocumentRow[]
    ).map((link) => link.document_id);

    let markedPrinted = 0;

    if (markPrinted && documentIds.length > 0) {
      const { data: updated, error: updateError } = await this.supabase
        .getClient()
        .from('documents')
        .update({
          status: 'printed',
          printed_at: new Date().toISOString(),
        })
        .in('id', documentIds)
        .eq('status', 'received')
        .select('id');

      if (updateError) {
        this.logger.error(
          `Impossible de marquer les documents imprimes : ${updateError.message}`,
        );
        throw new InternalServerErrorException(
          "Impossible de finaliser le lot d'impression.",
        );
      }

      markedPrinted = (updated ?? []).length;
    }

    const { data: completed, error: completeError } = await this.supabase
      .getClient()
      .from('print_batches')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId)
      .eq('admin_id', adminId)
      .select(BATCH_COLUMNS)
      .single();

    if (completeError || !completed) {
      this.logger.error(
        `Impossible de cloturer le lot : ${completeError?.message ?? 'reponse vide'}`,
      );
      throw new InternalServerErrorException(
        "Impossible de finaliser le lot d'impression.",
      );
    }

    return {
      ...this.toBatch(completed as unknown as PrintBatchRow),
      markedPrinted,
    };
  }

  /** Verifie l'appartenance et l'etat de chaque document du lot. */
  private async requirePrintableDocuments(
    adminId: string,
    uniqueIds: string[],
  ): Promise<void> {
    const { data, error } = await this.supabase
      .getClient()
      .from('documents')
      .select('id, status, print_sessions!inner(created_by)')
      .in('id', uniqueIds)
      .eq('print_sessions.created_by', adminId);

    if (error) {
      this.logger.error(
        `Impossible de verifier les documents du lot : ${error.message}`,
      );
      throw new InternalServerErrorException(
        "Impossible de verifier les documents selectionnes.",
      );
    }

    const rows = (data ?? []) as unknown as OwnedPrintDocumentRow[];

    if (rows.length !== uniqueIds.length) {
      throw new NotFoundException(
        'Un ou plusieurs documents sont introuvables.',
      );
    }

    if (rows.some((row) => row.status === 'deleted')) {
      throw new BadRequestException(
        "Un document supprime ne peut pas etre imprime.",
      );
    }
  }

  private toBatch(row: PrintBatchRow): PrintBatch {
    return {
      id: row.id,
      totalDocuments: row.total_documents,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }

  private toHistoryItem(row: HistoryBatchRow): PrintBatchHistoryItem {
    const links = [...(row.print_batch_documents ?? [])].sort(
      (left, right) => left.print_order - right.print_order,
    );

    const documents: PrintBatchDocumentSummary[] = links.map((link) => {
      const document = Array.isArray(link.documents)
        ? (link.documents[0] ?? null)
        : link.documents;

      return {
        documentId: link.document_id,
        originalName: document?.original_name ?? 'Document supprime',
        printOrder: link.print_order,
        status: (document?.status ?? 'deleted') as PrintBatchDocumentSummary['status'],
      };
    });

    return {
      ...this.toBatch(row),
      documents,
    };
  }
}
