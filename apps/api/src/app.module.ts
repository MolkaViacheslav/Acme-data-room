import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AccessModule } from './access/access.module';
import { AuthModule } from './auth/auth.module';
import { EnvModule } from './config/env.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EnvModule,
    PrismaModule,
    AccessModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
