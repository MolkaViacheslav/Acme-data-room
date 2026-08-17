import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Prisma is stubbed out rather than connected.
 *
 * Two reasons: `/health` must answer without touching the database, and the
 * suite should run on a machine that has no credentials. Prisma 7 also loads
 * its query compiler through a dynamic `import()`, which Jest cannot execute
 * without `--experimental-vm-modules`.
 */
const prismaStub: Pick<PrismaService, '$connect' | '$disconnect'> = {
  $connect: () => Promise.resolve(),
  $disconnect: () => Promise.resolve(),
};

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ ok: true });
  });
});
