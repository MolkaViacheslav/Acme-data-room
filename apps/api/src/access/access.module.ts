import { Global, Module } from '@nestjs/common';

import { AccessService } from './access.service';

/**
 * Global: every feature module that touches a resource must resolve access
 * first, so this is a dependency of all of them.
 */
@Global()
@Module({
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
