import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const mo = app.select(ConfigModule);
  const configService = app.get(ConfigService);
  console.log(configService.get('REDIS_HOST'));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [configService.get('KAFKA_URI')],
      },
    },
  });
  await app.startAllMicroservicesAsync();
  await app.listen(3000, '0.0.0.0');
}
bootstrap();
