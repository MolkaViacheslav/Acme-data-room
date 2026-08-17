import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/public.decorator';

export interface HealthResponse {
  readonly ok: true;
}

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): HealthResponse {
    return { ok: true };
  }
}
