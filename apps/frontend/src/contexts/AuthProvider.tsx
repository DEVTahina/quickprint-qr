import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { apiClient } from '../services/api/client';
import { supabase } from '../services/supabase/client';
import type { ApiErrorPayload } from '../types/api';
import type { AdminProfile } from '../types/auth';
import { AuthContext, type AuthStatus } from './auth-context';

function mapSignInError(message: string | undefined): string {
  if (!message) {
    return 'Connexion impossible. Veuillez reessayer.';
  }

  if (/invalid login credentials/i.test(message)) {
    return 'E-mail ou mot de passe incorrect.';
  }

  if (/email not confirmed/i.test(message)) {
    return "Cette adresse e-mail n'a pas encore ete confirmee.";
  }

  if (/rate limit|too many/i.test(message)) {
    return 'Trop de tentatives. Patientez quelques instants avant de reessayer.';
  }

  return 'Connexion impossible. Verifiez votre connexion puis reessayez.';
}

function getApiError(error: unknown): { status?: number; message?: string } {
  if (!axios.isAxiosError<ApiErrorPayload>(error)) {
    return {};
  }

  const payload = error.response?.data;
  const message = Array.isArray(payload?.message)
    ? payload.message.join(' ')
    : payload?.message;

  return { status: error.response?.status, message };
}

/** Fournit la session Supabase et le profil admin valide par le backend. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const applySession = useCallback((nextSession: Session | null) => {
    sessionRef.current = nextSession;
    setSession(nextSession);

    if (nextSession) {
      setStatus('loading');
    } else {
      setAdmin(null);
      setStatus('anonymous');
    }
  }, []);

  const validateAdmin = useCallback(async (accessToken: string) => {
    setStatus('loading');
    setError(null);

    try {
      const { data } = await apiClient.get<AdminProfile>('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      setAdmin(data);
      setStatus('authenticated');
    } catch (requestError) {
      const { status: httpStatus, message } = getApiError(requestError);
      setAdmin(null);

      if (httpStatus === 401 || httpStatus === 403) {
        setStatus('unauthorized');
        setError(
          message ??
            (httpStatus === 401
              ? 'Votre session a expire. Veuillez vous reconnecter.'
              : "Ce compte n'est pas autorise a acceder a l'espace administrateur."),
        );
      } else {
        setStatus('error');
        setError(
          "Impossible de verifier vos droits. Verifiez que l'API est demarree puis reessayez.",
        );
      }

      throw requestError;
    }
  }, []);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }

      applySession(data.session);

      if (data.session) {
        void validateAdmin(data.session.access_token).catch(() => undefined);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        // La session initiale est deja chargee par getSession().
        if (!active || event === 'INITIAL_SESSION') {
          return;
        }

        applySession(nextSession);

        if (nextSession) {
          void validateAdmin(nextSession.access_token).catch(() => undefined);
        }
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [applySession, validateAdmin]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.session) {
      throw new Error(mapSignInError(signInError?.message));
    }

    sessionRef.current = data.session;
    setSession(data.session);
    setStatus('loading');
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await supabase.auth.signOut();
    sessionRef.current = null;
    setSession(null);
    setAdmin(null);
    setStatus('anonymous');
  }, []);

  const retry = useCallback(async () => {
    let current = sessionRef.current;

    if (!current) {
      const { data } = await supabase.auth.getSession();
      current = data.session;
    }

    if (!current) {
      setStatus('anonymous');
      return;
    }

    await validateAdmin(current.access_token).catch(() => undefined);
  }, [validateAdmin]);

  return (
    <AuthContext.Provider
      value={{ status, session, admin, error, signIn, signOut, retry }}
    >
      {children}
    </AuthContext.Provider>
  );
}
