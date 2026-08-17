import { IsResourceName } from '../../folders/dto/folder-name';

export class RenameFileDto {
  @IsResourceName()
  name!: string;
}
