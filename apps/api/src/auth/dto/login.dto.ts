import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  // Deliberately no length rules: an old password that no longer meets current
  // policy must still be able to sign in, and the error must not hint at
  // whether the password shape was right.
  @IsString()
  @MinLength(1, { message: 'Enter your password.' })
  password!: string;
}
