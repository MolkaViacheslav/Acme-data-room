import { IsInt, IsString, IsUUID, MaxLength, Min } from 'class-validator';

import { IsResourceName } from '../../folders/dto/folder-name';

export class CreateUploadUrlDto {
  /** Destination. Access is resolved against this, never trusted. */
  @IsUUID()
  folderId!: string;

  @IsResourceName()
  name!: string;

  /**
   * What the browser believes the file is. Checked here to fail fast, and
   * checked again against storage in `complete` — that second check is the one
   * that decides.
   */
  @IsString()
  @MaxLength(255)
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
