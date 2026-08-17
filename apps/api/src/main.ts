import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Read after create(): ConfigModule has loaded .env by this point.
  const env = loadEnv();

  app.enableCors({
    origin: [...env.corsOrigins],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 0.0.0.0 so the container platform (Railway) can route to us.
  await app.listen(env.port, '0.0.0.0');
}

void bootstrap();
