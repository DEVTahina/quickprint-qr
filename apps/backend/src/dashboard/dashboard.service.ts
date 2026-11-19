import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { SupabaseService } from '../supabase/supabase.service.js';
import type { DashboardSummary } from './types/dashboard.js';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Compte les documents des sessions de l'administrateur connecte.
   * La jointure `!inner` limite le comptage a son propre perimetre.
   */
  async summary(adminId: string): Promise<DashboardSummary> {
    const client = this.supabase.getClient();

    const countDocuments = () =>
      client
        .from('documents')
        .select('id, print_sessions!inner(created_by)', {
          count: 'exact',
          head: true,
        })
        .eq('print_sessions.created_by', adminId);

    const [received, pending, printed, activeSessions] = await Promise.all([
      countDocuments().neq('status', 'deleted'),
      countDocuments().eq('status', 'received'),
      countDocuments().eq('status', 'printed'),
      client
        .from('print_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', adminId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString()),
    ]);

    for (const result of [received, pending, printed, activeSessions]) {
      if (result.error) {
        this.logger.error(
          `Impossible de calculer les compteurs : ${result.error.message}`,
        );
        throw new InternalServerErrorException(
          'Impossible de charger le tableau de bord pour le moment.',
        );
      }
    }

    return {
      received: received.count ?? 0,
      pending: pending.count ?? 0,
      printed: printed.count ?? 0,
      activeSessions: activeSessions.count ?? 0,
    };
  }
}
