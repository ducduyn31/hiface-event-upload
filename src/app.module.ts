import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { RecordModule } from './record/record.module';
import { SettingsModule } from './settings/settings.module';
import { CallbackModule } from './callback/callback.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { FoliageModule } from './foliage/foliage.module';

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
        type: 'mysql',
        host: config.get('DB_HOST'),
        port: +config.get('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [join(__dirname, '**/*.entity.{ts,js}')],
        synchronize: config.get('DB_SYNC') === 'true',
      }),
      inject: [ConfigService],
    }),
    FoliageModule,
  ],
})
export class AppModule {}
