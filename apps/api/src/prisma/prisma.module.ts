import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global: every feature module needs database access, and re-importing this
 * in each one would be noise.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
