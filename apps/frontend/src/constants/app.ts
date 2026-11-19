export const APP_NAME = 'QuickPrint QR';
export const APP_SLOGAN = 'Scan. Send. Print.';
export const APP_DESCRIPTION =
  "Envoyez vos documents PDF à l'imprimerie en scannant un QR Code, sans compte ni installation.";

export const ROUTES = {
  home: '/',
  adminLogin: '/admin/login',
  adminDashboard: '/admin',
  adminSessions: '/admin/sessions',
  adminDocuments: '/admin/documents',
} as const;

// Chemin relatif : le proxy Vite (ou le reverse proxy de production) transmet
// /api vers le backend. Cela evite d'encoder "localhost" dans le bundle, qui
// ne fonctionnerait pas depuis un telephone.
export const DEFAULT_API_URL = '/api';
