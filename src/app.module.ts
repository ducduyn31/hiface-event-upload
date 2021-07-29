import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { RecordModule } from './record/record.module';
import { ConfigModule } from './config/config.module';
import { CallbackModule } from './callback/callback.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService, ConfigModule as cfModule } from '@nestjs/config';
import { createConnection } from 'typeorm';

@Module({
  imports: [
    SharedModule,
    RecordModule,
    ConfigModule,
    CallbackModule,
    TypeOrmModule.forRootAsync({
      imports: [cfModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: +config.get('DB_PORT'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: ['**/*.entity.{ts,js}'],
        synchronize: config.get('DB_SYNC') === 'true',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
