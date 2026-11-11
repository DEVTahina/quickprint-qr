import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase reserve au backend.
 *
 * La cle `service_role` contourne RLS : elle ne doit jamais etre exposee au
 * frontend, ni journalisee. Les controles d'autorisation restent assures par
 * le backend avant chaque operation sensible.
 */
@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL');
    const serviceRoleKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour demarrer le backend.',
      );
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
