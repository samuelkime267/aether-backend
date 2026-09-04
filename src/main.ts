import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { Express, Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { getConfig } from './config/env';

async function bootstrap() {
  const env = getConfig();
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const server = app.getHttpAdapter().getInstance() as Express;
  server.set('trust proxy', true);

  app.enableCors({
    origin: env.feUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Aether AI API')
    .setDescription(
      'The Aether AI Operating System API description. Interactive docs below.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Wallet (SIWE), email/password, and Google authentication')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  server.get(
    '/doc',
    apiReference({
      spec: { content: document },
      theme: 'purple',
    }),
  );

  server.get('/doc-json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(document);
  });

  const port = env.port;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
void bootstrap();
