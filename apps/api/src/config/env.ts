/**
 * Environment is read and validated once, at boot, so a misconfigured deploy
 * fails immediately with a readable message instead of at the first request.
 *
 * Only variables the code actually uses are required here. The full set the
 * project will need is documented in `.env.example`.
 */

export interface AppEnv {
  readonly nodeEnv: 'development' | 'production' | 'test';
  readonly port: number;
  /** Exact origins allowed to call this API with credentials. Never `*`. */
  readonly corsOrigins: readonly string[];
  /**
   * Pooled Postgres connection (`:6543`) used by the running app. Migrations
   * use the direct connection instead, configured in `prisma.config.ts`.
   */
  readonly databaseUrl: string;
}

class EnvError extends Error {
  constructor(variable: string, problem: string) {
    super(`Invalid environment: ${variable} ${problem}. See apps/api/.env.example`);
    this.name = 'EnvError';
  }
}

function readNodeEnv(raw: string | undefined): AppEnv['nodeEnv'] {
  if (raw === 'production' || raw === 'test' || raw === 'development') return raw;
  if (raw === undefined || raw === '') return 'development';
  throw new EnvError('NODE_ENV', `must be development, production or test (got "${raw}")`);
}

function readPort(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 3001;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new EnvError('PORT', `must be an integer between 1 and 65535 (got "${raw}")`);
  }
  return port;
}

/**
 * Comma-separated list, e.g.
 * `http://localhost:3000,https://data-room.vercel.app`.
 */
function readCorsOrigins(raw: string | undefined): readonly string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new EnvError('WEB_ORIGIN', 'must list at least one allowed frontend origin');
  }

  for (const origin of origins) {
    if (origin === '*') {
      throw new EnvError('WEB_ORIGIN', 'cannot be "*" — credentialed CORS needs exact origins');
    }
    try {
      new URL(origin);
    } catch {
      throw new EnvError('WEB_ORIGIN', `contains an invalid URL: "${origin}"`);
    }
  }

  return origins;
}

function readDatabaseUrl(raw: string | undefined): string {
  const url = (raw ?? '').trim();

  if (url === '') {
    throw new EnvError('DATABASE_URL', 'must be set to the pooled Postgres connection string');
  }
  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    throw new EnvError('DATABASE_URL', 'must be a postgresql:// connection string');
  }

  return url;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    nodeEnv: readNodeEnv(source.NODE_ENV),
    port: readPort(source.PORT),
    corsOrigins: readCorsOrigins(source.WEB_ORIGIN),
    databaseUrl: readDatabaseUrl(source.DATABASE_URL),
  };
}
