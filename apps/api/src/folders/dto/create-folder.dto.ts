import { IsUUID } from 'class-validator';

import { IsResourceName } from './folder-name';

export class CreateFolderDto {
  @IsResourceName()
  name!: string;

  /** Where to create it. Access is resolved against this, never trusted. */
  @IsUUID()
  parentId!: string;
}
