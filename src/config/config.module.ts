import { CacheModule, Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { SharedModule } from '../shared/shared.module';
import { ConfigModule as cfModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    SharedModule,
    cfModule.forRoot(),
    CacheModule.registerAsync({
      imports: [cfModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ConfigController],
})
export class ConfigModule {}
