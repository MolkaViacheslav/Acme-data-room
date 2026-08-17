import { IsUUID } from 'class-validator';

export class MoveFolderDto {
  /** The folder to move into. Access is resolved against this separately. */
  @IsUUID()
  parentId!: string;
}
