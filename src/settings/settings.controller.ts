import {
  Body,
  CACHE_MANAGER,
  Controller,
  Get,
  Inject,
  Put,
} from '@nestjs/common';
import { ServerInfo } from '../shared/server-info';
import { Cache } from 'cache-manager';

@Controller('config')
export class SettingsController {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

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
