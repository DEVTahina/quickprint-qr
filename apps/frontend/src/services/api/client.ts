import axios from 'axios';

import { DEFAULT_API_URL } from '../../constants/app';

/** Client HTTP unique vers l'API NestJS. */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? DEFAULT_API_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});
