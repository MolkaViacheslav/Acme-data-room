import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  readonly ok: true;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { ok: true };
  }
}
