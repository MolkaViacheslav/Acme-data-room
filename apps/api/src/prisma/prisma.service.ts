import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { loadEnv } from '../config/env';
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
  constructor() {
    const { databaseUrl } = loadEnv();

    super({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
