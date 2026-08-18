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
  Post,
  Query,
} from '@nestjs/common';

import type { AccessActor } from '../access/access.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalUser } from '../auth/optional-user.decorator';
import { Public } from '../auth/public.decorator';

import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { MoveFileDto } from './dto/move-file.dto';
import { RenameFileDto } from './dto/rename-file.dto';
import { FilesService } from './files.service';
import type { DownloadUrl, FileDetail, UploadTarget } from './files.types';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload-url')
  createUploadUrl(
    @CurrentUser() actor: AccessActor,
    @Body() dto: CreateUploadUrlDto,
  ): Promise<UploadTarget> {
    return this.files.createUploadUrl(actor, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  completeUpload(
    @CurrentUser() actor: AccessActor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FileDetail> {
    return this.files.completeUpload(actor, id);
  }

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

  /** Public so a shared file opens without an account; still access-checked. */
  @Public()
  @Get(':id/download-url')
  createDownloadUrl(
    @OptionalUser() actor: AccessActor | null,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('token') token?: string,
  ): Promise<DownloadUrl> {
    return this.files.createDownloadUrl(actor, id, token);
  }
}
