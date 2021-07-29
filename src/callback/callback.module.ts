import { CacheModule, HttpModule, Module } from '@nestjs/common';
import { CallbackController } from './callback.controller';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { FoliageService } from '../record/foliage/foliage.service';
import { RecordService } from '../record/record.service';
import { RecordModule } from '../record/record.module';

@Module({
  imports: [
    HttpModule,
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
    RecordModule,
  ],
  controllers: [CallbackController],
  providers: [FoliageService, RecordService],
})
export class CallbackModule {}
