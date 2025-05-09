// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Get port from environment variable or use 5000 as default
  const port = process.env.PORT || 5000;
  app.enableCors();
  // Listen on all interfaces (0.0.0.0)
  await app.listen(port, '0.0.0.0');
  
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();