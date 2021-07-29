import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { RecordModule } from './record/record.module';
import { SettingsModule } from './settings/settings.module';
import { CallbackModule } from './callback/callback.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    SharedModule,
    RecordModule,
    SettingsModule,
    CallbackModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: +config.get('DB_PORT'),
        username: 'root',
        password: config.get('DB_PASSWORD'),
        database: 'hiface',
        entities: ['**/*.entity.{ts,js}'],
        synchronize: config.get('DB_SYNC') === 'true',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
