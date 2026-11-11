import axios from 'axios';

import { DEFAULT_API_URL } from '../../constants/app';
import { supabase } from '../supabase/client';

/** Client HTTP unique vers l'API NestJS. */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? DEFAULT_API_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Ajoute le token de la session courante aux requetes backend. */
apiClient.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
});
