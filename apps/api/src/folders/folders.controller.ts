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

import { CreateFolderDto } from './dto/create-folder.dto';
import { ListChildrenDto } from './dto/list-children.dto';
import { MoveFolderDto } from './dto/move-folder.dto';
import { RenameFolderDto } from './dto/rename-folder.dto';
import { FoldersService } from './folders.service';
import type { ChildrenPage, DeletePreview, FolderDetail } from './folders.types';

/**
 * HTTP only: parse, delegate, return. Every id below arrives from the client
 * and is resolved through `AccessService` inside the service, never here.
 */
@Controller('folders')
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Post()
  create(@CurrentUser() actor: AccessActor, @Body() dto: CreateFolderDto): Promise<FolderDetail> {
    return this.folders.create(actor, dto);
  }

  @Get(':id')
  findOne(
    @CurrentUser() actor: AccessActor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FolderDetail> {
    return this.folders.findOne(actor, id);
  }

  @Get(':id/children')
  listChildren(
    @CurrentUser() actor: AccessActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListChildrenDto,
  ): Promise<ChildrenPage> {
    return this.folders.listChildren(actor, id, query);
  }

  @Patch(':id')
  rename(
    @CurrentUser() actor: AccessActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameFolderDto,
  ): Promise<FolderDetail> {
    return this.folders.rename(actor, id, dto);
  }

  @Patch(':id/move')
  move(
    @CurrentUser() actor: AccessActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveFolderDto,
  ): Promise<FolderDetail> {
    return this.folders.move(actor, id, dto);
  }

  @Get(':id/delete-preview')
  deletePreview(
    @CurrentUser() actor: AccessActor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeletePreview> {
    return this.folders.deletePreview(actor, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() actor: AccessActor, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.folders.remove(actor, id);
  }
}
