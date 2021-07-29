import { CacheModule, Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SharedModule } from '../shared/shared.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    SharedModule,
    ConfigModule.forRoot(),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SettingsController],
})
export class SettingsModule {}
