import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuration Supabase manquante : definissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
  );
}

/**
 * Client public Supabase. Seule la cle `anon` est utilisee ici : la cle
 * `service_role` reste exclusivement dans l'environnement du backend.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
