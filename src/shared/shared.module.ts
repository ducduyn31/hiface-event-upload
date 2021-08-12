import { CACHE_MANAGER, CacheModule, HttpModule, Module } from '@nestjs/common';
import { ScreenInfo } from './screen-info';
import { ServerInfo } from './server-info';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { Cache } from 'cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Screen } from '../record/models/screen.entity';
import { DeviceService } from './device/device.service';
import { KoalaService } from './koala/koala.service';

@Module({
  imports: [
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
    HttpModule,
  ],
  providers: [
    {
      provide: ScreenInfo,
      useFactory: async (cacheManager: Cache) => {
        const screen = await cacheManager.get('screen');
        if (screen) return screen;
        return new ScreenInfo();
      },
      inject: [CACHE_MANAGER],
    },
    {
      provide: ServerInfo,
      useFactory: async (cacheManager: Cache) => {
        const server = await cacheManager.get('server');
        if (server) return server;
        return new ServerInfo();
      },
      inject: [CACHE_MANAGER],
    },
    DeviceService,
    KoalaService,
  ],
  exports: [
    {
      provide: ScreenInfo,
      useExisting: ScreenInfo,
    },
    {
      provide: ServerInfo,
      useExisting: ServerInfo,
    },
    DeviceService,
  ],
})
export class SharedModule {}
