import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import type { AppEnv } from '../config/env';
import { APP_ENV } from '../config/env.module';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma 7 requires a driver adapter — `datasourceUrl` no longer exists — so
 * the connection string is handed to `@prisma/adapter-pg` here rather than
 * being read out of the schema.
 *
 * This uses the **pooled** Supabase connection. Migrations run over the direct
 * connection instead, configured in `prisma.config.ts`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(APP_ENV) env: AppEnv) {
    super({ adapter: new PrismaPg({ connectionString: env.databaseUrl }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
