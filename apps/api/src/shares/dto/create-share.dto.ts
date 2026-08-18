import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsUUID,
} from 'class-validator';

export const SHARE_RESOURCE_TYPES = ['DATA_ROOM', 'FOLDER', 'FILE'] as const;
export const SHARE_MODES = ['PUBLIC_LINK', 'RESTRICTED'] as const;

export const MAX_RECIPIENTS = 50;

export class CreateShareDto {
  @IsIn(SHARE_RESOURCE_TYPES)
  resourceType!: (typeof SHARE_RESOURCE_TYPES)[number];

  @IsUUID()
  resourceId!: string;

  @IsIn(SHARE_MODES)
  mode!: (typeof SHARE_MODES)[number];

  /** Required for RESTRICTED, meaningless for PUBLIC_LINK. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_RECIPIENTS)
  @Transform(({ value }): unknown =>
    // `Array.isArray` narrows to `any[]`, which would leak `any` out of here.
    Array.isArray(value)
      ? (value as unknown[]).map((entry) =>
          typeof entry === 'string' ? entry.trim().toLowerCase() : entry,
        )
      : value,
  )
  @IsEmail({}, { each: true, message: 'Every recipient must be a valid email address.' })
  recipientEmails?: string[];

  @IsOptional()
  @IsISO8601({}, { message: 'Expiry must be a date.' })
  expiresAt?: string;
}
