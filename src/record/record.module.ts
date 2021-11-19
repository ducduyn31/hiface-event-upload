import { CacheModule, Module } from '@nestjs/common';
import { RecordController } from './record.controller';
import { SharedModule } from '../shared/shared.module';
import { RecordService } from './record.service';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Screen } from './models/screen.entity';
import { DeviceService } from '../shared/device/device.service';
import { KoalaService } from '../shared/koala/koala.service';
import { HttpModule } from '@nestjs/axios';
import { FoliageModule } from '../foliage/foliage.module';
import { HttpCallbackService } from '../shared/http-callback/httpcallback.service';

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
    TypeOrmModule.forFeature([Screen]),
    FoliageModule,
  ],
  controllers: [RecordController],
  providers: [RecordService, DeviceService, KoalaService, HttpCallbackService],
  exports: [RecordService],
})
export class RecordModule {}
