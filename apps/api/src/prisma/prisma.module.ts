import { Global, Module } from '@nestjs/common';

import { EnvModule } from '../config/env.module';

import { PrismaService } from './prisma.service';

/**
 * Global: every feature module needs database access, and re-importing this
 * in each one would be noise.
 */
@Global()
@Module({
  imports: [EnvModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
