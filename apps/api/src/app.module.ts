import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AccessModule } from './access/access.module';
import { AuthModule } from './auth/auth.module';
import { EnvModule } from './config/env.module';
import { FilesModule } from './files/files.module';
import { FoldersModule } from './folders/folders.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EnvModule,
    PrismaModule,
    StorageModule,
    AccessModule,
    AuthModule,
    FoldersModule,
    FilesModule,
    HealthModule,
  ],
})
export class AppModule {}
