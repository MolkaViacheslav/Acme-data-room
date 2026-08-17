import { IsUUID } from 'class-validator';

export class MoveFileDto {
  /** The folder to move into. Access is resolved against this separately. */
  @IsUUID()
  folderId!: string;
}
