import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [configService.get('KAFKA_URI')],
      },
      consumer: {
        groupId: 'event-consumer',
      },
    },
  });
  await app.startAllMicroservicesAsync();
  await app.listen(3000, () =>
<<<<<<< HEAD
    new Logger('NestApplication').log('Started on port 3000'),
=======
    new Logger('NestApplication').log('Server started on port 3000'),
>>>>>>> 3b19ca49f0f4891e13a8a8fcf26e1c364f922194
  );
}
bootstrap();
