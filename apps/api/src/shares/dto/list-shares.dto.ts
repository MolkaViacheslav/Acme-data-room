import { IsIn, IsUUID } from 'class-validator';

import { SHARE_RESOURCE_TYPES } from './create-share.dto';

export class ListSharesDto {
  @IsIn(SHARE_RESOURCE_TYPES)
  resourceType!: (typeof SHARE_RESOURCE_TYPES)[number];

  @IsUUID()
  resourceId!: string;
}
