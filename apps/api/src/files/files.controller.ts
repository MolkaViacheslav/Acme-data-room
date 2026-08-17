import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';

import type { AccessActor } from '../access/access.types';
import { CurrentUser } from '../auth/current-user.decorator';

import { MoveFileDto } from './dto/move-file.dto';
import { RenameFileDto } from './dto/rename-file.dto';
import { FilesService } from './files.service';
import type { DownloadUrl, FileDetail } from './files.types';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Patch(':id')
  rename(
    @CurrentUser() actor: AccessActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameFileDto,
  ): Promise<FileDetail> {
    return this.files.rename(actor, id, dto);
  }

  @Patch(':id/move')
  move(
    @CurrentUser() actor: AccessActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveFileDto,
  ): Promise<FileDetail> {
    return this.files.move(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() actor: AccessActor, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.files.remove(actor, id);
  }

  @Get(':id/download-url')
  createDownloadUrl(
    @CurrentUser() actor: AccessActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('token') token?: string,
  ): Promise<DownloadUrl> {
    return this.files.createDownloadUrl(actor, id, token);
  }
}
