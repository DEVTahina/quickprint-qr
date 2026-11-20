import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Render place l'application derriere un proxy : sans cela, le throttling
  // verrait l'adresse du proxy au lieu de celle du client.
  app.set('trust proxy', 1);

  // CSP desactivee : elle bloquerait l'interface inline de Swagger. Les autres
  // protections (nosniff, frameguard, referrer-policy, HSTS) restent actives.
  app.use(helmet({ contentSecurityPolicy: false }));

  // L'API ne recoit que du JSON leger ; les PDF passent par des URLs signees.
  app.useBodyParser('json', { limit: '32kb' });
  app.useBodyParser('urlencoded', { limit: '32kb', extended: true });

  const port = config.get<number>('PORT') ?? 3000;
  const frontendUrl =
    config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

  app.enableCors({
    origin: frontendUrl
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3_600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('QuickPrint QR API')
    .setDescription(
      "API REST de soumission et de gestion d'impression de documents PDF.",
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);

  Logger.log(`API disponible sur http://localhost:${port}`, 'Bootstrap');
  Logger.log(
    `Documentation Swagger sur http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}

await bootstrap();
