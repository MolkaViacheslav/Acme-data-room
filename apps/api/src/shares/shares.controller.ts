import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import type { AccessActor } from '../access/access.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalUser } from '../auth/optional-user.decorator';
import { Public } from '../auth/public.decorator';

import { CreateShareDto } from './dto/create-share.dto';
import { ListSharesDto } from './dto/list-shares.dto';
import { SharesService } from './shares.service';
import type { SharedResource, ShareSummary } from './shares.types';

@Controller('shares')
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @Post()
  create(@CurrentUser() actor: AccessActor, @Body() dto: CreateShareDto): Promise<ShareSummary> {
    return this.shares.create(actor, dto);
  }

  @Get()
  list(@CurrentUser() actor: AccessActor, @Query() query: ListSharesDto): Promise<ShareSummary[]> {
    return this.shares.listForResource(actor, query.resourceType, query.resourceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@CurrentUser() actor: AccessActor, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.shares.revoke(actor, id);
  }

  /**
   * Public: a share link has to open for someone with no account at all.
   * `@OptionalUser` still identifies the caller when they happen to be signed
   * in, which is what a restricted share needs.
   */
  @Public()
  @Get('by-token/:token')
  resolveByToken(
    @OptionalUser() actor: AccessActor | null,
    @Param('token') token: string,
  ): Promise<SharedResource> {
    return this.shares.resolveByToken(actor, token);
  }
}
