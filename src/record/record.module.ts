import { CacheModule, HttpModule, Module } from '@nestjs/common';
import { RecordController } from './record.controller';
import { SharedModule } from '../shared/shared.module';
import { RecordService } from './record.service';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { ConfigService } from '@nestjs/config';
import { FoliageService } from './foliage/foliage.service';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    HttpModule,
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
  controllers: [RecordController],
  providers: [RecordService, FoliageService],
  exports: [RecordService, FoliageService],
})
export class RecordModule {}
