import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Prefix: Chuẩn NestJS cho toàn bộ API phiên bản v1 (/api/v1/...)
  app.setGlobalPrefix('api/v1', {
    exclude: ['/'],
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS: Hỗ trợ tự động reflect origin cho cả Localhost, Docker và AWS EC2 Public IP
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('ShopFast E-Commerce API')
    .setDescription('Hệ thống backend ShopFast - Defense Case Study 6')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 ShopFast Server running on: http://localhost:${port}`);
  console.log(`📚 Swagger Documentation on: http://localhost:${port}/api/docs`);
}
await bootstrap();
