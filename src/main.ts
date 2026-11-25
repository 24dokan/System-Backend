import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const config = new DocumentBuilder()
    .setTitle('System Backend')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer') // send the token on every request from /docs
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  // Listen on IPv4 explicitly. On some Windows setups the default is IPv6 only, which other local programs cannot reach.
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '0.0.0.0');
}
bootstrap();
