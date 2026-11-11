import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

import type { AdminProfile } from '../types/auth';

export type AuthStatus =
  | 'loading'
  | 'anonymous'
  | 'authenticated'
  | 'unauthorized'
  | 'error';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  admin: AdminProfile | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Accede au contexte d'authentification depuis un composant. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth doit etre utilise a l interieur de AuthProvider.');
  }

  return context;
}
