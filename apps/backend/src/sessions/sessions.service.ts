import { createHash, randomBytes } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { AdminProfile } from '../auth/types/admin-profile.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { CreateSessionDto } from './dto/create-session.dto.js';
import type {
  CreatedPrintSession,
  PrintSessionStatus,
  PrintSessionSummary,
  PublicPrintSession,
} from './types/print-session.js';

const DEFAULT_EXPIRES_IN_MINUTES = 120;
const DEFAULT_MAX_FILES = 5;
const SESSION_COLUMNS =
  'id, status, expires_at, max_files, created_at, closed_at';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

interface SessionRow {
  id: string;
  status: PrintSessionStatus;
  expires_at: string;
  max_files: number;
  created_at: string;
  closed_at: string | null;
}

interface PublicSessionRow {
  status: PrintSessionStatus;
  expires_at: string;
  max_files: number;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Cree une session et retourne le token brut une seule fois. */
  async create(
    admin: AdminProfile,
    dto: CreateSessionDto,
  ): Promise<CreatedPrintSession> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() +
        (dto.expiresInMinutes ?? DEFAULT_EXPIRES_IN_MINUTES) * 60_000,
    ).toISOString();
    const maxFiles = dto.maxFiles ?? DEFAULT_MAX_FILES;

    // Une seule session active par administrateur : l'ancien QR est invalide.
    await this.closeActiveSessions(admin.id, now);

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);

    const { data, error } = await this.supabase
      .getClient()
      .from('print_sessions')
      .insert({
        created_by: admin.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        max_files: maxFiles,
      })
      .select(SESSION_COLUMNS)
      .single();

    if (error || !data) {
      this.throwDatabaseError('creation de la session');
    }

    return {
      session: this.toSummary(data as SessionRow, now.getTime()),
      token,
    };
  }

  /** Liste les sessions de l'administrateur connecte, sans token. */
  async list(adminId: string): Promise<PrintSessionSummary[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('print_sessions')
      .select(SESSION_COLUMNS)
      .eq('created_by', adminId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      this.throwDatabaseError('lecture des sessions');
    }

    const now = Date.now();

    return ((data ?? []) as SessionRow[]).map((row) =>
      this.toSummary(row, now),
    );
  }

  /** Retourne une session appartenant a l'administrateur. */
  async findOne(adminId: string, sessionId: string): Promise<PrintSessionSummary> {
    const row = await this.findOwnedSession(adminId, sessionId);

    return this.toSummary(row, Date.now());
  }

  /** Ferme une session active. Une session deja fermee ou expiree est refusee. */
  async close(
    adminId: string,
    sessionId: string,
  ): Promise<PrintSessionSummary> {
    const row = await this.findOwnedSession(adminId, sessionId);
    const now = new Date();
    const status = this.effectiveStatus(row, now.getTime());

    if (status === 'closed') {
      throw new ConflictException('Cette session est deja fermee.');
    }

    if (status === 'expired') {
      throw new ConflictException('Cette session a expire.');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('print_sessions')
      .update({ status: 'closed', closed_at: now.toISOString() })
      .eq('id', sessionId)
      .eq('created_by', adminId)
      .eq('status', 'active')
      .select('id');

    if (error) {
      this.throwDatabaseError('fermeture de la session');
    }

    if (!data || data.length === 0) {
      throw new ConflictException("Cette session n'est plus active.");
    }

    return this.toSummary(
      { ...row, status: 'closed', closed_at: now.toISOString() },
      now.getTime(),
    );
  }

  /**
   * Renouvelle une session : ferme l'ancienne et cree un nouveau token.
   * Une session deja fermee ne peut pas etre renouvelee.
   */
  async renew(
    admin: AdminProfile,
    sessionId: string,
    dto: CreateSessionDto,
  ): Promise<CreatedPrintSession> {
    const previous = await this.findOwnedSession(admin.id, sessionId);

    if (this.effectiveStatus(previous, Date.now()) === 'closed') {
      throw new ConflictException(
        'Une session fermee ne peut pas etre renouvelee.',
      );
    }

    return this.create(admin, {
      expiresInMinutes: dto.expiresInMinutes ?? DEFAULT_EXPIRES_IN_MINUTES,
      maxFiles: dto.maxFiles ?? previous.max_files,
    });
  }

  /**
   * Valide un token pour la page publique du QR Code.
   * Retourne uniquement des metadonnees non sensibles.
   */
  async inspectToken(token: string): Promise<PublicPrintSession> {
    if (!TOKEN_PATTERN.test(token)) {
      throw new NotFoundException('Session introuvable ou invalide.');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('print_sessions')
      .select('status, expires_at, max_files')
      .eq('token_hash', this.hashToken(token))
      .maybeSingle();

    if (error) {
      this.throwDatabaseError('validation du token de session');
    }

    if (!data) {
      throw new NotFoundException('Session introuvable ou invalide.');
    }

    const row = data as PublicSessionRow;
    const status = this.effectiveStatus(row, Date.now());

    return {
      valid: status === 'active',
      status,
      expiresAt: row.expires_at,
      maxFiles: row.max_files,
    };
  }

  private async findOwnedSession(
    adminId: string,
    sessionId: string,
  ): Promise<SessionRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from('print_sessions')
      .select(SESSION_COLUMNS)
      .eq('id', sessionId)
      .eq('created_by', adminId)
      .maybeSingle();

    if (error) {
      this.throwDatabaseError('lecture de la session');
    }

    if (!data) {
      throw new NotFoundException('Session introuvable.');
    }

    return data as SessionRow;
  }

  private async closeActiveSessions(
    adminId: string,
    now: Date,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('print_sessions')
      .update({ status: 'closed', closed_at: now.toISOString() })
      .eq('created_by', adminId)
      .eq('status', 'active')
      .gt('expires_at', now.toISOString());

    if (error) {
      this.throwDatabaseError('fermeture des sessions precedentes');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private effectiveStatus(
    row: Pick<SessionRow, 'status' | 'expires_at'>,
    now: number,
  ): PrintSessionStatus {
    if (row.status === 'closed') {
      return 'closed';
    }

    if (row.status === 'expired') {
      return 'expired';
    }

    return new Date(row.expires_at).getTime() <= now ? 'expired' : 'active';
  }

  private toSummary(row: SessionRow, now: number): PrintSessionSummary {
    return {
      id: row.id,
      status: this.effectiveStatus(row, now),
      expiresAt: row.expires_at,
      maxFiles: row.max_files,
      createdAt: row.created_at,
      closedAt: row.closed_at,
    };
  }

  private throwDatabaseError(action: string): never {
    this.logger.error(`Impossible de poursuivre : ${action}.`);
    throw new InternalServerErrorException(
      'Impossible de traiter la session pour le moment.',
    );
  }
}
