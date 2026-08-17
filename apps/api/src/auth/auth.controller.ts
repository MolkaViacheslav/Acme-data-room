import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { APP_ENV } from '../config/env.module';
import type { AppEnv } from '../config/env';

import { AuthService } from './auth.service';
import type { Actor, AuthUser } from './auth.types';
import {
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
  clearedAccessTokenCookieOptions,
} from './cookie';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const user = await this.auth.register(dto);
    await this.setAccessTokenCookie(response, user);

    return user;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const user = await this.auth.login(dto);
    await this.setAccessTokenCookie(response, user);

    return user;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    // Public on purpose: signing out with an already-expired token must still
    // clear the cookie rather than fail with a 401.
    response.clearCookie(ACCESS_TOKEN_COOKIE, clearedAccessTokenCookieOptions(this.env));
  }

  @Get('me')
  findCurrentUser(@CurrentUser() actor: Actor): Promise<AuthUser> {
    return this.auth.findCurrentUser(actor);
  }

  private async setAccessTokenCookie(response: Response, user: AuthUser): Promise<void> {
    const token = await this.auth.signAccessToken(user);

    response.cookie(ACCESS_TOKEN_COOKIE, token, accessTokenCookieOptions(this.env));
  }
}
