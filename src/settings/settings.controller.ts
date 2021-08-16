import {
  Body,
  CACHE_MANAGER,
  Controller,
  Get,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { ServerInfo } from '../shared/server-info';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

@Controller('config')
export class SettingsController implements OnModuleInit {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private config: ConfigService,
  ) {}

  // @Put('server')
  updateServer(@Body() server: ServerInfo) {
    this.cacheManager.set('server', server, { ttl: 0 });
    return server;
  }

  @Get('server')
  getServer() {
    return this.cacheManager.get('server');
  }

  onModuleInit(): any {
    this.updateServer({
      host: this.config.get('KOALA_HOST'),
      port: this.config.get('KOALA_PORT'),
      user_secret: this.config.get('SECRET_TOKEN'),
    });
  }
}
