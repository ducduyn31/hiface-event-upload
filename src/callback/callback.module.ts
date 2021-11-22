import { CacheModule, Module } from '@nestjs/common';
import { CallbackController } from './callback.controller';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { FoliageService } from '../foliage/foliage.service';
import { RecordService } from '../record/record.service';
import { RecordModule } from '../record/record.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Screen } from '../record/models/screen.entity';
import { SharedModule } from '../shared/shared.module';
import { DeviceService } from '../shared/device/device.service';
import { KoalaService } from '../shared/koala/koala.service';
import { CallbackService } from './callback.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { HttpModule } from '@nestjs/axios';
import { HttpCallbackService } from '../shared/http-callback/httpcallback.service';

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
        ttl: 0,
      }),
      inject: [ConfigService],
    }),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              brokers: [
                configService.get('KAFKA_URI').toLowerCase() === 'disable'
                  ? undefined
                  : configService.get('KAFKA_URI'),
              ],
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
    RecordModule,
    SharedModule,
    TypeOrmModule.forFeature([Screen]),
  ],
  controllers: [CallbackController],
  providers: [
    FoliageService,
    RecordService,
    DeviceService,
    KoalaService,
    CallbackService,
    HttpCallbackService,
  ],
})
export class CallbackModule {}
