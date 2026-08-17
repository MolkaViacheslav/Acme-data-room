import { Global, Module } from '@nestjs/common';

import { loadEnv } from './env';

/** Injection token for the parsed, validated environment. */
export const APP_ENV = Symbol('APP_ENV');

/**
 * Parses the environment once, at startup, and hands the result to anyone who
 * asks — rather than each call site re-reading and re-validating `process.env`.
 */
@Global()
@Module({
  providers: [{ provide: APP_ENV, useFactory: () => loadEnv() }],
  exports: [APP_ENV],
})
export class EnvModule {}
