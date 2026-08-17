import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * CLI-only configuration: `prisma migrate`, `prisma db`, `prisma studio`.
 *
 * These commands use Supabase's **direct** connection (`:5432`). The pooled
 * connection (`:6543`) runs in transaction mode, which cannot hold the
 * advisory locks and session state that migrations need.
 *
 * The running application uses the pooled URL instead — see
 * `src/prisma/prisma.service.ts`.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
