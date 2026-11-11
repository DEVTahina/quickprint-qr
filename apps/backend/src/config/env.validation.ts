const REQUIRED_SUPABASE = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

/**
 * Valide et normalise les variables d'environnement au demarrage.
 * Les variables Supabase sont requises des le developpement, sauf en test ou
 * des valeurs factices sont fournies par la configuration Vitest.
 */
export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv =
    typeof config.NODE_ENV === 'string' && config.NODE_ENV.length > 0
      ? config.NODE_ENV
      : 'development';

  if (nodeEnv !== 'test') {
    const missing = REQUIRED_SUPABASE.filter((key) => !config[key]);

    if (missing.length > 0) {
      throw new Error(
        `Variables d'environnement Supabase manquantes : ${missing.join(', ')}`,
      );
    }
  }

  if (nodeEnv === 'production' && !config.FRONTEND_URL) {
    throw new Error("Variable d'environnement manquante en production : FRONTEND_URL");
  }

  const port = Number(config.PORT ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT doit etre un entier compris entre 1 et 65535.');
  }

  return { ...config, NODE_ENV: nodeEnv, PORT: port };
}
