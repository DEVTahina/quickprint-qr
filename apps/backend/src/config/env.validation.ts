const REQUIRED_IN_PRODUCTION = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FRONTEND_URL',
] as const;

/**
 * Valide et normalise les variables d'environnement au demarrage.
 * En developpement, seuls PORT et NODE_ENV sont necessaires : les secrets
 * Supabase seront ajoutes lors de la Phase 2.
 */
export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv =
    typeof config.NODE_ENV === 'string' && config.NODE_ENV.length > 0
      ? config.NODE_ENV
      : 'development';

  if (nodeEnv === 'production') {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => !config[key]);

    if (missing.length > 0) {
      throw new Error(
        `Variables d'environnement manquantes en production : ${missing.join(', ')}`,
      );
    }
  }

  const port = Number(config.PORT ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT doit etre un entier compris entre 1 et 65535.');
  }

  return { ...config, NODE_ENV: nodeEnv, PORT: port };
}
