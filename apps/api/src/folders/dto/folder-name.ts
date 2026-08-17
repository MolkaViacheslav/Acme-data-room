import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const MAX_NAME_LENGTH = 255;

/**
 * Forbids slashes, and nothing else.
 *
 * A slash would make a name unreadable beside a path and invite confusion with
 * one. Spaces, punctuation and non-Latin scripts are all fine: a name is stored
 * as data and never used to build a path, which is made of ids.
 */
const NO_SLASHES = /^[^/\\]+$/;

export function IsResourceName(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value)),
    IsString(),
    MinLength(1, { message: 'Enter a name.' }),
    MaxLength(MAX_NAME_LENGTH, { message: `Name must be at most ${MAX_NAME_LENGTH} characters.` }),
    Matches(NO_SLASHES, { message: 'A name cannot contain slashes.' }),
  );
}
