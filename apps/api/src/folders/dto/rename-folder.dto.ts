import { IsResourceName } from './folder-name';

export class RenameFolderDto {
  @IsResourceName()
  name!: string;
}
