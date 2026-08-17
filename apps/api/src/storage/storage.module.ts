import { Global, Module } from '@nestjs/common';

import { EnvModule } from '../config/env.module';

import { StorageService } from './storage.service';

@Global()
@Module({
  imports: [EnvModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
