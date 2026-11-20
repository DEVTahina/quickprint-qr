import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../supabase/supabase.service.js';

const CLEANUP_INTERVAL_MS = 10 * 60_000;
const INTENT_BATCH_SIZE = 100;

export interface MaintenanceReport {
  expiredSessions: number;
  deletedIntents: number;
}

/**
 * Entretien periodique des donnees temporaires.
 *
 * - les sessions actives dont la date d'expiration est passee deviennent
 *   `expired` (les routes publiques les refusent deja, ceci aligne la base) ;
 * - les autorisations d'envoi jamais finalisees et arrivees a expiration sont
 *   supprimees avec leur objet dans le bucket prive.
 *
 * Le minuteur n'est pas arme en environnement de test : les tests appellent
 * directement `run()`.
 */
@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private readonly enabled: boolean;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly supabase: SupabaseService,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('NODE_ENV') !== 'test';
  }

  onModuleInit(): void {
    if (!this.enabled) {
      return;
    }

    this.timer = setInterval(() => {
      void this.run();
    }, CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Execute un passage de nettoyage ; une erreur partielle n'est pas fatale. */
  async run(now = new Date()): Promise<MaintenanceReport> {
    if (this.running) {
      return { expiredSessions: 0, deletedIntents: 0 };
    }

    this.running = true;

    try {
      const expiredSessions = await this.expireSessions(now);
      const deletedIntents = await this.cleanupExpiredIntents(now);

      if (expiredSessions > 0 || deletedIntents > 0) {
        this.logger.log(
          `${expiredSessions} session(s) expiree(s), ${deletedIntents} envoi(s) abandonne(s) nettoye(s).`,
        );
      }

      return { expiredSessions, deletedIntents };
    } finally {
      this.running = false;
    }
  }

  private async expireSessions(now: Date): Promise<number> {
    const { data, error } = await this.supabase
      .getClient()
      .from('print_sessions')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lte('expires_at', now.toISOString())
      .select('id');

    if (error) {
      this.logger.warn(
        'Impossible de marquer les sessions expirees dans la base.',
      );
      return 0;
    }

    return (data ?? []).length;
  }

  private async cleanupExpiredIntents(now: Date): Promise<number> {
    const { data, error } = await this.supabase
      .getClient()
      .from('upload_intents')
      .select('id, storage_path')
      .is('consumed_at', null)
      .lte('expires_at', now.toISOString())
      .limit(INTENT_BATCH_SIZE);

    if (error) {
      this.logger.warn(
        "Impossible de lire les autorisations d'envoi expirees.",
      );
      return 0;
    }

    const rows = (data ?? []) as Array<{ id: string; storage_path: string }>;

    if (rows.length === 0) {
      return 0;
    }

    const { error: removeError } = await this.supabase
      .getClient()
      .storage.from('quickprint-documents')
      .remove(rows.map((row) => row.storage_path));

    if (removeError) {
      this.logger.warn(
        "Impossible de supprimer les fichiers d'envoi abandonnes.",
      );
      return 0;
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
      this.logger.warn(
        "Impossible de supprimer les autorisations d'envoi expirees.",
      );
      return 0;
    }

    return rows.length;
  }
}
