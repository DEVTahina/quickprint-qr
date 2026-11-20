import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DEFAULT_UPLOAD_INTENT_TTL_SECONDS,
  MAX_PDF_SIZE_BYTES,
} from '../config/upload.config.js';
import { SessionsService } from '../sessions/sessions.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { AuthorizeUploadDto } from './dto/authorize-upload.dto.js';
import type {
  FinalizedDocument,
  UploadAuthorization,
  UploadSessionAccess,
} from './types/upload.js';

const BUCKET = 'quickprint-documents';
const PDF_SIGNATURE = Buffer.from('%PDF-');
const PDF_EOF_MARKER = '%%EOF';
const PDF_TAIL_BYTES = 1_024;
const INTENT_COLUMNS =
  'id, session_id, original_name, storage_path, declared_size_bytes, expires_at, consumed_at';
const DOCUMENT_COLUMNS = 'id, original_name, size_bytes, uploaded_at';

interface UploadIntentRow {
  id: string;
  session_id: string;
  original_name: string;
  storage_path: string;
  declared_size_bytes: number;
  expires_at: string;
  consumed_at: string | null;
}

interface DocumentRow {
  id: string;
  original_name: string;
  size_bytes: number;
  uploaded_at: string;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly maxPdfSizeBytes: number;
  private readonly intentTtlSeconds: number;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly sessions: SessionsService,
    config: ConfigService,
  ) {
    const configuredSize = config.get<number>('MAX_PDF_SIZE_BYTES');
    const configuredTtl = config.get<number>('UPLOAD_INTENT_TTL_SECONDS');

    this.maxPdfSizeBytes =
      typeof configuredSize === 'number' && configuredSize > 0
        ? Math.min(configuredSize, MAX_PDF_SIZE_BYTES)
        : MAX_PDF_SIZE_BYTES;
    this.intentTtlSeconds =
      typeof configuredTtl === 'number' && configuredTtl > 0
        ? configuredTtl
        : DEFAULT_UPLOAD_INTENT_TTL_SECONDS;
  }

  /**
   * Réserve un emplacement, vérifie les limites puis retourne une URL signée.
   * Le nom et le chemin fournis par le navigateur ne sont jamais utilisés tels
   * quels : le chemin est généré côté serveur.
   */
  async authorize(
    token: string,
    dto: AuthorizeUploadDto,
  ): Promise<UploadAuthorization> {
    const session = await this.requireActiveSession(token);
    const originalName = this.normalizeOriginalName(dto.fileName);

    if (dto.sizeBytes > this.maxPdfSizeBytes) {
      throw new PayloadTooLargeException(
        `Le fichier dépasse la limite de ${this.maxPdfSizeBytes} octets.`,
      );
    }

    const now = new Date();
    await this.cleanupExpiredIntents(session.id, now);

    const [documentsCount, intentsCount] = await Promise.all([
      this.countDocuments(session.id),
      this.countLiveIntents(session.id, now),
    ]);

    if (documentsCount + intentsCount >= session.maxFiles) {
      throw new ConflictException(
        `Cette session a atteint la limite de ${session.maxFiles} fichier(s).`,
      );
    }

    const intentId = randomUUID();
    const storagePath = `sessions/${session.id}/${intentId}.pdf`;
    const expiresAt = new Date(
      now.getTime() + this.intentTtlSeconds * 1_000,
    ).toISOString();

    const { data: signedUpload, error: storageError } = await this.supabase
      .getClient()
      .storage.from(BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (storageError || !signedUpload) {
      this.logger.error("Impossible de préparer l'URL d'envoi du fichier.");
      throw new InternalServerErrorException(
        "Impossible de préparer l'envoi du fichier pour le moment.",
      );
    }

    const { error: insertError } = await this.supabase
      .getClient()
      .from('upload_intents')
      .insert({
        id: intentId,
        session_id: session.id,
        original_name: originalName,
        storage_path: storagePath,
        declared_size_bytes: dto.sizeBytes,
        expires_at: expiresAt,
      });

    if (insertError) {
      this.logger.error("Impossible d'enregistrer l'autorisation d'envoi.");
      throw new InternalServerErrorException(
        "Impossible de préparer l'envoi du fichier pour le moment.",
      );
    }

    return {
      intentId,
      signedUrl: signedUpload.signedUrl,
      token: signedUpload.token,
      path: signedUpload.path,
      expiresAt,
    };
  }

  /**
   * Vérifie l'objet réellement reçu puis crée le document.
   * Un nouvel appel avec la même intention retourne le document existant.
   */
  async finalize(
    token: string,
    intentId: string,
  ): Promise<FinalizedDocument> {
    const session = await this.requireActiveSession(token);
    const intent = await this.findIntent(intentId, session.id);

    const existingDocument = await this.findDocument(intent.id);

    if (existingDocument) {
      return this.toFinalizedDocument(existingDocument);
    }

    if (intent.consumed_at) {
      throw new ConflictException('Cet envoi a déjà été finalisé.');
    }

    const now = new Date();

    if (new Date(intent.expires_at).getTime() <= now.getTime()) {
      await this.discardIntent(intent);
      throw new GoneException(
        "L'autorisation d'envoi a expiré. Sélectionnez à nouveau le fichier.",
      );
    }

    const documentsCount = await this.countDocuments(session.id);

    if (documentsCount >= session.maxFiles) {
      await this.discardIntent(intent);
      throw new ConflictException(
        `Cette session a atteint la limite de ${session.maxFiles} fichier(s).`,
      );
    }

    const { data: blob, error: downloadError } = await this.supabase
      .getClient()
      .storage.from(BUCKET)
      .download(intent.storage_path);

    if (downloadError || !blob) {
      this.logger.warn("Le fichier annoncé n'a pas été trouvé dans le stockage.");
      throw new ConflictException(
        "Le fichier n'a pas été reçu. Recommencez l'envoi.",
      );
    }

    if (blob.size > this.maxPdfSizeBytes) {
      await this.discardIntent(intent);
      throw new PayloadTooLargeException(
        `Le fichier dépasse la limite de ${this.maxPdfSizeBytes} octets.`,
      );
    }

    if (blob.size === 0) {
      await this.discardIntent(intent);
      throw new UnsupportedMediaTypeException(
        'Le fichier reçu est vide ou ne correspond pas à un PDF.',
      );
    }

    const content = Buffer.from(await blob.arrayBuffer());

    if (
      content.length < PDF_SIGNATURE.length ||
      !content.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)
    ) {
      await this.discardIntent(intent);
      throw new UnsupportedMediaTypeException(
        'Le fichier reçu ne correspond pas à un PDF valide.',
      );
    }

    // Un vrai PDF se termine par %%EOF (éventuellement suivi d'octets de
    // remplissage). Cette vérification légère rejette un fichier qui se
    // contenterait de commencer par la signature.
    const tail = content
      .subarray(Math.max(0, content.length - PDF_TAIL_BYTES))
      .toString('latin1');

    if (!tail.includes(PDF_EOF_MARKER)) {
      await this.discardIntent(intent);
      throw new UnsupportedMediaTypeException(
        'Le fichier reçu ne correspond pas à un PDF valide.',
      );
    }

    const { data: inserted, error: insertError } = await this.supabase
      .getClient()
      .from('documents')
      .insert({
        id: intent.id,
        session_id: session.id,
        original_name: intent.original_name,
        storage_path: intent.storage_path,
        mime_type: 'application/pdf',
        size_bytes: content.length,
        uploaded_at: now.toISOString(),
      })
      .select(DOCUMENT_COLUMNS)
      .single();

    if (insertError || !inserted) {
      // Une finalisation concurrente a pu créer le document entre-temps.
      const concurrentDocument = await this.findDocument(intent.id);

      if (concurrentDocument) {
        return this.toFinalizedDocument(concurrentDocument);
      }

      this.logger.error("Impossible d'enregistrer le document reçu.");
      await this.discardIntent(intent);
      throw new InternalServerErrorException(
        "Impossible de finaliser l'envoi du fichier pour le moment.",
      );
    }

    const { error: markError } = await this.supabase
      .getClient()
      .from('upload_intents')
      .update({ consumed_at: now.toISOString() })
      .eq('id', intent.id)
      .eq('session_id', session.id)
      .is('consumed_at', null);

    if (markError) {
      // Le document existe déjà : un nouvel appel restera idempotent.
      this.logger.warn("Impossible de marquer l'intention comme consommée.");
    }

    return this.toFinalizedDocument(inserted as DocumentRow);
  }

  private async requireActiveSession(
    token: string,
  ): Promise<UploadSessionAccess> {
    const session = await this.sessions.resolveToken(token);

    if (!session) {
      throw new NotFoundException('Session introuvable ou invalide.');
    }

    if (session.status === 'closed') {
      throw new ConflictException('Cette session a été fermée.');
    }

    if (session.status === 'expired') {
      throw new ConflictException('Cette session a expiré.');
    }

    return session;
  }

  private async findIntent(
    intentId: string,
    sessionId: string,
  ): Promise<UploadIntentRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from('upload_intents')
      .select(INTENT_COLUMNS)
      .eq('id', intentId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      this.throwDatabaseError("lecture de l'autorisation d'envoi");
    }

    if (!data) {
      throw new NotFoundException("Autorisation d'envoi introuvable.");
    }

    return data as UploadIntentRow;
  }

  private async findDocument(documentId: string): Promise<DocumentRow | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('documents')
      .select(DOCUMENT_COLUMNS)
      .eq('id', documentId)
      .maybeSingle();

    if (error) {
      this.throwDatabaseError('lecture du document');
    }

    return (data as DocumentRow | null) ?? null;
  }

  private async countDocuments(sessionId: string): Promise<number> {
    const { count, error } = await this.supabase
      .getClient()
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .neq('status', 'deleted');

    if (error) {
      this.throwDatabaseError('comptage des documents');
    }

    return count ?? 0;
  }

  private async countLiveIntents(
    sessionId: string,
    now: Date,
  ): Promise<number> {
    const { count, error } = await this.supabase
      .getClient()
      .from('upload_intents')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .is('consumed_at', null)
      .gt('expires_at', now.toISOString());

    if (error) {
      this.throwDatabaseError('comptage des envois en cours');
    }

    return count ?? 0;
  }

  /**
   * Nettoie les objets et intentions expirés de la session avant une nouvelle
   * autorisation. Le nettoyage est volontairement best-effort : un échec ne doit
   * pas empêcher un dépôt légitime.
   */
  private async cleanupExpiredIntents(
    sessionId: string,
    now: Date,
  ): Promise<void> {
    const { data, error } = await this.supabase
      .getClient()
      .from('upload_intents')
      .select('id, storage_path')
      .eq('session_id', sessionId)
      .is('consumed_at', null)
      .lte('expires_at', now.toISOString())
      .limit(20);

    if (error) {
      this.logger.warn("Impossible de lire les autorisations d'envoi expirées.");
      return;
    }

    const rows = (data ?? []) as Array<{ id: string; storage_path: string }>;

    if (rows.length === 0) {
      return;
    }

    const { error: removeError } = await this.supabase
      .getClient()
      .storage.from(BUCKET)
      .remove(rows.map((row) => row.storage_path));

    if (removeError) {
      this.logger.warn("Impossible de supprimer les fichiers d'envoi expirés.");
      return;
    }

    const { error: deleteError } = await this.supabase
      .getClient()
      .from('upload_intents')
      .delete()
      .in(
        'id',
        rows.map((row) => row.id),
      );

    if (deleteError) {
      this.logger.warn("Impossible de supprimer les intentions expirées.");
    }
  }

  /** Supprime un objet refusé et son intention. */
  private async discardIntent(intent: UploadIntentRow): Promise<void> {
    const { error: removeError } = await this.supabase
      .getClient()
      .storage.from(BUCKET)
      .remove([intent.storage_path]);

    if (removeError) {
      this.logger.warn("Impossible de supprimer un fichier refusé.");
    }

    const { error: deleteError } = await this.supabase
      .getClient()
      .from('upload_intents')
      .delete()
      .eq('id', intent.id);

    if (deleteError) {
      this.logger.warn("Impossible de supprimer une autorisation refusée.");
    }
  }

  private normalizeOriginalName(fileName: string): string {
    const basename = fileName
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      ?.trim();

    if (!basename || basename.length > 255 || !/\.pdf$/i.test(basename)) {
      throw new BadRequestException('Le nom du fichier est invalide.');
    }

    for (const character of basename) {
      const codePoint = character.codePointAt(0);

      if (codePoint !== undefined && (codePoint < 32 || codePoint === 127)) {
        throw new BadRequestException('Le nom du fichier est invalide.');
      }
    }

    return basename;
  }

  private toFinalizedDocument(row: DocumentRow): FinalizedDocument {
    return {
      id: row.id,
      originalName: row.original_name,
      sizeBytes: Number(row.size_bytes),
      uploadedAt: row.uploaded_at,
    };
  }

  private throwDatabaseError(action: string): never {
    this.logger.error(`Impossible de poursuivre : ${action}.`);
    throw new InternalServerErrorException(
      "Impossible de traiter l'envoi pour le moment.",
    );
  }
}
