import {
  Body,
  CACHE_MANAGER,
  Controller,
  Get,
  Inject,
  Put,
} from '@nestjs/common';
import { ScreenInfo } from '../shared/screen-info';
import { ServerInfo } from '../shared/server-info';
import { Cache } from 'cache-manager';

@Controller('config')
export class ConfigController {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  @Put('screen')
  updateScreen(@Body() screen: ScreenInfo) {
    this.cacheManager.set('screen', screen, { ttl: 0 });
    return screen;
  }

  @Get('screen')
  getScreen() {
    return this.cacheManager.get('screen');
  }

  @Put('server')
  updateServer(@Body() server: ServerInfo) {
    this.cacheManager.set('server', server, { ttl: 0 });
    return server;
  }

  @Get('server')
  getServer() {
    return this.cacheManager.get('server');
  }
}
