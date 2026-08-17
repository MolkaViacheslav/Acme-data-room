import type { LoginRequest, RegisterRequest } from '@/lib/api/types';

/**
 * Mirrors the `class-validator` rules on the API's DTOs, so a mistake is caught
 * before a round trip. The server still validates — this is a convenience,
 * never the enforcement.
 */

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;

export function validateRegisterForm(values: RegisterRequest): FieldErrors<RegisterRequest> {
  const errors: FieldErrors<RegisterRequest> = {};

  if (values.name.trim() === '') {
    errors.name = 'Enter your name.';
  } else if (values.name.trim().length > 80) {
    errors.name = 'Name must be at most 80 characters.';
  }

  if (values.email.trim() === '') {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (values.password === '') {
    errors.password = 'Choose a password.';
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (values.password.length > 72) {
    errors.password = 'Password must be at most 72 characters.';
  }

  return errors;
}

export function validateLoginForm(values: LoginRequest): FieldErrors<LoginRequest> {
  const errors: FieldErrors<LoginRequest> = {};

  if (values.email.trim() === '') {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (values.password === '') {
    errors.password = 'Enter your password.';
  }

  return errors;
}

export function hasErrors<T>(errors: FieldErrors<T>): boolean {
  return Object.keys(errors).length > 0;
}
