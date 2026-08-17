import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import type { AppEnv } from '../config/env';
import { APP_ENV, EnvModule } from '../config/env.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    EnvModule,
    JwtModule.registerAsync({
      imports: [EnvModule],
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => ({
        secret: env.jwtSecret,
        signOptions: { expiresIn: env.jwtExpiresInSeconds },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Global: every route is protected unless it says `@Public()`.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
